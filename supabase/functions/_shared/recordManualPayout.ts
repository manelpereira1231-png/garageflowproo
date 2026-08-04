/**
 * Regista o resultado financeiro de um pagamento online de fatura.
 *
 *  • Oficina COM Stripe Connect ativo → o Stripe retém automaticamente a
 *    comissão (application_fee) e transfere o resto. Aqui só guardamos o
 *    registo contabilístico em `platform_commissions`.
 *  • Oficina SEM Stripe Connect → o dinheiro entra na conta da plataforma e
 *    fica registado em `manual_payouts` o valor a repassar à oficina.
 *
 * Idempotente por invoice_id (UNIQUE em ambas as tabelas).
 */
import { getPlatformFeePercent } from "./platformFee.ts";
import { fromStripeAmount } from "./stripeCurrency.ts";

export async function recordManualPayout(
  admin: any,
  args: {
    invoiceId: string;
    stripeSessionId?: string | null;
    amountTotalCents?: number | null;
    currency?: string | null;
  },
  log: (msg: string, data?: unknown) => void = () => {},
): Promise<void> {
  try {
    const { data: inv } = await admin
      .from("invoices")
      .select("id, number, total, shop_id")
      .eq("id", args.invoiceId)
      .maybeSingle();
    if (!inv) return;

    const { data: shop } = await admin
      .from("shops")
      .select("currency, stripe_connect_account_id, stripe_connect_charges_enabled")
      .eq("id", inv.shop_id)
      .maybeSingle();

    const currency = String(args.currency || shop?.currency || "EUR");
    const feePercent = await getPlatformFeePercent(admin);

    // Valor bruto: preferimos sempre o valor real cobrado pelo Stripe.
    const gross = args.amountTotalCents != null
      ? fromStripeAmount(Number(args.amountTotalCents), currency)
      : Number(inv.total || 0);

    const fee = Math.round(gross * feePercent) / 100;
    const net = Math.round((gross - fee) * 100) / 100;

    const usesConnect = Boolean(
      shop?.stripe_connect_account_id && shop?.stripe_connect_charges_enabled,
    );

    const row = {
      invoice_id: inv.id,
      shop_id: inv.shop_id,
      invoice_number: inv.number ? String(inv.number) : null,
      gross_amount: gross,
      fee_percent: feePercent,
      fee_amount: fee,
      net_amount: net,
      currency: currency.toUpperCase(),
      stripe_session_id: args.stripeSessionId ?? null,
    };

    if (usesConnect) {
      // Comissão retida automaticamente pelo Stripe — só registo contabilístico.
      const { error } = await admin.from("platform_commissions").insert({
        ...row,
        stripe_account_id: shop?.stripe_connect_account_id ?? null,
        source: "stripe_connect",
      });
      if (error && error.code !== "23505") log("Erro a registar comissão Connect", error.message);
      else if (!error) log("Comissão Connect registada", { invoice: inv.id, fee, net });
      return;
    }

    const { error } = await admin.from("manual_payouts").insert({ ...row, status: "pending" });
    // 23505 = já existia (idempotência)
    if (error && error.code !== "23505") log("Erro a registar repasse manual", error.message);
    else if (!error) log("Repasse manual registado", { invoice: inv.id, fee, net });
  } catch (e) {
    log("Falha inesperada no registo financeiro", (e as Error).message);
  }
}
