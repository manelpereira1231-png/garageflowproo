import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";

const DECISIONS: Record<string, string> = {
  pending: "Aguarda decisão do cliente",
  keep_salvage: "Cliente fica com o salvado",
  deliver_insurer: "Cliente entrega a viatura à seguradora",
  repair_own_cost: "Cliente repara por conta própria",
};
const PREFIX = "Encargo: ";

/** Perda total: valores da seguradora, decisão do cliente e encargos (vão para as linhas a faturar). */
export function ClaimTotalLoss({ claim, shopId, isBR, onSaved }: { claim: any; shopId: string; isBR: boolean; onSaved: () => void }) {
  const [f, setF] = useState<any>({});
  const [charges, setCharges] = useState<any[]>([]);
  const [c, setC] = useState({ description: "", amount: "", payer: "client" });
  const cur = isBR ? "R$" : "€";

  useEffect(() => {
    setF({
      total_loss: !!claim.total_loss, total_loss_date: claim.total_loss_date || "",
      vehicle_market_value: claim.vehicle_market_value ?? "", salvage_value: claim.salvage_value ?? "",
      indemnity_amount: claim.indemnity_amount ?? "", client_decision: claim.client_decision || "pending",
      client_decision_date: claim.client_decision_date || "", total_loss_notes: claim.total_loss_notes || "",
    });
  }, [claim.id, claim.total_loss, claim.client_decision, claim.indemnity_amount]);

  const loadCharges = async () => {
    const { data } = await (supabase as any).from("claim_billing_lines").select("id, description, unit_price, quantity, payer, invoice_id")
      .eq("claim_id", claim.id).like("description", `${PREFIX}%`).order("created_at");
    setCharges(data || []);
  };
  useEffect(() => { void loadCharges(); }, [claim.id]);

  const n = (v: any) => (v === "" || v == null ? null : Number(v));
  const save = async (patch?: any) => {
    const v = { ...f, ...patch };
    const { error } = await supabase.from("claims").update({
      total_loss: v.total_loss, total_loss_date: v.total_loss_date || null,
      vehicle_market_value: n(v.vehicle_market_value), salvage_value: n(v.salvage_value), indemnity_amount: n(v.indemnity_amount),
      client_decision: v.total_loss ? v.client_decision : null, client_decision_date: v.client_decision_date || null,
      total_loss_notes: v.total_loss_notes || null,
    } as any).eq("id", claim.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Perda total guardada"); onSaved();
  };

  const addCharge = async () => {
    const a = Number(c.amount);
    if (!c.description.trim() || !(a > 0)) { toast.error("Indique o encargo e o valor."); return; }
    const { error } = await (supabase as any).from("claim_billing_lines").insert({ claim_id: claim.id, shop_id: shopId, description: PREFIX + c.description.trim(), quantity: 1, unit_price: a, payer: c.payer });
    if (error) { toast.error(error.message); return; }
    setC({ ...c, description: "", amount: "" }); loadCharges();
  };

  const net = n(f.indemnity_amount);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="text-base">Perda total</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="tl" className="text-sm">É perda total</Label>
          <Switch id="tl" checked={!!f.total_loss} onCheckedChange={(v) => { setF({ ...f, total_loss: v }); save({ total_loss: v, total_loss_date: v && !f.total_loss_date ? new Date().toISOString().slice(0, 10) : f.total_loss_date }); }} />
        </div>
      </CardHeader>
      {f.total_loss && (
        <CardContent className="space-y-4">
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div><Label>Data da perda total</Label><Input type="date" className="min-h-[44px]" value={f.total_loss_date} onChange={(e) => setF({ ...f, total_loss_date: e.target.value })} /></div>
            <div><Label>Valor venal / de mercado ({cur})</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" value={f.vehicle_market_value} onChange={(e) => setF({ ...f, vehicle_market_value: e.target.value })} /></div>
            <div><Label>Valor do salvado ({cur})</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" value={f.salvage_value} onChange={(e) => setF({ ...f, salvage_value: e.target.value })} /></div>
            <div><Label>Indemnização proposta ({cur})</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" value={f.indemnity_amount} onChange={(e) => setF({ ...f, indemnity_amount: e.target.value })} /></div>
            <div><Label>Decisão do cliente</Label>
              <Select value={f.client_decision} onValueChange={(v) => setF({ ...f, client_decision: v, client_decision_date: v !== "pending" && !f.client_decision_date ? new Date().toISOString().slice(0, 10) : f.client_decision_date })}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(DECISIONS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data da decisão</Label><Input type="date" className="min-h-[44px]" value={f.client_decision_date} onChange={(e) => setF({ ...f, client_decision_date: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Notas</Label><Textarea value={f.total_loss_notes} onChange={(e) => setF({ ...f, total_loss_notes: e.target.value })} /></div>
          </div>
          {net != null && <p className="text-sm text-muted-foreground">Valores indicados pela seguradora e registados pela oficina. O GarageFlow não calcula a indemnização.</p>}
          <Button className="min-h-[44px]" onClick={() => save()}>Guardar perda total</Button>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-sm font-medium">Encargos (parqueamento, reboque, desmontagem, peritagem…)</p>
            {charges.map((l) => (
              <div key={l.id} className="flex justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
                <span>{l.description.slice(PREFIX.length)} · {l.payer === "insurer" ? "Seguradora" : "Cliente"}</span>
                <span>{formatMoney(Number(l.unit_price) * Number(l.quantity))}{l.invoice_id ? (isBR ? " · emitida" : " · faturado") : ""}</span>
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_140px_auto] gap-2">
              <Input className="min-h-[44px]" placeholder="Encargo (ex.: Parqueamento 10 dias)" value={c.description} onChange={(e) => setC({ ...c, description: e.target.value })} />
              <Input className="min-h-[44px]" type="number" step="0.01" inputMode="decimal" placeholder="Valor" value={c.amount} onChange={(e) => setC({ ...c, amount: e.target.value })} />
              <Select value={c.payer} onValueChange={(v) => setC({ ...c, payer: v })}>
                <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="client">Cliente</SelectItem><SelectItem value="insurer">Seguradora</SelectItem></SelectContent>
              </Select>
              <Button variant="outline" className="min-h-[44px]" onClick={addCharge}>Adicionar</Button>
            </div>
            <p className="text-xs text-muted-foreground">{isBR ? "Os encargos entram nos itens a emitir em nota fiscal (separador Valores)." : "Os encargos entram nas linhas a faturar (separador Valores)."}</p>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
