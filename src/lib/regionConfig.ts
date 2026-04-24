/**
 * Region detection and configuration — GLOBAL multi-country.
 * Detects user country automatically via timezone/locale, with manual override.
 * All pricing/currency/Stripe IDs are loaded from country_settings table on startup,
 * but a static fallback exists for offline/SSR scenarios.
 */

import { supabase } from "@/integrations/supabase/client";

// Legacy region kept for backwards compatibility (br/eu).
// New code should use CountryCode instead.
export type Region = 'br' | 'eu';
export type CountryCode = string; // 'PT', 'BR', 'IN', 'US', 'ES', 'FR', 'DE', 'UK', ...

const COUNTRY_KEY = 'garageflow_country';
const LEGACY_REGION_KEY = 'garageflow_region';

// ─── Static fallback (used before country_settings loads) ────
export interface CountryConfig {
  code: CountryCode;
  name: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  locale: string;
  defaultLanguage: string;
  taxLabel: string;
  saas: {
    pro: { monthly: number; yearly: number };
    garage: { monthly: number; yearly: number };
    trialDays: number;
  };
  inspection: {
    price: number;
    shopShare: number;
    platformShare: number;
  };
  stripe: {
    proMonthly?: string;
    proYearly?: string;
    garageMonthly?: string;
    garageYearly?: string;
  };
  active: boolean;
}

const STATIC_COUNTRIES: Record<string, CountryConfig> = {
  PT: {
    code: 'PT', name: 'Portugal', flag: '🇵🇹',
    currency: 'EUR', currencySymbol: '€', locale: 'pt-PT',
    defaultLanguage: 'pt', taxLabel: 'IVA',
    saas: { pro: { monthly: 49, yearly: 490 }, garage: { monthly: 99, yearly: 990 }, trialDays: 30 },
    inspection: { price: 29.90, shopShare: 17.00, platformShare: 12.90 },
    stripe: {
      proMonthly: 'price_1T4YARE1zL2Sl1ZT0iAS9Cmk',
      proYearly: 'price_1T49EZE1zL2Sl1ZTHGB40FiB',
      garageMonthly: 'price_1T4YAeE1zL2Sl1ZTrqc35wZy',
      garageYearly: 'price_1T49EnE1zL2Sl1ZTs0crtbLM',
    },
    active: true,
  },
  BR: {
    code: 'BR', name: 'Brasil', flag: '🇧🇷',
    currency: 'BRL', currencySymbol: 'R$', locale: 'pt-BR',
    defaultLanguage: 'pt-BR', taxLabel: 'Impostos',
    saas: { pro: { monthly: 97, yearly: 970 }, garage: { monthly: 197, yearly: 1970 }, trialDays: 30 },
    inspection: { price: 89.90, shopShare: 50.00, platformShare: 39.90 },
    stripe: {
      proMonthly: 'price_1TFP7uE1zL2Sl1ZTQxdzHWRv',
      proYearly: 'price_1TFP8EE1zL2Sl1ZTorzoNWLQ',
      garageMonthly: 'price_1TFP8dE1zL2Sl1ZT7N3wnDIY',
      garageYearly: 'price_1TFP8wE1zL2Sl1ZTuTK1wiqu',
    },
    active: true,
  },
  IN: {
    code: 'IN', name: 'India', flag: '🇮🇳',
    currency: 'INR', currencySymbol: '₹', locale: 'en-IN',
    defaultLanguage: 'en', taxLabel: 'GST',
    saas: { pro: { monthly: 999, yearly: 9990 }, garage: { monthly: 1999, yearly: 19990 }, trialDays: 30 },
    inspection: { price: 499, shopShare: 300, platformShare: 199 },
    stripe: {},
    active: true,
  },
  ES: {
    code: 'ES', name: 'España', flag: '🇪🇸',
    currency: 'EUR', currencySymbol: '€', locale: 'es-ES',
    defaultLanguage: 'es', taxLabel: 'IVA',
    saas: { pro: { monthly: 49, yearly: 490 }, garage: { monthly: 99, yearly: 990 }, trialDays: 30 },
    inspection: { price: 29.90, shopShare: 17.00, platformShare: 12.90 },
    stripe: {},
    active: false,
  },
  FR: {
    code: 'FR', name: 'France', flag: '🇫🇷',
    currency: 'EUR', currencySymbol: '€', locale: 'fr-FR',
    defaultLanguage: 'fr', taxLabel: 'TVA',
    saas: { pro: { monthly: 49, yearly: 490 }, garage: { monthly: 99, yearly: 990 }, trialDays: 30 },
    inspection: { price: 29.90, shopShare: 17.00, platformShare: 12.90 },
    stripe: {},
    active: false,
  },
  DE: {
    code: 'DE', name: 'Deutschland', flag: '🇩🇪',
    currency: 'EUR', currencySymbol: '€', locale: 'de-DE',
    defaultLanguage: 'de', taxLabel: 'MwSt',
    saas: { pro: { monthly: 49, yearly: 490 }, garage: { monthly: 99, yearly: 990 }, trialDays: 30 },
    inspection: { price: 29.90, shopShare: 17.00, platformShare: 12.90 },
    stripe: {},
    active: false,
  },
  UK: {
    code: 'UK', name: 'United Kingdom', flag: '🇬🇧',
    currency: 'GBP', currencySymbol: '£', locale: 'en-GB',
    defaultLanguage: 'en', taxLabel: 'VAT',
    saas: { pro: { monthly: 45, yearly: 450 }, garage: { monthly: 89, yearly: 890 }, trialDays: 30 },
    inspection: { price: 29, shopShare: 17, platformShare: 12 },
    stripe: {},
    active: false,
  },
  US: {
    code: 'US', name: 'United States', flag: '🇺🇸',
    currency: 'USD', currencySymbol: '$', locale: 'en-US',
    defaultLanguage: 'en', taxLabel: 'Sales Tax',
    saas: { pro: { monthly: 49, yearly: 490 }, garage: { monthly: 99, yearly: 990 }, trialDays: 30 },
    inspection: { price: 34.90, shopShare: 20.00, platformShare: 14.90 },
    stripe: {},
    active: false,
  },
};

