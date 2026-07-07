import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (msg: string, data?: any) =>
  console.log(`[CHECK-SUB] ${msg}`, data ? JSON.stringify(data) : "");

function resolvePlan(amount: number): string {
  if (amount >= 9900) return "garage";
  if (amount >= 4900) return "pro";
  return "free";
}

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

    // Find user's shop
    const { data: shop } = await supabaseClient
      .from("shops")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (!shop) {
      log("No shop found for user", { userId: user.id });
      return new Response(JSON.stringify({ subscribed: false, plan: "free" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CRITICAL: Check if this subscription is Stripe-managed.
    // If no stripe_subscription_id exists, the plan was set manually by admin — DO NOT overwrite.
    const { data: existingSub } = await supabaseClient
      .from("subscriptions")
      .select("stripe_subscription_id, plan, status, revenue_type, current_period_end")
      .eq("shop_id", shop.id)
      .maybeSingle();

    // Admin-managed plan (no Stripe subscription id, revenue_type = manual_admin).
    // If the admin-set period has expired, mark as past_due so the app locks
    // premium access — there is no free tier, the "Start" plan costs money too.
    const now = Date.now();
    const adminExpired = existingSub &&
      existingSub.revenue_type === "manual_admin" &&
      existingSub.current_period_end &&
      new Date(existingSub.current_period_end).getTime() < now;

    if (adminExpired) {
      await supabaseClient.from("subscriptions").update({
        status: "past_due",
        revenue_type: "free",
        updated_at: new Date().toISOString(),
      }).eq("shop_id", shop.id);
      log("Admin-managed plan expired — marked past_due", { shopId: shop.id });
      return new Response(JSON.stringify({
        subscribed: false,
        plan: existingSub.plan,
        status: "past_due",
        admin_managed: false,
        must_subscribe: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isManualAdminPlan = existingSub &&
      !existingSub.stripe_subscription_id &&
      existingSub.plan !== "free" &&
      existingSub.status === "active" &&
      existingSub.revenue_type === "manual_admin";

    if (isManualAdminPlan) {
      log("Subscription is admin-managed (no stripe_subscription_id), skipping sync", {
        shopId: shop.id,
        plan: existingSub.plan,
      });
      return new Response(JSON.stringify({
        subscribed: existingSub.plan !== "free",
        plan: existingSub.plan,
        status: existingSub.status,
        admin_managed: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      // No Stripe customer — no paid subscription exists.
      // There is NO free tier: mark as past_due so the app forces subscription.
      if (existingSub) {
        await supabaseClient.from("subscriptions").update({
          plan: existingSub.plan || "free",
          status: "past_due",
          revenue_type: "free",
          stripe_customer_id: null,
          stripe_subscription_id: null,
          updated_at: new Date().toISOString(),
        }).eq("shop_id", shop.id);
      }

      return new Response(JSON.stringify({
        subscribed: false,
        plan: existingSub?.plan || "free",
        status: "past_due",
        must_subscribe: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const customerId = customers.data[0].id;

    // Check active or trialing subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });

    const activeSub = subscriptions.data.find((s: any) => ["active", "trialing"].includes(s.status));

    if (!activeSub) {
      // No active subscription — mark as past_due (NO free tier).
      await supabaseClient.from("subscriptions").update({
        plan: existingSub?.plan || "free",
        status: "past_due",
        revenue_type: "free",
        stripe_customer_id: customerId,
        stripe_subscription_id: null,
        updated_at: new Date().toISOString(),
      }).eq("shop_id", shop.id);

      log("No active Stripe sub — marked past_due (no free tier)", { customerId });

      return new Response(JSON.stringify({
        subscribed: false,
        plan: existingSub?.plan || "free",
        status: "past_due",
        must_subscribe: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Active subscription found — sync to DB
    const amount = activeSub.items.data[0]?.price?.unit_amount || 0;
    const plan = resolvePlan(amount);
    const interval = activeSub.items.data[0]?.price?.recurring?.interval;
    const billingCycle = interval === "year" ? "yearly" : "monthly";
    const subscriptionEnd = new Date(activeSub.current_period_end * 1000).toISOString();
    const trialEnd = activeSub.trial_end ? new Date(activeSub.trial_end * 1000).toISOString() : null;
    const status = activeSub.status === "trialing" ? "trialing" : "active";

    await supabaseClient.from("subscriptions").update({
      plan,
      billing_cycle: billingCycle,
      status,
      revenue_type: status === "active" && plan !== "free" ? "stripe_paid" : status === "trialing" ? "trial" : "free",
      stripe_customer_id: customerId,
      stripe_subscription_id: activeSub.id,
      trial_end: trialEnd,
      current_period_end: subscriptionEnd,
      updated_at: new Date().toISOString(),
    }).eq("shop_id", shop.id);

    log("Synced subscription", { customerId, plan, status, billingCycle });

    return new Response(JSON.stringify({
      subscribed: true,
      plan,
      status,
      billing_cycle: billingCycle,
      subscription_end: subscriptionEnd,
      trial_end: trialEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
