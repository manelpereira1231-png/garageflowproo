import { useState, useEffect } from "react";
import { useSubscription, type Plan } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Check, Crown, Zap, Building2, Clock, ExternalLink, XCircle, RefreshCw, Shield, CalendarDays, Gauge, Gift } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  const { subscription, plan, prices, limits, isTrialing, trialDaysLeft, loading, syncWithStripe, shopId } = useSubscription();
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

  const isAdminManaged = subscription && !subscription.stripe_subscription_id && plan !== 'free';
  const hasStripe = !!subscription?.stripe_subscription_id;
  const isCanceled = subscription?.status === 'canceled' || subscription?.status === 'cancelled';

  const plans: { key: Plan; icon: React.ElementType; color: string; features: string[] }[] = [
    {
      key: 'free',
      icon: Zap,
      color: 'text-muted-foreground',
      features: [
        t('billing.feature.quotes10'),
        t('billing.feature.1user'),
        t('billing.feature.basicDashboard'),
        t('billing.feature.watermarkPdf'),
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
    },
  ];

  const handleUpgrade = async (targetPlan: Plan) => {
    if (targetPlan === 'free') return;
    setUpgrading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: targetPlan, billing_cycle: billingCycle },
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(t('billing.errorCheckout'));
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageSubscription = async () => {
    setManagingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
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
        const { data, error } = await supabase.functions.invoke('customer-portal');
        if (error) throw error;
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }
      // For admin-managed plans or fallback — downgrade to free locally
      const shopId = subscription?.shop_id;
      if (shopId) {
        const { error } = await supabase.from("subscriptions").update({
          plan: 'free',
          status: 'canceled',
          current_period_end: new Date().toISOString(),
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
              isCanceled ? 'bg-destructive/10' : 'gradient-primary'
            }`}>
              {isCanceled ? <XCircle className="w-5 h-5 text-destructive" /> : <Crown className="w-5 h-5 text-primary-foreground" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-lg">{t(`billing.plan.${plan}`)}</span>
                {isTrialing && (
                  <Badge variant="secondary" className="bg-warning/10 text-warning">
                    <Clock className="w-3 h-3 mr-1" />
                    Trial — {trialDaysLeft} {t('billing.daysLeft')}
                  </Badge>
                )}
                {isCanceled && (
                  <Badge variant="secondary" className="bg-destructive/10 text-destructive">
                    <XCircle className="w-3 h-3 mr-1" />
                    {t('billing.statusCanceled')}
                  </Badge>
                )}
                {isAdminManaged && !isCanceled && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    <Shield className="w-3 h-3 mr-1" />
                    {t('billing.managedPlan')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {isCanceled
                  ? t('billing.planCanceledDesc')
                  : isAdminManaged
                  ? t('billing.adminManagedNote')
                  : subscription?.current_period_end
                  ? `${t('billing.renewsOn')} ${formatDate(subscription.current_period_end)}`
                  : plan === 'free'
                  ? t('billing.freePlanActive')
                  : t(`billing.plan.${plan}`)
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Stripe-managed: show portal button */}
            {hasStripe && !isCanceled && (
              <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={managingPortal}>
                {managingPortal ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                {t('billing.manage')}
              </Button>
            )}
            {/* Cancel button for paid plans */}
            {plan !== 'free' && !isCanceled && (
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/5" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="w-4 h-4 mr-2" />
                {t('billing.cancelSubscription')}
              </Button>
            )}
            {/* Reactivate / upgrade for free or canceled */}
            {(plan === 'free' || isCanceled) && (
              <Button onClick={() => handleUpgrade('pro')} disabled={upgrading} className="gradient-primary text-primary-foreground">
                <Crown className="w-4 h-4 mr-2" />
                {t('billing.tryPro')}
              </Button>
            )}
          </div>
        </div>

        {/* Subscription details row */}
        {plan !== 'free' && !isCanceled && (
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
            -17%
          </Badge>
        </button>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map(({ key, icon: Icon, color, features }) => {
          const price = prices[key][billingCycle];
          const isCurrentPlan = plan === key;

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
                <h3 className="text-xl font-bold">{t(`billing.plan.${key}`)}</h3>
                <div className="mt-3">
                  <span className="text-4xl font-bold mono">€{price}</span>
                  {price > 0 && (
                    <span className="text-muted-foreground text-sm">
                      /{billingCycle === 'monthly' ? t('billing.mo') : t('billing.yr')}
                    </span>
                  )}
                </div>
                {key !== 'free' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('billing.trial30')}
                  </p>
                )}
              </div>

              <ul className="space-y-3 mb-6">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${color}`} />
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
                variant={key === 'free' ? 'outline' : 'default'}
                disabled={isCurrentPlan || upgrading}
                onClick={() => handleUpgrade(key)}
              >
                {isCurrentPlan
                  ? t('billing.currentPlan')
                  : key === 'free'
                  ? t('billing.downgrade')
                  : upgrading
                  ? t('common.loading')
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
