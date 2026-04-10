/**
 * Region detection and configuration for Brazil vs Europe.
 * Detects user region automatically via browser locale/timezone.
 * Respects manual overrides stored in localStorage.
 */

export type Region = 'br' | 'eu';

const STORAGE_KEY = 'garageflow_region';

/**
 * Detect if user is from Brazil based on browser signals.
 */
function detectRegion(): Region {
  // Check timezone
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz?.startsWith('America/Sao_Paulo') || tz?.startsWith('America/Fortaleza') ||
        tz?.startsWith('America/Recife') || tz?.startsWith('America/Bahia') ||
        tz?.startsWith('America/Belem') || tz?.startsWith('America/Manaus') ||
        tz?.startsWith('America/Cuiaba') || tz?.startsWith('America/Porto_Velho') ||
        tz?.startsWith('America/Boa_Vista') || tz?.startsWith('America/Campo_Grande') ||
        tz?.startsWith('America/Rio_Branco') || tz?.startsWith('America/Maceio') ||
        tz?.startsWith('America/Araguaina') || tz?.startsWith('America/Noronha') ||
        tz?.startsWith('America/Santarem') || tz?.startsWith('America/Eirunepe') ||
        tz?.startsWith('America/Porto_Velho')) {
      return 'br';
    }
  } catch {}

  // Check browser language
  const lang = navigator.language || '';
  if (lang === 'pt-BR') return 'br';

  // Check all languages
  const langs = navigator.languages || [];
  if (langs.some(l => l === 'pt-BR')) return 'br';

  return 'eu';
}

/**
 * Get current region, respecting manual override.
 */
export function getRegion(): Region {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'br' || stored === 'eu') return stored;
  return detectRegion();
}

/**
 * Set region manually (persists override).
 */
export function setRegion(region: Region) {
  localStorage.setItem(STORAGE_KEY, region);
}

/**
 * Check if current region is Brazil.
 */
export function isBrazil(): boolean {
  return getRegion() === 'br';
}

// ─── Pricing ─────────────────────────────────────────────

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

const EUR_PRICING: RegionalPricing = {
  currency: 'EUR',
  currencySymbol: '€',
  locale: 'pt-PT',
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 49, yearly: 490 },
  garage: { monthly: 99, yearly: 990 },
  trialDays: 30,
  annualSavingsLabel: '-17%',
};

const BRL_PRICING: RegionalPricing = {
  currency: 'BRL',
  currencySymbol: 'R$',
  locale: 'pt-BR',
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 97, yearly: 970 },
  garage: { monthly: 197, yearly: 1970 },
  trialDays: 30,
  annualSavingsLabel: '2 meses grátis',
};

export function getRegionalPricing(): RegionalPricing {
  return isBrazil() ? BRL_PRICING : EUR_PRICING;
}

// ─── Currency Formatting ─────────────────────────────────

export function formatCurrency(value: number, region?: Region): string {
  const r = region || getRegion();
  if (r === 'br') {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format price for display (compact, no decimals for round numbers).
 */
export function formatPrice(value: number, region?: Region): string {
  const r = region || getRegion();
  if (r === 'br') {
    if (value === 0) return 'R$ 0';
    return `R$ ${value.toLocaleString('pt-BR')}`;
  }
  return `€${value}`;
}

// ─── Fiscal Terminology ──────────────────────────────────

/**
 * Get the correct tax label for the region.
 * Brazil: "Impostos" | Europe: "IVA"
 */
export function getTaxLabel(region?: Region): string {
  const r = region || getRegion();
  return r === 'br' ? 'Impostos' : 'IVA';
}

// ─── Stripe Price IDs ────────────────────────────────────

export interface StripePriceMap {
  pro: { monthly: string; yearly: string };
  garage: { monthly: string; yearly: string };
}

const EUR_STRIPE_PRICES: StripePriceMap = {
  pro: {
    monthly: 'price_1T4YARE1zL2Sl1ZT0iAS9Cmk',
    yearly: 'price_1T49EZE1zL2Sl1ZTHGB40FiB',
  },
  garage: {
    monthly: 'price_1T4YAeE1zL2Sl1ZTrqc35wZy',
    yearly: 'price_1T49EnE1zL2Sl1ZTs0crtbLM',
  },
};

// BRL prices - these need to be created in Stripe dashboard
// For now, use placeholder IDs that will be replaced with real ones
const BRL_STRIPE_PRICES: StripePriceMap = {
  pro: {
    monthly: 'price_1TFP7uE1zL2Sl1ZTQxdzHWRv',
    yearly: 'price_1TFP8EE1zL2Sl1ZTorzoNWLQ',
  },
  garage: {
    monthly: 'price_1TFP8dE1zL2Sl1ZT7N3wnDIY',
    yearly: 'price_1TFP8wE1zL2Sl1ZTuTK1wiqu',
  },
};

export function getStripePrices(region?: Region): StripePriceMap {
  const r = region || getRegion();
  return r === 'br' ? BRL_STRIPE_PRICES : EUR_STRIPE_PRICES;
}
