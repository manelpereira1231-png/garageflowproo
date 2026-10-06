import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { authorizedTotal, type Sup } from "@/lib/claimPhases";

const P_INS = "Reparação do sinistro";
const P_FRANQ = "Franquia do sinistro";
const P_EXTRA = "Extra não coberto: ";

type QLine = { quoteId: string; idx: number; name: string; total: number; covered: boolean };

/**
 * Faturação dividida: seguradora (autorizado − franquia) e cliente (franquia + extras não cobertos).
 * Gera as linhas em claim_billing_lines e abre o formulário de fatura existente.
 */
export function ClaimSplitBilling({ claim, shopId, sups, isBR, onChanged }: { claim: any; shopId: string; sups: Sup[]; isBR: boolean; onChanged: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [qlines, setQlines] = useState<QLine[]>([]);
  const [quoteRows, setQuoteRows] = useState<Record<string, any[]>>({});
  const [billed, setBilled] = useState<{ insurer: string | null; client: string | null }>({ insurer: null, client: null });
  const DOC = isBR ? "nota fiscal" : "fatura";

  const quoteIds = Array.from(new Set([claim.quote_id, ...sups.map((s: any) => s.quote_id)].filter(Boolean))) as string[];

  const load = async () => {
    if (quoteIds.length) {
      const { data } = await supabase.from("quotes").select("id, number, lines").in("id", quoteIds).eq("shop_id", shopId);
      const rows: Record<string, any[]> = {}; const out: QLine[] = [];
      for (const q of data || []) {
        const ls = Array.isArray(q.lines) ? (q.lines as any[]) : [];
        rows[q.id] = ls;
        ls.forEach((l, idx) => out.push({ quoteId: q.id, idx, name: l.name || l.description || "Linha", total: Number(l.qty ?? l.quantity ?? 1) * Number(l.unitPrice ?? l.unit_price ?? 0), covered: l.covered_by_insurance !== false }));
      }
      setQuoteRows(rows); setQlines(out);
    } else { setQlines([]); }
    const { data: bl } = await (supabase as any).from("claim_billing_lines").select("description, payer, invoice_id, invoices(number, status)").eq("claim_id", claim.id).eq("shop_id", shopId).not("invoice_id", "is", null);
    const live = (bl || []).filter((l: any) => l.invoices?.status !== "cancelled" && (l.description.startsWith(P_INS) || l.description.startsWith(P_FRANQ) || l.description.startsWith(P_EXTRA)));
    setBilled({
      insurer: live.find((l: any) => l.payer === "insurer")?.invoices?.number ?? null,
      client: live.find((l: any) => l.payer === "client")?.invoices?.number ?? null,
    });
  };
  useEffect(() => { void load(); }, [claim.id, claim.quote_id, JSON.stringify(sups)]);

  const toggleCovered = async (l: QLine, notCovered: boolean) => {
    const rows = [...(quoteRows[l.quoteId] || [])];
    rows[l.idx] = { ...rows[l.idx], covered_by_insurance: !notCovered };
    const { error } = await supabase.from("quotes").update({ lines: rows } as any).eq("id", l.quoteId);
    if (error) { toast.error(error.message); return; }
    load();
  };

  const authorized = sups.length ? authorizedTotal(sups) : (claim.amount_approved != null && claim.amount_approved !== "" ? Number(claim.amount_approved) : 0);
  const franchise = claim.deductible != null && claim.deductible !== "" ? Number(claim.deductible) : 0;
  const extras = qlines.filter((l) => !l.covered);
  const extrasTotal = extras.reduce((t, l) => t + l.total, 0);
  const insurerAmt = Math.max(0, Math.round((authorized - franchise) * 100) / 100);
  const clientAmt = Math.round((franchise + extrasTotal) * 100) / 100;

  const emit = async (payer: "insurer" | "client") => {
    if (busy || billed[payer]) return;
    setBusy(true);
    try {
    // limpa linhas automáticas ainda não faturadas deste destinatário e recria-as com os valores atuais
    const { data: old } = await (supabase as any).from("claim_billing_lines").select("id, description, invoice_id, invoices(status)").eq("claim_id", claim.id).eq("shop_id", shopId).eq("payer", payer);
    if ((old || []).some((l: any) => l.invoice_id && l.invoices?.status !== "cancelled" && (l.description.startsWith(P_INS) || l.description.startsWith(P_FRANQ) || l.description.startsWith(P_EXTRA)))) { toast.error("Estas linhas já estão numa fatura."); return; }
    const auto = (old || []).filter((l: any) => (l.description.startsWith(P_INS) || l.description.startsWith(P_FRANQ) || l.description.startsWith(P_EXTRA)) && (!l.invoice_id || l.invoices?.status === "cancelled"));
    for (const l of auto) {
      if (l.invoice_id) await (supabase as any).from("claim_billing_lines").update({ invoice_id: null }).eq("id", l.id);
      await (supabase as any).from("claim_billing_lines").delete().eq("id", l.id);
    }
    const ref = claim.ref || "";
    const rows = payer === "insurer"
      ? [{ description: `${P_INS} ${ref}`.trim(), quantity: 1, unit_price: insurerAmt }]
      : [
          ...(franchise > 0 ? [{ description: `${P_FRANQ} ${ref}`.trim(), quantity: 1, unit_price: franchise }] : []),
          ...extras.map((e) => ({ description: `${P_EXTRA}${e.name}`, quantity: 1, unit_price: Math.round(e.total * 100) / 100 })),
        ];
    if (!rows.length || rows.every((r) => !(r.unit_price > 0))) { toast.error("Não há valor a faturar."); return; }
    const { data, error } = await (supabase as any).from("claim_billing_lines")
      .insert(rows.map((r) => ({ ...r, claim_id: claim.id, shop_id: shopId, payer }))).select("id");
    if (error) { toast.error(error.message); return; }
    onChanged();
    navigate(`/invoices/new?from_claim=${claim.id}&payer=${payer}&lines=${(data || []).map((d: any) => d.id).join(",")}`);
    } finally { setBusy(false); }
  };

  const box = (title: string, amount: number, calc: string[], billedNo: string | null, onEmit: () => void, disabled: boolean, cta: string) => (
    <div className="claim-billing-option border border-border p-4 space-y-2 flex flex-col">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="text-2xl font-semibold">{formatMoney(amount)}</p>
      <div className="text-xs text-muted-foreground space-y-0.5 flex-1">{calc.map((c) => <p key={c}>{c}</p>)}</div>
      {billedNo ? <Badge variant="secondary" className="self-start">{isBR ? "Emitida" : "Emitida"} {billedNo}</Badge>
        : <Button className="min-h-[44px]" disabled={disabled || busy} onClick={onEmit}>{cta}</Button>}
    </div>
  );

  return (
    <Card className="rounded-[14px]">
      <CardHeader><CardTitle className="text-base">{isBR ? "Notas fiscais" : "Faturação"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 2xl:grid-cols-2">
          {box(`${isBR ? "Nota fiscal" : "Fatura"} à seguradora`, insurerAmt,
            [`Autorizado ${formatMoney(authorized)}`, `− Franquia ${formatMoney(franchise)}`],
            billed.insurer, () => emit("insurer"), !claim.insurer_id || !(insurerAmt > 0),
            `Emitir ${DOC} à seguradora`)}
          {box(`${isBR ? "Nota fiscal" : "Fatura"} ao cliente`, clientAmt,
            [`Franquia ${formatMoney(franchise)}`, `+ Extras não cobertos ${formatMoney(extrasTotal)}`],
            billed.client, () => emit("client"), !(clientAmt > 0),
            `Emitir ${DOC} ao cliente`)}
        </div>
        {!claim.insurer_id && <p className="text-xs text-muted-foreground">Indique a seguradora em "O essencial" para lhe emitir a {DOC}.</p>}
        {qlines.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-medium">Linhas do orçamento — marque o que a seguradora não cobre</p>
            {qlines.map((l) => (
              <label key={`${l.quoteId}-${l.idx}`} className="flex flex-wrap items-center gap-3 rounded-md border border-border px-3 min-h-[44px] text-sm cursor-pointer">
                <Checkbox checked={!l.covered} disabled={!!billed.insurer || !!billed.client} onCheckedChange={(v) => toggleCovered(l, !!v)} />
                <span className="flex-1 min-w-[100px]">{l.name}</span>
                <span className="text-muted-foreground">{formatMoney(l.total)}</span>
                {!l.covered && <Badge variant="outline">Não coberto</Badge>}
              </label>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{isBR ? "Valores sem impostos; os impostos são acrescentados na nota fiscal." : "Valores sem IVA; o IVA é acrescentado na fatura."} O destinatário pode ser confirmado antes de emitir.</p>
        {!isBR && <p className="text-xs text-muted-foreground">Pagamento da seguradora: até 8 dias úteis após assumir a responsabilidade e receber os documentos (DL 291/2007, art. 43.º).</p>}
      </CardContent>
    </Card>
  );
}
