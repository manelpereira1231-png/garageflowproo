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
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as SendEmailRequest;
    const { to, subject, html, from, branded, brand, preheader, cta, footerNote } = body;

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const finalHtml = branded
      ? renderBrandedEmail({ body: html, preheader, cta, footerNote, brand: brand || "garageflow" })
      : html;

    const originalTo = Array.isArray(to) ? to : [to];
    const useSandbox = !!SANDBOX_REDIRECT;
    const finalTo = useSandbox ? [SANDBOX_REDIRECT] : originalTo;
    const finalSubject = useSandbox ? `[Para: ${originalTo.join(", ")}] ${subject}` : subject;
    const finalFrom = useSandbox
      ? "GarageFlow <onboarding@resend.dev>"
      : (from || (brand === "market" ? "GarageFlow Market <market@garageflow.pt>" : "GarageFlow <noreply@garageflow.pt>"));

    // Inject open-pixel + rewrite links for click tracking.
    const emailIdEarly = crypto.randomUUID();
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const pixelUrl = `${supaUrl}/functions/v1/email-open-pixel?id=${emailIdEarly}`;
    const clickBase = `${supaUrl}/functions/v1/email-click-redirect`;
    let trackedHtml = finalHtml.replace(
      /<a\s+([^>]*?)href=["']((?:https?:)\/\/[^"']+)["']([^>]*)>/gi,
      (_m, pre, href, post) =>
        `<a ${pre}href="${clickBase}?id=${emailIdEarly}&url=${encodeURIComponent(href)}"${post}>`,
    );
    if (!/<\/body>/i.test(trackedHtml)) {
      trackedHtml = trackedHtml + `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
    } else {
      trackedHtml = trackedHtml.replace(
        /<\/body>/i,
        `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" /></body>`,
      );
    }
      ? "GarageFlow <onboarding@resend.dev>"
      : (from || (brand === "market" ? "GarageFlow Market <market@garageflow.pt>" : "GarageFlow <noreply@garageflow.pt>"));

    console.log(`Sending email | to: ${finalTo.join(",")} | branded: ${!!branded} | subject: ${finalSubject}`);

    const { data, error } = await resend.emails.send({
      from: finalFrom,
      to: finalTo,
      subject: finalSubject,
      html: trackedHtml,
    });

    const emailId = (data as any)?.id || emailIdEarly;

    if (error) {
      console.error("Resend error:", JSON.stringify(error));
      // Observability: log failure (silent fail).
      try {
        await admin.from("email_events").insert({
          email_id: emailId, email_type: (body as any).emailType ?? null,
          recipient: Array.isArray(originalTo) ? originalTo.join(",") : String(originalTo),
          event_type: "failed", details: { error: error.message },
        });
      } catch (_e) { /* ignore */ }
      return new Response(JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // Observability: log successful send.
    try {
      await admin.from("email_events").insert({
        email_id: emailId, email_type: (body as any).emailType ?? null,
        recipient: Array.isArray(originalTo) ? originalTo.join(",") : String(originalTo),
        event_type: "sent", details: { subject: finalSubject, branded: !!branded },
      });
    } catch (_e) { /* ignore */ }

    return new Response(JSON.stringify({ success: true, data, email_id: emailId }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } });

  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } });
  }
});
