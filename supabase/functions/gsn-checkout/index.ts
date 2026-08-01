import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Cria uma sessão de Stripe Checkout por encomenda GSN.
 * Body: { order_ids: string[] }  (retornados por gsn_cart_checkout)
 * Usa destination charges: application_fee_amount = commission_total, transfer_data.destination = supplier.stripe_account_id
 * Fallback (fornecedor sem Connect activo): checkout na conta plataforma sem transfer.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not set");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const supa = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const auth = req.headers.get("Authorization");
    if (!auth) throw new Error("Missing Authorization");
    const { data: u } = await supa.auth.getUser(auth.replace("Bearer ", ""));
    const user = u?.user;
    if (!user) throw new Error("Unauthorized");

    const body = await req.json().catch(() => ({}));
    const orderIds: string[] = Array.isArray(body?.order_ids) ? body.order_ids : [];
    if (!orderIds.length) throw new Error("order_ids obrigatório");

    const origin = req.headers.get("origin") || "https://garageflow.pt";
    const sessions: { order_id: string; url: string | null; error?: string }[] = [];

    for (const orderId of orderIds) {
      try {
        const { data: order } = await supa
          .from("gsn_orders")
          .select("id, supplier_id, buyer_user_id, total, currency, commission_total, status")
          .eq("id", orderId).maybeSingle();
        if (!order) throw new Error("Encomenda não encontrada");
        if (order.buyer_user_id !== user.id) throw new Error("Sem permissão");
        if (!["pending", "cart"].includes(order.status)) throw new Error(`Estado inválido: ${order.status}`);

        const { data: items } = await supa
          .from("gsn_order_items").select("title, quantity, unit_price, vat").eq("order_id", orderId);

        const { data: supplier } = await supa
          .from("gsn_suppliers")
          .select("company_name, stripe_account_id, stripe_charges_enabled")
          .eq("id", order.supplier_id).maybeSingle();

        const currency = (order.currency || "eur").toLowerCase();
        const line_items = (items ?? []).map((it: any) => {
          const unit = Math.round(Number(it.unit_price) * (1 + Number(it.vat) / 100) * 100);
          return {
            price_data: {
              currency,
              product_data: { name: it.title },
              unit_amount: unit,
            },
            quantity: it.quantity,
          };
        });

        const useConnect = supplier?.stripe_account_id && supplier?.stripe_charges_enabled;
        const totalCents = Math.round(Number(order.total) * 100);
        const feeCents = Math.round(Number(order.commission_total) * 100);

        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          line_items,
          success_url: `${origin}/parts/orders/${orderId}?paid=1`,
          cancel_url: `${origin}/parts/cart?cancelled=1`,
          client_reference_id: orderId,
          metadata: { gsn_order_id: orderId, supplier_id: order.supplier_id },
          payment_intent_data: useConnect ? {
            application_fee_amount: feeCents,
            transfer_data: { destination: supplier.stripe_account_id },
            metadata: { gsn_order_id: orderId },
          } : { metadata: { gsn_order_id: orderId } },
        });

        await supa.from("gsn_payments").insert({
          supplier_id: order.supplier_id, order_id: orderId,
          status: "pending", amount: order.total, currency,
          stripe_payment_intent_id: typeof session.payment_intent === "string" ? session.payment_intent : null,
          metadata: { checkout_session: session.id, connect: !!useConnect },
        });

        sessions.push({ order_id: orderId, url: session.url });
      } catch (e) {
        sessions.push({ order_id: orderId, url: null, error: (e as Error).message });
      }
    }

    return new Response(JSON.stringify({ sessions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
    });
  }
});
