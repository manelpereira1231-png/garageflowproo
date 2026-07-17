// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildChildInviteEmail } from "../_shared/child-invite-email.ts";

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
 * Emails are dispatched via the branded GarageFlow sender (`send-email`
 * -> Resend), never via Supabase's default auth mailer. The Supabase
 * action link is minted with `generateLink` (which does NOT send an
 * email on its own) and embedded as the CTA in our branded template.
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const INTERNAL_TOKEN = Deno.env.get("INTERNAL_EMAIL_TOKEN") || SERVICE_ROLE_KEY;

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

    const { data: status } = await admin.rpc("get_shop_creation_status", {
      _user_id: caller.id,
    });
    if (!status?.allowed) {
      return json({ error: "SHOP_LIMIT_REACHED", status }, 403);
    }

    // 1) Mint the Supabase action link WITHOUT sending Supabase's default email.
    //    generateLink({type:'invite'}) creates the user if it doesn't exist and
    //    returns `action_link`; it does not itself dispatch an email.
    let childUserId: string | null = null;
    let actionLink: string | null = null;

    const invite = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: REDIRECT_URL,
        data: { source: "child_shop_invite", shop_name: name },
      },
    });

    if (!invite.error && invite.data) {
      childUserId = invite.data.user?.id ?? null;
      actionLink = (invite.data.properties as any)?.action_link ?? null;
    } else {
      const msg = String(invite.error?.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // User already exists — fall back to recovery flow so they can (re)set a password.
        const { data: existing } = await admin.auth.admin.listUsers({ perPage: 200 });
        childUserId =
          existing?.users.find((u) => (u.email ?? "").toLowerCase() === email)?.id ?? null;
        if (!childUserId) return json({ error: "USER_LOOKUP_FAILED" }, 500);

        const rec = await admin.auth.admin.generateLink({
          type: "recovery",
          email,
          options: { redirectTo: REDIRECT_URL },
        });
        if (rec.error || !rec.data) {
          return json({ error: "LINK_FAILED", detail: rec.error?.message }, 500);
        }
        actionLink = (rec.data.properties as any)?.action_link ?? null;
      } else {
        return json({ error: "INVITE_FAILED", detail: invite.error?.message }, 500);
      }
    }

    if (!childUserId || !actionLink) return json({ error: "INVITE_FAILED" }, 500);

    // 2) Insert the shop.
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

    // 3) Register as owner in shop_users.
    await admin
      .from("shop_users")
      .upsert(
        { shop_id: shop.id, user_id: childUserId, role: "owner" },
        { onConflict: "shop_id,user_id" },
      );

    // 4) Send the branded GarageFlow email (same infra used for client emails).
    const mail = buildChildInviteEmail({
      recipientName: name,
      language: mother?.language ?? "pt",
    });
    try {
      const emailResp = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-token": INTERNAL_TOKEN,
        },
        body: JSON.stringify({
          to: email,
          subject: mail.subject,
          html: mail.html,
          branded: true,
          brand: "garageflow",
          preheader: mail.preheader,
          cta: { label: mail.ctaLabel, url: actionLink },
          footerNote: mail.footerNote,
        }),
      });
      if (!emailResp.ok) {
        const detail = await emailResp.text().catch(() => "");
        console.error("[invite-child-shop] send-email returned non-2xx", emailResp.status, detail);
        return json({ error: "EMAIL_SEND_FAILED", detail }, 502);
      }
    } catch (e) {
      console.error("[invite-child-shop] send-email failed", e);
      return json({ error: "EMAIL_SEND_FAILED", detail: String((e as any)?.message ?? e) }, 502);
    }

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
