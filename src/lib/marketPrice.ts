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

// ─── Listing-scoped formatters (multi-country marketplace) ───────────────
// A listing has its own country/currency; viewer has their own locale.
// Rule: preserve the listing's real price + currency; format numbers using
// the viewer's locale so digit groups match their reading habits.

const NO_DECIMALS = new Set(["INR", "JPY", "IDR", "HUF", "KRW", "VND", "CLP", "COP", "PYG"]);
const IMPERIAL_COUNTRIES = new Set(["US", "UK", "LR", "MM"]); // miles-first

export function formatListingPrice(
  value: number | null | undefined,
  listingCountry?: string | null,
  listingCurrency?: string | null,
): string {
  const v = Number(value) || 0;
  const viewer = getCountryConfig();
  const target = listingCountry ? getCountryConfig(listingCountry) : viewer;
  const currency = (listingCurrency || target.currency || viewer.currency).toUpperCase();
  const decimals = NO_DECIMALS.has(currency) ? 0 : 0;
  try {
    return new Intl.NumberFormat(viewer.locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      currencyDisplay: "symbol",
    }).format(v);
  } catch {
    return `${target.currencySymbol}${v.toLocaleString(viewer.locale)}`;
  }
}

export function getDistanceUnit(countryCode?: string | null): "km" | "mi" {
  const code = (countryCode || getCountryConfig().code || "").toUpperCase();
  return IMPERIAL_COUNTRIES.has(code) ? "mi" : "km";
}

/**
 * Formats odometer reading. Value is ALWAYS stored in km (SI); display
 * converts to miles for US/UK/etc. based on the listing's country.
 */
export function formatMileage(
  km: number | null | undefined,
  listingCountry?: string | null,
): string {
  const value = Number(km) || 0;
  const viewer = getCountryConfig();
  const unit = getDistanceUnit(listingCountry);
  const display = unit === "mi" ? Math.round(value * 0.621371) : value;
  return `${display.toLocaleString(viewer.locale)} ${unit}`;
}

/** Localized date/time in a specific IANA timezone (falls back to viewer locale). */
export function formatListingDateTime(
  value: string | Date | null | undefined,
  timezone?: string | null,
): string {
  if (!value) return "—";
  try {
    const d = typeof value === "string" ? new Date(value) : value;
    return new Intl.DateTimeFormat(getMarketLocale(), {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: timezone || undefined,
    }).format(d);
  } catch {
    return String(value);
  }
}

