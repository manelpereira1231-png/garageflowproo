import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Buyer confirms delivery → captures the authorized PaymentIntent immediately
 * (skips waiting for the 48h cron job).
 *
 * Body: { escrow_id: string }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: authData, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !authData?.user) throw new Error("Não autenticado");
    const userId = authData.user.id;

    const body = await req.json().catch(() => ({}));
    const escrowId: string | undefined = body.escrow_id;
    if (!escrowId) throw new Error("escrow_id obrigatório");

    const { data: escrow, error: eErr } = await supabaseAdmin
      .from("market_escrow")
      .select("*")
      .eq("id", escrowId)
      .single();
    if (eErr || !escrow) throw new Error("Escrow não encontrado");

    // Only the buyer can confirm delivery
    if (escrow.buyer_id !== userId) {
      throw new Error("Apenas o comprador pode confirmar a entrega");
    }
    if (!["paid", "delivery_confirmed"].includes(escrow.status)) {
      throw new Error(`Escrow em estado ${escrow.status} — não capturável`);
    }
    if (escrow.captured_at) throw new Error("Já capturado");
    if (!escrow.stripe_payment_intent_id) {
      // Legacy escrow (auto capture) — just mark as released
      await supabaseAdmin
        .from("market_escrow")
        .update({
          status: "released",
          delivery_confirmed_at: escrow.delivery_confirmed_at || new Date().toISOString(),
          released_at: new Date().toISOString(),
        })
        .eq("id", escrowId);
      return new Response(JSON.stringify({ success: true, legacy: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const captured = await stripe.paymentIntents.capture(escrow.stripe_payment_intent_id);

    await supabaseAdmin
      .from("market_escrow")
      .update({
        status: "released",
        delivery_confirmed_at: escrow.delivery_confirmed_at || new Date().toISOString(),
        captured_at: new Date().toISOString(),
        released_at: new Date().toISOString(),
      })
      .eq("id", escrowId);

    // Audit log
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      action: "escrow_delivery_confirmed",
      entity_type: "market_escrow",
      entity_id: escrowId,
      details: { payment_intent: captured.id, amount: escrow.amount },
    });

    return new Response(
      JSON.stringify({ success: true, payment_intent: captured.id, status: captured.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[market-escrow-confirm-delivery] error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