// In-memory cache populated from country_settings table
let runtimeCountries: Record<string, CountryConfig> | null = null;

/**
 * Load all active countries from DB (call once at app boot).
 * Falls back silently to STATIC_COUNTRIES on error.
 */
export async function loadCountriesFromDB(): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('country_settings')
      .select('*')
      .eq('active', true);
    if (error || !data) return;
    const map: Record<string, CountryConfig> = {};
    for (const row of data) {
      map[row.code] = {
        code: row.code,
        name: row.name,
        flag: row.flag_emoji,
        currency: row.currency,
        currencySymbol: row.currency_symbol,
        locale: row.locale,
        defaultLanguage: row.default_language,
        taxLabel: row.tax_label,
        saas: {
          pro: { monthly: Number(row.saas_pro_monthly), yearly: Number(row.saas_pro_yearly) },
          garage: { monthly: Number(row.saas_garage_monthly), yearly: Number(row.saas_garage_yearly) },
          trialDays: row.saas_trial_days,
        },
        inspection: {
          price: Number(row.inspection_price),
          shopShare: Number(row.inspection_shop_share),
          platformShare: Number(row.inspection_platform_share),
        },
        stripe: {
          proMonthly: row.stripe_pro_monthly || undefined,
          proYearly: row.stripe_pro_yearly || undefined,
          garageMonthly: row.stripe_garage_monthly || undefined,
          garageYearly: row.stripe_garage_yearly || undefined,
        },
        active: row.active,
      };
    }
    runtimeCountries = map;
  } catch {
    // ignore — static fallback remains
  }
}

function getCountriesMap(): Record<string, CountryConfig> {
  return runtimeCountries || STATIC_COUNTRIES;
}

/**
 * List all active countries (for selectors, country picker, etc.)
 */
export function listActiveCountries(): CountryConfig[] {
  return Object.values(getCountriesMap()).filter(c => c.active);
}

