import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find subscriptions where trial has expired and plan is still free
    const { data: expired, error } = await supabase
      .from("subscriptions")
      .select("id, shop_id")
      .eq("plan", "free")
      .eq("status", "active")
      .lt("trial_end", new Date().toISOString())
      .not("trial_end", "is", null);

    if (error) throw error;

    let count = 0;
    for (const sub of expired || []) {
      await supabase
        .from("subscriptions")
        .update({ status: "trial_expired" })
        .eq("id", sub.id);
      count++;
    }

    return new Response(
      JSON.stringify({ expired_count: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
