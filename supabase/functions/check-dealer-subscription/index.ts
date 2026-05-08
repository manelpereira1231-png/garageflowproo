import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PRICE_TO_PLAN: Record<string, string> = {
  price_1TUwrfKIsGuKgNEHtW35bMXH: "starter",
  price_1TUwruKIsGuKgNEHsSih4I2Q: "pro",
  price_1TUwstKIsGuKgNEH5KhkstSG: "unlimited",
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

    const { data: profile } = await supabase
      .from("carity_seller_profiles")
      .select("dealer_stripe_customer_id, account_type")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile || profile.account_type !== "dealer") {
      return new Response(
        JSON.stringify({ subscribed: false, plan: "free", reason: "not_dealer" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let customerId = profile.dealer_stripe_customer_id;
    if (!customerId) {
      const list = await stripe.customers.list({ email: user.email, limit: 1 });
      if (list.data.length === 0) {
        await supabase
          .from("carity_seller_profiles")
          .update({ dealer_plan: "free", dealer_subscription_status: "none", dealer_active_until: null })
          .eq("user_id", user.id);
        return new Response(
          JSON.stringify({ subscribed: false, plan: "free" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      customerId = list.data[0].id;
      await supabase.from("carity_seller_profiles").update({ dealer_stripe_customer_id: customerId }).eq("user_id", user.id);
    }

    const subs = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 5 });
    const active = subs.data.find((s) => ["active", "trialing", "past_due"].includes(s.status));

    if (!active) {
      await supabase
        .from("carity_seller_profiles")
        .update({ dealer_plan: "free", dealer_subscription_status: "none", dealer_active_until: null, dealer_stripe_subscription_id: null, dealer_stripe_price_id: null })
        .eq("user_id", user.id);
      return new Response(
        JSON.stringify({ subscribed: false, plan: "free" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const priceId = active.items.data[0].price.id;
    const plan = PRICE_TO_PLAN[priceId] || "starter";
    const periodEnd = new Date(active.current_period_end * 1000).toISOString();

    await supabase
      .from("carity_seller_profiles")
      .update({
        dealer_plan: plan,
        dealer_subscription_status: active.status,
        dealer_active_until: periodEnd,
        dealer_stripe_subscription_id: active.id,
        dealer_stripe_price_id: priceId,
      })
      .eq("user_id", user.id);

    return new Response(
      JSON.stringify({ subscribed: true, plan, status: active.status, period_end: periodEnd }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
