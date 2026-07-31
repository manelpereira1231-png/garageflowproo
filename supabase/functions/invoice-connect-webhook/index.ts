/**
 * invoice-connect-webhook
 * -----------------------
 * Endpoint dedicado aos eventos Stripe **Connect** (pagamentos que entram
 * diretamente nas contas das oficinas). Marca a fatura como paga de forma
 * idempotente, independentemente de o cliente voltar (ou não) ao browser.
 *
 * Configurar no Stripe: Developers → Webhooks → "Connect applications"
 *   URL: https://<project>.functions.supabase.co/invoice-connect-webhook
 *   Eventos: checkout.session.completed, checkout.session.async_payment_succeeded
 *   Segredo: guardar em INVOICE_STRIPE_WEBHOOK_SECRET
 */
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { markInvoicePaidFromSession } from "../_shared/markInvoicePaid.ts";

const log = (msg: string, data?: unknown) =>
  console.log(`[INVOICE-CONNECT-WEBHOOK] ${msg}`, data ? JSON.stringify(data) : "");

Deno.serve(async (req) => {
  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return new Response(JSON.stringify({ error: "stripe_not_configured" }), { status: 500 });

    const secret =
      Deno.env.get("INVOICE_STRIPE_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const sig = req.headers.get("stripe-signature");
    const raw = await req.text();

    if (!secret || !sig) {
      log("REJEITADO: assinatura em falta");
      return new Response(JSON.stringify({ error: "signature_required" }), { status: 401 });
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(raw, sig, secret);
    } catch (e) {
      log("REJEITADO: assinatura inválida", { error: (e as Error).message });
      return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401 });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Idempotência ao nível do evento (Stripe reenvia em caso de falha)
    const { error: dupErr } = await admin
      .from("stripe_webhook_events")
      .insert({ event_id: event.id, event_type: event.type });
    if (dupErr && (dupErr as any).code === "23505") {
      log("Evento duplicado — ignorado", { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }

    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const result = await markInvoicePaidFromSession(
        admin,
        {
          id: session.id,
          payment_status: session.payment_status,
          payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : null,
          amount_total: session.amount_total,
          currency: session.currency,
          metadata: session.metadata as Record<string, string> | null,
        },
        log,
      );
      log("Resultado", { account: event.account ?? "platform", ...result });
    } else {
      log(`Evento não tratado: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    log("ERRO", { message: (e as Error).message });
    // 200 evita retries infinitos por erros não recuperáveis; o log fica registado.
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 200 });
  }
});
