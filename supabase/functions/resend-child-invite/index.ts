// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildChildInviteEmail } from "../_shared/child-invite-email.ts";
import { sendGarageFlowPlatformEmail } from "../_shared/lovable-transactional-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URL =
  Deno.env.get("CHILD_SHOP_INVITE_REDIRECT") ??
  "https://garageflow-pt.lovable.app/reset-password?realm=erp";

Deno.serve(async (req) => {
  const debugId = crypto.randomUUID();
  const audit = (step: string, details: Record<string, unknown> = {}) => {
    console.log(`[child-invite:${debugId}] ${step} ${JSON.stringify(details)}`);
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  audit("resend_function_entered", { method: req.method, redirectTo: REDIRECT_URL });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      audit("auth_failed", { reason: "missing_bearer" });
      return json({ error: "NOT_AUTHENTICATED", debug_id: debugId }, 401);
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) {
      audit("auth_failed", { reason: userErr?.message ?? "no_user" });
      return json({ error: "NOT_AUTHENTICATED", debug_id: debugId }, 401);
    }
    const caller = userRes.user;
    audit("caller_resolved", { callerId: caller.id, callerEmail: caller.email ?? null });

    const { shop_id } = await req.json().catch((error) => {
      audit("body_parse_failed", { message: String(error?.message ?? error) });
      return {};
    });
    audit("request_body_received", { shop_id: shop_id ?? null });
    if (!shop_id) return json({ error: "MISSING_SHOP_ID", debug_id: debugId }, 400);

    const { data: shop, error: shopErr } = await admin
      .from("shops")
      .select("id, user_id, group_owner_id, email, name, language, country_code")
      .eq("id", shop_id)
      .maybeSingle();

    audit("child_shop_lookup", { found: !!shop, shopId: shop?.id ?? null, error: shopErr?.message ?? null });
    if (!shop) return json({ error: "SHOP_NOT_FOUND", debug_id: debugId }, 404);
    if (shop.group_owner_id !== caller.id) return json({ error: "NOT_GROUP_OWNER", debug_id: debugId }, 403);
    if (shop.user_id === caller.id) return json({ error: "CANNOT_RESET_PRIMARY", debug_id: debugId }, 400);

    const { data: child, error: getErr } = await admin.auth.admin.getUserById(shop.user_id);
    audit("child_auth_user_lookup", {
      exists: !!child?.user,
      userId: child?.user?.id ?? shop.user_id,
      email: child?.user?.email ?? null,
      emailConfirmedAt: child?.user?.email_confirmed_at ?? null,
      error: getErr?.message ?? null,
    });
    if (getErr || !child?.user?.email) return json({ error: "CHILD_USER_NOT_FOUND", debug_id: debugId }, 404);

    const childEmail = child.user.email;
    const authEmailMode: "invite" | "recovery" = child.user.email_confirmed_at ? "recovery" : "invite";
    const link = await createPasswordActionLink(admin, childEmail, shop.name ?? "", authEmailMode, audit);
    audit("password_action_link_resolved", { mode: link.mode, hasActionLink: !!link.actionLink });

    const emailResult = await sendBrandedPasswordEmail({
      to: childEmail,
      recipientName: shop.name ?? "",
      language: "pt",
      actionLink: link.actionLink,
      debugId,
      audit,
    });

    if (!emailResult.ok) {
      return json({
        error: "EMAIL_DELIVERY_FAILED",
        detail: emailResult.detail,
        debug_id: debugId,
      }, 502);
    }

    const provider = emailResult.provider;
    audit("resend_function_success", { provider, branded: emailResult });
    return json({
      ok: true,
      auth_email: link.mode,
      email_id: emailResult.ok ? emailResult.emailId : undefined,
      email_provider: provider,
      debug_id: debugId,
    }, 200);
  } catch (e: any) {
    audit("resend_function_unexpected_error", { message: String(e?.message ?? e), stack: String(e?.stack ?? "") });
    return json({ error: "UNEXPECTED", detail: String(e?.message ?? e), debug_id: debugId }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveInviteLanguage(language?: string | null, countryCode?: string | null): string {
  const normalized = String(language || "").toLowerCase();
  if (countryCode === "PT" || normalized === "pt" || normalized === "pt-pt") return "pt";
  if (normalized === "pt-br") return "pt";
  if (["es", "fr", "en"].includes(normalized)) return normalized;
  return "pt";
}

async function createPasswordActionLink(
  admin: any,
  email: string,
  shopName: string,
  preferred: "invite" | "recovery",
  audit: (step: string, details?: Record<string, unknown>) => void,
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
    audit("generateLink_invite_result", {
      ok: !invite.error,
      status: (invite.error as any)?.status ?? null,
      message: invite.error?.message ?? null,
      userId: invite.data?.user?.id ?? null,
      hasActionLink: !!invite.data?.properties?.action_link,
    });
    if (!invite.error) {
      return {
        actionLink: buildPasswordActivationUrl(
          String(invite.data?.properties?.hashed_token ?? ""),
          "invite",
          email,
          String(invite.data?.properties?.action_link ?? ""),
        ),
        mode: "invite",
      };
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
  audit("generateLink_recovery_result", {
    ok: !recovery.error,
    status: (recovery.error as any)?.status ?? null,
    message: recovery.error?.message ?? null,
    hasActionLink: !!recovery.data?.properties?.action_link,
  });
  if (recovery.error) throw new Error(`RECOVERY_LINK_FAILED: ${recovery.error.message}`);
  return {
    actionLink: buildPasswordActivationUrl(
      String(recovery.data?.properties?.hashed_token ?? ""),
      "recovery",
      email,
      String(recovery.data?.properties?.action_link ?? ""),
    ),
    mode: "recovery",
  };
}

function buildPasswordActivationUrl(tokenHash: string, type: "invite" | "recovery", email: string, fallbackActionLink: string): string {
  if (!tokenHash) return fallbackActionLink;
  const url = new URL(REDIRECT_URL);
  url.searchParams.set("realm", "erp");
  url.searchParams.set("type", type);
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("email", email);
  return url.toString();
}

async function sendBrandedPasswordEmail(params: {
  to: string;
  recipientName: string;
  language?: string | null;
  actionLink: string;
  debugId: string;
  audit: (step: string, details?: Record<string, unknown>) => void;
}): Promise<
  | { ok: true; provider: "lovable" | "resend"; emailId?: string; status: number; response: unknown; deliveryState: "accepted" | "delivered" }
  | { ok: false; detail: string; status: number; response: unknown; deliveryState: "failed" }
> {
  if (!params.actionLink) return { ok: false, detail: "MISSING_ACTION_LINK", status: 0, response: null, deliveryState: "failed" };

  const copy = buildChildInviteEmail({ recipientName: params.recipientName, language: params.language });
  params.audit("platform_send_start", {
    provider: "lovable",
    email: params.to,
    from: "GarageFlow <no-reply@auth.lovable.cloud>",
    subject: copy.subject,
  });

  const platform = await sendGarageFlowPlatformEmail({
    to: params.to,
    subject: copy.subject,
    bodyHtml: copy.html,
    preheader: copy.preheader,
    cta: { label: copy.ctaLabel, url: params.actionLink },
    footerNote: copy.footerNote,
    idempotencyKey: `child-shop-resend-${params.debugId}`,
    label: "child_shop_invite_resend",
  });

  params.audit("platform_send_result", platform);

  if (platform.ok) {
    return {
      ok: true,
      emailId: platform.emailId,
      status: 200,
      provider: platform.provider,
      response: platform.response,
      deliveryState: "accepted",
    };
  }

  params.audit("resend_fallback_send_start", {
    provider: "resend",
    email: params.to,
    from: "GarageFlow <noreply@garageflow.pt>",
    subject: copy.subject,
    platformDetail: platform.detail,
  });

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
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  params.audit("branded_send_result", {
    ok: response.ok,
    status: response.status,
    providerStatus: response.ok ? "accepted" : "failed",
    response: parsed,
  });

  if (!response.ok) {
    return {
      ok: false,
      detail: `platform=${platform.detail}; resend=${parsed?.error || parsed?.detail || text || `HTTP_${response.status}`}`,
      status: response.status,
      response: parsed,
      deliveryState: "failed",
    };
  }
  return {
    ok: true,
    emailId: parsed?.email_id || parsed?.data?.id,
    status: response.status,
    provider: "resend",
    response: parsed,
    deliveryState: "accepted",
  };
}