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
    let countryCode: string | null = null;

    // 1) Highest priority: explicit user override (or IP-detection result) in localStorage
    try {
      const stored = (typeof window !== "undefined" ? localStorage.getItem("garageflow_country") : null);
      if (stored) countryCode = stored.toUpperCase();
    } catch {}

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("carity_seller_profiles")
          .select("country_code").eq("user_id", user.id).maybeSingle();
        // Only trust the profile if it isn't the default 'PT' OR no localStorage hint exists
        if (profile?.country_code && (!countryCode || profile.country_code !== "PT")) {
          countryCode = profile.country_code;
        }
        if (!countryCode) {
          const shopRes: any = await (supabase as any)
            .from("shops").select("country_code")
            .eq("user_id", user.id).maybeSingle();
          if (shopRes?.data?.country_code) countryCode = shopRes.data.country_code;
        }
      }
      // Fallback: detect by timezone
      if (!countryCode) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
        if (tz.includes("Sao_Paulo") || tz.includes("Brazil")) countryCode = "BR";
        else if (tz.includes("Kolkata") || tz.includes("Calcutta")) countryCode = "IN";
        else if (tz.includes("Madrid")) countryCode = "ES";
        else if (tz === "Europe/London") countryCode = "UK";
        else if (tz === "Europe/Paris") countryCode = "FR";
        else if (tz === "Europe/Berlin") countryCode = "DE";
      }
      if (!countryCode) countryCode = "PT";
    } catch {
      if (!countryCode) countryCode = "PT";
    }

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
    let cancelled = false;
    if (cache) { setPricing(cache); setLoading(false); }
    else {
      detectAndLoadCountry().then(p => { if (!cancelled) { setPricing(p); setLoading(false); } });
    }
    const reload = () => {
      cache = null;
      cachePromise = null;
      detectAndLoadCountry().then(p => { if (!cancelled) setPricing(p); });
    };
    window.addEventListener("garageflow:country-detected", reload);
    window.addEventListener("garageflow:pricing-updated", reload);
    // Realtime: any admin-side update to country_settings → reload pricing.
    const channel = supabase
      .channel("country-settings-live")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "country_settings" }, reload)
      .subscribe();
    return () => {
      cancelled = true;
      window.removeEventListener("garageflow:country-detected", reload);
      window.removeEventListener("garageflow:pricing-updated", reload);
      supabase.removeChannel(channel);
    };
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
