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

  audit("function_entered", { method: req.method, redirectTo: REDIRECT_URL });

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

    const body = await req.json().catch((error) => {
      audit("body_parse_failed", { message: String(error?.message ?? error) });
      return {};
    });
    const name = String(body?.name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    audit("request_body_received", { email, hasName: !!name });

    if (!name) return json({ error: "MISSING_NAME", debug_id: debugId }, 400);
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      audit("validation_failed", { email, reason: "invalid_email" });
      return json({ error: "INVALID_EMAIL", debug_id: debugId }, 400);
    }

    const { data: mother, error: motherErr } = await admin
      .from("shops")
      .select("id, country, currency, country_code, timezone, language, vat_rate, labor_rate")
      .eq("group_owner_id", caller.id)
      .eq("user_id", caller.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    audit("mother_shop_lookup", { found: !!mother, shopId: mother?.id ?? null, error: motherErr?.message ?? null });
    if (!mother) return json({ error: "NOT_GROUP_OWNER", debug_id: debugId }, 403);

    const { data: status, error: statusErr } = await admin.rpc("get_shop_creation_status", {
      _user_id: caller.id,
    });
    audit("shop_limit_checked", { status, error: statusErr?.message ?? null });
    if (!status?.allowed) {
      return json({ error: "SHOP_LIMIT_REACHED", status, debug_id: debugId }, 403);
    }

    const link = await createPasswordActionLink(admin, email, name, "invite", audit);
    let childUserId = link.userId;
    const authEmailMode: "invite" | "recovery" = link.mode;

    audit("password_action_link_resolved", {
      mode: link.mode,
      hasUserId: !!childUserId,
      hasActionLink: !!link.actionLink,
    });

    if (!childUserId) return json({ error: "INVITE_FAILED", debug_id: debugId }, 500);

    const metadataResult = await admin.auth.admin.updateUserById(childUserId, {
      user_metadata: {
        source: "child_shop_invite",
        skip_shop_creation: "true",
        account_type: "garage_child",
        shop_name: name,
      },
    });
    audit("child_user_metadata_updated", {
      userId: childUserId,
      ok: !metadataResult.error,
      status: (metadataResult.error as any)?.status ?? null,
      message: metadataResult.error?.message ?? null,
      emailConfirmedAt: metadataResult.data?.user?.email_confirmed_at ?? null,
    });

    const { data: authUser, error: authUserErr } = await admin.auth.admin.getUserById(childUserId);
    audit("child_auth_user_confirmed", {
      exists: !!authUser?.user,
      userId: authUser?.user?.id ?? childUserId,
      email: authUser?.user?.email ?? email,
      emailConfirmedAt: authUser?.user?.email_confirmed_at ?? null,
      lastSignInAt: authUser?.user?.last_sign_in_at ?? null,
      error: authUserErr?.message ?? null,
    });

    const { data: existingChildShops, error: existingErr } = await admin
      .from("shops")
      .select("id, user_id, group_owner_id")
      .eq("user_id", childUserId);

    audit("existing_child_shop_lookup", {
      count: existingChildShops?.length ?? 0,
      error: existingErr?.message ?? null,
    });

    const existingInThisGroup = (existingChildShops ?? []).find((s: any) => s.group_owner_id === caller.id && s.user_id !== caller.id);
    const ownsIndependentWorkshop = (existingChildShops ?? []).some((s: any) => s.group_owner_id === childUserId);
    const belongsToOtherGroup = (existingChildShops ?? []).some((s: any) => s.group_owner_id !== caller.id && s.group_owner_id !== childUserId);

    if (ownsIndependentWorkshop || belongsToOtherGroup) {
      audit("child_shop_conflict", { ownsIndependentWorkshop, belongsToOtherGroup });
      return json({ error: "EMAIL_ALREADY_HAS_WORKSHOP", debug_id: debugId }, 409);
    }

    let shopId = existingInThisGroup?.id ?? null;
    if (!shopId) {
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

      audit("child_shop_insert_result", { ok: !insertErr, shopId: shop?.id ?? null, error: insertErr?.message ?? null });
      if (insertErr) {
        return json({ error: "SHOP_INSERT_FAILED", detail: insertErr.message, debug_id: debugId }, 500);
      }
      shopId = shop.id;

      const membership = await admin
        .from("shop_users")
        .upsert(
          { shop_id: shopId, user_id: childUserId, role: "owner" },
          { onConflict: "shop_id,user_id" },
        );
      audit("child_shop_membership_upserted", { ok: !membership.error, shopId, userId: childUserId, error: membership.error?.message ?? null });
    } else {
      audit("child_shop_reused", { shopId });
    }

    const emailResult = await sendBrandedPasswordEmail({
      to: email,
      recipientName: name,
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
    audit("function_success", {
      shopId,
      childUserId,
      provider,
      branded: emailResult,
    });

    return json({
      ok: true,
      shop_id: shopId,
      user_id: childUserId,
      auth_email: authEmailMode,
      email_id: emailResult.ok ? emailResult.emailId : undefined,
      email_provider: provider,
      debug_id: debugId,
      delivery_note: "Email GarageFlow em Português enviado com link para definir palavra-passe.",
    }, 200);
  } catch (e: any) {
    audit("function_unexpected_error", { message: String(e?.message ?? e), stack: String(e?.stack ?? "") });
    return json({ error: "UNEXPECTED", detail: String(e?.message ?? e), debug_id: debugId }, 500);
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

async function createPasswordActionLink(
  admin: any,
  email: string,
  shopName: string,
  preferred: "invite" | "recovery",
  audit: (step: string, details?: Record<string, unknown>) => void,
): Promise<{ userId: string | null; actionLink: string; mode: "invite" | "recovery" }> {
  const options = {
    redirectTo: REDIRECT_URL,
    data: {
      source: "child_shop_invite",
      skip_shop_creation: "true",
      account_type: "garage_child",
      shop_name: shopName,
    },
  };

  const invite = preferred === "invite"
    ? await admin.auth.admin.generateLink({ type: "invite", email, options })
    : null;

  if (invite) {
    audit("generateLink_invite_result", {
      ok: !invite.error,
      status: (invite.error as any)?.status ?? null,
      message: invite.error?.message ?? null,
      userId: invite.data?.user?.id ?? null,
      hasActionLink: !!invite.data?.properties?.action_link,
    });
  }

  if (invite && !invite.error) {
    const actionLink = buildPasswordActivationUrl(
      String(invite.data?.properties?.hashed_token ?? ""),
      "invite",
      email,
      String(invite.data?.properties?.action_link ?? ""),
    );
    return { userId: invite.data?.user?.id ?? null, actionLink, mode: "invite" };
  }

  const inviteMsg = String(invite?.error?.message || "").toLowerCase();
  if (invite && !inviteMsg.includes("already") && !inviteMsg.includes("registered") && !inviteMsg.includes("exists")) {
    throw new Error(`INVITE_LINK_FAILED: ${invite.error?.message}`);
  }

  const userId = await findUserIdByEmail(admin, email);
  audit("existing_user_lookup_for_recovery", { found: !!userId, email });
  if (!userId) throw new Error("USER_LOOKUP_FAILED");

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
    userId,
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

function resolveInviteLanguage(language?: string | null, countryCode?: string | null): string {
  const normalized = String(language || "").toLowerCase();
  if (countryCode === "PT" || normalized === "pt" || normalized === "pt-pt") return "pt";
  if (normalized === "pt-br") return "pt";
  if (["es", "fr", "en"].includes(normalized)) return normalized;
  return "pt";
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
    idempotencyKey: `child-shop-invite-${params.debugId}`,
    label: "child_shop_invite",
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
      emailType: "child_shop_invite",
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