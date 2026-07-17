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

/**
 * Ordered plan-feature item used by ALL pricing UIs (Landing, Billing,
 * Upgrade Modal, Checkout). Every plan card must render the SAME list in
 * the SAME order — only `enabled` changes. Never split into separate
 * "included" and "locked" arrays at the render site.
 */
export interface PlanFeatureItem {
  slug: string;
  name: string;
  enabled: boolean;
}

/**
 * Single source of truth for the ordered feature list shown on a plan
 * card. Order is derived from the admin-managed `features` table
 * (non-core, active) sorted alphabetically by display name — the same
 * order for every plan. Consumers just map over `items` and pick the
 * icon based on `enabled`.
 */
export function buildPlanFeatureItems(
  planSlug: "free" | "pro" | "garage",
  features: FeatureRow[],
  matrix: PlanFeatureRow[],
): PlanFeatureItem[] {
  const nonCore = [...features]
    .filter((f) => !f.is_core)
    .sort((a, b) => a.name.localeCompare(b.name));
  return nonCore.map((f) => {
    const row = matrix.find((r) => r.plan_slug === planSlug && r.feature_slug === f.slug);
    return { slug: f.slug, name: f.name, enabled: !!row?.enabled };
  });
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

/**
 * Legacy hardcoded restriction — only used as a fallback when the DB
 * matrix hasn't loaded yet. Custom plans skip this and rely purely on
 * the `plan_features` matrix.
 */
const GARAGE_ONLY_FEATURES = new Set(["marketing", "loyalty"]);
const FEATURE_LOAD_TIMEOUT_MS = 3000;

function timeoutResult<T>(value: T, ms = FEATURE_LOAD_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

const fallbackFeatureSetFor = (plan: string) => {
  const legacy = (plan === "free" || plan === "pro" || plan === "garage") ? plan : "garage";
  return new Set(FALLBACK_PLAN_FEATURES[legacy as keyof typeof FALLBACK_PLAN_FEATURES] ?? FALLBACK_PLAN_FEATURES.free);
};

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
      Promise.race([
        supabase.from("features").select("*").eq("active", true),
        timeoutResult({ data: null }),
      ]),
      Promise.race([
        supabase.from("plan_features").select("*"),
        timeoutResult({ data: null }),
      ]),
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

/**
 * Returns the active plan slug for the current user. May be a legacy slug
 * (`free|pro|garage`) OR any custom slug created dynamically by Super
 * Admin via `AdminPlans` — feature gating always goes through the
 * `plan_features` matrix, so no code change is needed for new plans.
 */
export function useCurrentPlan(): string {
  const { plan } = useSubscription();
  return plan || "free";
}

/** Hook: can the current user use a given feature slug? */
export function useFeature(slug: string): { allowed: boolean; loaded: boolean; limits: Record<string, any> } {
  const { matrix, features, loaded } = useFeatureMatrix();
  const { plan: currentPlan, loading: subscriptionLoading, subscriptionLoaded, mustSubscribe } = useSubscription();
  const plan: string = currentPlan || "free";
  const isLegacy = plan === "free" || plan === "pro" || plan === "garage";
  const subscriptionReady = subscriptionLoaded && !subscriptionLoading;
  return useMemo(() => {
    if (!subscriptionReady) return { allowed: false, loaded: false, limits: {} };
    if (mustSubscribe) return { allowed: false, loaded: true, limits: {} };
    if (GARAGE_ONLY_FEATURES.has(slug) && plan !== "garage") {
      return { allowed: false, loaded: true, limits: {} };
    }
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
  }, [matrix, features, plan, slug, loaded, subscriptionReady, mustSubscribe]);
}

/** Returns the full list of feature slugs the current user is allowed to access. */
export function useEnabledFeatureSet(): Set<string> {
  const { matrix, features, loaded } = useFeatureMatrix();
  const { plan: currentPlan, loading: subscriptionLoading, subscriptionLoaded, mustSubscribe } = useSubscription();
  const plan = currentPlan === "garage" || currentPlan === "pro" || currentPlan === "free" ? currentPlan : "free";
  const subscriptionReady = subscriptionLoaded && !subscriptionLoading;
  return useMemo(() => {
    // While the subscription is still resolving, do not falsely mark Garage
    // modules as locked in the sidebar. Route-level FeatureGate still waits
    // for the final plan before rendering protected content.
    if (!subscriptionReady) return fallbackFeatureSetFor("garage");
    if (mustSubscribe) return new Set<string>();
    if (!loaded || matrix.length === 0) return fallbackFeatureSetFor(plan);
    const out = new Set<string>();
    for (const f of features) {
      if (f.is_core && (plan === "garage" || !GARAGE_ONLY_FEATURES.has(f.slug))) out.add(f.slug);
    }
    for (const r of matrix) if (r.plan_slug === plan && r.enabled) out.add(r.feature_slug);
    if (plan !== "garage") {
      for (const slug of GARAGE_ONLY_FEATURES) out.delete(slug);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matrix, features, plan, loaded, subscriptionReady, mustSubscribe]);
}

/** Imperative check (e.g. for event handlers). */
export function useCanUse() {
  const set = useEnabledFeatureSet();
  return useCallback((slug: string) => set.has(slug), [set]);
}
