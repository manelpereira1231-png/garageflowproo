/**
 * Comissão da plataforma (platform_settings.invoice_payments.platform_fee_percent).
 * Nunca fixa no código: o valor por defeito só é usado se a configuração não
 * existir ou for inválida. Alterada pelo administrador em /admin/payment-fees.
 */
export const DEFAULT_INVOICE_FEE_PERCENT = 3;

export async function getPlatformFeePercent(admin: any): Promise<number> {
  try {
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "invoice_payments")
      .maybeSingle();
    const raw = (data?.value as { platform_fee_percent?: number } | null)?.platform_fee_percent;
    if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0 && raw <= 30) return raw;
  } catch (_) { /* usa o valor por defeito */ }
  return DEFAULT_INVOICE_FEE_PERCENT;
}
