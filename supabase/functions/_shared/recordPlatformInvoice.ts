/**
 * Regista uma cobrança Stripe da SUBSCRIÇÃO GARAGEFLOW em `platform_invoices`.
 *
 * NÃO emite nenhum documento fiscal. Enquanto a faturação fiscal do GarageFlow
 * não estiver ativa (`platform_billing_settings.fiscal_billing_active`), o
 * registo fica com `fiscal_status = 'pending_config'`.
 *
 * Idempotente: `stripe_invoice_id` tem índice único — se o Stripe reenviar o
 * mesmo evento, não se cria um segundo registo nem um segundo documento.
 *
 * Nunca lança: uma falha aqui não pode quebrar o processamento do webhook.
 */
// deno-lint-ignore-file no-explicit-any
export async function recordPlatformInvoice(
  admin: any,
  stripeInvoice: any,
  sub: { id: string; shop_id: string } | null,
): Promise<void> {
  try {
    const stripeInvoiceId: string | undefined = stripeInvoice?.id;
    if (!stripeInvoiceId) return;

    const { data: exists } = await admin
      .from("platform_invoices").select("id").eq("stripe_invoice_id", stripeInvoiceId).maybeSingle();
    if (exists) return; // já registado — idempotência

    const { data: settings } = await admin
      .from("platform_billing_settings").select("fiscal_billing_active").limit(1).maybeSingle();

    let plan: string | null = null;
    let cycle: string | null = null;
    if (sub?.id) {
      const { data } = await admin
        .from("subscriptions").select("plan, billing_cycle").eq("id", sub.id).maybeSingle();
      plan = data?.plan ?? null;
      cycle = data?.billing_cycle ?? null;
    }

    const total = (stripeInvoice.total ?? 0) / 100;
    const tax = (stripeInvoice.tax ?? 0) / 100;
    const net = total - tax;
    const line = stripeInvoice.lines?.data?.[0];
    const customerId = typeof stripeInvoice.customer === "string"
      ? stripeInvoice.customer
      : stripeInvoice.customer?.id ?? null;

    const { data: inserted, error } = await admin.from("platform_invoices").insert({
      shop_id: sub?.shop_id ?? null,
      subscription_id: sub?.id ?? null,
      plan,
      billing_cycle: cycle,
      period_start: line?.period?.start ? new Date(line.period.start * 1000).toISOString() : null,
      period_end: line?.period?.end ? new Date(line.period.end * 1000).toISOString() : null,
      currency: String(stripeInvoice.currency || "eur").toUpperCase(),
      amount_net: net,
      vat_rate: tax > 0 && net > 0 ? Math.round((tax / net) * 100) : 0,
      vat_amount: tax,
      amount_total: total,
      stripe_invoice_id: stripeInvoiceId,
      stripe_customer_id: customerId,
      stripe_subscription_id: typeof stripeInvoice.subscription === "string" ? stripeInvoice.subscription : null,
      stripe_status: stripeInvoice.status ?? null,
      stripe_hosted_url: stripeInvoice.hosted_invoice_url ?? null,
      paid_at: stripeInvoice.status_transitions?.paid_at
        ? new Date(stripeInvoice.status_transitions.paid_at * 1000).toISOString()
        : new Date().toISOString(),
      // A emissão fiscal só arranca depois da entidade legal estar configurada.
      fiscal_status: settings?.fiscal_billing_active ? "queued" : "pending_config",
    }).select("id").maybeSingle();

    if (error) {
      // 23505 = corrida entre dois eventos simultâneos → já existe, ignorar.
      if ((error as any).code !== "23505") console.error("[platform-invoice] insert", error.message);
      return;
    }

    await admin.from("platform_invoice_events").insert({
      platform_invoice_id: inserted?.id ?? null,
      event_type: "stripe_payment_recorded",
      level: "info",
      message: `Pagamento Stripe registado (${stripeInvoiceId})`,
      payload: { fiscal_active: settings?.fiscal_billing_active === true },
    });
  } catch (e) {
    console.error("[platform-invoice] erro não fatal", (e as Error).message);
  }
}
