import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cron job (run hourly): finds escrows whose 48h satisfaction window expired
 * and captures the authorized PaymentIntent. Idempotent.
 *
 * Eligibility:
 *  - status in ('paid', 'delivery_confirmed')
 *  - capture_method = 'manual'
 *  - captured_at IS NULL
 *  - reference timestamp (delivery_confirmed_at OR created_at) older than 48h
 *
 * Auth: service role bearer (set the SUPABASE_SERVICE_ROLE_KEY in cron job).
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (token !== Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 403,
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const cutoff = new Date(Date.now() - 48 * 3600 * 1000).toISOString();

  // Pull candidates (limit to avoid huge batches)
  const { data: candidates, error } = await supabaseAdmin
    .from("market_escrow")
    .select("id, status, stripe_payment_intent_id, capture_method, captured_at, created_at, delivery_confirmed_at, amount, seller_id")
    .in("status", ["paid", "delivery_confirmed"])
    .is("captured_at", null)
    .not("stripe_payment_intent_id", "is", null)
    .limit(50);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }

  const results: any[] = [];
  for (const e of candidates || []) {
    // Only manual-capture escrows go through cron capture
    if (e.capture_method && e.capture_method !== "manual") continue;
    const ref = e.delivery_confirmed_at || e.created_at;
    if (!ref || ref > cutoff) continue;

    try {
      const captured = await stripe.paymentIntents.capture(e.stripe_payment_intent_id!);
      await supabaseAdmin
        .from("market_escrow")
        .update({
          status: "released",
          captured_at: new Date().toISOString(),
          released_at: new Date().toISOString(),
        })
        .eq("id", e.id);

      await supabaseAdmin.from("audit_logs").insert({
        action: "escrow_auto_captured",
        entity_type: "market_escrow",
        entity_id: e.id,
        details: {
          payment_intent: captured.id,
          amount: e.amount,
          reason: "48h satisfaction window expired",
        },
      });

      results.push({ id: e.id, status: "captured" });
    } catch (err: any) {
      console.error(`[cron-capture] failed for ${e.id}`, err.message);
      results.push({ id: e.id, status: "error", error: err.message });
    }
  }

  return new Response(
    JSON.stringify({
      checked: candidates?.length ?? 0,
      processed: results.length,
      results,
      timestamp: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
  );
});
