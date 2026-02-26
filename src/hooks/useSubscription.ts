import { useState, useEffect, useCallback } from "react";
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

  const loadSubscription = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const activeId = localStorage.getItem(STORAGE_KEY);
    let resolvedShopId: string | null = null;

    if (activeId) {
      const { data: shop } = await supabase
        .from("shops")
        .select("id")
        .eq("id", activeId)
        .maybeSingle();
      if (shop) resolvedShopId = shop.id;
    }

    if (!resolvedShopId) {
      const { data: shop } = await supabase
        .from("shops")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (shop) resolvedShopId = shop.id;
    }

    if (!resolvedShopId) { setLoading(false); return; }
    setShopId(resolvedShopId);

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("shop_id", resolvedShopId)
      .maybeSingle();

    if (sub) {
      setSubscription(sub as unknown as Subscription);
    }
    setLoading(false);
  }, []);

  // Sync with Stripe on mount (calls check-subscription edge function)
  const syncWithStripe = useCallback(async () => {
    try {
      await supabase.functions.invoke('check-subscription');
      // After sync, reload from DB
      await loadSubscription();
    } catch (e) {
      console.warn("Failed to sync subscription with Stripe:", e);
    }
  }, [loadSubscription]);

  useEffect(() => {
    // Load from DB first (fast), then sync with Stripe in background
    loadSubscription().then(() => {
      supabase.functions.invoke('check-subscription').then(() => {
        loadSubscription();
      }).catch(() => {});
    });

    // Listen for storage changes (shop switch)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) loadSubscription();
    };
    window.addEventListener('storage', handleStorageChange);

    // Realtime subscription on the subscriptions table
    const channel = supabase
      .channel('subscription-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        (payload) => {
          // Reload subscription data when any change happens
          loadSubscription();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      supabase.removeChannel(channel);
    };
  }, [loadSubscription]);

  const plan: Plan = subscription?.plan as Plan || 'free';
  // If status is canceled or past_due, treat as free
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