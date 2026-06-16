// Periodic maintenance: reconcile entity_state, retry failed jobs, archive old events.
// Schedule via cron hourly.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (_req) => {
  // Auth guard: only the platform (cron / service role) may invoke
  const __auth = (_req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    || (_req.headers.get("x-internal-token") ?? "");
  if (__auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const out: Record<string, unknown> = {};
  const [recon, retry, arch] = await Promise.all([
    admin.rpc("reconcile_entity_state", { _limit: 1000 }),
    admin.rpc("retry_failed_jobs", { _limit: 100 }),
    admin.rpc("archive_old_events", { _days: 90 }),
  ]);
  out.reconcile = recon.data ?? recon.error?.message;
  out.retry_failed_jobs = retry.data ?? retry.error?.message;
  out.archive = arch.data ?? arch.error?.message;

  return new Response(JSON.stringify(out), {
    headers: { "Content-Type": "application/json" },
  });
});
