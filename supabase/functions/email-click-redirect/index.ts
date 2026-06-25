// Records a `clicked` event and 302-redirects to the target URL.
// Usage in emails: rewrite href -> .../functions/v1/email-click-redirect?id=EMAIL_ID&url=ENCODED
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ALLOWED_HOSTS = [
  "garageflow.pt",
  "garageflow-pt.lovable.app",
  "lovable.app",
  "lovable.dev",
];

function safeUrl(raw: string | null): string {
  const fallback = "https://garageflow.pt";
  if (!raw) return fallback;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return fallback;
    const host = u.hostname.toLowerCase();
    const ok = ALLOWED_HOSTS.some((d) => host === d || host.endsWith("." + d));
    if (!ok) return fallback;
    return u.toString();
  } catch {
    return fallback;
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const emailId = url.searchParams.get("id");
  const target = safeUrl(url.searchParams.get("url"));

  if (emailId) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("cf-connecting-ip") ?? null;
    admin.from("email_tracking_events").insert({
      email_id: emailId,
      event_type: "clicked",
      ip_address: ip,
      user_agent: req.headers.get("user-agent"),
      metadata: { target },
    }).then(() => {}).catch(() => {});
  }

  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store" },
  });
});
