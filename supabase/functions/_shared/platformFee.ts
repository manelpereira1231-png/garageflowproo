/**
 * Fonte única de verdade das comissões da plataforma sobre pagamentos online
 * de faturas: `platform_settings.invoice_payments`.
 *
 * Nada é fixo no código: os valores por defeito abaixo só entram em cena se a
 * linha de configuração não existir (ex.: base de dados acabada de criar).
 * Alterados pelo Super Admin em /admin/payment-fees.
 */
export const DEFAULT_INVOICE_FEE_PERCENT = 3;

export interface PaymentFeeSettings {
  /** Comissão base retida via Stripe Connect (%). */
  feePercent: number;
  /** Permite pagamentos online a oficinas SEM Stripe Connect. */
  allowWithoutConnect: boolean;
  /** Percentagem adicional aplicada quando não há Stripe Connect. */
  noConnectExtraPercent: number;
  /** Taxa fixa adicional (moeda da oficina) quando não há Stripe Connect. */
  noConnectFixedFee: number;
}

const num = (v: unknown, fallback: number, max: number): number => {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= max ? n : fallback;
};

export async function getPaymentFeeSettings(admin: any): Promise<PaymentFeeSettings> {
  let raw: Record<string, unknown> = {};
  try {
    const { data } = await admin
      .from("platform_settings")
      .select("value")
      .eq("key", "invoice_payments")
      .maybeSingle();
    raw = (data?.value as Record<string, unknown>) ?? {};
  } catch (_) { /* usa os valores por defeito */ }

  return {
    feePercent: num(raw.platform_fee_percent, DEFAULT_INVOICE_FEE_PERCENT, 30),
    allowWithoutConnect: raw.allow_without_connect !== false,
    noConnectExtraPercent: num(raw.no_connect_extra_percent, 0, 30),
    noConnectFixedFee: num(raw.no_connect_fixed_fee, 0, 1000),
  };
}

/** Atalho retrocompatível: apenas a comissão base. */
export async function getPlatformFeePercent(admin: any): Promise<number> {
  return (await getPaymentFeeSettings(admin)).feePercent;
}
