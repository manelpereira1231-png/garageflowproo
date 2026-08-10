// Helpers para dinamizar símbolos, locale e label fiscal a partir do
// currency da oficina (útil em contextos onde o country_config não está
// disponível — PDFs de uma oficina específica, mensagens, etc.).

export function getCurrencySymbol(currency?: string | null): string {
  switch ((currency || "").toUpperCase()) {
    case "EUR": return "€";
    case "BRL": return "R$";
    case "USD": return "$";
    case "GBP": return "£";
    case "INR": return "₹";
    default: return currency || "€";
  }
}

export function getLocaleForCurrency(currency?: string | null): string {
  switch ((currency || "").toUpperCase()) {
    case "BRL": return "pt-BR";
    case "USD": return "en-US";
    case "GBP": return "en-GB";
    case "INR": return "en-IN";
    case "EUR":
    default: return "pt-PT";
  }
}

export function getTaxLabelForCurrency(currency?: string | null): string {
  switch ((currency || "").toUpperCase()) {
    case "BRL": return "Impostos";
    case "USD": return "Tax";
    case "GBP": return "VAT";
    case "INR": return "GST";
    case "EUR":
    default: return "IVA";
  }
}

// ─── Variantes por PAÍS (mais precisas que só a moeda) ───────────────
// Necessárias porque PT e ES partilham EUR mas têm locales distintos
// (pt-PT: "35,00 €" | es-ES: "35,00 €" com separadores próprios).
const COUNTRY_LOCALES: Record<string, string> = {
  PT: "pt-PT", BR: "pt-BR", ES: "es-ES", FR: "fr-FR", DE: "de-DE",
  GB: "en-GB", UK: "en-GB", US: "en-US", IN: "en-IN",
};

const COUNTRY_TAX_LABELS: Record<string, string> = {
  PT: "IVA", ES: "IVA", BR: "Impostos", FR: "TVA", DE: "MwSt",
  GB: "VAT", UK: "VAT", US: "Tax", IN: "GST",
};

export function getLocaleForCountry(country?: string | null, currency?: string | null): string {
  const c = (country || "").toUpperCase();
  return COUNTRY_LOCALES[c] || getLocaleForCurrency(currency);
}

export function getTaxLabelForCountry(country?: string | null, currency?: string | null): string {
  const c = (country || "").toUpperCase();
  return COUNTRY_TAX_LABELS[c] || getTaxLabelForCurrency(currency);
}
