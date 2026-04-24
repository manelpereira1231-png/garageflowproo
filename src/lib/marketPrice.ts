/**
 * Market price formatter — uses the user's detected country (via regionConfig)
 * for currency + locale, with a single safe fallback to PT/EUR.
 *
 * Use this in pages where bringing in the async useCountryPricing hook
 * is overkill (e.g. SEO pages, listing cards, dashboards).
 *
 * For full pricing data (inspection_price, commission, etc.) use useCountryPricing.
 */
import { getCountryConfig } from "@/lib/regionConfig";

export function formatMarketPrice(value: number | null | undefined, opts?: { decimals?: number }): string {
  const v = Number(value) || 0;
  const c = getCountryConfig();
  const decimals = opts?.decimals ?? (c.currency === "INR" || c.currency === "JPY" || c.currency === "IDR" || c.currency === "HUF" ? 0 : 0);
  try {
    return new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: c.currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v);
  } catch {
    return `${c.currencySymbol}${v.toLocaleString()}`;
  }
}

/** Same as formatMarketPrice but always with 2 decimal places (escrow, contracts). */
export function formatMarketPriceExact(value: number | null | undefined): string {
  const v = Number(value) || 0;
  const c = getCountryConfig();
  try {
    return new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: c.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${c.currencySymbol}${v.toFixed(2)}`;
  }
}

/** Returns just the currency code (EUR, BRL, INR, ...) for the user's country. */
export function getMarketCurrency(): string {
  return getCountryConfig().currency;
}

/** Returns the locale string (pt-PT, en-US, ...) for the user's country. */
export function getMarketLocale(): string {
  return getCountryConfig().locale;
}

/** Returns the currency symbol (€, ₹, R$, $, ...) for the user's country, with optional shop override. */
export function getCurrencySymbol(shopCurrency?: string | null): string {
  if (shopCurrency) {
    const map: Record<string, string> = {
      EUR: "€", USD: "$", GBP: "£", BRL: "R$", INR: "₹", JPY: "¥", CHF: "CHF", AUD: "A$", CAD: "C$",
      MXN: "MX$", ZAR: "R", PLN: "zł", SEK: "kr", NOK: "kr", DKK: "kr", CZK: "Kč", HUF: "Ft",
      TRY: "₺", AED: "د.إ", SAR: "﷼", SGD: "S$", HKD: "HK$", NZD: "NZ$", KRW: "₩", THB: "฿",
      IDR: "Rp", PHP: "₱", MYR: "RM", VND: "₫", ILS: "₪", CLP: "$", COP: "$", ARS: "$", PEN: "S/",
    };
    return map[shopCurrency.toUpperCase()] || shopCurrency;
  }
  return getCountryConfig().currencySymbol;
}

/** Format a date string for the user's country locale (replaces hardcoded toLocaleDateString('pt-PT')). */
export function formatLocalDate(value: string | Date | null | undefined, withTime = false): string {
  if (!value) return "—";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    const locale = getMarketLocale();
    return withTime ? d.toLocaleString(locale) : d.toLocaleDateString(locale);
  } catch {
    return String(value);
  }
}

/**
 * Returns the localized tax label (IVA, GST, VAT, MwSt, ...) for the user's country.
 * Optionally accepts a shop override currency to compute the matching label.
 */
export function getTaxLabelLocal(): string {
  return getCountryConfig().taxLabel;
}
