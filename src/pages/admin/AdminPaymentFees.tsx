import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Percent } from "lucide-react";
import { toast } from "sonner";

export default function AdminPaymentFees() {
  const [fee, setFee] = useState<string>("3");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("value")
        .eq("key", "invoice_payments")
        .maybeSingle();
      const raw = (data?.value as { platform_fee_percent?: number } | null)?.platform_fee_percent;
      if (typeof raw === "number") setFee(String(raw));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    const value = Number(fee);
    if (!Number.isFinite(value) || value < 0 || value > 30) {
      toast.error("Indique uma percentagem entre 0 e 30.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key: "invoice_payments", value: { platform_fee_percent: value } }, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Taxa da plataforma atualizada.");
  };

  return (
    <div className="p-4 sm:p-6 max-w-xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold">Taxas de Pagamento</h1>
        <p className="text-sm text-muted-foreground">
          Comissão cobrada pela plataforma sobre cada pagamento online de fatura recebido nas
          contas Stripe das oficinas.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="w-4 h-4" /> Comissão sobre faturas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <div className="space-y-1">
                <Label htmlFor="fee">Percentagem (%)</Label>
                <Input
                  id="fee"
                  type="number"
                  min={0}
                  max={30}
                  step={0.1}
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                />
              </div>
              <Button onClick={save} disabled={saving} className="w-full min-h-[44px]">
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Guardar
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Aplica-se apenas a oficinas com Stripe Connect ativo (application_fee). Alterações
                entram em vigor no próximo pagamento.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