/**
 * Detect country via server-side IP geolocation (Cloudflare/ipapi).
 * Persists in localStorage. Skips silently if user already chose a country.
 * Call once at app boot, AFTER loadCountriesFromDB().
 */
export async function detectCountryByIP(): Promise<void> {
  if (localStorage.getItem(COUNTRY_KEY)) return; // respect explicit choice
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/detect-country`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(url, {
      method: "GET",
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return;
    const j = await r.json();
    if (j?.country && getCountriesMap()[j.country]) {
      localStorage.setItem(COUNTRY_KEY, j.country);
      // Notify listeners (LanguageContext, useCountryPricing) so UI updates
      // without a page reload — critical for IN/BR/UK first-time visitors.
      try {
        window.dispatchEvent(new CustomEvent("garageflow:country-detected", { detail: { country: j.country } }));
      } catch {}
    }
  } catch { /* timezone fallback handles it */ }
}

// ─── Detection ────────────────────────────────────────────
function detectCountryCode(): CountryCode {
  // 1. Stored override
  const stored = localStorage.getItem(COUNTRY_KEY);
  if (stored && getCountriesMap()[stored]) return stored;

  // 2. Legacy region key (backwards compat)
  const legacy = localStorage.getItem(LEGACY_REGION_KEY);
  if (legacy === 'br') return 'BR';

  // 3. Timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    if (tz.startsWith('America/Sao_Paulo') || tz.startsWith('America/Fortaleza') ||
        tz.startsWith('America/Recife') || tz.startsWith('America/Bahia') ||
        tz.startsWith('America/Belem') || tz.startsWith('America/Manaus') ||
        tz.startsWith('America/Cuiaba') || tz.startsWith('America/Porto_Velho') ||
        tz.startsWith('America/Boa_Vista') || tz.startsWith('America/Campo_Grande') ||
        tz.startsWith('America/Rio_Branco') || tz.startsWith('America/Maceio') ||
        tz.startsWith('America/Araguaina') || tz.startsWith('America/Noronha') ||
        tz.startsWith('America/Santarem') || tz.startsWith('America/Eirunepe')) return 'BR';
    if (tz === 'Asia/Kolkata' || tz === 'Asia/Calcutta') return 'IN';
    if (tz === 'Europe/Madrid' || tz === 'Atlantic/Canary') return 'ES';
    if (tz === 'Europe/Paris') return 'FR';
    if (tz === 'Europe/Berlin') return 'DE';
    if (tz === 'Europe/London') return 'UK';
    if (tz.startsWith('America/New_York') || tz.startsWith('America/Chicago') ||
        tz.startsWith('America/Denver') || tz.startsWith('America/Los_Angeles') ||
        tz.startsWith('America/Anchorage') || tz === 'Pacific/Honolulu' ||
        tz === 'America/Phoenix') return 'US';
    if (tz.startsWith('Europe/Lisbon') || tz.startsWith('Atlantic/Madeira') || tz.startsWith('Atlantic/Azores')) return 'PT';
  } catch {}

  // 4. Browser language
  const lang = (navigator.language || '').toLowerCase();
  if (lang === 'pt-br') return 'BR';
  if (lang.startsWith('hi') || lang === 'en-in') return 'IN';
  if (lang.startsWith('es')) return 'ES';
  if (lang.startsWith('fr')) return 'FR';
  if (lang.startsWith('de')) return 'DE';
  if (lang === 'en-gb') return 'UK';
  if (lang === 'en-us') return 'US';
  if (lang.startsWith('pt')) return 'PT';

  return 'PT'; // safe default
}

/**
 * Get current country code (PT, BR, IN, US, ...).
 */
export function getCountryCode(): CountryCode {
  return detectCountryCode();
}

/**
 * Get full country config for the current user.
 */
export function getCountryConfig(code?: CountryCode): CountryConfig {
  const map = getCountriesMap();
  const c = (code || getCountryCode()).toUpperCase();
  return map[c] || map['PT'];
}

/**
 * Set country override (persists in localStorage).
 */
export function setCountryCode(code: CountryCode) {
  localStorage.setItem(COUNTRY_KEY, code.toUpperCase());
  // Sync legacy region key for backwards compat
  if (code === 'BR') localStorage.setItem(LEGACY_REGION_KEY, 'br');
  else if (code === 'PT' || code === 'ES' || code === 'FR' || code === 'DE') localStorage.setItem(LEGACY_REGION_KEY, 'eu');
}

// ─── LEGACY API (kept for backwards compatibility) ────────
export function getRegion(): Region {
  const code = getCountryCode();
  return code === 'BR' ? 'br' : 'eu';
}

export function setRegion(region: Region) {
  localStorage.setItem(LEGACY_REGION_KEY, region);
  setCountryCode(region === 'br' ? 'BR' : 'PT');
}

export function isBrazil(): boolean {
  return getCountryCode() === 'BR';
}

// ─── Pricing (legacy interface, now country-aware) ────────
export interface RegionalPricing {
  currency: string;
  currencySymbol: string;
  locale: string;
  free: { monthly: number; yearly: number };
  pro: { monthly: number; yearly: number };
  garage: { monthly: number; yearly: number };
  trialDays: number;
  annualSavingsLabel: string;
}

export function getRegionalPricing(): RegionalPricing {
  const c = getCountryConfig();
  const annualSavingsLabel = c.code === 'BR' ? '2 meses grátis' : '-17%';
  return {
    currency: c.currency,
    currencySymbol: c.currencySymbol,
    locale: c.locale,
    free: { monthly: 0, yearly: 0 },
    pro: c.saas.pro,
    garage: c.saas.garage,
    trialDays: c.saas.trialDays,
    annualSavingsLabel,
  };
}

// ─── Currency Formatting ─────────────────────────────────
export function formatCurrency(value: number, countryOrRegion?: CountryCode | Region): string {
  let config: CountryConfig;
  if (!countryOrRegion) config = getCountryConfig();
  else if (countryOrRegion === 'br') config = getCountryConfig('BR');
  else if (countryOrRegion === 'eu') config = getCountryConfig('PT');
  else config = getCountryConfig(countryOrRegion);

  return value.toLocaleString(config.locale, {
    style: 'currency',
    currency: config.currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function formatPrice(value: number, countryOrRegion?: CountryCode | Region): string {
  let config: CountryConfig;
  if (!countryOrRegion) config = getCountryConfig();
  else if (countryOrRegion === 'br') config = getCountryConfig('BR');
  else if (countryOrRegion === 'eu') config = getCountryConfig('PT');
  else config = getCountryConfig(countryOrRegion);

  if (value === 0) return `${config.currencySymbol} 0`;
  // INR uses lakh formatting; toLocaleString handles it correctly
  return `${config.currencySymbol}${config.code === 'BR' || config.code === 'IN'
    ? value.toLocaleString(config.locale)
    : value}`;
}

// ─── Fiscal Terminology ──────────────────────────────────
export function getTaxLabel(countryOrRegion?: CountryCode | Region): string {
  if (!countryOrRegion) return getCountryConfig().taxLabel;
  if (countryOrRegion === 'br') return getCountryConfig('BR').taxLabel;
  if (countryOrRegion === 'eu') return getCountryConfig('PT').taxLabel;
  return getCountryConfig(countryOrRegion).taxLabel;
}

// ─── Stripe Price IDs (legacy interface) ─────────────────
export interface StripePriceMap {
  pro: { monthly: string; yearly: string };
  garage: { monthly: string; yearly: string };
}

export function getStripePrices(countryOrRegion?: CountryCode | Region): StripePriceMap {
  let config: CountryConfig;
  if (!countryOrRegion) config = getCountryConfig();
  else if (countryOrRegion === 'br') config = getCountryConfig('BR');
  else if (countryOrRegion === 'eu') config = getCountryConfig('PT');
  else config = getCountryConfig(countryOrRegion);

  return {
    pro: {
      monthly: config.stripe.proMonthly || '',
      yearly: config.stripe.proYearly || '',
    },
    garage: {
      monthly: config.stripe.garageMonthly || '',
      yearly: config.stripe.garageYearly || '',
    },
  };
}
