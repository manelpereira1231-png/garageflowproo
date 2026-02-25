import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// In Resend sandbox mode, emails can ONLY be sent to the account owner's email.
// Set this to your Resend account email. Once you verify a domain, remove this.
const SANDBOX_OWNER_EMAIL = "manelpereira11@gmail.com";

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
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html }: SendEmailRequest = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // In sandbox mode:
    // 1. "from" MUST be "onboarding@resend.dev"
    // 2. "to" MUST be the Resend account owner's email
    const senderAddress = "GarageFlow <onboarding@resend.dev>";
    const recipientList = [SANDBOX_OWNER_EMAIL];

    const originalTo = Array.isArray(to) ? to.join(", ") : to;
    console.log(`Sandbox mode: redirecting email from [${originalTo}] to [${SANDBOX_OWNER_EMAIL}]`);

    const { data, error } = await resend.emails.send({
      from: senderAddress,
      to: recipientList,
      subject: `[Para: ${originalTo}] ${subject}`,
      html,
    });

    if (error) {
      console.error("Resend error:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", data);
    return new Response(
      JSON.stringify({ success: true, data }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
