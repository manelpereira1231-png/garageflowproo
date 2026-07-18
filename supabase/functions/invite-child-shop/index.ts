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
 * Called by an authenticated Oficina Mãe to create a child shop with an
 * independent auth account. The password setup email is delivery-critical,
 * so it uses the platform auth mailer instead of the app-email sender domain.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URL =
  Deno.env.get("CHILD_SHOP_INVITE_REDIRECT") ??
  "https://garageflow-pt.lovable.app/reset-password?realm=erp";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "NOT_AUTHENTICATED" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const publicAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

    const { data: mother } = await admin
      .from("shops")
      .select("id, country, currency, country_code, timezone, language, vat_rate, labor_rate")
      .eq("group_owner_id", caller.id)
      .eq("user_id", caller.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!mother) return json({ error: "NOT_GROUP_OWNER" }, 403);

    const { data: status } = await admin.rpc("get_shop_creation_status", {
      _user_id: caller.id,
    });
    if (!status?.allowed) {
      return json({ error: "SHOP_LIMIT_REACHED", status }, 403);
    }

    let childUserId: string | null = null;
    let authEmailMode: "invite" | "recovery" = "invite";

    const invite = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: REDIRECT_URL,
      data: { source: "child_shop_invite", shop_name: name },
    });

    if (!invite.error && invite.data?.user) {
      childUserId = invite.data.user.id;
    } else {
      const msg = String(invite.error?.message || "").toLowerCase();
      if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
        return json({ error: "INVITE_EMAIL_FAILED", detail: invite.error?.message }, 500);
      }

      childUserId = await findUserIdByEmail(admin, email);
      if (!childUserId) return json({ error: "USER_LOOKUP_FAILED" }, 500);

      authEmailMode = "recovery";
      const reset = await publicAuth.auth.resetPasswordForEmail(email, {
        redirectTo: REDIRECT_URL,
      });
      if (reset.error) {
        return json({ error: "PASSWORD_EMAIL_FAILED", detail: reset.error.message }, 500);
      }
    }

    if (!childUserId) return json({ error: "INVITE_FAILED" }, 500);

    await admin.auth.admin.updateUserById(childUserId, {
      user_metadata: { source: "child_shop_invite", shop_name: name },
    }).catch(() => null);

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

    await admin
      .from("shop_users")
      .upsert(
        { shop_id: shop.id, user_id: childUserId, role: "owner" },
        { onConflict: "shop_id,user_id" },
      );

    return json({ ok: true, shop_id: shop.id, user_id: childUserId, auth_email: authEmailMode }, 200);
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

async function findUserIdByEmail(admin: any, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const match = data?.users?.find((u: any) => String(u.email ?? "").toLowerCase() === email);
    if (match?.id) return match.id;
    if (!data?.users || data.users.length < 1000) break;
  }
  return null;
}