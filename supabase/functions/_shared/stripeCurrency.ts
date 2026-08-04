/**
 * Conversão de valores para o "smallest currency unit" do Stripe.
 * Moedas zero-decimal (JPY, KRW, VND, ...) NÃO são multiplicadas por 100 —
 * enviar 100x o valor seria uma cobrança errada ao cliente.
 * https://docs.stripe.com/currencies#zero-decimal
 */
export const ZERO_DECIMAL_CURRENCIES = new Set([
  "bif", "clp", "djf", "gnf", "jpy", "kmf", "krw", "mga", "pyg",
  "rwf", "ugx", "vnd", "vuv", "xaf", "xof", "xpf",
]);

export function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(String(currency || "").toLowerCase());
}

/** Valor decimal (ex.: 123.45 EUR / 1200 JPY) → unidade mínima do Stripe. */
export function toStripeAmount(value: number, currency: string): number {
  const n = Number(value || 0);
  return isZeroDecimal(currency) ? Math.round(n) : Math.round(n * 100);
}

/** Unidade mínima do Stripe → valor decimal para guardar na base de dados. */
export function fromStripeAmount(amount: number, currency: string): number {
  const n = Number(amount || 0);
  return isZeroDecimal(currency) ? n : Math.round(n) / 100;
}

/** Comissão da plataforma, na unidade mínima do Stripe (nunca negativa). */
export function feeAmountFromStripeAmount(stripeAmount: number, feePercent: number): number {
  const fee = Math.round((Number(stripeAmount || 0) * Number(feePercent || 0)) / 100);
  return fee > 0 ? fee : 0;
}
