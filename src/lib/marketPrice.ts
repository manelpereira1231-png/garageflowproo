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
