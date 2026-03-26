import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// EUR prices
const EUR_PRICES: Record<string, Record<string, string>> = {
  pro: {
    monthly: "price_1T4YARE1zL2Sl1ZT0iAS9Cmk",
    yearly: "price_1T49EZE1zL2Sl1ZTHGB40FiB",
  },
  garage: {
    monthly: "price_1T4YAeE1zL2Sl1ZTrqc35wZy",
    yearly: "price_1T49EnE1zL2Sl1ZTs0crtbLM",
  },
};

// BRL prices (to be created in Stripe dashboard)
const BRL_PRICES: Record<string, Record<string, string>> = {
  pro: {
    monthly: "price_brl_pro_monthly",
    yearly: "price_brl_pro_yearly",
  },
  garage: {
    monthly: "price_brl_garage_monthly",
    yearly: "price_brl_garage_yearly",
  },
};

// Trial days per region
const TRIAL_DAYS: Record<string, number> = {
  eu: 30,
  br: 15,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Not authenticated");

    const user = userData.user;
    const { plan, billing_cycle, region } = await req.json();

    // Determine region and price map
    const effectiveRegion = region === 'br' ? 'br' : 'eu';
    const PRICES = effectiveRegion === 'br' ? BRL_PRICES : EUR_PRICES;
    const trialDays = TRIAL_DAYS[effectiveRegion];

    if (!plan || !PRICES[plan]) throw new Error("Invalid plan");
    const cycle = billing_cycle || "monthly";
    const priceId = PRICES[plan][cycle];
    if (!priceId) throw new Error("Invalid billing cycle");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Find or create customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    // Always use the custom domain so users don't land on preview URLs
    const rawOrigin = req.headers.get("origin") || "";
    const origin = rawOrigin.includes("lovable.app") || rawOrigin.includes("lovableproject.com") || !rawOrigin
      ? "https://garageflow.pt"
      : rawOrigin;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: {
        trial_period_days: trialDays,
      },
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
