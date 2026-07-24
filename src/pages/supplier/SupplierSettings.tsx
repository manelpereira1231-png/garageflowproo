import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";

export default function SupplierSettings() {
  const { supplierId } = useIsSupplier();
  const [prefs, setPrefs] = useState({ email_new_order: true, email_new_review: true, auto_accept: false });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supplierId) return;
    supabase.from("gsn_suppliers" as any).select("metadata").eq("id", supplierId).maybeSingle()
      .then(({ data }: any) => { if (data?.metadata?.prefs) setPrefs({ ...prefs, ...data.metadata.prefs }); });
  }, [supplierId]);

  const save = async () => {
    if (!supplierId) return;
    setLoading(true);
    const { data: cur }: any = await supabase.from("gsn_suppliers" as any).select("metadata").eq("id", supplierId).maybeSingle();
    const meta = { ...(cur?.metadata ?? {}), prefs };
    const { error } = await supabase.from("gsn_suppliers" as any).update({ metadata: meta }).eq("id", supplierId);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Preferências guardadas");
  };

  const toggle = (k: keyof typeof prefs) => (v: boolean) => setPrefs(s => ({ ...s, [k]: v }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Notificações, preferências e conta.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Notificações</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between"><Label>Email em nova encomenda</Label><Switch checked={prefs.email_new_order} onCheckedChange={toggle("email_new_order")} /></div>
          <div className="flex items-center justify-between"><Label>Email em nova avaliação</Label><Switch checked={prefs.email_new_review} onCheckedChange={toggle("email_new_review")} /></div>
          <div className="flex items-center justify-between"><Label>Aceitar encomendas automaticamente</Label><Switch checked={prefs.auto_accept} onCheckedChange={toggle("auto_accept")} /></div>
          <Button onClick={save} disabled={loading}>{loading ? "A guardar..." : "Guardar"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
