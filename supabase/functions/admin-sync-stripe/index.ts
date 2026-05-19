import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (message: string, data?: unknown) =>
  console.log(`[ADMIN-SYNC-STRIPE] ${message}`, data ? JSON.stringify(data) : "");

function normalizePlan(price: Stripe.Price): "free" | "pro" | "garage" {
  const lookup = `${price.lookup_key || ""} ${price.nickname || ""} ${price.id}`.toLowerCase();
  if (lookup.includes("garage")) return "garage";
  if (lookup.includes("pro")) return "pro";
  const monthlyAmount = price.recurring?.interval === "year"
    ? Math.round((price.unit_amount || 0) / 12)
    : (price.unit_amount || 0);
  if (monthlyAmount >= 9000) return "garage";
  if (monthlyAmount >= 4000) return "pro";
  return "free";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");

    const { data: isAdmin, error: adminError } = await supabaseClient.rpc("is_super_admin", { _user_id: userData.user.id });
    if (adminError || isAdmin !== true) throw new Error("Not authorized");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const shopsByEmail = new Map<string, any>();
    const { data: shops } = await supabaseClient
      .from("shops")
      .select("id, email, user_id")
      .limit(1000);

    (shops || []).forEach((shop: any) => {
      if (shop.email) shopsByEmail.set(String(shop.email).toLowerCase(), shop);
    });

    let synced = 0;
    let failed = 0;
    let checked = 0;
    const now = new Date().toISOString();

    for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 }).autoPagingIterable()) {
      checked += 1;
      try {
        const customer = typeof sub.customer === "string"
          ? await stripe.customers.retrieve(sub.customer)
          : sub.customer;
        if (!customer || customer.deleted || !customer.email) continue;

        const shop = shopsByEmail.get(customer.email.toLowerCase());
        if (!shop) continue;

        const price = sub.items.data[0]?.price;
        if (!price) continue;

        const activeLike = ["active", "trialing", "past_due", "incomplete"].includes(sub.status);
        if (!activeLike) continue;

        const plan = normalizePlan(price);
        const billingCycle = price.recurring?.interval === "year" ? "yearly" : "monthly";
        const status = sub.status;
        const revenueType = status === "active" && plan !== "free" ? "stripe_paid" : status === "trialing" ? "trial" : "free";

        const { error } = await supabaseClient.from("subscriptions").upsert({
          shop_id: shop.id,
          plan,
          billing_cycle: billingCycle,
          status,
          revenue_type: revenueType,
          stripe_customer_id: customer.id,
          stripe_subscription_id: sub.id,
          trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          current_period_end: sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          updated_at: now,
        }, { onConflict: "shop_id" });

        if (error) throw error;
        synced += 1;
      } catch (error) {
        failed += 1;
        log("Failed to sync subscription", { subscriptionId: sub.id, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return new Response(JSON.stringify({ synced, failed, checked, synced_at: now }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: failed > 0 && synced === 0 ? 500 : 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: message === "Not authorized" ? 403 : 500,
    });
  }
});