import { useState, useEffect } from "react";
import { useSubscription, type Plan } from "@/hooks/useSubscription";
import { loadPlatformSettings, getCachedPlatformSettings } from "@/lib/platformSettings";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { getRegionalPricing, formatPrice, isBrazil } from "@/lib/regionConfig";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Building2, Clock, ExternalLink, XCircle, RefreshCw, Shield, CalendarDays, Gauge, Gift, Lock } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePlanNames } from "@/hooks/usePlanNames";

function ReferralFreeMonths() {
  const { t } = useLanguage();
  const [freeMonths, setFreeMonths] = useState(0);
  const [paidCount, setPaidCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("referral_codes")
        .select("free_months_balance, paid_referrals_count")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFreeMonths(data.free_months_balance || 0);
        setPaidCount(data.paid_referrals_count || 0);
      }
    };
    load();
  }, []);

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Gift className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">{t('billing.referralRewards') || 'Recompensas de Referências'}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="text-center p-4 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-3xl font-bold text-primary">{freeMonths}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('referrals.freeMonths')}</p>
        </div>
        <div className="text-center p-4 bg-muted/50 rounded-lg">
          <p className="text-3xl font-bold">{paidCount}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('referrals.paidReferrals')}</p>
        </div>
        <div className="flex items-center justify-center">
          <Link to="/referrals">
            <Button variant="outline" size="sm">
              <Gift className="w-4 h-4 mr-2" />
              {t('billing.viewReferrals') || 'Ver Referências'}
            </Button>
          </Link>
        </div>
      </div>
      {freeMonths > 0 && (
        <p className="text-xs text-success mt-3">
          ✅ {t('billing.freeMonthsApplied') || `${freeMonths} mês(es) grátis serão aplicados na próxima renovação`}
        </p>
      )}
    </div>
  );
}

