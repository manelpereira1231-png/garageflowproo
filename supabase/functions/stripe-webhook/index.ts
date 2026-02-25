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
    } else {
      // Fallback: parse without signature verification (development)
      event = JSON.parse(body) as Stripe.Event;
      log("WARNING: No webhook signature verification");
    }

    log(`Received event: ${event.type}`);

    switch (event.type) {
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        // Find subscription by stripe_customer_id
        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("id, shop_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "active", updated_at: new Date().toISOString() })
            .eq("id", sub.id);
          log("Invoice paid — subscription activated", { customerId });
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("id, shop_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "past_due", updated_at: new Date().toISOString() })
            .eq("id", sub.id);

          // Create payment_failed alert
          await supabaseAdmin.from("alerts").insert({
            shop_id: sub.shop_id,
            type: "payment_failed",
            title: "Pagamento falhado",
            message: "O pagamento da sua subscrição falhou. Por favor atualize o seu método de pagamento.",
            status: "pending",
          });

          log("Payment failed — alert created", { customerId });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          const planItem = subscription.items?.data[0];
          let plan = "free";
          const amount = planItem?.price?.unit_amount || 0;
          if (amount >= 9900) plan = "garage";
          else if (amount >= 4900) plan = "pro";

          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: subscription.status === "trialing" ? "trialing" : subscription.status === "active" ? "active" : subscription.status,
              plan,
              current_period_end: subscription.current_period_end
                ? new Date(subscription.current_period_end * 1000).toISOString()
                : null,
              trial_end: subscription.trial_end
                ? new Date(subscription.trial_end * 1000).toISOString()
                : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          log("Subscription updated", { customerId, plan, status: subscription.status });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: sub } = await supabaseAdmin
          .from("subscriptions")
          .select("id, shop_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (sub) {
          await supabaseAdmin
            .from("subscriptions")
            .update({
              status: "canceled",
              plan: "free",
              updated_at: new Date().toISOString(),
            })
            .eq("id", sub.id);

          log("Subscription canceled — downgraded to free", { customerId });
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
