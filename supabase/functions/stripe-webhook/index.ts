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

    // SECURITY: webhook signature is mandatory. Reject unsigned payloads to
    // prevent forged events from arbitrary callers (PCI-DSS / RGPD hardening).
    if (!webhookSecret || !sig) {
      log("REJECTED: missing webhook signature or secret");
      return new Response(JSON.stringify({ error: "signature_required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    try {
      event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
    } catch (sigErr: any) {
      log("REJECTED: invalid signature", { error: sigErr.message });
      return new Response(JSON.stringify({ error: "invalid_signature" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
    log("Signature verified");

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
            .update({ status: "active", revenue_type: "stripe_paid", updated_at: new Date().toISOString() })
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
              revenue_type: status === "trialing" ? "trial" : "stripe_paid",
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
              revenue_type: "free",
              current_period_end: null,
              trial_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          log("Subscription deleted — downgraded to free", { customerId });
        }
        break;
      }

      // ============= MARKET ESCROW HANDLERS =============
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const escrowId = pi.metadata?.escrow_id;
        const type = pi.metadata?.type;
        if (!escrowId || type !== "market_escrow") break;

        const { data: escrow } = await supabaseAdmin
          .from("market_escrow")
          .select("id, status, listing_id, seller_id, buyer_id, amount")
          .eq("id", escrowId)
          .single();

        if (!escrow) {
          log("Escrow not found for payment_intent.succeeded", { escrowId });
          break;
        }
        if (escrow.status !== "pending") {
          log("Escrow already processed", { escrowId, status: escrow.status });
          break;
        }

        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: "paid",
            stripe_payment_intent_id: pi.id,
            stripe_verified: true,
            satisfaction_window_ends_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", escrowId);

        // Reserve listing
        await supabaseAdmin
          .from("carity_listings")
          .update({ status: "reserved" })
          .eq("id", escrow.listing_id);

        // Notify seller
        await supabaseAdmin.from("notifications").insert({
          shop_id: escrow.seller_id, // notification per user fallback
          user_id: escrow.seller_id,
          type: "escrow_paid",
          title: "Pagamento confirmado",
          message: `Pagamento de €${escrow.amount} confirmado e retido em escrow.`,
        }).then(() => {}, () => {});

        log("Market escrow paid", { escrowId, amount: escrow.amount });
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const escrowId = pi.metadata?.escrow_id;
        if (!escrowId || pi.metadata?.type !== "market_escrow") break;

        await supabaseAdmin
          .from("market_escrow")
          .update({ status: "failed", updated_at: new Date().toISOString() })
          .eq("id", escrowId)
          .eq("status", "pending");
        log("Market escrow payment failed", { escrowId });
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const piId = charge.payment_intent as string;
        if (!piId) break;

        const { data: escrow } = await supabaseAdmin
          .from("market_escrow")
          .select("id, listing_id, status")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();

        if (!escrow) break;

        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: "refunded",
            refunded_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", escrow.id);

        // Re-publish listing
        await supabaseAdmin
          .from("carity_listings")
          .update({ status: "published" })
          .eq("id", escrow.listing_id);

        log("Market escrow refunded", { escrowId: escrow.id, amount: charge.amount_refunded });
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = dispute.payment_intent as string;
        if (!piId) break;

        const { data: escrow } = await supabaseAdmin
          .from("market_escrow")
          .select("id, seller_id, buyer_id, amount")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();
        if (!escrow) break;

        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: "disputed",
            disputed_at: new Date().toISOString(),
            buyer_dispute_reason: dispute.reason || "Disputa Stripe",
            updated_at: new Date().toISOString(),
          })
          .eq("id", escrow.id);

        await supabaseAdmin.from("audit_risk_flags").insert({
          flag_type: "stripe_dispute",
          entity_type: "market_escrow",
          entity_id: escrow.id,
          severity: "critical",
          description: `Disputa Stripe aberta: ${dispute.reason} — €${escrow.amount}`,
          details: { dispute_id: dispute.id, reason: dispute.reason, status: dispute.status },
        });

        log("Stripe dispute opened on escrow", { escrowId: escrow.id, disputeId: dispute.id });
        break;
      }

      case "charge.dispute.closed": {
        const dispute = event.data.object as Stripe.Dispute;
        const piId = dispute.payment_intent as string;
        if (!piId) break;

        const { data: escrow } = await supabaseAdmin
          .from("market_escrow")
          .select("id, listing_id")
          .eq("stripe_payment_intent_id", piId)
          .maybeSingle();
        if (!escrow) break;

        const newStatus = dispute.status === "won" ? "paid" : "refunded";
        await supabaseAdmin
          .from("market_escrow")
          .update({
            status: newStatus,
            resolved_at: new Date().toISOString(),
            resolution_notes: `Disputa Stripe fechada: ${dispute.status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", escrow.id);

        if (newStatus === "refunded") {
          await supabaseAdmin
            .from("carity_listings")
            .update({ status: "published" })
            .eq("id", escrow.listing_id);
        }

        log("Stripe dispute closed", { escrowId: escrow.id, outcome: dispute.status });
        break;
      }
      // ============= END MARKET ESCROW =============

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