import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { useAuthReady } from "@/hooks/useAuthReady";
import { usePlansCatalog } from "@/hooks/usePlansCatalog";
import {
  loadPlatformSettings,
  getCachedPlatformSettings,
  limitOverridesFor,
  type PlatformSettings,
} from "@/lib/platformSettings";

/**
 * Plan slug. `'free' | 'pro' | 'garage'` are the historical/legacy slugs
 * with hardcoded fallbacks in this file. Any other string is a plan
 * created dynamically by Super Admin via `AdminPlans` — its limits are
 * resolved from `plan_features` matrix (loaded by `src/lib/features.ts`)
 * and Admin overrides in `platform_settings`. No code change is needed
 * to add a new plan.
 */
export type Plan = 'free' | 'pro' | 'garage' | (string & {});
export type LegacyPlan = 'free' | 'pro' | 'garage';

export interface Subscription {
  id: string;
  shop_id: string;
  plan: Plan;
  billing_cycle: 'monthly' | 'yearly';
  status: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_end: string | null;
  current_period_end: string | null;
}

export interface PlanLimits {
  maxQuotesPerMonth: number;
  maxUsers: number;
  teamManagement: boolean;
  pdfWatermark: boolean;
  advancedAlerts: boolean;
  basicAlerts: boolean;
  automations: boolean;
  basicAutomations: boolean;
  advancedReports: boolean;
  basicReports: boolean;
  multiShop: boolean;
  chatbot: boolean;
  api: boolean;
  marketing: boolean;
  loyalty: boolean;
  quoteApproval: boolean;
  fullUploads: boolean;
  fullInspections: boolean;
  csvExport: boolean;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxQuotesPerMonth: 10,
    maxUsers: 1,
    teamManagement: false,
    pdfWatermark: true,
    advancedAlerts: false,
    basicAlerts: false,
    automations: false,
    basicAutomations: false,
    advancedReports: false,
    basicReports: false,
    multiShop: false,
    chatbot: false,
    api: false,
    marketing: false,
    loyalty: false,
    quoteApproval: false,
    fullUploads: false,
    fullInspections: false,
    csvExport: false,
  },
  pro: {
    maxQuotesPerMonth: Infinity,
    maxUsers: 5,
    teamManagement: true,
    pdfWatermark: false,
    advancedAlerts: true,
    basicAlerts: true,
    automations: false,
    basicAutomations: true,
    advancedReports: false,
    basicReports: true,
    multiShop: false,
    chatbot: false,
    api: false,
    marketing: false,
    loyalty: false,
    quoteApproval: true,
    fullUploads: false,
    fullInspections: true,
    csvExport: true,
  },
  garage: {
    maxQuotesPerMonth: Infinity,
    maxUsers: Infinity,
    teamManagement: true,
    pdfWatermark: false,
    advancedAlerts: true,
    basicAlerts: true,
    automations: true,
    basicAutomations: true,
    advancedReports: true,
    basicReports: true,
    multiShop: true,
    chatbot: true,
    api: true,
    marketing: true,
    loyalty: true,
    quoteApproval: true,
    fullUploads: true,
    fullInspections: true,
    csvExport: true,
  },
};

// Prices are NOT hardcoded here anymore — they live in country_settings (single
// source of truth) and are read via @/lib/regionConfig::getRegionalPricing().
// Use that helper directly wherever you need to display a plan price.

const STORAGE_KEY = "garageflow_active_shop";
const SUBSCRIPTION_QUERY_TIMEOUT_MS = 3000;
const subscriptionCache = new Map<string, Subscription | null>();
const subscriptionInflight = new Map<string, Promise<Subscription | null>>();

