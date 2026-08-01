// Twilio SMS via Lovable connector gateway.
// Requires connected Twilio connector — TWILIO_API_KEY + LOVABLE_API_KEY secrets.
// Also requires TWILIO_SMS_FROM (E.164 number). Missing config → 503 (caller logs "skipped").
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  const TWILIO_SMS_FROM = Deno.env.get("TWILIO_SMS_FROM");

  if (!LOVABLE_API_KEY || !TWILIO_API_KEY || !TWILIO_SMS_FROM) {
    return new Response(
      JSON.stringify({ error: "SMS channel not configured", missing: {
        LOVABLE_API_KEY: !LOVABLE_API_KEY, TWILIO_API_KEY: !TWILIO_API_KEY, TWILIO_SMS_FROM: !TWILIO_SMS_FROM,
      }}),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { to, message, shop_id, entity_id } = await req.json();
    if (!to || !message) {
      return new Response(JSON.stringify({ error: "Missing to/message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Caller must be either service role (internal call) or shop member
    const authHeader = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    const isService = authHeader === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!isService) {
      const { data: u } = await supabase.auth.getUser(authHeader);
      if (!u?.user || !shop_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const [{ data: mem }, { data: own }] = await Promise.all([
        supabase.from("shop_users").select("shop_id").eq("user_id", u.user.id).eq("shop_id", shop_id).limit(1),
        supabase.from("shops").select("id").eq("id", shop_id).eq("user_id", u.user.id).limit(1),
      ]);
      if ((mem?.length ?? 0) === 0 && (own?.length ?? 0) === 0) {
        return new Response(JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      // Paid channel: blocked when the shop has no active subscription.
      const denied = await assertActivePlan(shop_id, corsHeaders);
      if (denied) return denied;
    }


    const body = new URLSearchParams({ To: to, From: TWILIO_SMS_FROM, Body: message });
    const resp = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const text = await resp.text();
    if (!resp.ok) {
      console.error("Twilio SMS error", resp.status, text);
      return new Response(
        JSON.stringify({ error: "Twilio request failed", status: resp.status, details: text }),
        { status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const data = JSON.parse(text);
    if (shop_id) {
      await supabase.from("email_logs").insert({
        shop_id, to_email: to, subject: `[SMS] ${message.slice(0, 60)}`,
        status: "sent", entity_type: "sms", entity_id: entity_id ?? null,
      }).select().maybeSingle();
    }
    return new Response(JSON.stringify({ ok: true, sid: data.sid }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("send-sms error", err);
    return new Response(JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
