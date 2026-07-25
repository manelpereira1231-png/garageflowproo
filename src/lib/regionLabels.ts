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
