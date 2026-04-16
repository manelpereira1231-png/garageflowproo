// Buyer cancels within 48h satisfaction window after delivery confirmation.
// Refunds the escrow and marks listing back to published (if not yet sold).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import Stripe from "https://esm.sh/stripe@14.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const STRIPE_KEY = Deno.env.get("STRIPE_SECRET_KEY");

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) return new Response(JSON.stringify({ error: "Não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }});

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }});

    const body = await req.json().catch(() => ({}));
    const escrow_id: string | undefined = body.escrow_id;
    const reason: string = (body.reason || "").toString().slice(0, 500);
    if (!escrow_id) return new Response(JSON.stringify({ error: "escrow_id obrigatório" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: escrow, error: escErr } = await admin
      .from("market_escrow")
      .select("*")
      .eq("id", escrow_id)
      .maybeSingle();

    if (escErr || !escrow) return new Response(JSON.stringify({ error: "Escrow não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    if (escrow.buyer_id !== user.id) return new Response(JSON.stringify({ error: "Apenas o comprador pode cancelar" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" }});

    if (!["delivery_confirmed", "paid"].includes(escrow.status)) {
      return new Response(JSON.stringify({ error: "Cancelamento indisponível neste estado" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // Window check: 48h after delivery_confirmed_at OR if status=paid still allow within 48h of created_at as a safety net
    const reference = escrow.delivery_confirmed_at || escrow.created_at;
    const elapsedHours = (Date.now() - new Date(reference).getTime()) / 3600 / 1000;
    if (elapsedHours > 48) {
      return new Response(JSON.stringify({ error: "Janela de 48h expirada. Use disputa formal." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
    }

    // Refund via Stripe if available
    let refundedStripe = false;
    if (STRIPE_KEY && escrow.stripe_payment_intent_id) {
      try {
        const stripe = new Stripe(STRIPE_KEY, { apiVersion: "2024-06-20" });
        await stripe.refunds.create({
          payment_intent: escrow.stripe_payment_intent_id,
          reason: "requested_by_customer",
          metadata: { satisfaction_window: "true", escrow_id },
        });
        refundedStripe = true;
      } catch (e) {
        console.error("Stripe refund failed", e);
      }
    }

    await admin.from("market_escrow").update({
      status: "refunded",
      refunded_at: new Date().toISOString(),
      cancelled_within_window: true,
      buyer_dispute_reason: reason || "Cancelamento dentro da janela de satisfação 48h",
    }).eq("id", escrow_id);

    // Revive listing if it was sold
    await admin.from("carity_listings").update({
      status: "published",
      sold_at: null,
    }).eq("id", escrow.listing_id);

    return new Response(JSON.stringify({
      ok: true,
      refunded: refundedStripe,
      message: refundedStripe
        ? "Reembolso processado. O valor regressa à sua conta em 5-10 dias úteis."
        : "Cancelamento registado. O reembolso será processado manualmente em 24h.",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
