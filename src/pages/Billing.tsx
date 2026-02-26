import { useState, useEffect } from "react";
import { useSubscription, type Plan } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Zap, Building2, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function Billing() {
  const { t } = useLanguage();
  const { subscription, plan, prices, isTrialing, trialDaysLeft, loading, syncWithStripe } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgrading, setUpgrading] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Handle return from Stripe — show toast then clean URL
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error(t('billing.errorPortal'));
    }
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
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{t(`billing.plan.${plan}`)}</span>
                {isTrialing && (
                  <Badge variant="secondary" className="bg-warning/10 text-warning">
                    <Clock className="w-3 h-3 mr-1" />
                    Trial — {trialDaysLeft} {t('billing.daysLeft')}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {subscription?.current_period_end
                  ? `${t('billing.renewsOn')} ${new Date(subscription.current_period_end).toLocaleDateString()}`
                  : t('billing.freePlanActive')
                }
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {plan !== 'free' && (
              <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                <ExternalLink className="w-4 h-4 mr-2" />
                {t('billing.manage')}
              </Button>
            )}
            {plan === 'free' && (
              <Button onClick={() => handleUpgrade('pro')} disabled={upgrading} className="gradient-primary text-primary-foreground">
                <Crown className="w-4 h-4 mr-2" />
                {t('billing.tryPro')}
              </Button>
            )}
          </div>
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
    </div>
  );
}
