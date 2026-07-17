/**
 * Plan promotions loader — reads active promotions from `plan_promotions` and
 * exposes helpers used by Landing, Billing and any place that renders
 * SaaS pricing. The base price stays in `country_settings`; promotions are
 * a *layer on top* — they never overwrite it. When a promotion ends
 * (via `ends_at` or `active=false`), callers automatically fall back to the
 * base price without any manual intervention.
 *
 * Single source of truth (frontend): this file. Checkout (Stripe) reads the
 * exact same data server-side via the `get_active_promotion` RPC.
 */
import { supabase } from "@/integrations/supabase/client";

/**
 * Plan slug. Legacy slugs are `'free' | 'pro' | 'garage'`, but any string
 * created by Super Admin via `AdminPlans` is accepted — promotions look
 * up by (country, plan_slug, cycle) with no hardcoded whitelist.
 */
export type PlanSlug = 'free' | 'pro' | 'garage' | (string & {});
export type CycleSlug = "monthly" | "yearly";

export interface PromoRow {
  country_code: string;
  plan: PlanSlug;
  cycle: CycleSlug;
  promo_price: number;
  currency: string;
  stripe_price_id: string | null;
  active: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

export interface EffectivePrice {
  basePrice: number;
  effectivePrice: number;
  isPromo: boolean;
  discountPercent: number;
  endsAt: string | null;
}

let cache: Map<string, PromoRow> | null = null;
let cachePromise: Promise<Map<string, PromoRow>> | null = null;

const key = (country: string, plan: string, cycle: string) =>
  `${country.toUpperCase()}::${plan}::${cycle}`;

function isPromoLive(row: PromoRow, now: Date = new Date()): boolean {
  if (!row.active) return false;
  if (row.starts_at && new Date(row.starts_at) > now) return false;
  if (row.ends_at && new Date(row.ends_at) <= now) return false;
  return true;
}

async function loadPromotions(): Promise<Map<string, PromoRow>> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    const map = new Map<string, PromoRow>();
    const { data } = await supabase
      .from("plan_promotions")
      .select("country_code, plan, cycle, promo_price, currency, stripe_price_id, active, starts_at, ends_at");
    (data as PromoRow[] | null)?.forEach((row) => {
      map.set(key(row.country_code, row.plan, row.cycle), row);
    });
    cache = map;
    return map;
  })();
  return cachePromise;
}

/** Force-refresh cache (called by admin pages after mutations). */
export function clearPromotionsCache() {
  cache = null;
  cachePromise = null;
}

/**
 * Effective price for a plan/cycle in a country, computed against `basePrice`.
 * Returns base price if no active promo exists. Never throws.
 */
export function getEffectivePrice(
  basePrice: number,
  country: string,
  plan: PlanSlug,
  cycle: CycleSlug,
): EffectivePrice {
  const row = cache?.get(key(country, plan, cycle));
  if (!row || !isPromoLive(row) || row.promo_price >= basePrice || basePrice <= 0) {
    return { basePrice, effectivePrice: basePrice, isPromo: false, discountPercent: 0, endsAt: null };
  }
  const pct = Math.max(0, Math.round(((basePrice - row.promo_price) / basePrice) * 100));
  return {
    basePrice,
    effectivePrice: row.promo_price,
    isPromo: true,
    discountPercent: pct,
    endsAt: row.ends_at,
  };
}

/** Ensure the cache is populated before rendering; safe to call multiple times. */
export async function ensurePromotionsLoaded() {
  await loadPromotions();
}

/** Full row for admin UI (all promos, including inactive/scheduled). */
export async function listAllPromotions(): Promise<PromoRow[]> {
  const { data } = await supabase
    .from("plan_promotions")
    .select("country_code, plan, cycle, promo_price, currency, stripe_price_id, active, starts_at, ends_at");
  return (data as PromoRow[] | null) ?? [];
}

/** Real-time subscription so any tab (landing, billing, admin) updates instantly. */
export function subscribeToPromotions(onChange: () => void) {
  const ch = supabase
    .channel("plan-promotions-live")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "plan_promotions" },
      () => {
        clearPromotionsCache();
        void ensurePromotionsLoaded().then(() => {
          onChange();
          try { window.dispatchEvent(new CustomEvent("garageflow:pricing-updated")); } catch { /* ignore */ }
        });
      },
    )
    .subscribe();
  return () => { void supabase.removeChannel(ch); };
}
