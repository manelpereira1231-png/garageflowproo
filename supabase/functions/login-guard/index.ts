// Login throttle guard. Called BEFORE and AFTER supabase.auth.signInWithPassword()
// from the client. Counts FAILED attempts per email and per IP and blocks only
// after the threshold is reached. Never blocks a first/valid attempt.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const admin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } },
);

const WINDOW_SECONDS = 15 * 60;
const MAX_EMAIL_FAILS = 8; // block after 8 wrong passwords for the same email
const MAX_IP_FAILS = 20; // wider net for shared IPs (workshops behind NAT)

function getIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip");
}

async function countFails(identifier: string, since: string): Promise<number> {
  const { data } = await admin
    .from("rate_limits")
    .select("count")
    .eq("action_type", "login_fail")
    .eq("identifier", identifier)
    .gt("window_start", since);
  return (data ?? []).reduce((acc: number, r: any) => acc + (r.count ?? 1), 0);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, action, realm } = await req.json().catch(() => ({}));
    if (!email || typeof email !== "string") {
      // Fail open — never block a login because the guard got bad input.
      return new Response(JSON.stringify({ allowed: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const ip = getIp(req);
    const emailKey = `login:${normalizedEmail}`;
    const ipKey = ip ? `login-ip:${ip}` : null;
    const since = new Date(Date.now() - WINDOW_SECONDS * 1000).toISOString();

    if (action === "fail") {
      const rows: any[] = [{ identifier: emailKey, action_type: "login_fail", count: 1, window_start: new Date().toISOString() }];
      if (ipKey) rows.push({ identifier: ipKey, action_type: "login_fail", count: 1, window_start: new Date().toISOString() });
      await admin.from("rate_limits").insert(rows);
      return new Response(JSON.stringify({ recorded: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "reset") {
      await admin.from("rate_limits").delete().eq("action_type", "login_fail").eq("identifier", emailKey);
      return new Response(JSON.stringify({ reset: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [emailFails, ipFails] = await Promise.all([
      countFails(emailKey, since),
      ipKey ? countFails(ipKey, since) : Promise.resolve(0),
    ]);

    if (emailFails >= MAX_EMAIL_FAILS || ipFails >= MAX_IP_FAILS) {
      return new Response(
        JSON.stringify({
          allowed: false,
          reason: emailFails >= MAX_EMAIL_FAILS ? "too_many_for_email" : "too_many_from_ip",
          retry_after_minutes: 15,
          realm: typeof realm === "string" ? realm : null,
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ allowed: true, fails: emailFails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[login-guard] error", e);
    // Fail OPEN: an infra problem must never lock users out.
    return new Response(JSON.stringify({ allowed: true, fallback: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
