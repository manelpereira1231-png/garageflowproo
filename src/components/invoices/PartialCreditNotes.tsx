import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { FileMinus, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { formatLocalDate } from "@/lib/marketPrice";

interface Props {
  invoice: any;
  items: any[];
  currency: string;
  canCreate: boolean;
  billingProvider?: string | null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const STATUS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  issued: { label: "Emitida", variant: "default" },
  internal: { label: "Registo interno (sem valor fiscal)", variant: "secondary" },
  pending: { label: "A emitir", variant: "outline" },
  error: { label: "Erro na emissão", variant: "destructive" },
};

export default function PartialCreditNotes({ invoice, items, currency, canCreate, billingProvider }: Props) {
  const [notes, setNotes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [obs, setObs] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("credit_notes").select("*").eq("invoice_id", invoice.id).order("created_at", { ascending: false });
    setNotes(data || []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [invoice.id]);

  const credited = useMemo(() => {
    const m: Record<string, number> = {};
    for (const n of notes) if (n.status === "issued" || n.status === "internal")
      for (const l of n.lines || []) m[l.item_id] = (m[l.item_id] || 0) + Number(l.quantity || 0);
    return m;
  }, [notes]);

  const avail = (it: any) => r2(Number(it.quantity) - (credited[it.id] || 0));

  const calc = useMemo(() => {
    let sub = 0, vat = 0;
    for (const it of items) {
      const q = sel[it.id];
      if (!q || q <= 0) continue;
      const s = r2(q * Number(it.unit_price));
      sub += s; vat += r2(s * Number(it.vat_rate || 0) / 100);
    }
    return { sub: r2(sub), vat: r2(vat), total: r2(sub + vat) };
  }, [sel, items]);

  const unsupported = !!invoice.provider_invoice_id && billingProvider && billingProvider !== "invoicexpress";
  const eligible = !["draft", "cancelled"].includes(invoice.status) && invoice.legal_status !== "cancelled";

  const submit = async () => {
    const lines = Object.entries(sel).filter(([, q]) => q > 0).map(([item_id, quantity]) => ({ item_id, quantity }));
    if (!lines.length) return toast.error("Escolha pelo menos uma linha");
    if (!reason.trim()) return toast.error("Indique o motivo");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("partial-credit-note", {
        body: { invoice_id: invoice.id, reason: reason.trim(), notes: obs.trim() || null, lines },
      });
      let msg = data?.error;
      if (error) {
        msg = error.message;
        try {
          const ctx = (error as any).context;
          const resp: Response | undefined = ctx instanceof Response ? ctx : ctx?.response;
          if (resp) { const b = await resp.clone().json().catch(() => null); if (b?.error) msg = b.error; }
        } catch { /* */ }
      }
      if (msg) throw new Error(msg);
      const cn = data.credit_note;
      toast.success(cn.status === "issued" ? `Nota de crédito emitida: ${cn.number || cn.provider_id}` : "Nota de crédito registada (registo interno, sem valor fiscal)");
      setOpen(false); setSel({}); setReason(""); setObs("");
    } catch (e: any) {
      toast.error(e.message || "Falha ao criar nota de crédito", { duration: 8000 });
    } finally {
      setBusy(false);
      load();
    }
  };

  if (!eligible && notes.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">Notas de crédito parciais</CardTitle>
        {canCreate && eligible && (
          <Button size="sm" variant="outline" className="min-h-[44px] sm:min-h-0" onClick={() => setOpen(true)} disabled={!!unsupported}>
            <FileMinus className="w-4 h-4 mr-1" />Nota de crédito parcial
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {unsupported && (
          <p className="text-xs text-muted-foreground">
            A nota de crédito parcial ainda não está disponível para {billingProvider === "moloni" ? "Moloni" : "eNotas"}. Use a anulação total ou emita a parcial no próprio programa.
          </p>
        )}
        {!invoice.provider_invoice_id && eligible && (
          <p className="text-xs text-muted-foreground">Esta fatura não foi emitida no programa certificado: a nota fica como registo interno, sem valor fiscal.</p>
        )}
        {notes.length === 0 && <p className="text-sm text-muted-foreground">Ainda não há notas de crédito parciais.</p>}
        {notes.map((n) => (
          <div key={n.id} className="rounded-lg border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{n.number ? `NC ${n.number}` : "Nota de crédito"} · {formatLocalDate(n.created_at)}</div>
              <div className="flex items-center gap-2">
                <Badge variant={STATUS[n.status]?.variant || "outline"}>{STATUS[n.status]?.label || n.status}</Badge>
                <span className="font-semibold">−{formatMoney(Number(n.total), currency)}</span>
              </div>
            </div>
            <ul className="mt-2 text-xs text-muted-foreground space-y-0.5">
              {(n.lines || []).map((l: any, i: number) => (
                <li key={i}>{l.quantity} × {l.description} — {formatMoney(Number(l.total), currency)}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">Motivo: {n.reason}{n.notes ? ` · ${n.notes}` : ""}</p>
            {n.error_message && <p className="mt-1 text-xs text-destructive">{n.error_message}</p>}
            {n.pdf_url && (
              <a href={n.pdf_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center text-xs text-primary underline">
                PDF da nota <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            )}
          </div>
        ))}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nota de crédito parcial — {invoice.number}</DialogTitle>
            <DialogDescription>Escolha as linhas e quantidades a creditar. A fatura original não é alterada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {items.map((it) => {
              const a = avail(it);
              const checked = (sel[it.id] || 0) > 0;
              return (
                <div key={it.id} className="rounded-lg border border-border p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <Checkbox
                      className="mt-1"
                      checked={checked}
                      disabled={a <= 0}
                      onCheckedChange={(v) => setSel((s) => ({ ...s, [it.id]: v ? a : 0 }))}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium break-words">{it.description}</div>
                      <div className="text-xs text-muted-foreground">
                        {Number(it.quantity)} × {formatMoney(Number(it.unit_price), currency)} · IVA {Number(it.vat_rate)}%
                        {a < Number(it.quantity) && ` · disponível: ${a}`}
                      </div>
                    </div>
                  </label>
                  {checked && (
                    <div className="mt-2 flex items-center gap-2 pl-7">
                      <Label className="text-xs">Quantidade</Label>
                      <Input
                        type="number" inputMode="decimal" min={0} max={a} step="any"
                        className="w-24 h-10"
                        value={sel[it.id]}
                        onChange={(e) => {
                          const v = Math.min(a, Math.max(0, Number(e.target.value)));
                          setSel((s) => ({ ...s, [it.id]: v }));
                        }}
                      />
                      <span className="text-xs text-muted-foreground">de {a}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(calc.sub, currency)}</span></div>
            <div className="flex justify-between"><span>IVA</span><span>{formatMoney(calc.vat, currency)}</span></div>
            <div className="flex justify-between font-semibold"><span>Total a creditar</span><span>{formatMoney(calc.total, currency)}</span></div>
          </div>
          <div className="space-y-2">
            <Label>Motivo *</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Peça devolvida" />
            <Label>Observações</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={submit} disabled={busy || calc.total <= 0 || !reason.trim()}>
              {busy && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}Criar nota de crédito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
