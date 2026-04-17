import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CountryPricing {
  code: string;
  name: string;
  currency: string;
  currency_symbol: string;
  locale: string;
  inspection_price: number;
  inspection_shop_share: number;
  inspection_platform_share: number;
  market_commission_rate: number;
  saas_pro_monthly: number;
  saas_pro_yearly: number;
  saas_garage_monthly: number;
  saas_garage_yearly: number;
}

const DEFAULT_PT: CountryPricing = {
  code: "PT", name: "Portugal", currency: "EUR", currency_symbol: "€", locale: "pt-PT",
  inspection_price: 29.90, inspection_shop_share: 17.00, inspection_platform_share: 12.90,
  market_commission_rate: 0.02,
  saas_pro_monthly: 49, saas_pro_yearly: 490, saas_garage_monthly: 99, saas_garage_yearly: 990,
};

let cache: CountryPricing | null = null;
let cachePromise: Promise<CountryPricing> | null = null;

async function detectAndLoadCountry(): Promise<CountryPricing> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    let countryCode = "PT";
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("carity_seller_profiles")
          .select("country_code").eq("user_id", user.id).maybeSingle();
        if (profile?.country_code) countryCode = profile.country_code;
        else {
          const { data: shop } = await supabase
            .from("shops").select("country_code")
            .eq("owner_id", user.id).maybeSingle();
          if ((shop as any)?.country_code) countryCode = (shop as any).country_code;
        }
      }
      // Fallback: detect by timezone
      if (countryCode === "PT") {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        if (tz.includes("Sao_Paulo") || tz.includes("Brazil")) countryCode = "BR";
        else if (tz.includes("Kolkata") || tz.includes("Calcutta")) countryCode = "IN";
        else if (tz.includes("Madrid")) countryCode = "ES";
      }
    } catch {}

    const { data } = await supabase
      .from("country_settings")
      .select("code,name,currency,currency_symbol,locale,inspection_price,inspection_shop_share,inspection_platform_share,market_commission_rate,saas_pro_monthly,saas_pro_yearly,saas_garage_monthly,saas_garage_yearly")
      .eq("code", countryCode).eq("active", true).maybeSingle();

    cache = (data as any) || DEFAULT_PT;
    return cache!;
  })();

  return cachePromise;
}

/**
 * Hook to access country-specific pricing dynamically from country_settings.
 * Returns null while loading. Use formatPrice() helper for currency formatting.
 */
export function useCountryPricing() {
  const [pricing, setPricing] = useState<CountryPricing | null>(cache);
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (cache) { setPricing(cache); setLoading(false); return; }
    detectAndLoadCountry().then(p => { setPricing(p); setLoading(false); });
  }, []);

  const formatPrice = (value: number) => {
    const p = pricing || DEFAULT_PT;
    return new Intl.NumberFormat(p.locale, {
      style: "currency", currency: p.currency,
      minimumFractionDigits: p.currency === "INR" ? 0 : 2,
    }).format(value);
  };

  return { pricing: pricing || DEFAULT_PT, loading, formatPrice };
}

/** Force-refresh the cache (e.g. after admin updates pricing) */
export function clearPricingCache() {
  cache = null;
  cachePromise = null;
}
