import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { daysBetween } from "./ClaimImmobilization";

export const DECISIONS: Record<string, string> = {
  deliver_insurer: "Aceita a indemnização e entrega o salvado à seguradora",
  repair_own_cost: "Fica com a viatura e repara por conta própria",
  take_unrepaired: "Leva a viatura sem reparar",
};
const PREFIX = "Encargo: ";

/** Perda total declarada pelo perito: decisão do cliente e encargos a cobrar. */
export function ClaimTotalLoss({ claim, shopId, isBR, onSaved }: { claim: any; shopId: string; isBR: boolean; onSaved: () => void }) {
  const navigate = useNavigate();
  const [shopRate, setShopRate] = useState<number | null>(null);
  const [f, setF] = useState<any>({});
  const [payer, setPayer] = useState<"insurer" | "client">("insurer");
  const [saveDefault, setSaveDefault] = useState(false);
  const [billedNo, setBilledNo] = useState<string | null>(null);
  const cur = isBR ? "R$" : "€";
  const car = isBR ? "veículo" : "viatura";

  useEffect(() => {
    supabase.from("shops").select("storage_daily_rate").eq("id", shopId).maybeSingle().then(({ data }) => setShopRate((data as any)?.storage_daily_rate ?? null));
    (supabase as any).from("claim_billing_lines").select("invoice_id, invoices(number, status)").eq("claim_id", claim.id).like("description", `${PREFIX}%`).not("invoice_id", "is", null)
      .then(({ data }: any) => setBilledNo((data || []).find((l: any) => l.invoices?.status !== "cancelled")?.invoices?.number ?? null));
  }, [shopId, claim.id]);
  useEffect(() => {
    setF({
      client_decision: claim.client_decision && claim.client_decision !== "pending" ? claim.client_decision : "",
      disassembly_fee: claim.disassembly_fee ?? "", storage_daily_rate: claim.storage_daily_rate ?? "",
      salvage_value: claim.salvage_value ?? "", indemnity_amount: claim.indemnity_amount ?? "",
    });
  }, [claim.id, claim.client_decision, claim.disassembly_fee, claim.storage_daily_rate, claim.salvage_value, claim.indemnity_amount]);

  const rate = f.storage_daily_rate !== "" && f.storage_daily_rate != null ? Number(f.storage_daily_rate) : (shopRate ?? 0);
  const days = claim.vehicle_in_date ? daysBetween(claim.vehicle_in_date, claim.vehicle_out_date) : 0;
  const storage = Math.round(days * rate * 100) / 100;
  const disassembly = f.disassembly_fee !== "" ? Number(f.disassembly_fee) : 0;
  const n = (v: any) => (v === "" || v == null ? null : Number(v));

  const save = async (patch: Record<string, any> = {}) => {
    const v = { ...f, ...patch };
    const { error } = await supabase.from("claims").update({
      client_decision: v.client_decision || "pending",
      client_decision_date: v.client_decision ? (claim.client_decision_date || new Date().toISOString().slice(0, 10)) : null,
      disassembly_fee: n(v.disassembly_fee), storage_daily_rate: n(v.storage_daily_rate),
      salvage_value: n(v.salvage_value), indemnity_amount: n(v.indemnity_amount),
    } as any).eq("id", claim.id);
    if (error) { toast.error(error.message); return false; }
    if (saveDefault && n(v.storage_daily_rate) != null) await supabase.from("shops").update({ storage_daily_rate: n(v.storage_daily_rate) } as any).eq("id", shopId);
    if (patch.client_decision) await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: shopId, kind: "note", description: `Decisão do cliente: ${DECISIONS[patch.client_decision]}` });
    onSaved(); return true;
  };

  const emit = async () => {
    if (!(await save())) return;
    const rows = [
      ...(disassembly > 0 ? [{ description: `${PREFIX}Desmontagem para peritagem`, quantity: 1, unit_price: disassembly }] : []),
      ...(storage > 0 ? [{ description: `${PREFIX}Parqueamento (${days} dias × ${formatMoney(rate)})`, quantity: days, unit_price: rate }] : []),
    ];
    if (!rows.length) { toast.error("Indique pelo menos um encargo."); return; }
    const { data: old } = await (supabase as any).from("claim_billing_lines").select("id").eq("claim_id", claim.id).like("description", `${PREFIX}%`).is("invoice_id", null);
    for (const o of old || []) await (supabase as any).from("claim_billing_lines").delete().eq("id", o.id);
    const { data, error } = await (supabase as any).from("claim_billing_lines").insert(rows.map((r) => ({ ...r, claim_id: claim.id, shop_id: shopId, payer }))).select("id");
    if (error) { toast.error(error.message); return; }
    navigate(`/invoices/new?from_claim=${claim.id}&payer=${payer}&lines=${(data || []).map((d: any) => d.id).join(",")}`);
  };

  const decisions = isBR ? Object.fromEntries(Object.entries(DECISIONS).map(([k, v]) => [k, v.replace("viatura", "veículo")])) : DECISIONS;

  return (
    <Card className="rounded-[14px] border-red-500/40">
      <CardHeader><CardTitle className="text-base">Perda total declarada pelo perito</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <p className="text-sm font-medium">O que decidiu o cliente?</p>
          {Object.entries(decisions).map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setF({ ...f, client_decision: k }); save({ client_decision: k }); }}
              className={`w-full text-left rounded-[14px] border px-3 min-h-[44px] py-2 text-sm ${f.client_decision === k ? "border-primary bg-primary/10 font-medium" : "border-border hover:border-primary/50"}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="grid gap-3 grid-cols-2">
          <div><Label>Indemnização proposta ({cur})</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" value={f.indemnity_amount ?? ""} onChange={(e) => setF({ ...f, indemnity_amount: e.target.value })} onBlur={() => save()} /></div>
          <div><Label>Valor do salvado ({cur})</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" value={f.salvage_value ?? ""} onChange={(e) => setF({ ...f, salvage_value: e.target.value })} onBlur={() => save()} /></div>
        </div>
        <div className="space-y-2 border-t border-border pt-3">
          <p className="text-sm font-medium">Encargos a cobrar</p>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            <div><Label>Desmontagem para peritagem ({cur})</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" value={f.disassembly_fee ?? ""} onChange={(e) => setF({ ...f, disassembly_fee: e.target.value })} /></div>
            <div><Label>Parqueamento por dia ({cur})</Label><Input type="number" step="0.01" inputMode="decimal" className="min-h-[44px]" placeholder={shopRate != null ? String(shopRate) : ""} value={f.storage_daily_rate ?? ""} onChange={(e) => setF({ ...f, storage_daily_rate: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm min-h-[44px]"><Checkbox checked={saveDefault} onCheckedChange={(v) => setSaveDefault(!!v)} />Usar este preço por dia como predefinição da oficina</label>
          <div className="rounded-md border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Desmontagem</span><span>{formatMoney(disassembly)}</span></div>
            <div className="flex justify-between"><span>Parqueamento: {days} dias × {formatMoney(rate)}</span><span>{formatMoney(storage)}</span></div>
            <div className="flex justify-between font-semibold border-t border-border pt-1"><span>Total</span><span>{formatMoney(disassembly + storage)}</span></div>
            {!claim.vehicle_in_date && <p className="text-xs text-muted-foreground">Indique a data de entrada da {car} em "Imobilização" para contar os dias.</p>}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <span className="text-sm">Faturar a:</span>
            <div className="inline-flex rounded-[14px] border border-border p-1">
              {(["insurer", "client"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPayer(p)} className={`px-3 min-h-[40px] rounded-[10px] text-sm ${payer === p ? "bg-primary text-primary-foreground" : ""}`}>{p === "insurer" ? "Seguradora" : "Cliente"}</button>
              ))}
            </div>
            {billedNo ? <Badge variant="secondary">Emitida {billedNo}</Badge>
              : <Button className="min-h-[44px] sm:ml-auto" disabled={payer === "insurer" && !claim.insurer_id} onClick={emit}>{isBR ? "Emitir nota fiscal de encargos" : "Emitir fatura de encargos"}</Button>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
