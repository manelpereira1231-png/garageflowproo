import React from "react";
import { useSubscription, type PlanLimits } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useIsChildShop } from "@/hooks/useIsChildShop";

interface PlanGateProps {
  feature: keyof PlanLimits;
  requiredPlan?: 'pro' | 'garage';
  children: React.ReactNode;
}

const PLAN_LABELS: Record<string, string> = {
  pro: 'Pro',
  garage: 'Garage',
};

const PlanGate = React.forwardRef<HTMLDivElement, PlanGateProps>(
  ({ feature, requiredPlan = 'garage', children }, ref) => {
    const { canUseFeature, loading, subscriptionLoaded } = useSubscription();
    const { t } = useLanguage();
    const { isChildShop } = useIsChildShop();

    if (loading || !subscriptionLoaded) {
      return (
        <div ref={ref} className="flex items-center justify-center min-h-[40vh]">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (!canUseFeature(feature)) {
      return (
        <div ref={ref} className="relative min-h-[50vh]">
          <div className="pointer-events-none min-h-[50vh] select-none opacity-40 blur-[2px]">
            {children}
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-background/50 p-4 backdrop-blur-[1px]">
            <Card className="max-w-md w-full border-primary/20 bg-card/95">
              <CardContent className="py-12 text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Lock className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground">
                  {t('planGate.title')}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {isChildShop
                    ? "Esta funcionalidade não está incluída na licença da empresa. Contacte a Oficina Mãe."
                    : t('planGate.description').replace('{plan}', PLAN_LABELS[requiredPlan] || requiredPlan)}
                </p>
                {!isChildShop && (
                  <Link to="/billing">
                    <Button className="mt-2">{t('planGate.upgrade')}</Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      );
    }

    return <div ref={ref}>{children}</div>;
  }
);

PlanGate.displayName = 'PlanGate';

export default PlanGate;
