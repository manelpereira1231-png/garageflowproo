import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find trialing subscriptions whose trial_end has passed and no Stripe sub took over.
    const { data: expired, error } = await supabase
      .from("subscriptions")
      .select("id, shop_id, stripe_subscription_id")
      .in("status", ["trialing", "active"])
      .lt("trial_end", new Date().toISOString())
      .is("stripe_subscription_id", null)
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
