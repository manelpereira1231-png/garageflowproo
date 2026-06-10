// Returns a 1x1 transparent PNG and records an `opened` event for the email.
// Usage in emails: <img src=".../functions/v1/email-open-pixel?id=EMAIL_ID" width="1" height="1" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// 1x1 transparent PNG
const PIXEL = Uint8Array.from(atob(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
), (c) => c.charCodeAt(0));

const HEADERS = {
  "Content-Type": "image/png",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  "Access-Control-Allow-Origin": "*",
};

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);
    const emailId = url.searchParams.get("id");
    if (emailId) {
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        req.headers.get("cf-connecting-ip") ?? null;
      admin.from("email_tracking_events").insert({
        email_id: emailId,
        event_type: "opened",
        ip_address: ip,
        user_agent: req.headers.get("user-agent"),
      }).then(() => {}).catch(() => {});
    }
  } catch (_e) { /* silent */ }
  return new Response(PIXEL, { headers: HEADERS, status: 200 });
});
