/**
 * Regista o repasse manual devido à oficina quando um pagamento de fatura
 * entra na conta Stripe da PLATAFORMA (oficina sem Stripe Connect ativo).
 *
 * Calcula: valor total recebido, comissão retida (platform_settings
 * .invoice_payments.platform_fee_percent, 3% por defeito) e valor líquido
 * a transferir. Idempotente por invoice_id (UNIQUE + upsert ignore).
 */
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

    // Se a oficina recebe diretamente via Connect não há repasse manual.
    if (shop?.stripe_connect_account_id && shop?.stripe_connect_charges_enabled) return;

    let feePercent = 3;
    const { data: feeSetting } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "invoice_payments")
      .maybeSingle();
    const rawFee = (feeSetting?.value as { platform_fee_percent?: number } | null)?.platform_fee_percent;
    if (typeof rawFee === "number" && rawFee >= 0 && rawFee <= 30) feePercent = rawFee;

    const gross = args.amountTotalCents != null
      ? Number(args.amountTotalCents) / 100
      : Number(inv.total || 0);
    const fee = Math.round(gross * feePercent) / 100;
    const net = Math.round((gross - fee) * 100) / 100;

    const { error } = await admin.from("manual_payouts").insert({
      invoice_id: inv.id,
      shop_id: inv.shop_id,
      invoice_number: inv.number ? String(inv.number) : null,
      gross_amount: gross,
      fee_percent: feePercent,
      fee_amount: fee,
      net_amount: net,
      currency: String(args.currency || shop?.currency || "EUR").toUpperCase(),
      stripe_session_id: args.stripeSessionId ?? null,
      status: "pending",
    });
    // 23505 = já existia (idempotência)
    if (error && error.code !== "23505") log("Erro a registar repasse manual", error.message);
    else if (!error) log("Repasse manual registado", { invoice: inv.id, fee, net });
  } catch (e) {
    log("Falha inesperada no repasse manual", (e as Error).message);
  }
}
