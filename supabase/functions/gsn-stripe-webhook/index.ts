import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const secret = Deno.env.get("GSN_STRIPE_WEBHOOK_SECRET");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const sig = req.headers.get("stripe-signature");
    const raw = await req.text();
    let event: Stripe.Event;
    if (secret && sig) {
      event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
    } else {
      event = JSON.parse(raw) as Stripe.Event;
    }

    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const markPaid = async (orderId: string, pi?: string | null) => {
      await supa.rpc("gsn_order_transition" as any, {
        _order_id: orderId, _new_state: "paid", _note: "Stripe payment received",
      });
      if (pi) {
        await supa.from("gsn_payments").update({
          status: "captured", stripe_payment_intent_id: pi, updated_at: new Date().toISOString(),
        }).eq("order_id", orderId);
      }
      // Fire-and-forget notification
      try {
        await supa.functions.invoke("gsn-notify-order-event", {
          body: { order_id: orderId, event: "paid" },
        });
      } catch (_e) { /* ignore */ }
    };


    switch (event.type) {
      case "checkout.session.completed": {
        const s = event.data.object as Stripe.Checkout.Session;
        const orderId = s.metadata?.gsn_order_id || s.client_reference_id;
        if (orderId && s.payment_status === "paid") {
          await markPaid(orderId, typeof s.payment_intent === "string" ? s.payment_intent : null);
        }
        break;
      }
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.gsn_order_id;
        if (orderId) await markPaid(orderId, pi.id);
        break;
      }
      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.gsn_order_id;
        if (orderId) {
          await supa.from("gsn_payments").update({ status: "failed" }).eq("order_id", orderId);
        }
        break;
      }
      case "account.updated": {
        const acct = event.data.object as Stripe.Account;
        await supa.from("gsn_suppliers").update({
          stripe_charges_enabled: acct.charges_enabled,
          stripe_payouts_enabled: acct.payouts_enabled,
        }).eq("stripe_account_id", acct.id);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