function timeoutResult<T>(value: T, ms = SUBSCRIPTION_QUERY_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

async function fetchSubscriptionForShop(shopId: string, force = false): Promise<Subscription | null> {
  if (!force && subscriptionCache.has(shopId)) {
    return subscriptionCache.get(shopId) ?? null;
  }

  if (!force && subscriptionInflight.has(shopId)) {
    return subscriptionInflight.get(shopId) ?? null;
  }

  const request = (async () => {
    try {
      const { data } = await Promise.race([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("shop_id", shopId)
          .maybeSingle(),
        timeoutResult({ data: null }),
      ]);

      const next = (data as unknown as Subscription | null) ?? null;
      subscriptionCache.set(shopId, next);
      return next;
    } finally {
      subscriptionInflight.delete(shopId);
    }
  })();

  subscriptionInflight.set(shopId, request);
  return request;
}

export function useSubscription() {
  const activeShopId = useActiveShopId();
  const { user, isReady: authReady } = useAuthReady("erp");
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(getCachedPlatformSettings());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load admin-managed plan limits / feature gates (single source of truth)
  useEffect(() => {
    let cancelled = false;
    loadPlatformSettings().then((s) => { if (!cancelled) setPlatformSettings(s); });
    const onUpdate = () => {
      loadPlatformSettings(true).then((s) => { if (!cancelled) setPlatformSettings(s); });
    };
    window.addEventListener("garageflow:platform-settings-updated", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("garageflow:platform-settings-updated", onUpdate);
    };
  }, []);

  // Resolve active shop ID
  const resolveShopId = useCallback(async (): Promise<string | null> => {
    if (!authReady || !user) return null;

    const activeId = localStorage.getItem(STORAGE_KEY);
    if (activeId) {
      const { data: shop } = await Promise.race([
        supabase
          .from("shops")
          .select("id")
          .eq("id", activeId)
          .maybeSingle(),
        timeoutResult({ data: { id: activeId } }),
      ]);
      if (shop) return shop.id;
    }

    const { data: shop } = await Promise.race([
      supabase
        .from("shops")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle(),
      timeoutResult({ data: null }),
    ]);
    return shop?.id || null;
  }, [authReady, user]);

  // Load subscription from DB only (source of truth)
  const loadSubscription = useCallback(async (resolvedShopId?: string, force = false) => {
    const sid = resolvedShopId || activeShopId || await resolveShopId();
    if (!sid) {
      setShopId(null);
      setSubscription(null);
      setLoading(false);
      setSubscriptionLoaded(true);
      return;
    }

    setShopId((prev) => (prev === sid ? prev : sid));
    try {
      const sub = await fetchSubscriptionForShop(sid, force);
      setSubscription(sub);
    } catch {
      setSubscription(null);
    } finally {
      setSubscriptionLoaded(true);
      setLoading(false);
    }
  }, [activeShopId, resolveShopId]);

  // Sync with Stripe (only for Stripe-managed subscriptions, not admin overrides)
  const syncWithStripe = useCallback(async () => {
    try {
      const sid = shopId || activeShopId || await resolveShopId();
      if (sid) {
        const { data: sub } = await Promise.race([
          supabase
            .from("subscriptions")
            .select("stripe_subscription_id")
            .eq("shop_id", sid)
            .maybeSingle(),
          timeoutResult({ data: null }),
        ]);
        
        // CRITICAL: Skip sync if no stripe_subscription_id (admin-managed plan)
        if (!sub?.stripe_subscription_id) {
          console.log("[useSubscription] Skipping Stripe sync — no stripe_subscription_id (admin-managed)");
          return;
        }
      }
      await supabase.functions.invoke('check-subscription');
      if (sid) subscriptionCache.delete(sid);
      await loadSubscription(sid, true);
    } catch (e) {
      console.warn("Failed to sync subscription with Stripe:", e);
    }
  }, [activeShopId, loadSubscription, shopId, resolveShopId]);

  // Setup Realtime channel filtered by shop_id
  const setupRealtime = useCallback((sid: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`subscription-${sid}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `shop_id=eq.${sid}`,
        },
        () => {
          subscriptionCache.delete(sid);
          loadSubscription(sid, true);
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [loadSubscription]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!authReady) return;
      try {
        const sid = activeShopId || await resolveShopId();
        if (!mounted) return;
        if (!sid) { setLoading(false); setSubscriptionLoaded(true); return; }

        // Load from DB (fast)
        await loadSubscription(sid);

        // Setup Realtime for this specific shop
        setupRealtime(sid);

        // Background Stripe sync — only if shop has stripe_subscription_id
        const { data: sub } = await Promise.race([
          supabase
            .from("subscriptions")
            .select("stripe_subscription_id")
            .eq("shop_id", sid)
            .maybeSingle(),
          timeoutResult({ data: null }),
        ]);

        if (sub?.stripe_subscription_id) {
          supabase.functions.invoke('check-subscription').then(() => {
            if (mounted) {
              subscriptionCache.delete(sid);
              loadSubscription(sid, true);
            }
          }).catch(() => {});
        }
      } catch {
        if (mounted) {
          setLoading(false);
          setSubscriptionLoaded(true);
        }
      }
    };

    setLoading(true);
    setSubscriptionLoaded(false);
    init();

    return () => {
      mounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeShopId, authReady, resolveShopId, loadSubscription, setupRealtime]);

  // CRITICAL: Calculate effectivePlan correctly
  // - While loading, don't calculate (loading state prevents UI from rendering wrong plan)
  // - Only downgrade to free if status is explicitly canceled/past_due
  // - NEVER fallback to free silently for admin-managed plans
  const rawPlan: Plan = (subscription?.plan as Plan) || 'free';
  const lockedStatus = subscription?.status === 'canceled'
    || subscription?.status === 'cancelled'
    || subscription?.status === 'past_due'
    || subscription?.status === 'trial_expired';

  // Client-side detection: an admin-managed plan (no stripe_subscription_id)
  // whose current_period_end is in the past must be treated as expired even
  // if the server hasn't flipped it yet. There is NO free fallback.
  const adminExpiredClient = !!subscription
    && !subscription.stripe_subscription_id
    && !!subscription.current_period_end
    && new Date(subscription.current_period_end).getTime() < Date.now();

  // Admin-managed plans are valid when explicitly active/trialing, even when
  // they do not have a Stripe id or period end. Several real Garage plans are
  // granted this way from the admin panel; treating them as unpaid was locking
  // Garage-only modules like Marketing/Fidelização.
  const noPaidBacking = !!subscription
    && !subscription.stripe_subscription_id
    && !subscription.current_period_end
    && !['active', 'trialing'].includes(subscription.status);

  const effectivePlan: Plan = !subscriptionLoaded
    ? 'free' // Will be hidden by loading state
    : (lockedStatus || adminExpiredClient || noPaidBacking)
      ? 'free'
      : rawPlan;

  // There is NO free tier — even the entry "Start" plan is paid (€19.99+).
  // A shop with no active/trialing subscription (canceled, past_due, expired)
  // must resubscribe. Any admin-managed plan without stripe_subscription_id
  // is only valid until its current_period_end.
  const mustSubscribe = subscriptionLoaded
    && !!subscription
    && (lockedStatus || adminExpiredClient || noPaidBacking);

  // Admin-managed overrides (Admin > Platform Settings) merged on top
  // of static defaults — guarantees the toggles in /admin/settings drive
  // every feature gate across the app in real time.
  // For unknown plan slugs (created by Super Admin via AdminPlans), start
  // from the most permissive legacy baseline (garage); real per-feature
  // gating is driven by the `plan_features` matrix via useFeature().
  const legacyKey: LegacyPlan =
    (effectivePlan === 'free' || effectivePlan === 'pro' || effectivePlan === 'garage')
      ? (effectivePlan as LegacyPlan)
      : 'garage';
  const overrides = limitOverridesFor(legacyKey, platformSettings);
  const baseLimits: PlanLimits = { ...PLAN_LIMITS[legacyKey], ...(overrides as Partial<PlanLimits>) };
  // When mustSubscribe is true, lock EVERY feature (no free access at all).
  const LOCKED_LIMITS: PlanLimits = {
    maxQuotesPerMonth: 0,
    maxUsers: 0,
    teamManagement: false,
    pdfWatermark: true,
    advancedAlerts: false,
    basicAlerts: false,
    automations: false,
    basicAutomations: false,
    advancedReports: false,
    basicReports: false,
    multiShop: false,
    chatbot: false,
    api: false,
    marketing: false,
    loyalty: false,
    quoteApproval: false,
    fullUploads: false,
    fullInspections: false,
    csvExport: false,
  };
  const limits: PlanLimits = mustSubscribe ? LOCKED_LIMITS : baseLimits;
  // Prices are read directly from country_settings via @/lib/regionConfig — see getRegionalPricing().
  const isTrialing = subscription?.status === 'trialing';
  const isTrialExpired = subscription?.status === 'trial_expired';
  const trialDaysLeft = subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const canUseFeature = (feature: keyof PlanLimits): boolean => {
    return !!limits[feature];
  };


  const checkQuoteLimit = async (): Promise<boolean> => {
    if (limits.maxQuotesPerMonth === Infinity) return true;
    if (!shopId) return false;

    // Use backend validation
    const { data: canCreate } = await supabase.rpc('validate_plan_limit', {
      _action_type: 'create_quote',
      _shop_id: shopId,
    });
    return !!canCreate;
  };

  // Backend-validated feature check
  const validatePlanAction = async (actionType: string): Promise<boolean> => {
    if (!shopId) return false;
    const { data } = await supabase.rpc('validate_plan_limit', {
      _action_type: actionType,
      _shop_id: shopId,
    });
    return !!data;
  };

  return {
    subscription,
    plan: effectivePlan,
    limits,
    loading,
    shopId,
    isTrialing,
    isTrialExpired,
    trialDaysLeft,
    mustSubscribe,
    canUseFeature,
    checkQuoteLimit,
    syncWithStripe,
    subscriptionLoaded,
    validatePlanAction,
  };
}
