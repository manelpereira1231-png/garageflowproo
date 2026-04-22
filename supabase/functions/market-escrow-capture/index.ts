import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Captures a previously authorized PaymentIntent (manual capture flow).
 * Triggered when the 48h satisfaction window expires OR buyer confirms delivery.
 *
 * Body: { escrow_id: string }
 *
 * Authorization: super admin OR cron (with service role key as bearer).
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

    const body = await req.json().catch(() => ({}));
    const escrowId: string | undefined = body.escrow_id;
    if (!escrowId) throw new Error("escrow_id obrigatório");

    // Auth check: allow service role OR super admin user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let isAdmin = false;
    if (!isServiceRole) {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? ""
      );
      const { data: authData } = await supabaseClient.auth.getUser(token);
      if (authData?.user) {
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", authData.user.id);
        isAdmin = !!roles?.some((r: any) => r.role === "super_admin");
      }
    }
    if (!isServiceRole && !isAdmin) throw new Error("Sem permissão");

    const { data: escrow } = await supabaseAdmin
      .from("market_escrow")
      .select("*")
      .eq("id", escrowId)
      .single();

    if (!escrow) throw new Error("Escrow não encontrado");
    if (escrow.status !== "delivery_confirmed" && escrow.status !== "paid") {
      throw new Error(`Escrow em estado ${escrow.status} — não capturável`);
    }
    if (!escrow.stripe_payment_intent_id) throw new Error("Sem PaymentIntent associado");
    if (escrow.captured_at) throw new Error("Já capturado");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Capture the authorized payment
    const captured = await stripe.paymentIntents.capture(escrow.stripe_payment_intent_id);

    await supabaseAdmin
      .from("market_escrow")
      .update({
        status: "released",
        captured_at: new Date().toISOString(),
        released_at: new Date().toISOString(),
      })
      .eq("id", escrowId);

    return new Response(
      JSON.stringify({ success: true, payment_intent: captured.id, status: captured.status }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[market-escrow-capture] error", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
