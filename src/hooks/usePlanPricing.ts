import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Dynamic plan pricing hook — reads `plan_country_prices` + `plan_promotions`
 * via the `get_effective_plan_price` RPC.
 *
 * Replaces direct reads of `country_settings.saas_*_*` hardcoded columns so
 * new plans created by Super Admin (e.g. "business", "enterprise") flow
 * automatically into Landing, Billing, Checkout and UpgradeModal — with no
 * code changes and no visual regressions.
 *
 * `country_settings.saas_free/pro/garage_*` columns are mirrored into
 * `plan_country_prices` by a DB trigger, so any legacy admin UI that still
 * writes the old columns keeps working during the migration window.
 */
export type EffectivePlanPrice = {
  plan_slug: string;
  country_code: string;
  cycle: "monthly" | "yearly" | "quarterly" | "semestral" | "lifetime";
  currency: string;
  base_amount: number;
  base_stripe_price_id: string | null;
  base_stripe_product_id: string | null;
  effective_amount: number;
  effective_stripe_price_id: string | null;
  promo_active: boolean;
  promo_starts_at: string | null;
  promo_ends_at: string | null;
  discount_percent: number;
};

export async function fetchEffectivePlanPrice(
  planSlug: string,
  countryCode: string,
  cycle: EffectivePlanPrice["cycle"]
): Promise<EffectivePlanPrice | null> {
  const { data, error } = await supabase.rpc("get_effective_plan_price" as any, {
    p_plan_slug: planSlug,
    p_country_code: countryCode,
    p_cycle: cycle,
  });
  if (error || !data) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return (row as EffectivePlanPrice) ?? null;
}

export function useEffectivePlanPrice(
  planSlug: string | null | undefined,
  countryCode: string | null | undefined,
  cycle: EffectivePlanPrice["cycle"] = "monthly"
) {
  const [price, setPrice] = useState<EffectivePlanPrice | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!planSlug || !countryCode) {
      setPrice(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetchEffectivePlanPrice(planSlug, countryCode, cycle).then((res) => {
      if (!cancelled) {
        setPrice(res);
        setLoading(false);
      }
    });

    // Realtime: invalidate on any change to prices or promotions for this key
    const channel = supabase
      .channel(`plan-price-${planSlug}-${countryCode}-${cycle}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_country_prices", filter: `plan_slug=eq.${planSlug}` },
        () => {
          fetchEffectivePlanPrice(planSlug, countryCode, cycle).then((res) => {
            if (!cancelled) setPrice(res);
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_promotions", filter: `plan=eq.${planSlug}` },
        () => {
          fetchEffectivePlanPrice(planSlug, countryCode, cycle).then((res) => {
            if (!cancelled) setPrice(res);
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [planSlug, countryCode, cycle]);

  return { price, loading };
}

/**
 * Fetch every plan/cycle price for a given country in one shot. Useful for
 * Landing/Billing to render the full pricing grid without N calls.
 */
export async function fetchAllPlanPrices(countryCode: string) {
  const { data, error } = await supabase
    .from("plan_country_prices" as any)
    .select("plan_slug, country_code, cycle, currency, amount, stripe_price_id, stripe_product_id, active")
    .eq("country_code", countryCode)
    .eq("active", true);
  if (error || !data) return [];
  return (data as unknown) as Array<{
    plan_slug: string;
    country_code: string;
    cycle: EffectivePlanPrice["cycle"];
    currency: string;
    amount: number;
    stripe_price_id: string | null;
    stripe_product_id: string | null;
    active: boolean;
  }>;
}
