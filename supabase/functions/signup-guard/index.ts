// Signup rate-limit guard. Called BEFORE supabase.auth.signUp() from the
// client. Checks IP + email throttle in DB and records the attempt.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

function getIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, realm } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string" || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
      return new Response(JSON.stringify({ allowed: false, reason: "invalid_email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = getIp(req);
    const normalizedEmail = email.toLowerCase().trim();

    // 1. Check the limit.
    const { data: check, error: checkErr } = await admin.rpc("check_signup_rate_limit", {
      _ip: ip,
      _email: normalizedEmail,
    });

    if (checkErr) {
      console.error("[signup-guard] rpc error", checkErr);
      // Fail OPEN on infra errors — better to allow signup than break onboarding.
      return new Response(JSON.stringify({ allowed: true, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = (check ?? { allowed: true }) as {
      allowed: boolean;
      reason?: string;
      retry_after_minutes?: number;
    };

    // 2. Record the attempt (regardless of allow/block) so future checks see it.
    await admin.from("signup_attempts").insert({
      ip_address: ip,
      email: normalizedEmail,
      realm: typeof realm === "string" ? realm : null,
      blocked: !result.allowed,
    });

    return new Response(JSON.stringify(result), {
      status: result.allowed ? 200 : 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[signup-guard] error", e);
    // Fail open
    return new Response(JSON.stringify({ allowed: true, fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
