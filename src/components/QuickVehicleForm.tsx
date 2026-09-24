import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { lookupPlate, mapFuel, matchCatalogModel, type LookupResult } from "@/lib/vehicleLookup";
import { autoFormatPlate, canonicalPlate, normalizePlate } from "@/lib/plateFormat";

/**
 * Criação rápida de viatura dentro de outro fluxo (ex.: Novo sinistro).
 * Grava na mesma tabela de viaturas e reutiliza a consulta por matrícula existente.
 */
export default function QuickVehicleForm({
  shopId, clientId, onCreated, onCancel,
}: { shopId: string; clientId: string; onCreated: (v: { id: string; make: string; model: string; plate: string }) => void; onCancel: () => void }) {
  const [plate, setPlate] = useState("");
  const [f, setF] = useState({ make: "", model: "", version: "", year: "", fuel: "", vin: "" });
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lookup, setLookup] = useState<LookupResult | null>(null);

  const consult = async () => {
    const canon = canonicalPlate(plate);
    if (canon.length !== 6) { toast.error("Matrícula inválida. Confirme a matrícula introduzida."); return; }
    // Já existe na oficina?
    const { data: ex } = await supabase.from("vehicles").select("id, make, model, plate, client_id")
      .eq("shop_id", shopId).is("deleted_at", null).ilike("plate", `%${canon.slice(0, 2)}%`).limit(200);
    const found = (ex || []).find((v: any) => canonicalPlate(v.plate) === canon);
    if (found) {
      if (found.client_id === clientId) { toast.success("Viatura já existe — associada."); onCreated(found as any); return; }
      toast.error("Esta viatura já existe no GarageFlow, associada a outro cliente."); return;
    }
    setBusy(true);
    const r = await lookupPlate({ shopId, plate });
    setBusy(false);
    setLookup(r);
    if (r.status === "ok" && r.data) {
      const d = r.data;
      setF({
        make: d.make || f.make, model: matchCatalogModel(d.make, d.model) || d.model || f.model,
        version: d.version || f.version, year: d.year ? String(d.year) : f.year,
        fuel: mapFuel(d.fuel) || f.fuel, vin: d.vin || f.vin,
      });
      toast.success("Viatura encontrada — dados preenchidos");
    } else toast.message(r.message || "Pode preencher os dados manualmente.");
  };

  const save = async () => {
    if (!plate.trim() || !f.make.trim() || !f.model.trim()) { toast.error("Indique matrícula, marca e modelo."); return; }
    setSaving(true);
    const payload: any = {
      shop_id: shopId, client_id: clientId, plate: normalizePlate(plate), make: f.make, model: f.model,
      version: f.version || null, year: parseInt(f.year) || new Date().getFullYear(), fuel: f.fuel || "Gasóleo",
      vin: f.vin || null, mileage: 0,
    };
    if (lookup?.status === "ok" && lookup.data) {
      payload.tech_data = lookup.data; payload.tech_source = "matricula_pt";
      payload.tech_updated_at = lookup.fetched_at || new Date().toISOString();
    }
    const { data, error } = await supabase.from("vehicles").insert(payload).select("id, make, model, plate").single();
    setSaving(false);
    if (error) {
      toast.error((error as any).code === "23505" ? "Esta viatura já existe no GarageFlow (mesma matrícula)." : "Não foi possível criar a viatura.");
      return;
    }
    toast.success("Viatura criada");
    onCreated(data as any);
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <Label>Matrícula</Label>
      <div className="flex gap-2">
        <Input className="h-12 text-lg font-mono uppercase" placeholder="12-AA-34" value={plate}
          onChange={(e) => setPlate(autoFormatPlate(e.target.value, "PT"))} />
        <Button type="button" variant="outline" className="h-12" onClick={consult} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          <span className="ml-1 hidden sm:inline">Consultar matrícula</span>
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Marca</Label><Input value={f.make} onChange={(e) => setF({ ...f, make: e.target.value })} /></div>
        <div><Label>Modelo</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
        <div><Label>Versão</Label><Input value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} /></div>
        <div><Label>Ano</Label><Input inputMode="numeric" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button type="button" onClick={save} disabled={saving}>{saving ? "A criar…" : "Criar viatura"}</Button>
      </div>
    </div>
  );
}
