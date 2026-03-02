import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-08-27.basil",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

const log = (msg: string, data?: any) =>
  console.log(`[STRIPE-WEBHOOK] ${msg}`, data ? JSON.stringify(data) : "");

// Resolve plan from Stripe subscription price amount
function resolvePlan(subscription: Stripe.Subscription): string {
  const item = subscription.items?.data[0];
  if (!item) return "free";
  const amount = item.price?.unit_amount || 0;
  // Garage: €99/mo (9900) or €990/yr (99000)
  if (amount >= 9900) return "garage";
  // Pro: €49/mo (4900) or €490/yr (49000)
  if (amount >= 4900) return "pro";
  return "free";
}

// Resolve billing cycle from Stripe interval
function resolveBillingCycle(subscription: Stripe.Subscription): string {
  const interval = subscription.items?.data[0]?.price?.recurring?.interval;
  return interval === "year" ? "yearly" : "monthly";
}

// Find subscription record by stripe_customer_id
async function findSubByCustomer(customerId: string) {
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("id, shop_id")
    .eq("stripe_customer_id", customerId)
    .single();
  return data;
}

// If no subscription found by customer_id, try to find by user email → shop
async function findSubByEmail(email: string) {
  // Find user by email in auth — use targeted lookup instead of listing all users
  const { data: usersRes } = await supabaseAdmin.auth.admin.listUsers({ filter: email, perPage: 1 });
  const user = usersRes?.users?.[0];
  if (!user || user.email !== email) return null;
  
  const { data: shop } = await supabaseAdmin
    .from("shops")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .single();
  if (!shop) return null;
  
  const { data: sub } = await supabaseAdmin
    .from("subscriptions")
    .select("id, shop_id")
    .eq("shop_id", shop.id)
    .single();
  return sub;
}

async function findSubscription(customerId: string) {
  let sub = await findSubByCustomer(customerId);
  if (sub) return sub;
  
  // Fallback: look up customer email in Stripe, then match
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer && !customer.deleted && customer.email) {
      sub = await findSubByEmail(customer.email);
      // Link the stripe_customer_id for future lookups
      if (sub) {
        await supabaseAdmin
          .from("subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("id", sub.id);
        log("Linked stripe_customer_id to subscription", { customerId, subId: sub.id });
      }
    }
  } catch (e) {
    log("Error looking up customer email", { error: (e as Error).message });
  }
  return sub;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
      },
    });
  }

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
      log("Signature verified");
    } else {
      event = JSON.parse(body) as Stripe.Event;
      log("WARNING: No webhook signature verification");
    }

    log(`Received event: ${event.type}`);

    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        const sub = await findSubscription(customerId);
        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          log("Invoice paid — subscription activated", { customerId, subId: sub.id });
        } else {
          log("No subscription found for invoice.paid", { customerId });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        const sub = await findSubscription(customerId);
        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("id", sub.id);

          await supabaseAdmin.from("alerts").insert({
            shop_id: sub.shop_id,
            type: "payment_failed",
            title: "Pagamento falhado",
            message: "O pagamento da sua subscrição falhou. Por favor atualize o seu método de pagamento.",
            status: "pending",
          });

          log("Payment failed — status past_due, alert created", { customerId });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const sub = await findSubscription(customerId);
        if (sub) {
          const plan = resolvePlan(subscription);
          const billingCycle = resolveBillingCycle(subscription);
          
          // Map Stripe status to our status
          let status = subscription.status;
          if (status === "trialing") status = "trialing";
          else if (status === "active") status = "active";
          else if (status === "past_due") status = "past_due";
          else if (status === "canceled" || status === "unpaid") status = "canceled";

          await supabaseAdmin
            .from("subscriptions")
            .update({
              status,
              plan,
              billing_cycle: billingCycle,
              stripe_subscription_id: subscription.id,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          log("Subscription updated", { customerId, plan, status, billingCycle });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const sub = await findSubscription(customerId);
        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "canceled",
              plan: "free",
              stripe_subscription_id: null,
              current_period_end: null,
              trial_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          log("Subscription deleted — downgraded to free", { customerId });
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        if (!customerId || !subscriptionId) break;

        // Fetch the full subscription from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
        const plan = resolvePlan(stripeSub);
        const billingCycle = resolveBillingCycle(stripeSub);

        const sub = await findSubscription(customerId);
        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              plan,
              billing_cycle: billingCycle,
              status: stripeSub.status === "trialing" ? "trialing" : "active",
              stripe_customer_id: customerId,
              stripe_subscription_id: subscriptionId,
              current_period_end: stripeSub.current_period_end
                ? new Date(stripeSub.current_period_end * 1000).toISOString()
                : null,
              trial_end: stripeSub.trial_end
                ? new Date(stripeSub.trial_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          log("Checkout completed — subscription synced", { customerId, plan, billingCycle });
        }
        break;
      }

      default:
        log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    log("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
});