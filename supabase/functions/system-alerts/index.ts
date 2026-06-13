// Operational health watchdog. Runs every 15 min via cron.
// Checks thresholds and creates notifications for super_admin when breached.
// Thresholds:
//   - failed_jobs unresolved > 20
//   - action_queue 'failed' > 50 in last hour
//   - api_logs 5xx rate > 5% in last hour (min 50 reqs)
//   - complaints SLA breached (resolution_due_at past, not resolved)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const SUPER_ADMIN_EMAIL = "manelpereira11@gmail.com";

async function notify(type: string, title: string, body: string, severity: "info" | "warn" | "critical") {
  // Find super admin user_id
  const { data: u } = await admin
    .from("user_roles" as any)
    .select("user_id")
    .eq("role", "super_admin")
    .limit(5);
  const ids = (u ?? []).map((r: any) => r.user_id);
  for (const uid of ids) {
    await admin.from("notifications").insert({
      user_id: uid, type: `system_alert:${type}`, title, body,
    }).then(() => {}, () => {});
  }
  // Also send email to hardcoded super admin
  if (severity !== "info") {
    await admin.functions.invoke("send-email", {
      body: { to: SUPER_ADMIN_EMAIL, subject: `[GarageFlow ${severity.toUpperCase()}] ${title}`, html: `<pre>${body}</pre>` },
    }).catch(() => {});
  }
}

Deno.serve(async () => {
  const out: any = { checks: [] };

  // 1. Failed jobs backlog
  const { count: failedJobs } = await admin.from("failed_jobs" as any)
    .select("*", { count: "exact", head: true }).eq("resolved", false);
  out.checks.push({ name: "failed_jobs", value: failedJobs });
  if ((failedJobs ?? 0) > 20) {
    await notify("failed_jobs", "Failed jobs acumulados", `${failedJobs} jobs falhados não resolvidos.`, "warn");
  }

  // 2. Action queue failed in last hour
  const since = new Date(Date.now() - 3600_000).toISOString();
  const { count: actionFailed } = await admin.from("action_queue" as any)
    .select("*", { count: "exact", head: true }).eq("status", "failed").gte("updated_at", since);
  out.checks.push({ name: "action_queue_failed_1h", value: actionFailed });
  if ((actionFailed ?? 0) > 50) {
    await notify("action_queue", "Action queue: muitas falhas", `${actionFailed} ações falharam na última hora.`, "critical");
  }

  // 3. API error rate (5xx) last hour
  const { data: apiSample } = await admin.from("api_logs" as any)
    .select("status_code").gte("created_at", since).limit(2000);
  const total = apiSample?.length ?? 0;
  const errs = (apiSample ?? []).filter((r: any) => (r.status_code ?? 0) >= 500).length;
  const rate = total > 0 ? errs / total : 0;
  out.checks.push({ name: "api_5xx_rate", total, errs, rate });
  if (total >= 50 && rate > 0.05) {
    await notify("api_5xx", "API com taxa de erro elevada",
      `Taxa 5xx: ${(rate * 100).toFixed(1)}% (${errs}/${total}) na última hora.`, "critical");
  }

  // 4. Complaints SLA breached
  const { count: slaBreached } = await admin.from("complaints" as any)
    .select("*", { count: "exact", head: true })
    .is("resolved_at", null)
    .lt("sla_resolution_due_at", new Date().toISOString());
  out.checks.push({ name: "complaints_sla_breach", value: slaBreached });
  if ((slaBreached ?? 0) > 0) {
    await notify("sla_breach", "Reclamações com SLA ultrapassado",
      `${slaBreached} reclamações em incumprimento de SLA.`, "warn");
  }

  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
});
