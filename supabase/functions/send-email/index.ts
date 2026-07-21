import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { renderBrandedEmail } from "../_shared/branded-email.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);


const SANDBOX_REDIRECT = "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailAttachment {
  filename: string;
  /** Base64-encoded content of the file. */
  content: string;
  content_type?: string;
}

interface SendEmailRequest {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  /** When true, wrap `html` in the branded GarageFlow shell */
  branded?: boolean;
  brand?: "garageflow" | "market";
  preheader?: string;
  cta?: { label: string; url: string };
  footerNote?: string;
  attachments?: EmailAttachment[];
  /** Public-token auth: allow sending from unauthenticated public quote approval page.
   *  When present, we validate the token matches a decided quote and the recipient(s)
   *  are limited to that quote's client email and the shop's email. */
  quote_token?: string;
  /** Team invite path: authenticated owner/admin of shop_id may invite any recipient. */
  invite?: boolean;
  shop_id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // P4: Prefer a dedicated INTERNAL_EMAIL_TOKEN. Keep SUPABASE_SERVICE_ROLE_KEY as a
    // temporary fallback so in-flight calls keep working during rotation; remove after rollout.
    const authHeader = req.headers.get("Authorization") || "";
    const internalToken = req.headers.get("x-internal-token") || "";
    const dedicatedInternal = Deno.env.get("INTERNAL_EMAIL_TOKEN") || "";
    const serviceSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    let isInternal = false;
    let callerUser: { id: string; email: string | null } | null = null;
    if (
      internalToken &&
      ((dedicatedInternal && internalToken === dedicatedInternal) ||
       (serviceSecret && internalToken === serviceSecret))
    ) {
      isInternal = true;
    } else if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user) {
        callerUser = { id: data.user.id, email: data.user.email ?? null };
      }
    }
    // Note: unauthorized check is deferred until after we parse the body, so we can
    // also accept a public quote_token for the unauthenticated approval page.


    const body = await req.json() as SendEmailRequest;
    const { to, subject, html, from, branded, brand, preheader, cta, footerNote, attachments, quote_token, invite, shop_id } = body;

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Public token auth: unauthenticated quote-approval page sends via a signed quote token.
    // We only allow sending to the quote's client email or the shop email, and only for
    // quotes whose client has already decided (approved / rejected / converted).
    if (!isInternal && !callerUser && quote_token && typeof quote_token === "string" && quote_token.length >= 8) {
      const { data: q } = await admin
        .from("quotes")
        .select("id, status, client_id, shop_id")
        .eq("token", quote_token)
        .maybeSingle();
      if (q && ["approved", "rejected", "converted"].includes(String(q.status))) {
        const [{ data: client }, { data: shop }] = await Promise.all([
          admin.from("clients").select("email").eq("id", q.client_id).maybeSingle(),
          admin.from("shops").select("email").eq("id", q.shop_id).maybeSingle(),
        ]);
        const allowed = new Set<string>();
        const ce = String((client as any)?.email ?? "").toLowerCase().trim();
        const se = String((shop as any)?.email ?? "").toLowerCase().trim();
        if (ce) allowed.add(ce);
        if (se) allowed.add(se);
        const recipients = (Array.isArray(to) ? to : [to])
          .map((e) => String(e).toLowerCase().trim())
          .filter(Boolean);
        const blocked = recipients.filter((r) => !allowed.has(r));
        if (recipients.length > 0 && recipients.length <= 5 && blocked.length === 0) {
          isInternal = true; // treat as authorized send from this point
        }
      }
    }

    if (!isInternal && !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // For user-JWT callers, restrict recipients to: caller's own email, shop members,
    // or clients of shops the caller belongs to. This prevents the function being abused
    // as an open relay for phishing.
    if (!isInternal && callerUser) {
      // Team invite bypass: owner/admin of shop_id may invite arbitrary recipients.
      if (invite && shop_id && typeof shop_id === "string") {
        const [{ data: ownedShop }, { data: membership }] = await Promise.all([
          admin.from("shops").select("id").eq("id", shop_id).eq("user_id", callerUser.id).maybeSingle(),
          admin.from("shop_users").select("role").eq("shop_id", shop_id).eq("user_id", callerUser.id).maybeSingle(),
        ]);
        const role = (membership as any)?.role;
        if (ownedShop || role === "owner" || role === "admin" || role === "manager") {
          const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
          if (recipients.length >= 1 && recipients.length <= 5) {
            isInternal = true; // authorize this send
          }
        }
      }
    }
    if (!isInternal && callerUser) {
      const recipients = (Array.isArray(to) ? to : [to])
        .map((e) => String(e).toLowerCase().trim())
        .filter(Boolean);
      if (recipients.length === 0 || recipients.length > 20) {
        return new Response(JSON.stringify({ error: "Invalid recipients" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }

      // Allow caller's own email always.
      const ownEmail = (callerUser.email ?? "").toLowerCase();
      const allowed = new Set<string>();
      if (ownEmail) allowed.add(ownEmail);


      // P5: if the caller supplies a shop_id, verify membership and restrict the
      // allowlist to THAT shop's clients/owner email — not the union of every shop the
      // user belongs to. Falls back to the multi-shop union only when no shop_id is provided
      // (preserves backward compatibility for legacy callers).
      let scopedShopIds: string[] = [];
      if (shop_id && typeof shop_id === "string") {
        const [{ data: ownedOne }, { data: memberOne }] = await Promise.all([
          admin.from("shops").select("id").eq("id", shop_id).eq("user_id", callerUser.id).maybeSingle(),
          admin.from("shop_users").select("shop_id").eq("shop_id", shop_id).eq("user_id", callerUser.id).maybeSingle(),
        ]);
        if (ownedOne || memberOne) {
          scopedShopIds = [shop_id];
        } else {
          return new Response(JSON.stringify({ error: "Recipient not permitted" }),
            { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
        }
      } else {
        const [{ data: ownedShops }, { data: memberShops }] = await Promise.all([
          admin.from("shops").select("id").eq("user_id", callerUser.id),
          admin.from("shop_users").select("shop_id").eq("user_id", callerUser.id),
        ]);
        scopedShopIds = [
          ...((ownedShops ?? []).map((r: any) => r.id)),
          ...((memberShops ?? []).map((r: any) => r.shop_id)),
        ];
      }

      if (scopedShopIds.length > 0) {
        const { data: clientRows } = await admin
          .from("clients").select("email").in("shop_id", scopedShopIds);
        for (const c of clientRows ?? []) {
          const e = String((c as any).email ?? "").toLowerCase().trim();
          if (e) allowed.add(e);
        }
        const { data: ownerShops } = await admin
          .from("shops").select("email").in("id", scopedShopIds);
        for (const s of ownerShops ?? []) {
          const e = String((s as any).email ?? "").toLowerCase().trim();
          if (e) allowed.add(e);
        }
      }

      const blocked = recipients.filter((r) => !allowed.has(r));
      if (blocked.length > 0) {
        return new Response(JSON.stringify({ error: "Recipient not permitted" }),
          { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } });
      }
    }

    const finalHtml = branded
      ? renderBrandedEmail({ body: html, preheader, cta, footerNote, brand: brand || "garageflow" })
      : html;

    const originalTo = Array.isArray(to) ? to : [to];
    const useSandbox = !!SANDBOX_REDIRECT;
    const finalTo = useSandbox ? [SANDBOX_REDIRECT] : originalTo;
    const finalSubject = useSandbox ? `[Para: ${originalTo.join(", ")}] ${subject}` : subject;
    const fallbackFrom = "GarageFlow <onboarding@resend.dev>";
    const finalFrom = useSandbox
      ? "GarageFlow <onboarding@resend.dev>"
      : (from || (brand === "market" ? "GarageFlow Market <market@garageflow.pt>" : "GarageFlow <noreply@garageflow.pt>"));
    const emailType = String((body as any).emailType ?? "");

    // Inject open-pixel + rewrite links for click tracking.
    const emailIdEarly = crypto.randomUUID();
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const pixelUrl = `${supaUrl}/functions/v1/email-open-pixel?id=${emailIdEarly}`;
    const clickBase = `${supaUrl}/functions/v1/email-click-redirect`;
    let trackedHtml = finalHtml.replace(
      /<a\s+([^>]*?)href=["']((?:https?:)\/\/[^"']+)["']([^>]*)>/gi,
      (m, pre, href, post) => {
        try {
          const target = new URL(href);
          const host = target.hostname.toLowerCase();
          // Auth action links must stay untouched. Rewriting them through the
          // click tracker can invalidate/strip the recovery/invite flow or hit
          // the tracker allow-list instead of the auth endpoint.
          if (host.endsWith(".supabase.co") || target.pathname.includes("/auth/v1/verify")) {
            return m;
          }
        } catch (_e) {
          return m;
        }
        return `<a ${pre}href="${clickBase}?id=${emailIdEarly}&url=${encodeURIComponent(href)}"${post}>`;
      },
    );
    if (!/<\/body>/i.test(trackedHtml)) {
      trackedHtml = trackedHtml + `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
    } else {
      trackedHtml = trackedHtml.replace(
        /<\/body>/i,
        `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" /></body>`,
      );
    }


    if (!Deno.env.get("RESEND_API_KEY")) {
      console.error("Email send blocked: RESEND_API_KEY is not configured.");
      return new Response(JSON.stringify({ error: "EMAIL_PROVIDER_NOT_CONFIGURED" }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    console.log(`Sending email | to: ${finalTo.join(",")} | from: ${finalFrom} | branded: ${!!branded} | type: ${emailType || "generic"} | subject: ${finalSubject} | attachments: ${attachments?.length ?? 0}`);

    const resendPayload: any = {
      from: finalFrom,
      to: finalTo,
      subject: finalSubject,
      html: trackedHtml,
    };
    if (Array.isArray(attachments) && attachments.length > 0) {
      resendPayload.attachments = attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        content_type: a.content_type || "application/pdf",
      }));
    }
    let { data, error } = await resend.emails.send(resendPayload);

    // Convites de equipa não devem falhar só porque o domínio de envio ainda
    // não está verificado. Mantemos o envio funcional usando o remetente seguro
    // do Resend apenas neste fluxo operacional.
    const resendMessage = String((error as any)?.message || "");
    if (invite && !emailType.startsWith("child_shop_invite") && error && resendMessage.toLowerCase().includes("domain is not verified")) {
      console.warn("Team invite sender domain not verified; retrying with fallback sender.");
      const retry = await resend.emails.send({ ...resendPayload, from: fallbackFrom });
      data = retry.data;
      error = retry.error;
    }

    const emailId = (data as any)?.id || emailIdEarly;

    if (error) {
      console.error("Resend error:", JSON.stringify({ error, from: finalFrom, to: finalTo, type: emailType || null }));
      // Observability: log failure (silent fail).
      try {
        const { error: logError } = await admin.from("email_events").insert({
          email_id: emailId, email_type: emailType || null,
          recipient: Array.isArray(originalTo) ? originalTo.join(",") : String(originalTo),
          event_type: "failed", details: { error: error.message, from: finalFrom, provider: "resend" },
        });
        if (logError) console.error("Email event failed-log insert failed:", JSON.stringify(logError));
      } catch (logException: any) {
        console.error("Email event failed-log insert exception:", String(logException?.message ?? logException));
      }
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    console.log(`Email accepted by provider | id: ${emailId} | from: ${finalFrom} | to: ${finalTo.join(",")} | type: ${emailType || "generic"}`);

    // Observability: log successful send.
    try {
      const { error: logError } = await admin.from("email_events").insert({
        email_id: emailId, email_type: emailType || null,
        recipient: Array.isArray(originalTo) ? originalTo.join(",") : String(originalTo),
        event_type: "sent", details: { subject: finalSubject, branded: !!branded, from: finalFrom, provider: "resend" },
      });
      if (logError) console.error("Email event sent-log insert failed:", JSON.stringify(logError));
    } catch (logException: any) {
      console.error("Email event sent-log insert exception:", String(logException?.message ?? logException));
    }

    return new Response(JSON.stringify({ success: true, data, email_id: emailId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
