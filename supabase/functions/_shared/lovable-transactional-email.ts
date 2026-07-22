// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { renderBrandedEmail } from "./branded-email.ts";

async function ensureUnsubscribeToken(email: string): Promise<string | undefined> {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return undefined;
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const normalized = email.toLowerCase().trim();
    const { data: existing } = await supabase
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", normalized)
      .maybeSingle();
    if (existing?.token) return existing.token as string;
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const { data: inserted, error } = await supabase
      .from("email_unsubscribe_tokens")
      .insert({ email: normalized, token })
      .select("token")
      .maybeSingle();
    if (error) {
      const { data: retry } = await supabase
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", normalized)
        .maybeSingle();
      return retry?.token as string | undefined;
    }
    return inserted?.token as string | undefined;
  } catch (_e) {
    return undefined;
  }
}

type PlatformEmailResult =
  | { ok: true; provider: "lovable_queue"; emailId: string; status: "queued"; response: unknown }
  | { ok: false; provider: "lovable"; detail: string; response: unknown };

function htmlToText(html: string, cta?: { label: string; url: string }) {
  const cleaned = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cta?.url ? `${cleaned}\n\n${cta.label}: ${cta.url}` : cleaned;
}

export async function sendGarageFlowPlatformEmail(params: {
  to: string;
  subject: string;
  bodyHtml: string;
  preheader?: string;
  cta?: { label: string; url: string };
  footerNote?: string;
  idempotencyKey: string;
  label: string;
}): Promise<PlatformEmailResult> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return { ok: false, provider: "lovable", detail: "EMAIL_QUEUE_NOT_CONFIGURED", response: null };

  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const senderDomain = Deno.env.get("GARAGEFLOW_EMAIL_SENDER_DOMAIN") || "notify.garageflow.pt";
  const fromAddress = Deno.env.get("GARAGEFLOW_EMAIL_FROM") || `GarageFlow <noreply@${senderDomain}>`;

  const html = renderBrandedEmail({
    body: params.bodyHtml,
    preheader: params.preheader,
    cta: params.cta,
    footerNote: params.footerNote,
    brand: "garageflow",
  });

  const unsubscribeToken = await ensureUnsubscribeToken(params.to);
  const messageId = params.idempotencyKey || crypto.randomUUID();

  const { data: suppressed, error: suppressionError } = await supabase
    .from("suppressed_emails")
    .select("reason")
    .eq("email", params.to.toLowerCase().trim())
    .maybeSingle();

  if (suppressionError) {
    return { ok: false, provider: "lovable", detail: `SUPPRESSION_CHECK_FAILED: ${suppressionError.message}`, response: suppressionError };
  }

  if (suppressed?.reason) {
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: params.label,
      recipient_email: params.to,
      status: "suppressed",
      error_message: String(suppressed.reason),
      metadata: { idempotency_key: params.idempotencyKey },
    });
    return { ok: false, provider: "lovable", detail: "RECIPIENT_SUPPRESSED", response: suppressed };
  }

  const payload = {
    message_id: messageId,
    to: params.to,
    from: fromAddress,
    sender_domain: senderDomain,
    subject: params.subject,
    html,
    text: htmlToText(params.bodyHtml, params.cta),
    purpose: "transactional",
    label: params.label,
    idempotency_key: params.idempotencyKey,
    unsubscribe_token: unsubscribeToken,
    queued_at: new Date().toISOString(),
  };

  try {
    const { error: logError } = await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: params.label,
      recipient_email: params.to,
      status: "pending",
      metadata: { idempotency_key: params.idempotencyKey, sender_domain: senderDomain },
    });
    if (logError) throw new Error(`EMAIL_LOG_PENDING_FAILED: ${logError.message}`);

    const { data: queueId, error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload,
    });
    if (enqueueError) throw new Error(`EMAIL_QUEUE_FAILED: ${enqueueError.message}`);

    return {
      ok: true,
      provider: "lovable_queue",
      emailId: messageId,
      status: "queued",
      response: { queue_id: queueId, message_id: messageId },
    };
  } catch (error: any) {
    return {
      ok: false,
      provider: "lovable",
      detail: String(error?.message ?? error),
      response: {
        name: error?.name ?? null,
        status: error?.status ?? null,
        code: error?.code ?? null,
      },
    };
  }
}