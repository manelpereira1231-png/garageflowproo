import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map Stripe product IDs to plan names
const PRODUCT_TO_PLAN: Record<string, string> = {
  "prod_U1qtELk15j9qK8": "pro",
  "prod_U1qvDO5egIyQ3W": "garage",
  "prod_U1qz5Zuk431eAk": "pro",
  "prod_U1qzCQc94eTGPu": "garage",
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
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;

    // Check active or trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    const activeSub = subscriptions.data.find(s => ["active", "trialing"].includes(s.status));

    if (!activeSub) {
      // Update local DB to free
      const { data: shop } = await supabaseClient.from("shops").select("id").eq("user_id", user.id).single();
      if (shop) {
        await supabaseClient.from("subscriptions").update({
          plan: "free",
          status: "active",
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          trial_end: null,
          current_period_end: null,
        }).eq("shop_id", shop.id);
      }

      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const productId = activeSub.items.data[0].price.product as string;
    const plan = PRODUCT_TO_PLAN[productId] || "pro";
    const subscriptionEnd = new Date(activeSub.current_period_end * 1000).toISOString();
    const trialEnd = activeSub.trial_end ? new Date(activeSub.trial_end * 1000).toISOString() : null;

    // Sync to local DB
    const { data: shop } = await supabaseClient.from("shops").select("id").eq("user_id", user.id).single();
    if (shop) {
      await supabaseClient.from("subscriptions").update({
        plan,
        status: activeSub.status === "trialing" ? "trialing" : "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: activeSub.id,
        trial_end: trialEnd,
        current_period_end: subscriptionEnd,
      }).eq("shop_id", shop.id);
    }

    return new Response(JSON.stringify({
      subscribed: true,
      plan,
      status: activeSub.status,
      subscription_end: subscriptionEnd,
      trial_end: trialEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
