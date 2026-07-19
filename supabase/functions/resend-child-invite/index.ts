// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildChildInviteEmail } from "../_shared/child-invite-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * resend-child-invite
 * -------------------
 * Re-sends the GarageFlow-branded password setup email to a child shop account.
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
    if (!authHeader.startsWith("Bearer ")) return json({ error: "NOT_AUTHENTICATED" }, 401);

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes.user) return json({ error: "NOT_AUTHENTICATED" }, 401);
    const caller = userRes.user;

    const { shop_id } = await req.json().catch(() => ({}));
    if (!shop_id) return json({ error: "MISSING_SHOP_ID" }, 400);

    const { data: shop } = await admin
      .from("shops")
      .select("id, user_id, group_owner_id, email, name")
      .eq("id", shop_id)
      .maybeSingle();

    if (!shop) return json({ error: "SHOP_NOT_FOUND" }, 404);
    if (shop.group_owner_id !== caller.id) return json({ error: "NOT_GROUP_OWNER" }, 403);
    if (shop.user_id === caller.id) return json({ error: "CANNOT_RESET_PRIMARY" }, 400);

    const { data: child, error: getErr } = await admin.auth.admin.getUserById(shop.user_id);
    if (getErr || !child?.user?.email) return json({ error: "CHILD_USER_NOT_FOUND" }, 404);

    const childEmail = child.user.email;
    const authEmailMode: "invite" | "recovery" = child.user.email_confirmed_at ? "recovery" : "invite";
    const link = await createPasswordActionLink(admin, childEmail, shop.name ?? "", authEmailMode);

    const emailResult = await sendBrandedPasswordEmail({
      to: childEmail,
      recipientName: shop.name ?? "",
      actionLink: link.actionLink,
    });
    if (!emailResult.ok) {
      return json({ error: "BRANDED_EMAIL_FAILED", detail: emailResult.detail }, 502);
    }

    return json({ ok: true, auth_email: link.mode, email_id: emailResult.emailId }, 200);
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

async function createPasswordActionLink(
  admin: any,
  email: string,
  shopName: string,
  preferred: "invite" | "recovery",
): Promise<{ actionLink: string; mode: "invite" | "recovery" }> {
  if (preferred === "invite") {
    const invite = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo: REDIRECT_URL,
        data: {
          source: "child_shop_invite",
          skip_shop_creation: "true",
          account_type: "garage_child",
          shop_name: shopName,
        },
      },
    });
    if (!invite.error) {
      return { actionLink: String(invite.data?.properties?.action_link ?? ""), mode: "invite" };
    }
    const msg = String(invite.error.message || "").toLowerCase();
    if (!msg.includes("already") && !msg.includes("registered") && !msg.includes("exists")) {
      throw new Error(`INVITE_LINK_FAILED: ${invite.error.message}`);
    }
  }

  const recovery = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: REDIRECT_URL },
  });
  if (recovery.error) throw new Error(`RECOVERY_LINK_FAILED: ${recovery.error.message}`);
  return { actionLink: String(recovery.data?.properties?.action_link ?? ""), mode: "recovery" };
}

async function sendBrandedPasswordEmail(params: {
  to: string;
  recipientName: string;
  actionLink: string;
}): Promise<{ ok: true; emailId?: string } | { ok: false; detail: string }> {
  if (!params.actionLink) return { ok: false, detail: "MISSING_ACTION_LINK" };

  const copy = buildChildInviteEmail({ recipientName: params.recipientName, language: "pt" });
  const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "x-internal-token": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      to: params.to,
      from: "GarageFlow <noreply@garageflow.pt>",
      subject: copy.subject,
      html: copy.html,
      branded: true,
      brand: "garageflow",
      preheader: copy.preheader,
      cta: { label: copy.ctaLabel, url: params.actionLink },
      footerNote: copy.footerNote,
      emailType: "child_shop_invite_resend",
    }),
  });

  const text = await response.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep raw text */ }
  if (!response.ok) {
    return { ok: false, detail: parsed?.error || parsed?.detail || text || `HTTP_${response.status}` };
  }
  return { ok: true, emailId: parsed?.email_id || parsed?.data?.id };
}