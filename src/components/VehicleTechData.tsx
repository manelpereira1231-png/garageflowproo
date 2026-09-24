import { useState } from "react";
import { useVehicleLookupEnabled } from "@/hooks/useVehicleLookupEnabled";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { canonicalPlate } from "@/lib/plateFormat";
import { lookupPlate, mapFuel, matchCatalogModel, TECH_LABELS, type VehicleTechData as TD } from "@/lib/vehicleLookup";

type Diff = { field: "make" | "model" | "version" | "year" | "fuel" | "vin"; label: string; current: string; incoming: string };

/** Dados técnicos da viatura + "Atualizar dados pela matrícula". Só consulta ao clicar. */
export default function VehicleTechData({ vehicle, onUpdated }: { vehicle: any; onUpdated: () => void }) {
  const [busy, setBusy] = useState(false);
  const [diffs, setDiffs] = useState<Diff[] | null>(null);
  const [pick, setPick] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<{ data: TD; fetched_at: string; fill: Record<string, any> } | null>(null);
  const tech: TD | null = vehicle?.tech_data || null;
  const lookupEnabled = useVehicleLookupEnabled();

  const save = async (data: TD, fetchedAt: string, apply: Diff[], fill: Record<string, any>) => {
    const patch: any = { tech_data: data, tech_source: "matricula_pt", tech_updated_at: fetchedAt, ...fill };
    apply.forEach((d) => { patch[d.field] = d.field === "year" ? Number(d.incoming) : d.incoming; });
    const { error } = await supabase.from("vehicles").update(patch).eq("id", vehicle.id).eq("shop_id", vehicle.shop_id);
    if (error) { toast.error("Não foi possível guardar os dados técnicos."); return; }
    toast.success("Dados técnicos atualizados.");
    setDiffs(null); setPending(null); onUpdated();
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const res = await lookupPlate({ shopId: vehicle.shop_id, plate: canonicalPlate(vehicle.plate), vehicleId: vehicle.id, force: true });
      if (res.status !== "ok" || !res.data) { toast.error(res.message); return; }
      const d = res.data;
      const incoming: Record<Diff["field"], string | undefined> = {
        make: d.make, model: matchCatalogModel(d.make, d.model), version: d.version,
        year: d.year ? String(d.year) : undefined, fuel: mapFuel(d.fuel), vin: d.vin,
      };
      const labels: Record<Diff["field"], string> = { make: "Marca", model: "Modelo", version: "Versão", year: "Ano", fuel: "Combustível", vin: "VIN" };
      const fill: Record<string, any> = {};
      const conflicts: Diff[] = [];
      (Object.keys(incoming) as Diff["field"][]).forEach((f) => {
        const inc = incoming[f];
        if (!inc) return;
        const cur = vehicle[f] == null ? "" : String(vehicle[f]).trim();
        if (!cur) { fill[f] = f === "year" ? Number(inc) : inc; return; }
        if (cur.toLowerCase() === inc.toLowerCase()) return;
        // Dado da oficina mais específico (ex.: "320d Touring" vs "320d") é preservado.
        if (cur.toLowerCase().includes(inc.toLowerCase())) return;
        conflicts.push({ field: f, label: labels[f], current: cur, incoming: inc });
      });
      const fetchedAt = res.fetched_at || new Date().toISOString();
      if (conflicts.length === 0) { await save(d, fetchedAt, [], fill); return; }
      setPending({ data: d, fetched_at: fetchedAt, fill });
      setPick({});
      setDiffs(conflicts);
    } finally { setBusy(false); }
  };

  // Serviço desligado: mostra apenas dados já guardados (se houver), sem ações de consulta.
  if (!lookupEnabled && !tech) return null;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h4 className="font-semibold text-sm">Dados técnicos</h4>
          <p className="text-xs text-muted-foreground">
            {vehicle?.tech_updated_at
              ? `Última consulta técnica: ${new Date(vehicle.tech_updated_at).toLocaleString("pt-PT", { dateStyle: "short", timeStyle: "short" })}`
              : lookupEnabled ? "Ainda sem consulta técnica." : ""}
          </p>
        </div>
        {lookupEnabled && (
          <Button variant="outline" size="sm" className="min-h-[44px] sm:min-h-0" onClick={refresh} disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Atualizar dados pela matrícula
          </Button>
        )}
      </div>

      {diffs && pending && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
          <p className="text-sm font-medium">Há diferenças com os dados da oficina. Escolha o que substituir:</p>
          {diffs.map((d) => (
            <label key={d.field} className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox checked={!!pick[d.field]} onCheckedChange={(v) => setPick((p) => ({ ...p, [d.field]: !!v }))} className="mt-0.5" />
              <span><strong>{d.label}:</strong> GarageFlow “{d.current}” → Consulta “{d.incoming}”</span>
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <Button size="sm" onClick={() => save(pending.data, pending.fetched_at, diffs.filter((d) => pick[d.field]), pending.fill)}>Guardar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setDiffs(null); setPending(null); }}>Cancelar</Button>
          </div>
        </div>
      )}

      {tech ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2 text-sm">
          {TECH_LABELS.map(([k, label, fmt]) => (
            <div key={k}>
              <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
              <span>{tech[k] !== undefined && tech[k] !== null && tech[k] !== "" ? fmt(tech[k]) : <span className="text-muted-foreground">Não disponível</span>}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
