import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Loader2, Percent, ShieldCheck } from "lucide-react";
import ManualPayoutsReport from "@/components/admin/ManualPayoutsReport";
import PlatformCommissionsReport from "@/components/admin/PlatformCommissionsReport";
import { toast } from "sonner";

/**
 * Configurações → Pagamentos → Stripe Connect.
 * Fonte única de verdade das comissões: platform_settings.invoice_payments.
 * Escrita restrita ao Super Admin por RLS.
 */
export default function AdminPaymentFees() {
  const [fee, setFee] = useState("3");
  const [allowWithoutConnect, setAllowWithoutConnect] = useState(true);
  const [extraPercent, setExtraPercent] = useState("0");
  const [fixedFee, setFixedFee] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "invoice_payments")
        .maybeSingle();
      if (error) toast.error("Não foi possível carregar a configuração.");
      const raw = (data?.value as Record<string, unknown> | null) ?? {};
      if (raw.platform_fee_percent != null) setFee(String(raw.platform_fee_percent));
      setAllowWithoutConnect(raw.allow_without_connect !== false);
      setExtraPercent(String(raw.no_connect_extra_percent ?? 0));
      setFixedFee(String(raw.no_connect_fixed_fee ?? 0));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const value = Number(fee);
    const extra = Number(extraPercent);
    const fixed = Number(fixedFee);
    if (!Number.isFinite(value) || value < 0 || value > 30) {
      toast.error("A comissão Stripe Connect tem de estar entre 0% e 30%.");
      return;
    }
    if (!Number.isFinite(extra) || extra < 0 || extra > 30) {
      toast.error("A taxa adicional tem de estar entre 0% e 30%.");
      return;
    }
    if (!Number.isFinite(fixed) || fixed < 0 || fixed > 1000) {
      toast.error("A taxa fixa tem de estar entre 0 e 1000.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({
        key: "invoice_payments",
        value: {
          platform_fee_percent: value,
          allow_without_connect: allowWithoutConnect,
          no_connect_extra_percent: extra,
          no_connect_fixed_fee: fixed,
        },
      }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Configuração de comissões atualizada.");
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">Comissões Stripe Connect</h1>
        <p className="text-sm text-muted-foreground">
          Configuração global e única das comissões cobradas sobre pagamentos online de faturas.
          Toda a aplicação (checkout, webhooks, relatórios e contabilidade) lê estes valores.
        </p>
      </div>

      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Percent className="w-4 h-4" /> Comissão da plataforma
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="fee">Comissão Stripe Connect (%)</Label>
                <Input id="fee" type="number" min={0} max={30} step={0.1}
                  value={fee} onChange={(e) => setFee(e.target.value)} />
                <p className="text-[11px] text-muted-foreground">
                  Retida automaticamente pelo Stripe (application_fee) em cada pagamento recebido
                  por oficinas com Connect ativo.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> Oficinas sem Stripe Connect
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="allow">Permitir pagamentos para oficinas sem Stripe Connect</Label>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Desativado: apenas oficinas com Stripe Connect totalmente configurado podem
                    receber pagamentos online — as restantes veem uma mensagem a pedir a conclusão
                    da configuração e não conseguem gerar links de pagamento.
                  </p>
                </div>
                <Switch id="allow" checked={allowWithoutConnect} onCheckedChange={setAllowWithoutConnect} />
              </div>

              <div className={allowWithoutConnect ? "grid gap-3 sm:grid-cols-2" : "grid gap-3 sm:grid-cols-2 opacity-50 pointer-events-none"}>
                <div className="space-y-1">
                  <Label htmlFor="extra">Taxa adicional sem Connect (%)</Label>
                  <Input id="extra" type="number" min={0} max={30} step={0.1}
                    value={extraPercent} onChange={(e) => setExtraPercent(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fixed">Taxa fixa adicional por pagamento</Label>
                  <Input id="fixed" type="number" min={0} max={1000} step={0.01}
                    value={fixedFee} onChange={(e) => setFixedFee(e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={save} disabled={saving} className="w-full min-h-[44px]">
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Guardar configuração
          </Button>
          <p className="text-[11px] text-muted-foreground">
            As alterações entram em vigor no pagamento seguinte, sem qualquer alteração de código.
          </p>
        </>
      )}

      <ManualPayoutsReport />
      <PlatformCommissionsReport />
    </div>
  );
}
