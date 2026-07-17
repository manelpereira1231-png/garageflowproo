// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * invite-child-shop
 * ------------------------------------------------------------------
 * Called by an authenticated "Oficina Mãe" (group owner) to create a
 * child shop that has its OWN independent auth account.
 *
 * Flow:
 *  1. Verify caller's JWT and confirm plan allows another shop.
 *  2. Create the child auth account via `inviteUserByEmail` (Supabase
 *     sends the "Set your password" email using the official invite
 *     template — we never generate or store the password).
 *  3. Insert a new shop with `user_id = <new child user>` and
 *     `group_owner_id = <caller>` so the mother keeps management
 *     access while the child owns her own data.
 *  4. Register the child as owner in `shop_users` so RLS/RBAC grants
 *     her the workshop on first login.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URL =
  Deno.env.get("CHILD_SHOP_INVITE_REDIRECT") ??
  "https://www.garageflow.pt/reset-password?realm=erp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "NOT_AUTHENTICATED" }, 401);
    }

    // Client bound to the caller's JWT — respects RLS.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json({ error: "NOT_AUTHENTICATED" }, 401);
    const caller = userRes.user;

    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!name) return json({ error: "MISSING_NAME" }, 400);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      return json({ error: "INVALID_EMAIL" }, 400);
    }

    // Only the real group owner / Oficina Mãe can create child shops.
    // A child account may own its own auth user, but must never create/manage
    // sibling shops or inherit the mother's quota through a direct function call.
    const { data: mother } = await admin
      .from("shops")
      .select("id, country, currency, country_code, timezone, language, vat_rate, labor_rate")
      .eq("group_owner_id", caller.id)
      .eq("user_id", caller.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!mother) {
      return json({ error: "NOT_GROUP_OWNER" }, 403);
    }

    // Plan quota — source of truth lives in the backend RPC and uses the
    // dynamic plan catalogue / max_shops limit for this group.
    const { data: status } = await admin.rpc("get_shop_creation_status", {
      _user_id: caller.id,
    });
    if (!status?.allowed) {
      return json({ error: "SHOP_LIMIT_REACHED", status }, 403);
    }

    // 1) Create the auth account for the child shop.
    //    inviteUserByEmail is idempotent per address on Supabase — if the user
    //    already exists we fall back to generateLink(recovery) to just resend.
    let childUserId: string | null = null;
    const invite = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: REDIRECT_URL,
      data: { source: "child_shop_invite", shop_name: name },
    });
    if (invite.error) {
      // Fallback: user may already exist under another shop — we still allow
      // reusing it as long as the caller wants to attach this new shop to it.
      const msg = String(invite.error.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered")) {
        const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
        childUserId = existing?.users.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
        if (!childUserId) return json({ error: "USER_LOOKUP_FAILED" }, 500);
        // Fire a fresh recovery link so they can (re)define a password.
        await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: REDIRECT_URL },
        });
      } else {
        return json({ error: "INVITE_FAILED", detail: invite.error.message }, 500);
      }
    } else {
      childUserId = invite.data.user?.id ?? null;
    }

    if (!childUserId) return json({ error: "INVITE_FAILED" }, 500);

    // 2) Insert the shop with the child user as owner but the caller as group owner.
    const { data: shop, error: insertErr } = await admin
      .from("shops")
      .insert({
        user_id: childUserId,
        group_owner_id: caller.id,
        name,
        email,
        country: mother?.country ?? "Portugal",
        country_code: mother?.country_code ?? "PT",
        currency: mother?.currency ?? "EUR",
        timezone: mother?.timezone ?? "Europe/Lisbon",
        language: mother?.language ?? "pt",
        vat_rate: mother?.vat_rate ?? 23,
        labor_rate: mother?.labor_rate ?? 35,
      })
      .select("id")
      .single();

    if (insertErr) {
      return json({ error: "SHOP_INSERT_FAILED", detail: insertErr.message }, 500);
    }

    // 3) Register the child as owner in shop_users for RBAC/RLS grants.
    await admin
      .from("shop_users")
      .upsert(
        { shop_id: shop.id, user_id: childUserId, role: "owner" },
        { onConflict: "shop_id,user_id" },
      );

    return json({ ok: true, shop_id: shop.id, user_id: childUserId }, 200);
  } catch (e: any) {
    return json({ error: "UNEXPECTED", detail: String(e?.message ?? e) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
