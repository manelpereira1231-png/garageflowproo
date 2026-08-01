import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  // Auth guard: only the platform (cron / service role) may invoke
  const __auth = (req.headers.get("Authorization") ?? "").replace("Bearer ", "")
    || (req.headers.get("x-internal-token") ?? "");
  if (__auth !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const now = new Date();
    const results: any[] = [];

    // 1. Find vehicles with no service in 6+ months
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: allVehicles } = await supabase
      .from("vehicles")
      .select("id, make, model, plate, mileage, client_id, shop_id, clients(name, email)")
      .is("deleted_at", null)
      .limit(500);

    if (!allVehicles) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const vehicle of allVehicles) {
      // Check last service
      const { data: lastService } = await supabase
        .from("work_orders")
        .select("id, created_at, status")
        .eq("vehicle_id", vehicle.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const lastServiceDate = lastService?.created_at ? new Date(lastService.created_at) : null;

      // Check if reminder already exists and is pending
      const { data: existingReminder } = await supabase
        .from("service_reminders")
        .select("id")
        .eq("vehicle_id", vehicle.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingReminder) continue; // Already has a pending reminder

      let shouldRemind = false;
      let reminderType = "revision";
      let reminderDate: string | null = null;

      // No service ever, or last service > 6 months ago
      if (!lastServiceDate || lastServiceDate < sixMonthsAgo) {
        shouldRemind = true;
        reminderDate = now.toISOString().split("T")[0];
      }

      // High mileage check (every 15000 km suggest service)
      if (vehicle.mileage > 0 && vehicle.mileage % 15000 < 2000) {
        shouldRemind = true;
        reminderType = "mileage_service";
      }

      if (shouldRemind) {
        // Create service reminder
        await supabase.from("service_reminders").insert({
          vehicle_id: vehicle.id,
          client_id: vehicle.client_id,
          shop_id: vehicle.shop_id,
          service_type: reminderType,
          status: "pending",
          next_service_date: reminderDate,
          next_service_km: vehicle.mileage + 15000,
        });

        // Create alert
        const client = vehicle.clients as any;
        await supabase.from("alerts").insert({
          shop_id: vehicle.shop_id,
          type: "service_due",
          priority: "medium",
          title: `Revisão pendente: ${vehicle.make} ${vehicle.model}`,
          message: `O veículo ${vehicle.plate} (${client?.name || 'Cliente'}) não tem serviço há mais de 6 meses ou atingiu intervalo de quilometragem.`,
          vehicle_id: vehicle.id,
          client_id: vehicle.client_id,
        });

        // Create notification
        await supabase.from("notifications").insert({
          shop_id: vehicle.shop_id,
          type: "reminder",
          title: "Lembrete de revisão",
          message: `${vehicle.plate} - ${vehicle.make} ${vehicle.model} necessita de revisão.`,
          link: `/vehicles`,
        });

        results.push({
          vehicle: `${vehicle.make} ${vehicle.model} (${vehicle.plate})`,
          reason: reminderType,
          client: client?.name,
        });
      }
    }

    // 2. Check for inactive clients (90+ days without any activity)
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: recentClients } = await supabase
      .from("work_orders")
      .select("client_id")
      .gte("created_at", ninetyDaysAgo.toISOString());

    const activeClientIds = new Set((recentClients || []).map(w => w.client_id));

    const { data: allClients } = await supabase
      .from("clients")
      .select("id, name, email, shop_id")
      .is("deleted_at", null)
      .limit(500);

    for (const client of (allClients || [])) {
      if (activeClientIds.has(client.id)) continue;

      // Check if already alerted
      const { data: existingAlert } = await supabase
        .from("alerts")
        .select("id")
        .eq("client_id", client.id)
        .eq("type", "inactive_client")
        .eq("status", "pending")
        .maybeSingle();

      if (existingAlert) continue;

      await supabase.from("alerts").insert({
        shop_id: client.shop_id,
        type: "inactive_client",
        priority: "low",
        title: `Cliente inativo: ${client.name}`,
        message: `${client.name} não tem atividade há mais de 90 dias.`,
        client_id: client.id,
      });

      results.push({ type: "inactive_client", client: client.name });
    }

    return new Response(JSON.stringify({ processed: results.length, details: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("smart-reminders error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
