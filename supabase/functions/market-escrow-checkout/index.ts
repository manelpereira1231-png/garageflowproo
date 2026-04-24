import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── All local payment methods per country (one-time payment mode) ───
const PAYMENT_METHODS: Record<string, string[]> = {
  PT: ["card", "sepa_debit", "multibanco", "link"],
  ES: ["card", "sepa_debit", "link"], FR: ["card", "sepa_debit", "link"],
  DE: ["card", "sepa_debit", "klarna", "giropay", "sofort", "link"],
  IT: ["card", "sepa_debit", "link"],
  NL: ["card", "ideal", "sepa_debit", "klarna", "link"],
  BE: ["card", "bancontact", "sepa_debit", "link"],
  AT: ["card", "sepa_debit", "eps", "klarna", "link"],
  IE: ["card", "sepa_debit", "link"], FI: ["card", "sepa_debit", "klarna", "link"],
  GR: ["card", "sepa_debit", "link"], LU: ["card", "sepa_debit", "link"],
  UK: ["card", "bacs_debit", "klarna", "link"], GB: ["card", "bacs_debit", "klarna", "link"],
  PL: ["card", "p24", "blik", "klarna", "link"],
  SE: ["card", "klarna", "link"], NO: ["card", "klarna", "link"], DK: ["card", "klarna", "link"],
  CH: ["card", "link"], CZ: ["card", "link"],
  US: ["card", "us_bank_account", "link", "cashapp", "klarna"],
  CA: ["card", "acss_debit", "link"],
  BR: ["card", "boleto"], MX: ["card", "oxxo", "link"],
  AR: ["card", "link"], CL: ["card", "link"], CO: ["card", "link"], PE: ["card", "link"],
  IN: ["card", "link"], JP: ["card", "konbini", "link"],
  SG: ["card", "grabpay", "paynow", "link"], HK: ["card", "alipay", "link"],
  MY: ["card", "fpx", "grabpay", "link"], TH: ["card", "promptpay", "link"],
  ID: ["card", "link"], PH: ["card", "link"], VN: ["card", "link"], KR: ["card", "link"],
  AU: ["card", "au_becs_debit", "afterpay_clearpay", "link"],
  NZ: ["card", "afterpay_clearpay", "link"],
  AE: ["card", "link"], SA: ["card", "link"], ZA: ["card", "link"],
  EG: ["card", "link"], IL: ["card", "link"], TR: ["card", "link"], MA: ["card", "link"],
};
function getPaymentMethods(country: string): string[] {
  return PAYMENT_METHODS[country.toUpperCase()] || ["card", "link"];
}

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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Utilizador não autenticado");
    const token = authHeader.replace("Bearer ", "");
    const { data: authData } = await supabaseClient.auth.getUser(token);
    const user = authData.user;
    if (!user?.email) throw new Error("Utilizador não autenticado");

    const { listing_id } = await req.json();
    if (!listing_id) throw new Error("listing_id é obrigatório");

    // Get listing details
    const { data: listing, error: listingError } = await supabaseAdmin
      .from("carity_listings")
      .select("*")
      .eq("id", listing_id)
      .eq("status", "published")
      .single();

    if (listingError || !listing) throw new Error("Anúncio não encontrado ou não disponível");
    if (listing.seller_id === user.id) throw new Error("Não pode comprar o seu próprio carro");
    if (listing.price <= 0) throw new Error("Preço inválido");

    // Check if there's already an active escrow for this listing
    const { data: existingEscrows } = await supabaseAdmin
      .from("market_escrow")
      .select("id, status, stripe_session_id, created_at")
      .eq("listing_id", listing_id)
      .in("status", ["pending", "paid", "delivery_confirmed"])
      .order("created_at", { ascending: false });

    const blockingEscrow = (existingEscrows || []).find((item) => item.status !== "pending")
      || (existingEscrows || []).find((item) => {
        if (item.status !== "pending") return false;
        const createdAt = new Date(item.created_at).getTime();
        const ageMs = Date.now() - createdAt;
        return ageMs < 30 * 60 * 1000;
      });

    if (blockingEscrow) throw new Error("Já existe uma transação ativa para este carro");

    // Resolve country & commission dynamically from country_settings
    const { data: sellerProfile } = await supabaseAdmin
      .from("carity_seller_profiles")
      .select("country_code, stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("user_id", listing.seller_id)
      .maybeSingle();
    const countryCode = (sellerProfile?.country_code || "PT").toUpperCase();
    const sellerConnectAccountId = sellerProfile?.stripe_connect_account_id || null;
    const sellerConnectReady = !!sellerProfile?.stripe_connect_charges_enabled && !!sellerConnectAccountId;

    const { data: country } = await supabaseAdmin
      .from("country_settings")
      .select("currency, market_commission_rate, active")
      .eq("code", countryCode)
      .maybeSingle();

    if (!country || !country.active) {
      throw new Error(`O país ${countryCode} ainda não está ativo no Market.`);
    }

    const currency = (country.currency || "EUR").toLowerCase();
    const commissionRate = Number(country.market_commission_rate) > 0
      ? Number(country.market_commission_rate)
      : 2; // fallback safety
    const platformFee = Math.round(listing.price * commissionRate) / 100;
    const sellerAmount = listing.price - platformFee;
    const totalCharge = listing.price;

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check/create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Create escrow record (pending)
    const captureMethod = sellerConnectReady ? "manual" : "automatic";
    const isZeroDecimal = ["jpy", "krw", "vnd", "clp"].includes(currency);
    const stripeAmount = isZeroDecimal ? Math.round(totalCharge) : Math.round(totalCharge * 100);
    const stripeAppFee = isZeroDecimal ? Math.round(platformFee) : Math.round(platformFee * 100);

    const { data: escrow, error: escrowError } = await supabaseAdmin
      .from("market_escrow")
      .insert({
        listing_id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        amount: totalCharge,
        platform_fee: platformFee,
        seller_amount: sellerAmount,
        commission_rate: commissionRate,
        capture_method: captureMethod,
        application_fee_amount: platformFee,
        status: "pending",
        delivery_deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
      })
      .select()
      .single();

    if (escrowError) throw new Error("Erro ao criar escrow: " + escrowError.message);

    // Build payment_intent_data dynamically: Connect split + manual capture if seller is onboarded
    const paymentIntentData: Record<string, any> = {
      capture_method: captureMethod,
      metadata: {
        escrow_id: escrow.id,
        listing_id,
        buyer_id: user.id,
        seller_id: listing.seller_id,
        type: "market_escrow",
      },
    };
    if (sellerConnectReady) {
      paymentIntentData.application_fee_amount = stripeAppFee;
      paymentIntentData.transfer_data = { destination: sellerConnectAccountId };
    }

    // Create Stripe Checkout session
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
              description: `Compra com proteção escrow GarageFlow Market. Fundos retidos até confirmação de entrega.`,
            },
            unit_amount: stripeAmount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      // Auto-enables Pix (BR), iDEAL (NL), Bancontact (BE), SEPA, Klarna, Apple/Google Pay, etc.
      billing_address_collection: "auto",
      payment_intent_data: paymentIntentData,
      metadata: {
        escrow_id: escrow.id,
        listing_id,
        type: "market_escrow",
      },
      success_url: `${origin}/market/car/${listing_id}?escrow=success&escrow_id=${escrow.id}`,
      cancel_url: `${origin}/market/car/${listing_id}?escrow=cancelled`,
    });

    // Update escrow with Stripe session ID
    await supabaseAdmin
      .from("market_escrow")
      .update({ stripe_session_id: session.id })
      .eq("id", escrow.id);

    return new Response(JSON.stringify({ url: session.url, escrow_id: escrow.id }), {
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
