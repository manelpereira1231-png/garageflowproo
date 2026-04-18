import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user?.email) throw new Error("Não autenticado");

    const { escrow_id, action } = await req.json();
    if (!escrow_id) throw new Error("escrow_id obrigatório");

    // Get escrow
    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("market_escrow")
      .select("*, carity_listings(make, model, year, price, status)")
      .eq("id", escrow_id)
      .single();

    if (escrowError || !escrow) throw new Error("Compra não encontrada");
    if (escrow.buyer_id !== user.id) throw new Error("Sem permissão");
    if (escrow.status !== "pending") throw new Error("Esta compra já não está pendente");

    // CANCEL action
    if (action === "cancel") {
      await supabaseAdmin
        .from("market_escrow")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", escrow_id);

      return new Response(JSON.stringify({ ok: true, cancelled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // RESUME action — create new Stripe Checkout session
    const listing = escrow.carity_listings as any;
    if (!listing || listing.status !== "published") {
      throw new Error("Este carro já não está disponível");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Resolve currency dynamically from seller's country
    const { data: sellerProfile } = await supabaseAdmin
      .from("carity_seller_profiles")
      .select("country_code")
      .eq("user_id", escrow.seller_id)
      .maybeSingle();
    const countryCode = (sellerProfile?.country_code || "PT").toUpperCase();
    const { data: country } = await supabaseAdmin
      .from("country_settings")
      .select("currency, active")
      .eq("code", countryCode)
      .maybeSingle();
    if (!country || !country.active) {
      throw new Error(`O país ${countryCode} ainda não está ativo no Market.`);
    }
    const currency = (country.currency || "EUR").toLowerCase();
    const amountNum = Number(escrow.amount);
    const unitAmount = ["jpy", "krw", "vnd", "clp"].includes(currency)
      ? Math.round(amountNum)
      : Math.round(amountNum * 100);

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const origin = req.headers.get("origin") || "https://garageflow.pt";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: {
              name: `${listing.make} ${listing.model} ${listing.year}`,
              description: `Compra com proteção escrow GarageFlow Market.`,
            },
            unit_amount: unitAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        metadata: {
          escrow_id: escrow.id,
          listing_id: escrow.listing_id,
          buyer_id: user.id,
          seller_id: escrow.seller_id,
          type: "market_escrow",
        },
      },
      metadata: {
        escrow_id: escrow.id,
        listing_id: escrow.listing_id,
        type: "market_escrow",
      },
      success_url: `${origin}/market/car/${escrow.listing_id}?escrow=success&escrow_id=${escrow.id}`,
      cancel_url: `${origin}/market/purchases?escrow=cancelled`,
    });

    await supabaseAdmin
      .from("market_escrow")
      .update({ stripe_session_id: session.id, updated_at: new Date().toISOString() })
      .eq("id", escrow.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
