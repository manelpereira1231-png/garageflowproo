import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Banknote, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ConnectOnboardingGateProps {
  /** "seller" for marketplace sellers, "shop" for workshops */
  role: "seller" | "shop";
  /** Required when role === "shop" */
  shopId?: string;
  /** Path Stripe will redirect to after onboarding */
  returnPath?: string;
  /** Called whenever status changes; parent can use to enable/disable actions */
  onStatusChange?: (ready: boolean) => void;
}

interface ConnectStatus {
  onboarded: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
}

/**
 * Gate UI that forces the user to complete Stripe Connect Express onboarding
 * before they can receive payouts. Shows current status and an action button
 * to start/resume onboarding.
 */
export default function ConnectOnboardingGate({
  role,
  shopId,
  returnPath,
  onStatusChange,
}: ConnectOnboardingGateProps) {
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  const refresh = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("connect-status", {
        body: { role, shop_id: shopId },
      });
      if (error) throw error;
      const s = data as ConnectStatus;
      setStatus(s);
      onStatusChange?.(!!s?.charges_enabled && !!s?.payouts_enabled);
    } catch (err: any) {
      console.error("[ConnectGate] refresh error", err);
      onStatusChange?.(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // Auto-refresh when user returns from Stripe
    const params = new URLSearchParams(window.location.search);
    if (params.get("connect") === "done" || params.get("connect") === "refresh") {
      // small delay so Stripe has time to flip flags
      setTimeout(refresh, 1500);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, shopId]);

  const startOnboarding = async () => {
    try {
      setStarting(true);
      const { data, error } = await supabase.functions.invoke("connect-onboarding", {
        body: {
          role,
          shop_id: shopId,
          return_path: returnPath || window.location.pathname,
        },
      });
      if (error) {
        // Extract the real error message returned by the edge function body
        let realMsg = error.message;
        try {
          const ctxResp: Response | undefined = (error as any).context?.response;
          if (ctxResp) {
            const body = await ctxResp.clone().json().catch(() => null);
            if (body?.error) realMsg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(realMsg);
      }
      if (!data?.url) throw new Error("Sem URL de onboarding");
      window.location.href = data.url;
    } catch (err: any) {
      console.error("[ConnectGate] onboarding error", err);
      toast.error(err.message || "Erro ao iniciar onboarding", { duration: 8000 });
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> A verificar conta de pagamentos…
        </CardContent>
      </Card>
    );
  }

  const ready = !!status?.charges_enabled && !!status?.payouts_enabled;

  if (ready) {
    return (
      <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-900/10">
        <CardContent className="py-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div className="flex-1">
            <p className="text-sm font-medium">Conta de pagamentos ativa</p>
            <p className="text-xs text-muted-foreground">Pode receber transferências automaticamente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-900/10">
      <CardContent className="py-5 space-y-3">
        <div className="flex items-start gap-3">
          {status?.onboarded ? (
            <AlertCircle className="h-6 w-6 text-amber-600 shrink-0" />
          ) : (
            <Banknote className="h-6 w-6 text-amber-600 shrink-0" />
          )}
          <div className="flex-1">
            <h3 className="font-semibold">
              {status?.onboarded
                ? "Conta de pagamentos pendente de aprovação"
                : "Ative a sua conta de pagamentos"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {status?.onboarded
                ? "A Stripe ainda está a verificar os seus dados. Pode atualizar informações em falta."
                : "Para receber o valor da venda automaticamente, precisamos verificar a sua identidade bancária via Stripe (powered by GarageFlow). Demora 2–5 minutos."}
            </p>
          </div>
        </div>
        <Button
          onClick={startOnboarding}
          disabled={starting}
          className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
        >
          {starting ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Banknote className="h-4 w-4 mr-2" />
          )}
          {status?.onboarded ? "Completar verificação" : "Ativar conta de pagamentos"}
        </Button>
      </CardContent>
    </Card>
  );
}
