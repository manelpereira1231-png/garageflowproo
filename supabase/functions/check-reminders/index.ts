import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find reminders due within the next 7 days that haven't been notified
    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);
    const today = new Date().toISOString().split("T")[0];
    const futureDate = inSevenDays.toISOString().split("T")[0];

    const { data: reminders, error: fetchError } = await supabase
      .from("service_reminders")
      .select("*, vehicles(make, model, plate, mileage), clients(name, email, phone)")
      .eq("status", "pending")
      .is("notified_at", null)
      .lte("next_service_date", futureDate)
      .gte("next_service_date", today);

    if (fetchError) {
      console.error("Error fetching reminders:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let alertsCreated = 0;

    for (const reminder of reminders || []) {
      const client = reminder.clients as any;
      const vehicle = reminder.vehicles as any;
      const clientName = client?.name || "Cliente";
      const vehicleInfo = vehicle ? `${vehicle.make} ${vehicle.model} (${vehicle.plate})` : "";
      const daysUntil = Math.ceil(
        (new Date(reminder.next_service_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      // Create alert for the shop
      const { error: alertError } = await supabase.from("alerts").insert({
        shop_id: reminder.shop_id,
        client_id: reminder.client_id,
        vehicle_id: reminder.vehicle_id,
        type: "revision",
        priority: daysUntil <= 3 ? "high" : "medium",
        title: `${clientName} – Revisão em ${daysUntil} dias`,
        message: `O veículo ${vehicleInfo} tem revisão agendada para ${reminder.next_service_date}.${reminder.next_service_km ? ` Próxima revisão aos ${reminder.next_service_km} km.` : ""}`,
        status: "pending",
      });

      if (!alertError) {
        // Mark as notified
        await supabase
          .from("service_reminders")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", reminder.id);
        alertsCreated++;
      } else {
        console.error("Error creating alert for reminder", reminder.id, alertError);
      }
    }

    console.log(`check-reminders: processed ${reminders?.length || 0} reminders, created ${alertsCreated} alerts`);

    return new Response(
      JSON.stringify({ success: true, processed: reminders?.length || 0, alertsCreated }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in check-reminders:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
