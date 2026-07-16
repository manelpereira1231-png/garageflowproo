import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Lock, CreditCard, Crown, LifeBuoy, LogOut, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "@/hooks/use-toast";

/**
 * Hard paywall landing page.
 *
 * There is NO free tier. When the 30-day evaluation ends (or subscription
 * lapses / is canceled / past_due), the user is redirected here by
 * <Layout>. From here they can only: choose a plan, pay, update card,
 * contact support, or sign out. All ERP surfaces (dashboard, clients,
 * vehicles, invoicing, market, APIs) remain gated at the RLS + hook
 * layer — this page is just the honest exit door.
 */
export default function TrialExpired() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { subscription } = useSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast({
        title: t("common.error") || "Erro",
        description: e?.message || "Não foi possível abrir o portal.",
        variant: "destructive",
      });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  const hasStripeCustomer = !!subscription?.stripe_customer_id;

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center px-4 py-10">
      <Card className="max-w-xl w-full border-primary/20">
        <CardContent className="py-10 px-6 sm:px-10 space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-primary" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
              O seu período de avaliação de 30 dias terminou
            </h1>
            <p className="text-muted-foreground">
              Para continuar a utilizar o GarageFlow é necessário ativar uma assinatura.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <Button
              size="lg"
              className="gradient-primary text-primary-foreground"
              onClick={() => navigate("/billing")}
            >
              <Crown className="w-4 h-4 mr-2" />
              Escolher Plano
            </Button>

            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate("/billing")}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Efetuar Pagamento
            </Button>

            {hasStripeCustomer && (
              <Button
                size="lg"
                variant="outline"
                onClick={handlePortal}
                disabled={portalLoading}
                className="sm:col-span-2"
              >
                {portalLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <ExternalLink className="w-4 h-4 mr-2" />
                )}
                Atualizar Método de Pagamento
              </Button>
            )}

            <Button
              size="lg"
              variant="outline"
              onClick={() => navigate("/support")}
            >
              <LifeBuoy className="w-4 h-4 mr-2" />
              Contactar Suporte
            </Button>

            <Button
              size="lg"
              variant="ghost"
              onClick={handleLogout}
              className="text-muted-foreground"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Terminar Sessão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
