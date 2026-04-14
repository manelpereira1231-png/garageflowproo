import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    if (!user?.email) throw new Error("Utilizador não autenticado");

    const body = await req.json();
    const { listing_id, type } = body;
    if (!listing_id) throw new Error("listing_id é obrigatório");

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const origin = req.headers.get("origin") || "https://garageflow.pt";

    // Check/create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Handle boost payments
    if (type === "boost") {
      const { boost_type } = body;
      const boostPrices: Record<string, { amount: number; label: string; days: number }> = {
        "7d": { amount: 599, label: "Destaque 7 dias", days: 7 },
        "14d": { amount: 999, label: "Destaque 14 dias", days: 14 },
        "top": { amount: 1299, label: "Topo do marketplace", days: 30 },
      };

      const boost = boostPrices[boost_type || "7d"];
      if (!boost) throw new Error("Tipo de boost inválido");

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        customer_email: customerId ? undefined : user.email,
        line_items: [{
          price_data: {
            currency: "eur",
            product_data: { name: `Carity — ${boost.label}` },
            unit_amount: boost.amount,
          },
          quantity: 1,
        }],
        mode: "payment",
        success_url: `${origin}/carity/meus-anuncios?boost=success`,
        cancel_url: `${origin}/carity/meus-anuncios?boost=cancelled`,
        metadata: { listing_id, type: "carity_boost", boost_type: boost_type || "7d" },
      });

      // Create boost record
      await adminClient.from("carity_boosts").insert({
        listing_id,
        seller_id: user.id,
        boost_type: boost_type || "7d",
        price: boost.amount / 100,
        status: "pending",
        stripe_session_id: session.id,
      });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle inspection payment (default)
    const { data: listing, error: listingErr } = await adminClient
      .from("carity_listings")
      .select("*")
      .eq("id", listing_id)
      .eq("seller_id", user.id)
      .eq("status", "pending_payment")
      .single();

    if (listingErr || !listing) throw new Error("Anúncio não encontrado ou já pago");

    // Inspection: 24.90€ (65% oficina, 35% plataforma)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{
        price_data: {
          currency: "eur",
          product_data: {
            name: `Inspeção Carity — ${listing.make} ${listing.model} (${listing.year})`,
            description: `Inspeção técnica oficial para ${listing.plate}`,
          },
          unit_amount: 2490,
        },
        quantity: 1,
      }],
      mode: "payment",
      success_url: `${origin}/carity/meus-anuncios?payment=success`,
      cancel_url: `${origin}/carity/pagar/${listing_id}?payment=cancelled`,
      metadata: { listing_id, type: "carity_inspection" },
    });

    // Update listing status
    await adminClient.from("carity_listings")
      .update({ status: "pending_inspection" })
      .eq("id", listing_id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
