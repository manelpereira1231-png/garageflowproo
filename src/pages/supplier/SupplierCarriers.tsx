import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

export default function SupplierCarriers() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");

  const load = async () => {
    if (!supplierId) return;
    const { data } = await supabase.from("gsn_carriers" as any)
      .select("id,name,code,base_price,active")
      .eq("supplier_id", supplierId)
      .order("name");
    setRows((data as any) ?? []);
  };

  useEffect(() => { load(); }, [supplierId]);

  const add = async () => {
    if (!name || !supplierId) return;
    const { error } = await supabase.from("gsn_carriers" as any).insert({ supplier_id: supplierId, name, base_price: Number(price) || 0, active: true });
    if (error) return toast.error(error.message);
    setName(""); setPrice("0"); load();
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("gsn_carriers" as any).update({ active }).eq("id", id);
    load();
  };

  const remove = async (id: string) => {
    await supabase.from("gsn_carriers" as any).delete().eq("id", id);
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transportadoras</h1>
        <p className="text-sm text-muted-foreground">CTT, DPD, GLS, MRW, DHL, UPS, Correos Express e outros.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Adicionar transportadora</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          <Input placeholder="Nome (ex: CTT Expresso)" value={name} onChange={e => setName(e.target.value)} className="max-w-xs" />
          <Input type="number" step="0.01" placeholder="Preço base €" value={price} onChange={e => setPrice(e.target.value)} className="max-w-[140px]" />
          <Button onClick={add}>Adicionar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Ativas ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Sem transportadoras configuradas.</p> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-2 p-3 border rounded-md">
                  <div>
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">€ {Number(r.base_price).toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={r.active} onCheckedChange={(v) => toggle(r.id, v)} />
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)}><Trash2 className="w-4 h-4" /></Button>
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
