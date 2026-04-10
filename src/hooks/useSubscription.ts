import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type Plan = 'free' | 'pro' | 'garage';

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

const PLAN_PRICES = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 49, yearly: 490 },
  garage: { monthly: 99, yearly: 990 },
};

const STORAGE_KEY = "garageflow_active_shop";

export function useSubscription() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [shopId, setShopId] = useState<string | null>(null);
  const [subscriptionLoaded, setSubscriptionLoaded] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Resolve active shop ID
  const resolveShopId = useCallback(async (): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const activeId = localStorage.getItem(STORAGE_KEY);
    if (activeId) {
      const { data: shop } = await supabase
        .from("shops")
        .select("id")
        .eq("id", activeId)
        .maybeSingle();
      if (shop) return shop.id;
    }

    const { data: shop } = await supabase
      .from("shops")
      .select("id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();
    return shop?.id || null;
  }, []);

  // Load subscription from DB only (source of truth)
  const loadSubscription = useCallback(async (resolvedShopId?: string) => {
    const sid = resolvedShopId || await resolveShopId();
    if (!sid) { setLoading(false); setSubscriptionLoaded(true); return; }
    setShopId(sid);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("shop_id", sid)
      .maybeSingle();

    if (sub) {
      console.log("[useSubscription] Loaded from DB:", {
        plan: sub.plan,
        status: sub.status,
        stripe_subscription_id: sub.stripe_subscription_id,
        shop_id: sid,
      });
      setSubscription(sub as unknown as Subscription);
    } else {
      console.log("[useSubscription] No subscription found for shop:", sid);
      setSubscription(null);
    }
    setSubscriptionLoaded(true);
    setLoading(false);
  }, [resolveShopId]);

  // Sync with Stripe (only for Stripe-managed subscriptions, not admin overrides)
  const syncWithStripe = useCallback(async () => {
    try {
      const sid = shopId || await resolveShopId();
      if (sid) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("stripe_subscription_id")
          .eq("shop_id", sid)
          .maybeSingle();
        
        // CRITICAL: Skip sync if no stripe_subscription_id (admin-managed plan)
        if (!sub?.stripe_subscription_id) {
          console.log("[useSubscription] Skipping Stripe sync — no stripe_subscription_id (admin-managed)");
          return;
        }
      }
      await supabase.functions.invoke('check-subscription');
      await loadSubscription();
    } catch (e) {
      console.warn("Failed to sync subscription with Stripe:", e);
    }
  }, [loadSubscription, shopId, resolveShopId]);

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
          console.log("[useSubscription] Realtime update received for shop:", sid);
          loadSubscription(sid);
        }
      )
      .subscribe();

    channelRef.current = channel;
  }, [loadSubscription]);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const sid = await resolveShopId();
      if (!mounted) return;
      if (!sid) { setLoading(false); setSubscriptionLoaded(true); return; }

      // Load from DB (fast)
      await loadSubscription(sid);

      // Setup Realtime for this specific shop
      setupRealtime(sid);

      // Background Stripe sync — only if shop has stripe_subscription_id
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("stripe_subscription_id")
        .eq("shop_id", sid)
        .maybeSingle();
      
      if (sub?.stripe_subscription_id) {
        supabase.functions.invoke('check-subscription').then(() => {
          if (mounted) loadSubscription(sid);
        }).catch(() => {});
      }
    };

    init();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setLoading(true);
        setSubscriptionLoaded(false);
        resolveShopId().then(sid => {
          if (!mounted || !sid) return;
          loadSubscription(sid);
          setupRealtime(sid);
        });
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      mounted = false;
      window.removeEventListener('storage', handleStorageChange);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [resolveShopId, loadSubscription, setupRealtime]);

  // CRITICAL: Calculate effectivePlan correctly
  // - While loading, don't calculate (loading state prevents UI from rendering wrong plan)
  // - Only downgrade to free if status is explicitly canceled/past_due
  // - NEVER fallback to free silently for admin-managed plans
  const rawPlan: Plan = (subscription?.plan as Plan) || 'free';
  const effectivePlan: Plan = !subscriptionLoaded
    ? 'free' // Will be hidden by loading state
    : subscription?.status === 'canceled' || subscription?.status === 'cancelled' || subscription?.status === 'past_due'
      ? 'free'
      : rawPlan;
  
  const limits = PLAN_LIMITS[effectivePlan];
  const prices = PLAN_PRICES;
  const isTrialing = subscription?.status === 'trialing';
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
    prices,
    loading,
    shopId,
    isTrialing,
    trialDaysLeft,
    canUseFeature,
    checkQuoteLimit,
    syncWithStripe,
    subscriptionLoaded,
    validatePlanAction,
  };
}
