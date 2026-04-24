// Shared helper: returns Stripe payment_method_types per country/currency.
// Ensures every supported country exposes its full local payment stack.
//
// Reference: https://docs.stripe.com/payments/payment-methods/integration-options
//
// All countries fall back to ["card"] (Visa/Mastercard/Amex universally supported).
// Apple Pay / Google Pay are auto-included when "card" is enabled.

type Mode = "payment" | "subscription";

const COUNTRY_METHODS: Record<string, string[]> = {
  // ─── Eurozone (SEPA + cards + wallets) ───
  PT: ["card", "sepa_debit", "multibanco", "link"],
  ES: ["card", "sepa_debit", "link"],
  FR: ["card", "sepa_debit", "link"],
  DE: ["card", "sepa_debit", "klarna", "giropay", "sofort", "link"],
  IT: ["card", "sepa_debit", "link"],
  NL: ["card", "ideal", "sepa_debit", "klarna", "link"],
  BE: ["card", "bancontact", "sepa_debit", "link"],
  AT: ["card", "sepa_debit", "eps", "klarna", "link"],
  IE: ["card", "sepa_debit", "link"],
  FI: ["card", "sepa_debit", "klarna", "link"],
  GR: ["card", "sepa_debit", "link"],
  LU: ["card", "sepa_debit", "link"],

  // ─── Other Europe ───
  UK: ["card", "bacs_debit", "klarna", "link"],
  GB: ["card", "bacs_debit", "klarna", "link"],
  PL: ["card", "p24", "blik", "klarna", "link"],
  CZ: ["card", "link"],
  SE: ["card", "klarna", "link"],
  NO: ["card", "klarna", "link"],
  DK: ["card", "klarna", "link"],
  CH: ["card", "link"],

  // ─── Americas ───
  US: ["card", "us_bank_account", "link", "cashapp", "klarna", "affirm"],
  CA: ["card", "acss_debit", "link"],
  BR: ["card", "boleto"], // Pix added below when in beta-allowed accounts via "pix"
  MX: ["card", "oxxo", "link"],
  AR: ["card", "link"],
  CL: ["card", "link"],
  CO: ["card", "link"],
  PE: ["card", "link"],

  // ─── Asia ───
  IN: ["card", "link"], // UPI is collected via card flow; specific upi method needs IN account
  JP: ["card", "konbini", "link"],
  SG: ["card", "grabpay", "paynow", "link"],
  HK: ["card", "alipay", "link"],
  MY: ["card", "fpx", "grabpay", "link"],
  TH: ["card", "promptpay", "link"],
  ID: ["card", "link"],
  PH: ["card", "link"],
  VN: ["card", "link"],
  KR: ["card", "link"],
  CN: ["card", "alipay", "wechat_pay", "link"],

  // ─── Oceania ───
  AU: ["card", "au_becs_debit", "afterpay_clearpay", "link"],
  NZ: ["card", "afterpay_clearpay", "link"],

  // ─── Middle East / Africa ───
  AE: ["card", "link"],
  SA: ["card", "link"],
  ZA: ["card", "link"],
  EG: ["card", "link"],
  IL: ["card", "link"],
  TR: ["card", "link"],
  MA: ["card", "link"],
};

// Methods not allowed in subscription mode (only one-time payments).
const PAYMENT_ONLY_METHODS = new Set([
  "multibanco", "boleto", "oxxo", "konbini", "promptpay", "paynow",
  "alipay", "wechat_pay", "afterpay_clearpay", "affirm", "cashapp",
  "p24", "blik", "eps", "fpx", "giropay", "grabpay", "pix",
]);

/**
 * Returns the Stripe payment_method_types array for a country in a given mode.
 * If unknown country → defaults to ["card", "link"] (universal coverage).
 */
export function getPaymentMethods(countryCode: string, mode: Mode = "payment"): string[] {
  const code = (countryCode || "PT").toUpperCase();
  const base = COUNTRY_METHODS[code] || ["card", "link"];
  if (mode === "subscription") {
    return base.filter((m) => !PAYMENT_ONLY_METHODS.has(m));
  }
  return base;
}
