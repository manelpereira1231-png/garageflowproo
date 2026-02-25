import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Sandbox mode disabled – emails go to the real recipient.
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
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, from }: SendEmailRequest = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const originalTo = Array.isArray(to) ? to : [to];
    
    // Determine if we need sandbox redirect
    const useSandbox = !!SANDBOX_REDIRECT;
    const finalTo = useSandbox ? [SANDBOX_REDIRECT] : originalTo;
    const finalSubject = useSandbox ? `[Para: ${originalTo.join(", ")}] ${subject}` : subject;
    // In sandbox: from MUST be onboarding@resend.dev
    const finalFrom = useSandbox ? "GarageFlow <onboarding@resend.dev>" : (from || "GarageFlow <noreply@garageflow.pt>");

    console.log(`Sending email | to: ${finalTo.join(",")} | original: ${originalTo.join(",")} | subject: ${finalSubject}`);

    const { data, error } = await resend.emails.send({
      from: finalFrom,
      to: finalTo,
      subject: finalSubject,
      html,
    });

    if (error) {
      console.error("Resend error:", JSON.stringify(error));
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Email sent successfully:", JSON.stringify(data));
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