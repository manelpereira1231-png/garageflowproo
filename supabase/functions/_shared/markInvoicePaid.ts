/**
 * Marca uma fatura do ERP como paga a partir de um evento Stripe.
 * Idempotente: se a fatura já estiver marcada como paga (paid_online_at),
 * não volta a escrever nem duplica registos.
 *
 * Usado por:
 *  - stripe-webhook            (pagamentos na conta da plataforma)
 *  - invoice-connect-webhook   (pagamentos em contas Stripe Connect das oficinas)
 */
import { recordManualPayout } from "./recordManualPayout.ts";

export interface MarkInvoiceResult {
  handled: boolean;
  already_paid?: boolean;
  invoice_id?: string;
  reason?: string;
}

export async function markInvoicePaidFromSession(
  admin: any,
  session: {
    id: string;
    payment_status?: string | null;
    payment_intent?: string | null;
    amount_total?: number | null;
    currency?: string | null;
    metadata?: Record<string, string> | null;
  },
  log: (msg: string, data?: unknown) => void = () => {},
): Promise<MarkInvoiceResult> {
  const invoiceId = session.metadata?.invoice_id;
  if (!invoiceId) return { handled: false, reason: "no_invoice_metadata" };

  if (session.payment_status && session.payment_status !== "paid") {
    log("Sessão de fatura ainda não paga", { session: session.id, status: session.payment_status });
    return { handled: false, invoice_id: invoiceId, reason: "not_paid" };
  }

  const { data: inv } = await admin
    .from("invoices")
    .select("id, status, paid_online_at, shop_id, number")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!inv) {
    log("Fatura do metadata não existe", { invoiceId });
    return { handled: false, invoice_id: invoiceId, reason: "invoice_not_found" };
  }

  // IDEMPOTÊNCIA: já paga → não repete nada.
  if (inv.paid_online_at) {
    log("Fatura já estava paga — ignorado", { invoiceId });
    return { handled: true, already_paid: true, invoice_id: invoiceId };
  }

  const { error } = await admin
    .from("invoices")
    .update({
      paid_online_at: new Date().toISOString(),
      status: "paid",
      stripe_payment_session_id: session.id,
    })
    .eq("id", invoiceId)
    .is("paid_online_at", null); // guarda extra contra corrida entre webhook e redirect

  if (error) {
    log("Erro a marcar fatura paga", { invoiceId, error: error.message });
    throw new Error(error.message);
  }

  // Pagamento recebido na conta da plataforma → regista repasse manual + comissão.
  await recordManualPayout(admin, {
    invoiceId,
    stripeSessionId: session.id,
    amountTotalCents: session.amount_total ?? null,
    currency: session.currency ?? null,
  }, (m, d) => log(m, d));

  log("Fatura marcada como paga via webhook", { invoiceId, session: session.id });
  return { handled: true, already_paid: false, invoice_id: invoiceId };
}
