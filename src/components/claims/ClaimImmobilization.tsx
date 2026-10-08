import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const DAY = 86400000;
const todayISO = () => new Date().toISOString().slice(0, 10);
export const daysBetween = (a: string, b?: string | null) => Math.max(0, Math.round((new Date(b || todayISO()).getTime() - new Date(a).getTime()) / DAY));

/** Imobilização: entrada/saída, prazo prometido e viatura de substituição. */
export function ClaimImmobilization({ claim, isBR, onSaved }: { claim: any; isBR: boolean; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const loc = isBR ? "pt-BR" : "pt-PT";
  useEffect(() => {
    setF({
      vehicle_in_date: claim.vehicle_in_date || "", promised_date: claim.promised_date || "", vehicle_out_date: claim.vehicle_out_date || "",
      replacement_vehicle: claim.replacement_vehicle || "nao", replacement_start: claim.replacement_start || "", replacement_end: claim.replacement_end || "",
    });
  }, [claim.id, claim.vehicle_in_date, claim.vehicle_out_date, claim.promised_date, claim.replacement_vehicle, claim.replacement_start, claim.replacement_end]);

  const save = async () => {
    if (f.vehicle_in_date && f.vehicle_out_date && f.vehicle_out_date < f.vehicle_in_date) { toast.error("A saída não pode ser antes da entrada."); return; }
    if (f.replacement_start && f.replacement_end && f.replacement_end < f.replacement_start) { toast.error("O fim da viatura de substituição não pode ser antes do início."); return; }
    const { error } = await supabase.from("claims").update({
      vehicle_in_date: f.vehicle_in_date || null, promised_date: f.promised_date || null, vehicle_out_date: f.vehicle_out_date || null,
      replacement_vehicle: f.replacement_vehicle,
      replacement_start: f.replacement_vehicle === "nao" ? null : f.replacement_start || null,
      replacement_end: f.replacement_vehicle === "nao" ? null : f.replacement_end || null,
    } as any).eq("id", claim.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Guardado"); onSaved();
  };

  const stopped = claim.vehicle_in_date ? daysBetween(claim.vehicle_in_date, claim.vehicle_out_date) : null;
  const repl = claim.replacement_vehicle && claim.replacement_vehicle !== "nao" && claim.replacement_start ? daysBetween(claim.replacement_start, claim.replacement_end) : null;
  const late = claim.promised_date && !claim.vehicle_out_date && claim.promised_date < todayISO();
  const car = isBR ? "veículo" : "viatura";

  return (
    <Card className="rounded-[14px]">
      <CardHeader><CardTitle className="text-base">Imobilização</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border p-2">
            <p className="text-xl font-semibold">{stopped ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{stopped != null ? `dias na oficina desde ${new Date(claim.vehicle_in_date).toLocaleDateString(loc, { day: "2-digit", month: "2-digit" })}` : "indique a data de entrada"}</p>
          </div>
          <div className="rounded-md border border-border p-2">
            <p className="text-xl font-semibold">{repl ?? "—"}</p>
            <p className="text-xs text-muted-foreground">dias com {car} de substituição</p>
          </div>
        </div>
        {late && <Badge variant="destructive">Prazo prometido ultrapassado</Badge>}
        <div className="grid gap-2 grid-cols-1">
          <div><Label>Entrada</Label><Input type="date" className="min-h-[44px]" value={f.vehicle_in_date || ""} onChange={(e) => setF({ ...f, vehicle_in_date: e.target.value })} /></div>
          <div><Label>Entrega prometida</Label><Input type="date" className="min-h-[44px]" value={f.promised_date || ""} onChange={(e) => setF({ ...f, promised_date: e.target.value })} /></div>
          <p className="text-xs text-muted-foreground">A entrada e a entrega prometida aparecem automaticamente na <a href="/agenda" className="underline">Agenda</a>.</p>
          <div><Label>Saída</Label><Input type="date" className="min-h-[44px]" value={f.vehicle_out_date || ""} onChange={(e) => setF({ ...f, vehicle_out_date: e.target.value })} /></div>
          <div><Label>{isBR ? "Veículo de substituição" : "Viatura de substituição"}</Label>
            <Select value={f.replacement_vehicle || "nao"} onValueChange={(v) => setF({ ...f, replacement_vehicle: v })}>
              <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="seguradora">Sim, cedida pela seguradora</SelectItem>
                <SelectItem value="oficina">Sim, cedida pela oficina</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {f.replacement_vehicle && f.replacement_vehicle !== "nao" && (
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Início</Label><Input type="date" className="min-h-[44px]" value={f.replacement_start || ""} onChange={(e) => setF({ ...f, replacement_start: e.target.value })} /></div>
              <div><Label>Fim</Label><Input type="date" className="min-h-[44px]" value={f.replacement_end || ""} onChange={(e) => setF({ ...f, replacement_end: e.target.value })} /></div>
            </div>
          )}
        </div>
        <Button variant="outline" className="min-h-[44px] w-full" onClick={save}>Guardar</Button>
      </CardContent>
    </Card>
  );
}
