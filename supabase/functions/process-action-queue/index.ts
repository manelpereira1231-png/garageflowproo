// Auto-action execution worker. Claims pending actions from action_queue
// and dispatches them. Safe: whitelist + cooldown enforced at enqueue.
// Schedule via cron every minute.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action_type: string;
  payload: Record<string, unknown>;
  trace_id: string | null;
};

async function executeAction(a: Action): Promise<{ ok: boolean; error?: string }> {
  try {
    switch (a.action_type) {
      case "boost_listing": {
        if (!a.entity_id) return { ok: false, error: "missing entity_id" };
        await admin.from("carity_listings")
          .update({ boost_score: 10, boosted_at: new Date().toISOString() })
          .eq("id", a.entity_id);
        return { ok: true };
      }
      case "send_reactivation_email": {
        // Fire-and-forget invoke; never re-send if shop has no email
        await admin.functions.invoke("send-lifecycle-email", {
          body: { type: "reactivation", shop_id: a.entity_id },
        });
        return { ok: true };
      }
      case "seo_internal_link_injection": {
        await admin.from("seo_graph_links").insert({
          source_id: a.entity_id,
          target_id: a.payload?.target_id ?? null,
          weight: 1,
          link_type: "auto_inject",
        }).then(() => {}, () => {});
        return { ok: true };
      }
      case "feature_in_homepage":
      case "price_review": {
        // Mark via notifications; soft action
        await admin.from("notifications").insert({
          user_id: null,
          type: a.action_type,
          title: a.action_type,
          body: JSON.stringify(a.payload ?? {}),
        }).then(() => {}, () => {});
        return { ok: true };
      }
      default:
        return { ok: false, error: `unknown_action:${a.action_type}` };
    }
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  // Auth guard: only the platform (cron / service role) may invoke
  const __auth = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    || (req.headers.get("x-internal-token") ?? "");
  if (__auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: claims, error } = await admin.rpc("claim_next_actions", { _limit: 20 });
  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const list = (claims ?? []) as Action[];
  const results: Array<{ id: string; ok: boolean; error?: string }> = [];

  for (const a of list) {
    const res = await executeAction(a);
    await admin.rpc("complete_action", { _id: a.id, _success: res.ok, _error: res.error ?? null });
    if (a.trace_id) {
      admin.from("action_trace").insert({
        trace_id: a.trace_id, step: "action_executed",
        source_table: "action_queue", source_id: a.id,
        metadata: { action_type: a.action_type, ok: res.ok, error: res.error ?? null },
      }).then(() => {}, () => {});
    }
    results.push({ id: a.id, ...res });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
