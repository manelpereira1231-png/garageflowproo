// deno-lint-ignore-file no-explicit-any
import { sendLovableEmail } from "npm:@lovable.dev/email-js@0.1.2";
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
  | { ok: true; provider: "lovable"; emailId?: string; status?: string; response: unknown }
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
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    return { ok: false, provider: "lovable", detail: "LOVABLE_API_KEY_NOT_CONFIGURED", response: null };
  }

  const senderDomain = Deno.env.get("GARAGEFLOW_EMAIL_SENDER_DOMAIN") || "notify.garageflow.pt";
  const fromAddress = Deno.env.get("GARAGEFLOW_EMAIL_FROM") || `GarageFlow <noreply@${senderDomain}>`;

  const html = renderBrandedEmail({
    body: params.bodyHtml,
    preheader: params.preheader,
    cta: params.cta,
    footerNote: params.footerNote,
    brand: "garageflow",
  });

  try {
    const response = await sendLovableEmail(
      {
        to: params.to,
        from: fromAddress,
        sender_domain: senderDomain,
        subject: params.subject,
        html,
        text: htmlToText(params.bodyHtml, params.cta),
        purpose: "transactional",
        idempotency_key: params.idempotencyKey,
        label: params.label,
      },
      { apiKey },
    );

    return {
      ok: true,
      provider: "lovable",
      emailId: response.message_id ?? response.workflow_id,
      status: response.status,
      response,
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