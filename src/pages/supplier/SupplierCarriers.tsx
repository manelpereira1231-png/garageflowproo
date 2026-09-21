import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { useSupplierLive } from "@/hooks/useSupplierLive";
import { toast } from "sonner";
import { Trash2, Truck } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { getCountryConfig } from "@/lib/regionConfig";

const PRESETS = ["CTT Expresso", "DPD", "GLS", "MRW", "DHL", "UPS", "Correos Express"];

interface CarrierRow {
  id: string;
  name: string;
  code: string | null;
  base_price: number;
  eta_days: number | null;
  free_above: number | null;
  active: boolean;
}

export default function SupplierCarriers() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<CarrierRow[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("0");
  const [eta, setEta] = useState("");
  const [freeAbove, setFreeAbove] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!supplierId) return;
    const { data } = await supabase.from("gsn_carriers" as any)
      .select("id,name,code,base_price,eta_days,free_above,active")
      .eq("supplier_id", supplierId)
      .order("base_price");
    setRows(((data as any) ?? []) as CarrierRow[]);
  }, [supplierId]);

  useEffect(() => { void load(); }, [load]);
  useSupplierLive(supplierId, ["gsn_carriers"], () => { void load(); });

  const add = async () => {
    if (!name.trim() || !supplierId) return toast.error("Indique o nome da transportadora");
    setSaving(true);
    const { error } = await supabase.from("gsn_carriers" as any).insert({
      supplier_id: supplierId,
      name: name.trim(),
      base_price: Number(price.replace(",", ".")) || 0,
      eta_days: eta ? Number(eta) : null,
      free_above: freeAbove ? Number(freeAbove.replace(",", ".")) : null,
      active: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Transportadora adicionada");
    setName(""); setPrice("0"); setEta(""); setFreeAbove("");
    void load();
  };

  const patch = async (id: string, values: Record<string, unknown>) => {
    const { error } = await supabase.from("gsn_carriers" as any).update(values).eq("id", id);
    if (error) return toast.error(error.message);
    void load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("gsn_carriers" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Transportadora removida");
    void load();
  };

  const symbol = getCountryConfig().currencySymbol;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Transportadoras</h1>
        <p className="text-sm text-muted-foreground">
          As oficinas escolhem uma destas opções no carrinho e os portes entram automaticamente no total da encomenda.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Adicionar transportadora</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button key={p} type="button" size="sm" variant="outline" onClick={() => setName(p)}>{p}</Button>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="c-name">Nome</Label>
              <Input id="c-name" placeholder="Ex: CTT Expresso" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-price">Portes ({symbol})</Label>
              <Input id="c-price" type="number" step="0.01" min="0" value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-eta">Prazo (dias)</Label>
              <Input id="c-eta" type="number" min="1" placeholder="Ex: 2" value={eta} onChange={(e) => setEta(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-free">Grátis acima de ({symbol})</Label>
              <Input id="c-free" type="number" step="0.01" min="0" placeholder="Opcional" value={freeAbove} onChange={(e) => setFreeAbove(e.target.value)} />
            </div>
          </div>
          <Button onClick={add} disabled={saving} className="min-h-[44px]">{saving ? "A guardar..." : "Adicionar"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Configuradas ({rows.length})</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Truck className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-sm">Sem transportadoras. Sem nenhuma configurada, as encomendas seguem sem portes.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-3 border rounded-md">
                  <div className="min-w-0">
                    <p className="font-medium text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {Number(r.base_price) > 0 ? formatMoney(Number(r.base_price)) : "Portes grátis"}
                      {r.eta_days ? ` · ${r.eta_days} dia${r.eta_days > 1 ? "s" : ""}` : ""}
                      {r.free_above != null ? ` · grátis acima de ${formatMoney(Number(r.free_above))}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{r.active ? "Ativa" : "Inativa"}</span>
                    <Switch checked={r.active} onCheckedChange={(v) => patch(r.id, { active: v })} />
                    <Button size="icon" variant="ghost" onClick={() => remove(r.id)} aria-label="Remover">
                      <Trash2 className="w-4 h-4" />
                    </Button>
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
