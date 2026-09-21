import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { toast } from "sonner";
import { CreditCard, ExternalLink, Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";

type ConnectStatus = {
  connected: boolean;
  live?: boolean;
  account_id?: string;
  charges_enabled?: boolean;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
  requirements?: string[];
  disabled_reason?: string | null;
  note?: string;
  error?: string;
};

export default function SupplierPayments() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<ConnectStatus | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!supplierId) return;
    supabase.from("gsn_payments" as any)
      .select("id,amount,currency,status,stripe_payment_intent_id,created_at,order_id")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setRows((data as any) ?? []));
  }, [supplierId]);

  const loadStatus = useCallback(async () => {
    setLoadingStatus(true);
    const { data, error } = await supabase.functions.invoke("gsn-connect-status", { body: {} });
    setStatus(error ? { connected: false, error: error.message } : (data as ConnectStatus));
    setLoadingStatus(false);
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const startOnboarding = async () => {
    setStarting(true);
    const { data, error } = await supabase.functions.invoke("gsn-connect-onboarding", { body: {} });
    setStarting(false);
    if (error || !(data as any)?.url) {
      return toast.error((data as any)?.error || error?.message || "Não foi possível abrir a configuração Stripe");
    }
    window.location.href = (data as any).url;
  };

  const total = rows
    .filter((r) => r.status === "succeeded" || r.status === "paid")
    .reduce((s, r) => s + Number(r.amount), 0);

  const ready = !!status?.connected && !!status?.charges_enabled;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recebimentos</h1>
        <p className="text-sm text-muted-foreground">Receba os pagamentos das oficinas diretamente na sua conta Stripe.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="w-4 h-4" /> Conta Stripe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingStatus ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> A verificar o estado da ligação...
            </p>
          ) : status?.error ? (
            <div className="space-y-3">
              <p className="text-sm text-destructive">{status.error}</p>
              <Button variant="outline" size="sm" onClick={() => void loadStatus()}>
                <RefreshCw className="w-4 h-4 mr-2" />Tentar novamente
              </Button>
            </div>
          ) : !status?.connected ? (
            <div className="space-y-3">
              <Badge variant="outline">Ainda não configurado</Badge>
              <p className="text-sm text-muted-foreground">
                Para receber pagamentos das encomendas precisa de ativar os recebimentos com a sua própria conta Stripe.
              </p>
              <Button onClick={() => void startOnboarding()} disabled={starting}>
                {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                Ativar recebimentos com Stripe
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={ready ? "default" : "secondary"} className="gap-1">
                  {ready ? <ShieldCheck className="w-3 h-3" /> : <TriangleAlert className="w-3 h-3" />}
                  {ready ? "Stripe ligado" : "Configuração por concluir"}
                </Badge>
                <Badge variant="outline">Pagamentos: {status.charges_enabled ? "ativos" : "inativos"}</Badge>
                <Badge variant="outline">Transferências: {status.payouts_enabled ? "ativas" : "inativas"}</Badge>
              </div>
              {status.account_id && (
                <p className="text-xs text-muted-foreground font-mono">{status.account_id}</p>
              )}
              {status.note && <p className="text-xs text-muted-foreground">{status.note}</p>}
              {!!status.requirements?.length && (
                <p className="text-xs text-amber-500">
                  Em falta no Stripe: {status.requirements.slice(0, 6).join(", ")}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {!ready && (
                  <Button size="sm" onClick={() => void startOnboarding()} disabled={starting}>
                    {starting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
                    Concluir configuração
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => void loadStatus()}>
                  <RefreshCw className="w-4 h-4 mr-2" />Atualizar estado
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase">Total recebido</p>
          <p className="text-2xl font-bold">{formatMoney(total)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Histórico ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem pagamentos.</p> : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border rounded-md">
                  <div className="min-w-0">
                    <p className="text-sm font-mono truncate">{r.stripe_payment_intent_id ?? `#${r.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(r.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatMoney(Number(r.amount), r.currency)}</p>
                    <Badge variant="outline">{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
