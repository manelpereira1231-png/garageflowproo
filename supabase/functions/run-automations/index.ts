import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch all active automation rules
    const { data: rules } = await supabase
      .from("automation_rules")
      .select("*")
      .eq("active", true);

    if (!rules || rules.length === 0) {
      return new Response(JSON.stringify({ message: "No active rules", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const rule of rules) {
      try {
        let triggered = false;
        let details: any = {};

        switch (rule.trigger_type) {
          case "invoice_overdue": {
            const { data: overdue } = await supabase
              .from("invoices")
              .select("id, number, client_id, total")
              .eq("shop_id", rule.shop_id)
              .eq("status", "issued")
              .lt("due_date", new Date().toISOString().split("T")[0]);
            if (overdue && overdue.length > 0) {
              triggered = true;
              details = { count: overdue.length, invoices: overdue.map(i => i.number) };
            }
            break;
          }
          case "client_inactive": {
            const cutoff = new Date(Date.now() - 90 * 86400000).toISOString();
            const { data: inactive } = await supabase
              .from("clients")
              .select("id, name")
              .eq("shop_id", rule.shop_id)
              .is("deleted_at", null)
              .lt("created_at", cutoff)
              .limit(50);
            // Check if any of these clients have NO recent work orders
            if (inactive && inactive.length > 0) {
              const clientIds = inactive.map(c => c.id);
              const { data: recentOrders } = await supabase
                .from("work_orders")
                .select("client_id")
                .eq("shop_id", rule.shop_id)
                .in("client_id", clientIds)
                .gte("created_at", cutoff);
              const activeClientIds = new Set((recentOrders || []).map(o => o.client_id));
              const trueInactive = inactive.filter(c => !activeClientIds.has(c.id));
              if (trueInactive.length > 0) {
                triggered = true;
                details = { count: trueInactive.length, clients: trueInactive.slice(0, 5).map(c => c.name) };
              }
            }
            break;
          }
          case "low_stock": {
            const { data: lowParts } = await supabase
              .from("parts")
              .select("id, name, stock_quantity, min_stock")
              .eq("shop_id", rule.shop_id)
              .eq("active", true);
            const low = (lowParts || []).filter(p => p.stock_quantity <= p.min_stock);
            if (low.length > 0) {
              triggered = true;
              details = { count: low.length, parts: low.slice(0, 5).map(p => p.name) };
            }
            break;
          }
          case "quote_pending": {
            const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
            const { data: pending } = await supabase
              .from("quotes")
              .select("id, number")
              .eq("shop_id", rule.shop_id)
              .eq("status", "sent")
              .lt("created_at", threeDaysAgo);
            if (pending && pending.length > 0) {
              triggered = true;
              details = { count: pending.length };
            }
            break;
          }
          case "service_reminder": {
            const upcoming = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
            const { data: reminders } = await supabase
              .from("service_reminders")
              .select("id, service_type")
              .eq("shop_id", rule.shop_id)
              .eq("status", "pending")
              .lte("next_service_date", upcoming);
            if (reminders && reminders.length > 0) {
              triggered = true;
              details = { count: reminders.length };
            }
            break;
          }
        }

        if (triggered) {
          // Execute action
          if (rule.action_type === "create_alert") {
            await supabase.from("alerts").insert({
              shop_id: rule.shop_id,
              title: rule.name,
              message: JSON.stringify(details),
              type: rule.trigger_type,
              priority: "medium",
            });
          } else if (rule.action_type === "create_notification") {
            await supabase.from("notifications").insert({
              shop_id: rule.shop_id,
              title: rule.name,
              message: `Automação: ${rule.trigger_type} - ${details.count || 0} itens`,
              type: "automation",
            });
          }

          // Log execution
          await supabase.from("automation_logs").insert({
            shop_id: rule.shop_id,
            rule_id: rule.id,
            trigger_type: rule.trigger_type,
            action_type: rule.action_type,
            status: "success",
            details,
          });

          // Update rule
          await supabase.from("automation_rules").update({
            last_run_at: new Date().toISOString(),
            run_count: (rule.run_count || 0) + 1,
          }).eq("id", rule.id);

          processed++;
        }
      } catch (ruleErr: any) {
        await supabase.from("automation_logs").insert({
          shop_id: rule.shop_id,
          rule_id: rule.id,
          trigger_type: rule.trigger_type,
          action_type: rule.action_type,
          status: "error",
          details: { error: ruleErr.message },
        });
      }
    }

    return new Response(JSON.stringify({ message: "Done", processed, total_rules: rules.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