export default function Billing() {
  const { t } = useLanguage();
  const { subscription, plan, limits, isTrialing, trialDaysLeft, loading, syncWithStripe, shopId, mustSubscribe } = useSubscription();
  const { getName: getPlanName } = usePlanNames();
  const [pricingTick, setPricingTick] = useState(0);
  const [freeQuoteLimit, setFreeQuoteLimit] = useState<number>(getCachedPlatformSettings().planLimits.freeQuoteLimit);
  useEffect(() => {
    loadPlatformSettings().then((s) => setFreeQuoteLimit(s.planLimits.freeQuoteLimit));
    const onUpdate = () => {
      setPricingTick((t) => t + 1);
      loadPlatformSettings(true).then((s) => setFreeQuoteLimit(s.planLimits.freeQuoteLimit));
    };
    window.addEventListener("garageflow:pricing-updated", onUpdate);
    window.addEventListener("garageflow:country-detected", onUpdate);
    window.addEventListener("garageflow:platform-settings-updated", onUpdate);
    return () => {
      window.removeEventListener("garageflow:pricing-updated", onUpdate);
      window.removeEventListener("garageflow:country-detected", onUpdate);
      window.removeEventListener("garageflow:platform-settings-updated", onUpdate);
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const regionalPricing = (() => { void pricingTick; return getRegionalPricing(); })();
  const prices = regionalPricing;
  const isBR = isBrazil();
  const [monthlyQuotes, setMonthlyQuotes] = useState(0);
  const [teamCount, setTeamCount] = useState(0);
  const [shopCount, setShopCount] = useState(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [managingPortal, setManagingPortal] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Handle return from Stripe
  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');
    if (success === 'true') {
      toast.success(t('billing.paymentSuccess'));
      syncWithStripe();
      navigate('/billing', { replace: true });
    } else if (canceled === 'true') {
      toast.info(t('billing.paymentCanceled'));
      navigate('/billing', { replace: true });
    }
  }, [searchParams, t, navigate]);

  // Load usage stats
  useEffect(() => {
    if (!shopId) return;
    const loadUsage = async () => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const [quotesRes, teamRes, shopsRes] = await Promise.all([
        supabase.from("quotes").select("id", { count: "exact", head: true }).eq("shop_id", shopId).gte("created_at", monthStart),
        supabase.from("shop_users").select("id", { count: "exact", head: true }).eq("shop_id", shopId),
        supabase.from("shops").select("id", { count: "exact", head: true }),
      ]);
      setMonthlyQuotes(quotesRes.count || 0);
      setTeamCount(teamRes.count || 0);
      setShopCount(shopsRes.count || 0);
    };
    loadUsage();
  }, [shopId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isAdminManaged = subscription && !subscription.stripe_subscription_id && plan !== 'free' && !mustSubscribe;
  const hasStripe = !!subscription?.stripe_subscription_id;
  const isCanceled = subscription?.status === 'canceled' || subscription?.status === 'cancelled';
  // No free tier exists: any user without an active/trialing subscription must
  // resubscribe. `mustSubscribe` (from useSubscription) is the single source of
  // truth — do NOT reintroduce a "free" plan fallback anywhere on this page.
  const noActivePlan = mustSubscribe || isCanceled;

  const plans: { key: Plan; icon: React.ElementType; color: string; features: string[]; lockedFeatures?: string[] }[] = [
    {
      key: 'free',
      icon: Gift,
      color: 'text-muted-foreground',
      features: [
        `${freeQuoteLimit} ${t('billing.feature.quotes10').replace(/^\d+\s*/, '')}`,
        t('billing.feature.1user'),
        t('billing.feature.basicDashboard'),
        t('billing.feature.watermarkPdf'),
      ],
      lockedFeatures: [
        t('billing.feature.unlimitedQuotes'),
        t('billing.feature.emailAuto'),
        t('billing.feature.export'),
        t('billing.feature.automations'),
        t('billing.feature.advancedReports'),
        t('billing.feature.multiShop'),
        t('billing.feature.chatbot'),
        t('billing.feature.api'),
      ],
    },
    {
      key: 'pro',
      icon: Crown,
      color: 'text-primary',
      features: [
        t('billing.feature.unlimitedQuotes'),
        t('billing.feature.5users'),
        t('billing.feature.fullDashboard'),
        t('billing.feature.proPdf'),
        t('billing.feature.basicAlerts'),
        t('billing.feature.emailAuto'),
        t('billing.feature.export'),
      ],
      lockedFeatures: [
        t('billing.feature.automations'),
        t('billing.feature.advancedReports'),
        t('billing.feature.multiShop'),
        t('billing.feature.api'),
      ],
    },
    {
      key: 'garage',
      icon: Building2,
      color: 'text-success',
      features: [
        t('billing.feature.unlimitedQuotes'),
        t('billing.feature.unlimitedUsers'),
        t('billing.feature.advancedDashboard'),
        t('billing.feature.proPdf'),
        t('billing.feature.advancedAlerts'),
        t('billing.feature.automations'),
        t('billing.feature.advancedReports'),
        t('billing.feature.multiShop'),
        t('billing.feature.chatbot'),
        t('billing.feature.api'),
      ],
      lockedFeatures: [],
    },
  ];


  const isEmbeddedRuntime = () => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  };

  const openPendingExternalWindow = () => {
    if (!isEmbeddedRuntime()) return null;

    const externalWindow = window.open("", "_blank");
    if (externalWindow) {
      try {
        externalWindow.opener = null;
        externalWindow.document.title = "GarageFlow";
      } catch {}
      externalWindow.focus();
    }

    return externalWindow;
  };

  const redirectToExternalUrl = (url: string, externalWindow?: Window | null) => {
    if (externalWindow && !externalWindow.closed) {
      externalWindow.location.replace(url);
      externalWindow.focus();
      return;
    }

    if (isEmbeddedRuntime()) {
      throw new Error('REDIRECT_BLOCKED');
    }

    window.location.assign(url);
  };

  const runExternalRedirect = async (resolveUrl: () => Promise<string>) => {
    const externalWindow = openPendingExternalWindow();

    try {
      const url = await resolveUrl();
      redirectToExternalUrl(url, externalWindow);
    } catch (error) {
      if (externalWindow && !externalWindow.closed) {
        externalWindow.close();
      }
      throw error;
    }
  };

  const createCheckoutUrl = async (targetPlan: Plan) => {
    const { data: sessionData } = await supabase.auth.getSession();
    let session = sessionData.session;

    if (!session) {
      throw new Error('SESSION_EXPIRED');
    }

    const expiresSoon = !session.expires_at || (session.expires_at * 1000) - Date.now() < 60_000;
    if (expiresSoon) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        throw new Error('SESSION_EXPIRED');
      }
      session = refreshed.session;
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({
        plan: targetPlan,
        billing_cycle: billingCycle,
        region: isBR ? 'br' : 'eu',
      }),
    });

    const raw = await response.text();
    let payload: { url?: string; error?: string } = {};

    if (raw) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = { error: raw };
      }
    }

    if (!response.ok) {
      throw new Error(payload.error || 'CHECKOUT_FAILED');
    }

    if (!payload.url) {
      throw new Error(payload.error || 'CHECKOUT_FAILED');
    }

    return payload.url;
  };

  const createCustomerPortalUrl = async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    if (error) throw error;
    if (!data?.url) throw new Error('PORTAL_FAILED');
    return data.url as string;
  };

  const handleUpgrade = async (targetPlan: Plan) => {
    setUpgrading(true);
    try {
      await runExternalRedirect(() => createCheckoutUrl(targetPlan));
    } catch (err: any) {
      console.error('Checkout error:', err);
      const msg = err?.message || '';
      if (msg === 'REDIRECT_BLOCKED') {
        toast.error('O checkout foi criado, mas o browser bloqueou a abertura da nova aba.');
      } else if (msg === 'SESSION_EXPIRED' || msg.includes('Not authenticated') || msg.includes('No authorization')) {
        toast.error(t('billing.errorSessionExpired') || 'Sessão expirada. Faça login novamente.');
        navigate('/auth');
      } else {
        toast.error(t('billing.errorCheckout'));
      }
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      await runExternalRedirect(createCustomerPortalUrl);
    } catch (err: any) {
      toast.error(t('billing.errorPortal'));
    } finally {
      setManagingPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      if (hasStripe) {
        // Cancel via Stripe portal
        await runExternalRedirect(createCustomerPortalUrl);
        return;
      }
      // For admin-managed plans or fallback — cancel locally WITHOUT assigning
      // any new plan. The subscription simply loses its active status; the
      // last known plan value is preserved for reference only.
      const shopId = subscription?.shop_id;
      if (shopId) {
        const { error } = await supabase.from("subscriptions").update({
          status: 'canceled',
          current_period_end: new Date().toISOString(),
          revenue_type: 'free',
        }).eq("shop_id", shopId);
        if (error) throw error;
        toast.success(t('billing.cancelSuccess'));
      }
    } catch (err: any) {
      toast.error(t('billing.errorGeneric'));
    } finally {
      setCanceling(false);
      setCancelDialogOpen(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      day: '2-digit', month: 'long', year: 'numeric',
    });
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('billing.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('billing.subtitle')}</p>
        </div>
      </div>

      {/* Current Plan Banner */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              noActivePlan ? 'bg-destructive/10' : 'gradient-primary'
            }`}>
              {noActivePlan ? <XCircle className="w-5 h-5 text-destructive" /> : <Crown className="w-5 h-5 text-primary-foreground" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">
                  {noActivePlan
                    ? (t('billing.noActivePlan') || 'Sem plano ativo')
                    : getPlanName(plan, t(`billing.plan.${plan}`))}
                </span>
                {isTrialing && !noActivePlan && (
                  <Badge variant="secondary" className="bg-warning/10 text-warning">
                    <Clock className="w-3 h-3 mr-1" />
                    Trial — {trialDaysLeft} {t('billing.daysLeft')}
                  </Badge>
                )}
                {noActivePlan && (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    {t('billing.statusCanceled') || 'Expirado'}
                  </Badge>
                )}
                {isAdminManaged && !noActivePlan && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <Shield className="w-3 h-3 mr-1" />
                    {t('billing.managedPlan')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {noActivePlan
                  ? (t('billing.mustSubscribeMessage')
                    || 'A sua subscrição expirou. Escolha um plano para continuar a utilizar todas as funcionalidades do GarageFlow.')
                  : isAdminManaged
                  ? t('billing.adminManagedNote')
                  : subscription?.current_period_end
                  ? `${t('billing.renewsOn')} ${formatDate(subscription.current_period_end)}`
                  : getPlanName(plan, t(`billing.plan.${plan}`))
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Stripe-managed: show portal button */}
            {hasStripe && !noActivePlan && (
              <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={managingPortal}>
                {managingPortal ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {t('billing.manage')}
              </Button>
            )}
            {/* Cancel button — only when there is an active plan */}
            {!noActivePlan && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/5" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="w-4 h-4 mr-2" />
                {t('billing.cancelSubscription')}
              </Button>
            )}
            {/* Subscribe — shown when the user has no active plan */}
            {noActivePlan && (
              <Button onClick={() => handleUpgrade('pro')} disabled={upgrading} className="gradient-primary text-primary-foreground">
                <Crown className="w-4 h-4 mr-2" />
                {t('billing.subscribe') || 'Subscrever'}
              </Button>
            )}
          </div>
        </div>

        {/* Subscription details row — only meaningful while an active plan exists */}
        {!noActivePlan && (
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="w-4 h-4" />
              <span>{t('billing.billingCycleLabel')}: <strong className="text-foreground capitalize">{subscription?.billing_cycle || 'monthly'}</strong></span>
            </div>
            {subscription?.current_period_end && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span>{t('billing.nextRenewal')}: <strong className="text-foreground">{formatDate(subscription.current_period_end)}</strong></span>
              </div>
            )}
            {isAdminManaged && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Shield className="w-4 h-4" />
                <span>{t('billing.adminManagedNote')}</span>
              </div>
            )}
          </div>
        )}
      </div>


      {/* Referral Free Months */}
      <ReferralFreeMonths />


      {/* Plan Limits & Quotas */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Gauge className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">{t('billing.limitsTitle')}</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Quotes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('billing.limitsQuotes')}</span>
              <span className="font-medium mono">
                {monthlyQuotes}/{limits.maxQuotesPerMonth === Infinity ? '∞' : limits.maxQuotesPerMonth}
              </span>
            </div>
            <Progress
              value={limits.maxQuotesPerMonth === Infinity ? 0 : (monthlyQuotes / limits.maxQuotesPerMonth) * 100}
              className="h-2"
            />
          </div>
          {/* Team */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('billing.limitsUsers')}</span>
              <span className="font-medium mono">
                {teamCount}/{limits.maxUsers === Infinity ? '∞' : limits.maxUsers}
              </span>
            </div>
            <Progress
              value={limits.maxUsers === Infinity ? 0 : (teamCount / limits.maxUsers) * 100}
              className="h-2"
            />
          </div>
          {/* Shops */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('billing.limitsShops')}</span>
              <span className="font-medium mono">
                {shopCount}/{limits.multiShop ? 5 : 1}
              </span>
            </div>
            <Progress
              value={(shopCount / (limits.multiShop ? 5 : 1)) * 100}
              className="h-2"
            />
          </div>
        </div>
        {/* Feature flags */}
        <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-3">
          {[
            { key: 'advancedAlerts', label: t('billing.feature.advancedAlerts') },
            { key: 'automations', label: t('billing.feature.automations') },
            { key: 'chatbot', label: t('billing.feature.chatbot') },
            { key: 'api', label: t('billing.feature.api') },
            { key: 'multiShop', label: t('billing.feature.multiShop') },
          ].map(f => (
            <Badge key={f.key} variant="outline" className={
              (limits as any)[f.key]
                ? 'bg-success/10 text-success border-success/30'
                : 'bg-muted text-muted-foreground'
            }>
              {(limits as any)[f.key] ? <Check className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              {f.label}
            </Badge>
          ))}
        </div>
      </div>

      {/* Billing Cycle Toggle */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('billing.monthly')}
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            billingCycle === 'yearly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('billing.yearly')}
          <Badge variant="secondary" className="ml-2 bg-success/10 text-success text-xs">
            {regionalPricing.annualSavingsLabel}
          </Badge>
        </button>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(({ key, icon: Icon, color, features, lockedFeatures }) => {
          const price = prices[key][billingCycle];
          // When the user has no active subscription, NO card must show as
          // "Plano Atual" — every card is a fresh subscription option and the
          // button always reads "Subscrever".
          const isCurrentPlan = !noActivePlan && plan === key;

          return (
            <div
              key={key}
              className={`relative bg-card border rounded-xl p-6 transition-all ${
                isCurrentPlan ? 'border-primary shadow-lg shadow-primary/10' : 'border-border hover:border-primary/30'
              }`}
            >
              {key === 'pro' && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gradient-primary text-primary-foreground px-3 py-1">
                    {t('billing.popular')}
                  </Badge>
                </div>
              )}

              <div className="text-center mb-6">
                <Icon className={`w-8 h-8 mx-auto mb-3 ${color}`} />
                <h3 className="text-xl font-bold">{getPlanName(key, t(`billing.plan.${key}`))}</h3>
                <div className="mt-3">
                  <span className="text-4xl font-bold mono">{formatPrice(price)}</span>
                  {price > 0 && (
                    <span className="text-muted-foreground text-sm">
                      /{billingCycle === 'monthly' ? t('billing.mo') : t('billing.yr')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('billing.trial30')}
                </p>
              </div>

              <ul className="space-y-3 mb-6">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
                    <span>{feature}</span>
                  </li>
                ))}
                {lockedFeatures?.map((feature, i) => (
                  <li key={`locked-${i}`} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Lock className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full ${
                  isCurrentPlan
                    ? 'bg-muted text-muted-foreground cursor-default hover:bg-muted'
                    : key === 'pro'
                    ? 'gradient-primary text-primary-foreground'
                    : ''
                }`}
                disabled={isCurrentPlan || upgrading}
                onClick={() => handleUpgrade(key)}
              >
                {isCurrentPlan
                  ? t('billing.currentPlan')
                  : upgrading
                  ? t('common.loading')
                  : noActivePlan
                  ? (t('billing.subscribe') || 'Subscrever')
                  : t('billing.upgrade')
                }
              </Button>
            </div>
          );
        })}
      </div>


      {/* Cancel Subscription Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('billing.cancelTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('billing.cancelDescription')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={canceling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {canceling ? t('common.loading') : t('billing.confirmCancel')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
