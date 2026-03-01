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
  pdfWatermark: boolean;
  advancedAlerts: boolean;
  automations: boolean;
  advancedReports: boolean;
  multiShop: boolean;
  chatbot: boolean;
  api: boolean;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: {
    maxQuotesPerMonth: 10,
    maxUsers: 1,
    pdfWatermark: true,
    advancedAlerts: false,
    automations: false,
    advancedReports: false,
    multiShop: false,
    chatbot: false,
    api: false,
  },
  pro: {
    maxQuotesPerMonth: Infinity,
    maxUsers: 5,
    pdfWatermark: false,
    advancedAlerts: true,
    automations: false,
    advancedReports: false,
    multiShop: false,
    chatbot: false,
    api: false,
  },
  garage: {
    maxQuotesPerMonth: Infinity,
    maxUsers: Infinity,
    pdfWatermark: false,
    advancedAlerts: true,
    automations: true,
    advancedReports: true,
    multiShop: true,
    chatbot: true,
    api: true,
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
    if (!sid) { setLoading(false); return; }
    setShopId(sid);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("shop_id", sid)
      .maybeSingle();

    if (sub) {
      setSubscription(sub as unknown as Subscription);
    } else {
      setSubscription(null);
    }
    setLoading(false);
  }, [resolveShopId]);

  // Sync with Stripe (only for Stripe-managed subscriptions, not admin overrides)
  const syncWithStripe = useCallback(async () => {
    try {
      await supabase.functions.invoke('check-subscription');
      await loadSubscription();
    } catch (e) {
      console.warn("Failed to sync subscription with Stripe:", e);
    }
  }, [loadSubscription]);

  // Setup Realtime channel filtered by shop_id
  const setupRealtime = useCallback((sid: string) => {
    // Cleanup previous channel
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
          // Reload from DB on any change — this is the instant update path
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
      if (!sid) { setLoading(false); return; }

      // Load from DB (fast)
      await loadSubscription(sid);

      // Setup Realtime for this specific shop
      setupRealtime(sid);

      // Background Stripe sync — only if shop has stripe_subscription_id
      // This prevents overwriting admin-set plans for non-Stripe shops
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

    // Listen for shop switch via localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setLoading(true);
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

  const plan: Plan = subscription?.plan as Plan || 'free';
  const effectivePlan: Plan = 
    subscription?.status === 'canceled' || subscription?.status === 'past_due'
      ? 'free'
      : plan;
  
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

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .gte("created_at", monthStart);

    return (count || 0) < limits.maxQuotesPerMonth;
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
  };
}
