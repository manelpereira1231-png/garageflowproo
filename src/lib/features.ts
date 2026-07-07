/**
 * Feature flag system — single source of truth.
 *
 * Reads the `plan_features` matrix maintained by the super admin and
 * exposes a small hook surface for components and route guards.
 *
 * Realtime: subscribes to changes on `features` and `plan_features` so
 * the menu/routes update without a page reload when the admin toggles
 * something in /admin/settings.
 */
import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription, type Plan } from "@/hooks/useSubscription";

export interface FeatureRow {
  slug: string;
  name: string;
  description: string | null;
  category: string;
  is_core: boolean;
  active: boolean;
}

export interface PlanFeatureRow {
  plan_slug: "free" | "pro" | "garage";
  feature_slug: string;
  enabled: boolean;
  limits: Record<string, any>;
}

type State = {
  features: FeatureRow[];
  matrix: PlanFeatureRow[];
  loaded: boolean;
};

const FALLBACK_PLAN_FEATURES: Record<Plan, string[]> = {
  free: ["dashboard", "clients", "vehicles", "quotes", "services", "billing", "settings"],
  pro: [
    "dashboard", "clients", "vehicles", "quotes", "services", "billing", "settings",
    "alerts_basic", "team_management", "invoices", "financial_reports_basic", "agenda",
    "service_catalog", "inspections", "workshop_mode", "referrals", "warranties",
  ],
  garage: [
    "dashboard", "clients", "vehicles", "quotes", "services", "billing", "settings",
    "alerts_basic", "team_management", "invoices", "financial_reports_basic", "agenda",
    "service_catalog", "inspections", "workshop_mode", "referrals", "warranties",
    "chat", "marketing", "automations", "loyalty", "api", "stock", "multiShop",
  ],
};

const fallbackFeatureSetFor = (plan: Plan) => new Set(FALLBACK_PLAN_FEATURES[plan] ?? FALLBACK_PLAN_FEATURES.free);

const listeners = new Set<() => void>();
let cache: State = { features: [], matrix: [], loaded: false };
let inflight: Promise<State> | null = null;
let realtimeBound = false;

function emit() {
  listeners.forEach((fn) => {
    try { fn(); } catch {}
  });
}

async function loadOnce(): Promise<State> {
  if (cache.loaded) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const [{ data: features }, { data: matrix }] = await Promise.all([
      supabase.from("features").select("*").eq("active", true),
      supabase.from("plan_features").select("*"),
    ]);
    cache = {
      features: (features as any) ?? [],
      matrix: (matrix as any) ?? [],
      loaded: true,
    };
    emit();
    return cache;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

export function invalidateFeatureCache() {
  cache = { features: [], matrix: [], loaded: false };
  void loadOnce();
}

function bindRealtime() {
  if (realtimeBound) return;
  realtimeBound = true;
  const ch = supabase
    .channel("features-matrix")
    .on("postgres_changes", { event: "*", schema: "public", table: "features" }, invalidateFeatureCache)
    .on("postgres_changes", { event: "*", schema: "public", table: "plan_features" }, invalidateFeatureCache)
    .subscribe();
  // never unsubscribed: lives for the app lifetime
  void ch;
}

export function useFeatureMatrix() {
  const [, force] = useState(0);
  useEffect(() => {
    const tick = () => force((n) => n + 1);
    listeners.add(tick);
    void loadOnce();
    bindRealtime();
    return () => {
      listeners.delete(tick);
    };
  }, []);
  return cache;
}

/** Returns the active plan slug for the current user (free|pro|garage). */
export function useCurrentPlan(): "free" | "pro" | "garage" {
  const { plan } = useSubscription();
  if (plan === "garage" || plan === "pro" || plan === "free") return plan;
  return "free";
}

/** Hook: can the current user use a given feature slug? */
export function useFeature(slug: string): { allowed: boolean; loaded: boolean; limits: Record<string, any> } {
  const { matrix, features, loaded } = useFeatureMatrix();
  const plan = useCurrentPlan();
  return useMemo(() => {
    if (!loaded || matrix.length === 0) {
      return { allowed: fallbackFeatureSetFor(plan).has(slug), loaded: true, limits: {} };
    }
    const feat = features.find((f) => f.slug === slug);
    if (feat?.is_core) return { allowed: true, loaded, limits: {} };
    const row = matrix.find((r) => r.plan_slug === plan && r.feature_slug === slug);
    return {
      allowed: !!row?.enabled,
      loaded,
      limits: row?.limits ?? {},
    };
  }, [matrix, features, plan, slug, loaded]);
}

/** Returns the full list of feature slugs the current user is allowed to access. */
export function useEnabledFeatureSet(): Set<string> {
  const { matrix, features, loaded } = useFeatureMatrix();
  const plan = useCurrentPlan();
  return useMemo(() => {
    if (!loaded || matrix.length === 0) return fallbackFeatureSetFor(plan);
    const out = new Set<string>();
    for (const f of features) if (f.is_core) out.add(f.slug);
    for (const r of matrix) if (r.plan_slug === plan && r.enabled) out.add(r.feature_slug);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrix, features, plan, loaded]);
}

/** Imperative check (e.g. for event handlers). */
export function useCanUse() {
  const set = useEnabledFeatureSet();
  return useCallback((slug: string) => set.has(slug), [set]);
}
