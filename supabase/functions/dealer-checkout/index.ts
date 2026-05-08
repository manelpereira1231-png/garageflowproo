import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_IDS: Record<string, { price: string; plan: string }> = {
  starter: { price: "price_1TUwrfKIsGuKgNEHtW35bMXH", plan: "starter" },
  pro: { price: "price_1TUwruKIsGuKgNEHsSih4I2Q", plan: "pro" },
  unlimited: { price: "price_1TUwstKIsGuKgNEH5KhkstSG", plan: "unlimited" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData.user?.email) throw new Error("Not authenticated");
    const user = userData.user;

    const body = await req.json();
    const action = body.action || "checkout";

    const { data: profile } = await supabase
      .from("carity_seller_profiles")
      .select("dealer_stripe_customer_id, dealer_company_name, account_type")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.account_type !== "dealer") {
      throw new Error("Conta não é de Stand");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Resolve customer
    let customerId = profile.dealer_stripe_customer_id;
    if (!customerId) {
      const existing = await stripe.customers.list({ email: user.email, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      } else {
        const c = await stripe.customers.create({
          email: user.email,
          name: profile.dealer_company_name || user.email,
          metadata: { user_id: user.id, account_type: "dealer" },
        });
        customerId = c.id;
      }
      await supabase
        .from("carity_seller_profiles")
        .update({ dealer_stripe_customer_id: customerId })
        .eq("user_id", user.id);
    }

    const origin = req.headers.get("origin") || "https://www.garageflow.pt";

    // PORTAL
    if (action === "portal") {
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/market/dealer-dashboard`,
      });
      return new Response(JSON.stringify({ url: portal.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CHECKOUT
    const planKey = String(body.plan || "").toLowerCase();
    const target = PRICE_IDS[planKey];
    if (!target) throw new Error("Plano inválido");

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: target.price, quantity: 1 }],
      allow_promotion_codes: true,
      success_url: `${origin}/market/dealer-dashboard?upgraded=${target.plan}`,
      cancel_url: `${origin}/market/dealer-dashboard?canceled=1`,
      metadata: { user_id: user.id, dealer_plan: target.plan, kind: "dealer_subscription" },
      subscription_data: {
        metadata: { user_id: user.id, dealer_plan: target.plan, kind: "dealer_subscription" },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
