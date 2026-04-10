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

// BRL prices
const BRL_PRICES: Record<string, Record<string, string>> = {
  pro: {
    monthly: "price_1TFP7uE1zL2Sl1ZTQxdzHWRv",
    yearly: "price_1TFP8EE1zL2Sl1ZTorzoNWLQ",
  },
  garage: {
    monthly: "price_1TFP8dE1zL2Sl1ZT7N3wnDIY",
    yearly: "price_1TFP8wE1zL2Sl1ZTuTK1wiqu",
  },
};

const TRIAL_DAYS = 30;

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

    // --- ANTI-FRAUD TRIAL CHECK (server-side only) ---
    // Get user's shop info for NIF/phone cross-check
    const { data: shopData } = await supabaseClient
      .from("shops")
      .select("id, nif, phone")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    const userNif = shopData?.nif || null;
    const userPhone = shopData?.phone || null;
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null;

    // Check trial eligibility via DB function
    const { data: eligible } = await supabaseClient.rpc("check_trial_eligibility", {
      _email: user.email,
      _nif: userNif,
      _phone: userPhone,
      _stripe_customer_id: customerId || null,
    });

    // Also check Stripe: has this customer ever had a trial/subscription?
    let stripeHadTrial = false;
    if (customerId) {
      const subs = await stripe.subscriptions.list({
        customer: customerId,
        limit: 100,
        status: "all",
      });
      stripeHadTrial = subs.data.some(
        (s) => s.trial_start !== null || s.status === "trialing"
      );
    }

    const canTrial = eligible === true && !stripeHadTrial;

    // Always use the custom domain
    const rawOrigin = req.headers.get("origin") || "";
    const origin = rawOrigin.includes("lovable.app") || rawOrigin.includes("lovableproject.com") || !rawOrigin
      ? "https://garageflow.pt"
      : rawOrigin;

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/billing?success=true`,
      cancel_url: `${origin}/billing?canceled=true`,
    };

    // Only add trial if eligible
    if (canTrial) {
      sessionParams.subscription_data = {
        trial_period_days: TRIAL_DAYS,
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Record trial usage if trial was granted
    if (canTrial && shopData) {
      await supabaseClient.from("trial_records").insert({
        user_id: user.id,
        shop_id: shopData.id,
        email: user.email,
        nif: userNif,
        phone: userPhone,
        stripe_customer_id: customerId || null,
        ip_address: clientIp,
        trial_start: new Date().toISOString(),
        trial_end: new Date(Date.now() + TRIAL_DAYS * 86400000).toISOString(),
      });
    }

    return new Response(JSON.stringify({ url: session.url, trial_granted: canTrial }), {
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
