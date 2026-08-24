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
    .select("id, status, paid_online_at, shop_id, number, total, client_id")
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

  // Notificar a OFICINA (in-app + email) — o cliente já recebe a confirmação dele.
  await notifyShopInvoicePaid(admin, inv, session, log);

  log("Fatura marcada como paga via webhook", { invoiceId, session: session.id });
  return { handled: true, already_paid: false, invoice_id: invoiceId };
}


/** Notifica a oficina que o cliente liquidou a fatura (sino + email aos membros). */
async function notifyShopInvoicePaid(
  admin: any,
  inv: { id: string; shop_id: string; number?: string | null; total?: number | null; client_id?: string | null },
  session: { amount_total?: number | null; currency?: string | null },
  log: (msg: string, data?: unknown) => void = () => {},
): Promise<void> {
  try {
    const amount = typeof session.amount_total === "number"
      ? session.amount_total / 100
      : Number(inv.total || 0);
    const currency = (session.currency || "eur").toUpperCase();
    const amountStr = `${amount.toFixed(2)} ${currency}`;
    const docNumber = inv.number || inv.id.slice(0, 8);

    let clientName = "";
    if (inv.client_id) {
      const { data: c } = await admin.from("clients").select("name").eq("id", inv.client_id).maybeSingle();
      clientName = (c as any)?.name || "";
    }

    const title = "Pagamento recebido";
    const message = `A fatura ${docNumber}${clientName ? ` (${clientName})` : ""} foi paga online — ${amountStr}.`;

    await admin.from("notifications").insert({
      shop_id: inv.shop_id,
      title,
      message,
      type: "payment",
      link: `/invoices/${inv.id}`,
      data: { invoice_id: inv.id, amount, currency },
    });

    // Email aos membros da oficina (best-effort).
    let emails: string[] = [];
    try {
      const { data: members } = await admin.rpc("get_shop_member_emails", { _shop_id: inv.shop_id });
      emails = (members || [])
        .map((m: any) => m?.email)
        .filter((e: any) => typeof e === "string" && e.includes("@"));
    } catch { /* rpc indisponível → ignora */ }
    if (!emails.length) {
      const { data: shopRow } = await admin.from("shops").select("email").eq("id", inv.shop_id).maybeSingle();
      if ((shopRow as any)?.email) emails = [(shopRow as any).email];
    }

    if (emails.length) {
      const html = `
        <h2 style="margin:0 0 8px;">Pagamento recebido</h2>
        <p style="margin:0 0 16px;">A fatura <strong>${docNumber}</strong>${clientName ? ` do cliente <strong>${clientName}</strong>` : ""} foi liquidada online.</p>
        <p style="margin:0 0 16px;font-size:18px;"><strong>${amountStr}</strong></p>
        <p style="margin:0;">Pode consultar os detalhes na área de Faturas do GarageFlow.</p>
      `;
      await admin.functions.invoke("send-email", {
        body: {
          to: emails,
          subject: `Pagamento recebido — Fatura ${docNumber} (${amountStr})`,
          html,
          branded: true,
          brand: "garageflow",
          preheader: `${docNumber} paga — ${amountStr}`,
        },
      }).catch((e: unknown) => log("send-email falhou", { error: String(e) }));
    }
  } catch (e) {
    log("Falha a notificar a oficina do pagamento", { error: String(e) });
  }
}
