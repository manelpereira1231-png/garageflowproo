import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Loader2, ExternalLink, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { usePlatformInvoiceFee } from "@/hooks/usePlatformInvoiceFee";

type ConnectState = "none" | "pending" | "active";

interface Props {
  shopId: string | null;
}

/**
 * Configurações → Pagamentos.
 * Três estados explícitos: sem Stripe ligado / onboarding pendente / ligado e ativo.
 */
export function ShopPaymentsCard({ shopId }: Props) {
  const { feePercent } = usePlatformInvoiceFee();
  const [state, setState] = useState<ConnectState>("none");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("shops")
      .select("stripe_connect_account_id, stripe_connect_onboarded, stripe_connect_charges_enabled")
      .eq("id", shopId)
      .maybeSingle();
    if (!data?.stripe_connect_account_id) setState("none");
    else if (data.stripe_connect_charges_enabled) setState("active");
    else setState("pending");
    setLoading(false);
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const refreshStatus = async () => {
    if (!shopId) return;
    setWorking(true);
    try {
      const { data, error } = await supabase.functions.invoke("connect-status", {
        body: { role: "shop", shop_id: shopId },
      });
      if (error) throw error;
      if (data?.charges_enabled) toast.success("Conta Stripe ativa. Já recebe os pagamentos diretamente.");
      else toast.info("A Stripe ainda não concluiu a verificação da conta.");
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível verificar o estado.");
    } finally {
      setWorking(false);
    }
  };

  const startOnboarding = async () => {
    if (!shopId) return;
    setWorking(true);
    const win = window.open("", "_blank");
    try {
      const { data, error } = await supabase.functions.invoke("connect-onboarding", {
        body: { role: "shop", shop_id: shopId, return_path: "/settings" },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Não foi possível iniciar a ligação à Stripe.");
      if (win) win.location.href = data.url;
      else window.location.href = data.url;
      await load();
    } catch (e: any) {
      win?.close();
      toast.error(e?.message || "Erro ao ligar à Stripe.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CreditCard className="w-4 h-4" />
          Pagamentos
          {state === "active" && <Badge className="bg-green-100 text-green-800 border-green-300">Ligado e ativo</Badge>}
          {state === "pending" && <Badge variant="outline" className="text-amber-700 border-amber-300">Verificação pendente</Badge>}
          {state === "none" && <Badge variant="outline">Sem Stripe ligado</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> A carregar…
          </div>
        ) : state === "none" ? (
          <>
            <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Enquanto não ligar a sua conta Stripe, os pagamentos online das suas faturas são
                recebidos pela plataforma GarageFlow em seu nome e transferidos manualmente.
                Ligue a sua conta para receber diretamente, no seu IBAN, em 2–7 dias úteis.
              </p>
            </div>
            <Button onClick={startOnboarding} disabled={working || !shopId} className="w-full min-h-[44px]">
              {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Ligar conta Stripe
            </Button>
          </>
        ) : state === "pending" ? (
          <>
            <p className="text-sm text-muted-foreground">
              A conta Stripe foi criada mas a verificação ainda não está concluída. Até lá, os
              pagamentos continuam a ser recebidos pela plataforma GarageFlow em seu nome.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={startOnboarding} disabled={working} className="flex-1 min-h-[44px]">
                {working ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                Continuar verificação
              </Button>
              <Button variant="outline" onClick={refreshStatus} disabled={working} className="min-h-[44px]">
                <RefreshCw className="w-4 h-4 mr-2" /> Verificar estado
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex gap-2 rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Os pagamentos das suas faturas entram diretamente na sua conta Stripe e são
                transferidos para o seu IBAN segundo o calendário de payouts da Stripe.
              </p>
            </div>
            <Button variant="outline" onClick={refreshStatus} disabled={working} className="w-full min-h-[44px]">
              <RefreshCw className="w-4 h-4 mr-2" /> Verificar estado
            </Button>
          </>
        )}

        <p className="text-[11px] text-muted-foreground">
          Comissão da plataforma sobre pagamentos online: <strong>{feePercent}%</strong> por
          transação (além das taxas cobradas pela Stripe).
        </p>
      </CardContent>
    </Card>
  );
}
