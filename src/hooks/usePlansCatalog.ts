import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { registerPlanRanks } from "@/lib/planHierarchy";

/**
 * Catálogo de planos 100% dinâmico — fonte única de verdade para toda a app.
 *
 * Lê:
 *  - plans (metadados + limits jsonb + capacidades)
 *  - plan_features (matriz por plano)
 *  - plan_country_prices (preços + stripe IDs por país)
 *
 * Nada é hardcoded. Um plano novo criado no Super Admin aparece imediatamente
 * em Billing / Landing / Upgrade / Checkout / SEO sem alterar código.
 */

export type PlanCtaMode = "checkout" | "trial" | "demo" | "contact" | "unavailable" | "custom_url";

export interface PlanRow {
  slug: string;
  name: string;
  label: string | null;
  description: string | null;
  active: boolean;
  sort_order: number;
  color: string | null;
  icon: string | null;
  visible_on_landing: boolean;
  visible_on_billing: boolean;
  visible_on_checkout: boolean;
  visible_on_compare: boolean;
  limits: Record<string, number | boolean>;
  trial_days: number | null;
  supports_multi_shop: boolean;
  included_shops: number;
  stripe_product_id: string | null;
  archived_at: string | null;
  cta_mode: PlanCtaMode;
  cta_label: string | null;
  cta_url: string | null;
  badge_label: string | null;
  show_button: boolean;
  show_price: boolean;
  show_trial: boolean;
  show_badge: boolean;
}

export interface PlanFeatureRow {
  plan_slug: string;
  feature_slug: string;
  enabled: boolean;
  limits: Record<string, unknown>;
}

export interface PlanPriceRow {
  plan_slug: string;
  country_code: string;
  cycle: string;
  currency: string;
  amount: number;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  stripe_coupon_id: string | null;
  trial_days_override: number | null;
  active: boolean;
}

export interface PlansCatalog {
  plans: PlanRow[];
  features: Record<string, PlanFeatureRow[]>; // key: plan_slug
  prices: PlanPriceRow[];
}

async function fetchCatalog(): Promise<PlansCatalog> {
  const [plansRes, featRes, pricesRes] = await Promise.all([
    supabase.from("plans").select("*").eq("active", true).order("sort_order"),
    supabase.from("plan_features").select("*"),
    supabase.from("plan_country_prices").select("*").eq("active", true),
  ]);

  const plans = (plansRes.data ?? []).map((p: any) => ({
    ...p,
    limits: (p.limits ?? {}) as Record<string, number | boolean>,
    cta_mode: (p.cta_mode ?? "trial") as PlanCtaMode,
    cta_label: p.cta_label ?? null,
    cta_url: p.cta_url ?? null,
    badge_label: p.badge_label ?? null,
    show_button: p.show_button ?? true,
    show_price: p.show_price ?? true,
    show_trial: p.show_trial ?? true,
    show_badge: p.show_badge ?? true,
  })) as PlanRow[];

  const featuresByPlan: Record<string, PlanFeatureRow[]> = {};
  for (const f of (featRes.data ?? []) as PlanFeatureRow[]) {
    (featuresByPlan[f.plan_slug] ??= []).push(f);
  }

  // Register plan ranks into the shared planHierarchy registry so
  // getPlanButtonState / getPlanRank work for *any* plan slug (Enterprise,
  // Business, custom…) without touching code.
  registerPlanRanks(Object.fromEntries(plans.map((p) => [p.slug, p.sort_order])));

  return {
    plans,
    features: featuresByPlan,
    prices: (pricesRes.data ?? []) as PlanPriceRow[],
  };
}

export function usePlansCatalog() {
  const query = useQuery({
    queryKey: ["plans-catalog-v2"],
    queryFn: fetchCatalog,
    staleTime: 5 * 60 * 1000,
  });

  // Invalidação em tempo real quando o Admin altera algo
  useEffect(() => {
    const channel = supabase
      .channel("plans-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => query.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_features" }, () => query.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "plan_country_prices" }, () => query.refetch())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return query;
}

// ── Utilitários puros (sem estado) ─────────────────────────────────────

export function findPlan(catalog: PlansCatalog | undefined, slug: string): PlanRow | undefined {
  return catalog?.plans.find((p) => p.slug === slug);
}

export function planLimit(plan: PlanRow | undefined, key: string, fallback: number = -1): number {
  const v = plan?.limits?.[key];
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  return fallback;
}

export function planCapability(plan: PlanRow | undefined, key: string, fallback = false): boolean {
  const v = plan?.limits?.[key];
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  return fallback;
}

export function priceFor(
  catalog: PlansCatalog | undefined,
  slug: string,
  country: string,
  cycle: "monthly" | "yearly" = "monthly",
): PlanPriceRow | undefined {
  if (!catalog) return undefined;
  return catalog.prices.find(
    (p) => p.plan_slug === slug && p.country_code === country && p.cycle === cycle,
  );
}

/**
 * `current` cobre o plano `required`? Comparação por sort_order (nunca por slug).
 * Aceita plano por slug ou por objeto. Retorna true se current.sort_order >= required.sort_order.
 */
export function planSatisfies(
  catalog: PlansCatalog | undefined,
  currentSlug: string,
  requiredSlug: string,
): boolean {
  const cur = findPlan(catalog, currentSlug);
  const req = findPlan(catalog, requiredSlug);
  if (!cur || !req) return false;
  return cur.sort_order >= req.sort_order;
}

export function publicPlans(catalog: PlansCatalog | undefined, surface: "landing" | "billing" | "checkout" | "compare" = "billing"): PlanRow[] {
  if (!catalog) return [];
  const key =
    surface === "landing" ? "visible_on_landing" :
    surface === "billing" ? "visible_on_billing" :
    surface === "checkout" ? "visible_on_checkout" : "visible_on_compare";
  return catalog.plans
    .filter((p) => p.active && !p.archived_at && (p as any)[key])
    .sort((a, b) => a.sort_order - b.sort_order);
}
