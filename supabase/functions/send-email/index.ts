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
    // Require service-role internal token OR an authenticated user limited to safe recipients.
    const authHeader = req.headers.get("Authorization") || "";
    const internalToken = req.headers.get("x-internal-token") || "";
    const serviceSecret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let isInternal = false;
    let callerUser: { id: string; email: string | null } | null = null;
    if (internalToken && internalToken === serviceSecret) {
      isInternal = true;
    } else if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data, error } = await admin.auth.getUser(token);
      if (!error && data?.user) {
        callerUser = { id: data.user.id, email: data.user.email ?? null };
      }
    }
    if (!isInternal && !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    const body = await req.json() as SendEmailRequest;
    const { to, subject, html, from, branded, brand, preheader, cta, footerNote } = body;

    if (!to || !subject || !html) {
      return new Response(JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } });
    }

    // For user-JWT callers, restrict recipients to: caller's own email, shop members,
    // or clients of shops the caller belongs to. This prevents the function being abused
    // as an open relay for phishing.
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

      // Collect shop ids the user owns or is a member of.
      const [{ data: ownedShops }, { data: memberShops }] = await Promise.all([
        admin.from("shops").select("id").eq("user_id", callerUser.id),
        admin.from("shop_users").select("shop_id").eq("user_id", callerUser.id),
      ]);
      const shopIds = [
        ...((ownedShops ?? []).map((r: any) => r.id)),
        ...((memberShops ?? []).map((r: any) => r.shop_id)),
      ];

      const allowed = new Set<string>();
      if (ownEmail) allowed.add(ownEmail);

      if (shopIds.length > 0) {
        // Team member emails (shop owners + shop_users via auth.users via profile join).
        // Clients of those shops.
        const { data: clientRows } = await admin
          .from("clients").select("email").in("shop_id", shopIds);
        for (const c of clientRows ?? []) {
          const e = String((c as any).email ?? "").toLowerCase().trim();
          if (e) allowed.add(e);
        }
        const { data: ownerShops } = await admin
          .from("shops").select("email").in("id", shopIds);
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
