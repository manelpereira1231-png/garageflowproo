import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const DAY = 86400000;
const days = (a: string, b?: string | null) => Math.max(0, Math.round(((b ? new Date(b) : new Date(new Date().toISOString().slice(0, 10))).getTime() - new Date(a).getTime()) / DAY));

/** Viatura parada: entrada/saída, prazo prometido e registo de cliente informado. */
export function ClaimImmobilization({ claim, isBR, onSaved }: { claim: any; isBR: boolean; onSaved: () => void }) {
  const [f, setF] = useState({ vehicle_in_date: "", vehicle_out_date: "", promised_date: "" });
  const [note, setNote] = useState("");
  const loc = isBR ? "pt-BR" : "pt-PT";
  useEffect(() => {
    setF({ vehicle_in_date: claim.vehicle_in_date || "", vehicle_out_date: claim.vehicle_out_date || "", promised_date: claim.promised_date || "" });
  }, [claim.id, claim.vehicle_in_date, claim.vehicle_out_date, claim.promised_date]);

  const save = async () => {
    if (f.vehicle_in_date && f.vehicle_out_date && f.vehicle_out_date < f.vehicle_in_date) { toast.error("A saída não pode ser antes da entrada."); return; }
    const { error } = await supabase.from("claims").update({
      vehicle_in_date: f.vehicle_in_date || null, vehicle_out_date: f.vehicle_out_date || null, promised_date: f.promised_date || null,
    } as any).eq("id", claim.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Datas guardadas"); onSaved();
  };
  const informed = async () => {
    const { error } = await supabase.from("claims").update({ client_informed_at: new Date().toISOString(), client_informed_note: note.trim() || null } as any).eq("id", claim.id);
    if (error) { toast.error(error.message); return; }
    await (supabase as any).from("claim_events").insert({ claim_id: claim.id, shop_id: claim.shop_id, kind: "note", description: `Cliente informado${note.trim() ? `: ${note.trim()}` : ""}` });
    setNote(""); toast.success("Registado"); onSaved();
  };

  const stopped = claim.vehicle_in_date ? days(claim.vehicle_in_date, claim.vehicle_out_date) : null;
  const today = new Date().toISOString().slice(0, 10);
  const late = claim.promised_date && !claim.vehicle_out_date && claim.promised_date < today;
  const sinceInformed = claim.client_informed_at ? days(claim.client_informed_at.slice(0, 10)) : null;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{isBR ? "Veículo na oficina e prazos" : "Viatura na oficina e prazos"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {stopped != null && <Badge variant="secondary">{stopped} {stopped === 1 ? "dia" : "dias"} {claim.vehicle_out_date ? "na oficina" : "parada até hoje"}</Badge>}
          {late && <Badge variant="destructive">Prazo prometido ultrapassado</Badge>}
          {sinceInformed != null && sinceInformed >= 3 && !claim.vehicle_out_date && <Badge variant="outline">Cliente sem atualização há {sinceInformed} dias</Badge>}
        </div>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          <div><Label>Entrada</Label><Input type="date" className="min-h-[44px]" value={f.vehicle_in_date} onChange={(e) => setF({ ...f, vehicle_in_date: e.target.value })} /></div>
          <div><Label>Entrega prometida</Label><Input type="date" className="min-h-[44px]" value={f.promised_date} onChange={(e) => setF({ ...f, promised_date: e.target.value })} /></div>
          <div><Label>Saída</Label><Input type="date" className="min-h-[44px]" value={f.vehicle_out_date} onChange={(e) => setF({ ...f, vehicle_out_date: e.target.value })} /></div>
        </div>
        <Button variant="outline" className="min-h-[44px]" onClick={save}>Guardar datas</Button>
        <div className="border-t border-border pt-3 space-y-2">
          <p className="text-sm">
            {claim.client_informed_at
              ? <>Cliente informado em {new Date(claim.client_informed_at).toLocaleString(loc, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}{claim.client_informed_note ? ` — ${claim.client_informed_note}` : ""}</>
              : <span className="text-muted-foreground">Ainda não foi registado nenhum contacto com o cliente.</span>}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input className="min-h-[44px]" placeholder="O que foi dito (opcional)" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button className="min-h-[44px]" onClick={informed}>Cliente informado agora</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
