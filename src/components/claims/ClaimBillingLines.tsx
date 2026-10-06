import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";

type Line = { id: string; description: string; quantity: number; unit_price: number; payer: "insurer" | "client"; invoice_id: string | null; invoices?: { number: string | null; status: string | null } | null };

/** Linhas do sinistro com destinatário (seguradora/cliente). Faturadas pelo formulário de fatura existente. */
export function ClaimBillingLines({ claimId, shopId, isBR, hasInsurer }: { claimId: string; shopId: string; isBR: boolean; hasInsurer: boolean }) {
  const navigate = useNavigate();
  const [lines, setLines] = useState<Line[]>([]);
  const [d, setD] = useState({ description: "", quantity: "1", unit_price: "", payer: "insurer" as "insurer" | "client" });
  const DOC = isBR ? "nota fiscal" : "fatura";

  const load = async () => {
    const { data } = await (supabase as any).from("claim_billing_lines")
      .select("id, description, quantity, unit_price, payer, invoice_id, invoices(number, status)").eq("claim_id", claimId).order("created_at");
    setLines(data || []);
  };
  useEffect(() => { void load(); }, [claimId]);

  const add = async () => {
    const price = Number(d.unit_price), qty = Number(d.quantity);
    if (!d.description.trim() || !(qty > 0) || isNaN(price)) { toast.error("Indique descrição, quantidade e preço."); return; }
    const { error } = await (supabase as any).from("claim_billing_lines").insert({ claim_id: claimId, shop_id: shopId, description: d.description.trim(), quantity: qty, unit_price: price, payer: d.payer });
    if (error) { toast.error(error.message); return; }
    setD({ ...d, description: "", quantity: "1", unit_price: "" });
    load();
  };
  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("claim_billing_lines").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };
  const changePayer = async (id: string, payer: string) => {
    const { error } = await (supabase as any).from("claim_billing_lines").update({ payer }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  // Linha ligada a documento anulado volta a poder ser faturada.
  const isBilled = (l: Line) => !!l.invoice_id && l.invoices?.status !== "cancelled";
  const open = (p: "insurer" | "client") => lines.filter((l) => l.payer === p && !isBilled(l));
  const sum = (ls: Line[]) => ls.reduce((t, l) => t + Number(l.quantity) * Number(l.unit_price), 0);
  const bill = async (p: "insurer" | "client") => {
    const ls = open(p);
    const stale = ls.filter((l) => l.invoice_id);
    if (stale.length) await (supabase as any).from("claim_billing_lines").update({ invoice_id: null }).in("id", stale.map((l) => l.id));
    navigate(`/invoices/new?from_claim=${claimId}&payer=${p}&lines=${ls.map((l) => l.id).join(",")}`);
  };
  const payerLabel = (p: string) => (p === "insurer" ? "Seguradora" : "Cliente");

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{isBR ? "Itens a emitir em nota fiscal" : "Linhas a faturar"}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {lines.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há linhas. Adicione o que a seguradora paga e o que fica a cargo do cliente.</p>}
        <div className="space-y-2">
          {lines.map((l) => (
            <div key={l.id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-border p-2 text-sm">
              <span className="flex-1">{l.description} <span className="text-muted-foreground">· {Number(l.quantity)} × {formatMoney(Number(l.unit_price))}</span></span>
              <span className="font-medium">{formatMoney(Number(l.quantity) * Number(l.unit_price))}</span>
              {isBilled(l) ? (
                <Badge variant="secondary">{payerLabel(l.payer)} · {isBR ? "Emitida" : "Faturada"} {l.invoices?.number || ""}</Badge>
              ) : (
                <div className="flex gap-2">
                  <Select value={l.payer} onValueChange={(v) => changePayer(l.id, v)}>
                    <SelectTrigger className="min-h-[44px] w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="insurer">Seguradora</SelectItem><SelectItem value="client">Cliente</SelectItem></SelectContent>
                  </Select>
                  <Button size="icon" variant="ghost" className="min-h-[44px]" aria-label="Remover linha" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-[1fr_80px_120px_140px_auto] gap-2">
          <Input className="col-span-2 sm:col-span-1 min-h-[44px]" placeholder="Descrição (ex.: Mão de obra chapa, franquia)" value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} />
          <Input className="min-h-[44px]" type="number" inputMode="decimal" placeholder="Qtd." value={d.quantity} onChange={(e) => setD({ ...d, quantity: e.target.value })} />
          <Input className="min-h-[44px]" type="number" step="0.01" inputMode="decimal" placeholder="Preço s/ imposto" value={d.unit_price} onChange={(e) => setD({ ...d, unit_price: e.target.value })} />
          <Select value={d.payer} onValueChange={(v: any) => setD({ ...d, payer: v })}>
            <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="insurer">Seguradora</SelectItem><SelectItem value="client">Cliente</SelectItem></SelectContent>
          </Select>
          <Button variant="outline" className="min-h-[44px]" onClick={add}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button className="min-h-[44px]" disabled={!open("insurer").length || !hasInsurer} onClick={() => bill("insurer")}>
            {isBR ? "Emitir nota fiscal à seguradora" : "Faturar seguradora"} ({formatMoney(sum(open("insurer")))})
          </Button>
          <Button variant="outline" className="min-h-[44px]" disabled={!open("client").length} onClick={() => bill("client")}>
            {isBR ? "Emitir nota fiscal ao cliente" : "Faturar cliente"} ({formatMoney(sum(open("client")))})
          </Button>
        </div>
        {!hasInsurer && <p className="text-xs text-muted-foreground">Associe uma seguradora ao sinistro para lhe emitir {DOC}.</p>}
        <p className="text-xs text-muted-foreground">Cada linha só pode ser incluída numa {DOC}. O destinatário pode ser confirmado ou alterado no formulário antes de emitir.</p>
      </CardContent>
    </Card>
  );
}
