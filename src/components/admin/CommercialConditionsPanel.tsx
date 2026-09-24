import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, CreditCard, History, Loader2, RefreshCw, Settings2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type ConditionType = "fixed_temporary" | "fixed_permanent" | "percent_temporary" | "percent_permanent" | "free_months" | "dated";
type Timing = "immediate" | "next_renewal" | "specific_date";
type Condition = Record<string, any>;
type StatusData = {
  shop: { name: string };
  subscription: Record<string, any>;
  base_amount_minor: number;
  currency: string;
  available_plans?: { plan_slug: string; plan_name?: string; cycle: "monthly" | "yearly"; amount_minor: number; currency: string }[];
  stripe_connected: boolean;
  current: Condition | null;
  history: Condition[];
  upcoming: { amount_due_minor: number; currency: string; next_payment_attempt: string | null; period_end: string | null } | null;
};

const typeLabels: Record<string, string> = {
  fixed_temporary: "Preço personalizado temporário",
  fixed_permanent: "Preço personalizado permanente",
  percent_temporary: "Desconto percentual temporário",
  percent_permanent: "Desconto percentual permanente",
  free_months: "Meses grátis",
  dated: "Condição por datas",
};
const reasonLabels = ["Cliente fundador", "Negociação comercial", "Campanha", "Retenção", "Compensação", "Parceria", "Migração", "Outro"];

const money = (minor: number | null | undefined, currency = "EUR") => new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format((minor || 0) / 100);
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("pt-PT") : "—";

async function invoke(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("admin-commercial-condition", { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
    throw new Error(details?.error || error.message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export function CommercialConditionsPanel({ shopId }: { shopId: string }) {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [form, setForm] = useState({ type: "fixed_temporary" as ConditionType, timing: "next_renewal" as Timing, value: "", percent: "", months: "6", startsAt: "", endsAt: "", reason: "Negociação comercial", note: "", proration: "none", plan: "", cycle: "" as "" | "monthly" | "yearly" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await invoke({ action: "status", shop_id: shopId });
      setData(d);
      setForm(f => ({ ...f, plan: f.plan || String(d.subscription?.plan || ""), cycle: f.cycle || (d.subscription?.billing_cycle === "yearly" ? "yearly" : "monthly") }));
    }
    catch (error: any) { toast.error(error.message); }
    finally { setLoading(false); }
  }, [shopId]);

  useEffect(() => { void load(); }, [load]);

  const request = useMemo(() => ({
    shop_id: shopId,
    condition_type: form.type,
    application_timing: form.timing,
    value_major: form.value ? Number(form.value.replace(",", ".")) : undefined,
    percent_off: form.percent ? Number(form.percent.replace(",", ".")) : undefined,
    duration_months: form.months ? Number(form.months) : undefined,
    starts_at: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
    ends_at: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    reason: form.reason,
    internal_note: form.note || undefined,
    proration_behavior: form.proration,
    target_plan: form.plan || undefined,
    target_cycle: form.cycle || undefined,
  }), [form, shopId]);

  const showPreview = async () => {
    setBusy(true);
    try { setPreview(await invoke({ action: "preview", ...request })); setConfirming(true); }
    catch (error: any) { toast.error(error.message); }
    finally { setBusy(false); }
  };

  const apply = async () => {
    setBusy(true);
    try {
      const requestKey = `${shopId}:${Date.now()}:${crypto.randomUUID()}`;
      await invoke({ action: "apply", ...request, request_key: requestKey });
      toast.success("Condição confirmada pelo Stripe.");
      setConfirming(false); setOpen(false); await load();
    } catch (error: any) { toast.error(error.message); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    if (!window.confirm("Remover esta condição agora e regressar ao preço normal sem prorrata?")) return;
    setBusy(true);
    try { await invoke({ action: "remove", shop_id: shopId, application_timing: "immediate", proration_behavior: "none" }); toast.success("Condição removida no Stripe."); await load(); }
    catch (error: any) { toast.error(error.message); }
    finally { setBusy(false); }
  };

  const reconcile = async () => {
    setBusy(true);
    try { const result = await invoke({ action: "reconcile", shop_id: shopId }); toast[result.synchronized ? "success" : "error"](result.synchronized ? "Stripe e GarageFlow estão sincronizados." : "Foi detetada uma divergência."); await load(); }
    catch (error: any) { toast.error(error.message); }
    finally { setBusy(false); }
  };

  if (loading) return <Card><CardContent className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></CardContent></Card>;
  if (!data) return null;
  const current = data.current;
  const isPercent = form.type.startsWith("percent");
  const isPermanent = form.type.endsWith("permanent");
  const isFree = form.type === "free_months";
  const isDated = form.type === "dated";
  const isYearly = (form.cycle || data.subscription.billing_cycle) === "yearly";
  const plans = data.available_plans || [];
  const planSlugs = Array.from(new Set(plans.map(p => p.plan_slug)));
  const selectedPrice = plans.find(p => p.plan_slug === form.plan && p.cycle === form.cycle);
  const nameOf = (slug: string) => (plans.find(p => p.plan_slug === slug)?.plan_name || (slug === "free" ? "Start" : slug)).toUpperCase();
  const cycleLabel = (c: string) => c === "yearly" ? "ano" : "mês";
  const typedMinor = form.value ? Math.round(Number(form.value.replace(",", ".")) * 100) : null;
  const percentNum = form.percent ? Number(form.percent.replace(",", ".")) : null;
  const resultMinor = selectedPrice ? (isFree ? 0 : isPercent ? (percentNum != null ? Math.round(selectedPrice.amount_minor * (1 - percentNum / 100)) : null) : typedMinor) : null;

  return <div className="space-y-4">
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" />Subscrição e Condições Comerciais</CardTitle><CardDescription>Estado real da oficina e da cobrança Stripe.</CardDescription></div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reconcile} disabled={busy || !data.stripe_connected}><RefreshCw className={`h-4 w-4 mr-1 ${busy ? "animate-spin" : ""}`} />Verificar</Button>
            <Button size="sm" onClick={() => setOpen(true)}><Settings2 className="h-4 w-4 mr-1" />Alterar condições</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Plano" value={nameOf(String(data.subscription.plan))} />
        <Metric label="Preço padrão" value={`${money(data.base_amount_minor, data.currency)}/${data.subscription.billing_cycle === "yearly" ? "ano" : "mês"}`} />
        <Metric label="Preço efetivo" value={money(current?.effective_amount_minor ?? data.base_amount_minor, data.currency)} />
        <div className="rounded-md border p-3"><p className="text-xs text-muted-foreground">Stripe</p><div className="mt-1 flex items-center gap-2">{!data.stripe_connected ? <Badge variant="outline" className="text-warning">Condição preparada</Badge> : current?.status === "sync_error" ? <Badge variant="destructive">Erro de sincronização</Badge> : <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Sincronizado</Badge>}</div></div>
        <Metric label="Condição comercial" value={current ? typeLabels[current.condition_type] || current.condition_type : "Preço normal"} />
        <Metric label="Início" value={date(current?.starts_at)} />
        <Metric label="Depois" value={current?.ends_at ? `${money(current.after_amount_minor, data.currency)} em ${date(current.ends_at)}` : "Sem data final"} />
        <Metric label="Próxima cobrança" value={data.upcoming ? `${money(data.upcoming.amount_due_minor, data.upcoming.currency)} · ${date(data.upcoming.next_payment_attempt || data.upcoming.period_end)}` : "Não disponível"} />
        {current?.sync_error && <div className="sm:col-span-2 lg:col-span-4 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{current.sync_error}</div>}
        {current && <div className="sm:col-span-2 lg:col-span-4 flex justify-end"><Button variant="outline" size="sm" className="text-destructive" onClick={remove} disabled={busy}><Trash2 className="h-4 w-4 mr-1" />Remover condição especial</Button></div>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Histórico de condições comerciais</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {data.history.length === 0 ? <p className="text-sm text-muted-foreground">Sem condições comerciais registadas.</p> : data.history.map(row => <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b py-3 last:border-0"><div><p className="text-sm font-medium">{typeLabels[row.condition_type] || row.condition_type}</p><p className="text-xs text-muted-foreground">{money(row.base_amount_minor, row.currency)} → {money(row.effective_amount_minor, row.currency)} · {row.reason}</p></div><div className="text-right"><Badge variant="outline">{row.status}</Badge><p className="text-xs text-muted-foreground mt-1">{new Date(row.created_at).toLocaleString("pt-PT")}</p></div></div>)}
      </CardContent>
    </Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-xl"><DialogHeader><DialogTitle>Alterar condições comerciais</DialogTitle><DialogDescription>A alteração só será marcada como ativa após confirmação do Stripe.</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Plano"><Select value={form.plan} onValueChange={value => setForm({ ...form, plan: value })}><SelectTrigger><SelectValue placeholder="Escolher plano" /></SelectTrigger><SelectContent>{planSlugs.map(slug => <SelectItem key={slug} value={slug}>{nameOf(slug)}{slug === data.subscription.plan ? " (atual)" : ""}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Ciclo de faturação"><Select value={form.cycle} onValueChange={(value: "monthly" | "yearly") => setForm({ ...form, cycle: value, months: value === "yearly" && Number(form.months) % 12 !== 0 ? "12" : form.months })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["monthly", "yearly"] as const).filter(c => plans.some(p => p.plan_slug === form.plan && p.cycle === c)).map(c => <SelectItem key={c} value={c}>{c === "yearly" ? "Anual" : "Mensal"}</SelectItem>)}</SelectContent></Select></Field>
        <div className="sm:col-span-2 rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
          {selectedPrice ? <div className="flex flex-wrap items-center justify-between gap-2">
            <span>Preço normal do <b>{nameOf(form.plan)}</b>: <b>{money(selectedPrice.amount_minor, selectedPrice.currency)}/{cycleLabel(form.cycle)}</b></span>
            {resultMinor != null && <span>→ Fica a pagar <b className="text-primary">{money(resultMinor, selectedPrice.currency)}/{cycleLabel(form.cycle)}</b>{selectedPrice.amount_minor > 0 && resultMinor < selectedPrice.amount_minor ? ` (−${Math.round((1 - resultMinor / selectedPrice.amount_minor) * 100)}%)` : ""}</span>}
            {resultMinor != null && !isPercent && !isFree && resultMinor >= selectedPrice.amount_minor && <span className="text-destructive w-full">O novo preço tem de ser inferior ao preço normal do plano.</span>}
            {(form.plan !== data.subscription.plan || form.cycle !== (data.subscription.billing_cycle === "yearly" ? "yearly" : "monthly")) && <span className="w-full text-xs text-warning">A oficina passa do plano {nameOf(String(data.subscription.plan))} para {nameOf(form.plan)} ({form.cycle === "yearly" ? "anual" : "mensal"}) com esta condição.</span>}
          </div> : <span className="text-destructive">Este plano não tem preço Stripe configurado para o país da oficina.</span>}
        </div>
        <Field label="Tipo de condição" wide><Select value={form.type} onValueChange={(value: ConditionType) => setForm({ ...form, type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
        {!isFree && <Field label={isPercent ? "Desconto (%)" : `Novo preço (€/${cycleLabel(form.cycle)})`}><Input type="number" min="0" step="0.01" value={isPercent ? form.percent : form.value} onChange={e => setForm({ ...form, [isPercent ? "percent" : "value"]: e.target.value })} /></Field>}
        {!isPermanent && !isDated && <Field label={isYearly ? "Duração (meses, múltiplos de 12)" : "Duração (meses)"}><Input type="number" min={isYearly ? "12" : "1"} step={isYearly ? "12" : "1"} max="120" value={form.months} onChange={e => setForm({ ...form, months: e.target.value })} /></Field>}
        <Field label="Começa"><Select value={form.timing} onValueChange={(value: Timing) => setForm({ ...form, timing: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="next_renewal">Na próxima renovação</SelectItem><SelectItem value="immediate">Imediatamente</SelectItem><SelectItem value="specific_date">Data específica</SelectItem></SelectContent></Select></Field>
        {form.timing === "specific_date" && <Field label="Data de início"><Input type="datetime-local" value={form.startsAt} onChange={e => setForm({ ...form, startsAt: e.target.value })} /></Field>}
        {isDated && <Field label="Data final"><Input type="datetime-local" value={form.endsAt} onChange={e => setForm({ ...form, endsAt: e.target.value })} /></Field>}
        {form.timing === "immediate" && <Field label="Ajuste proporcional"><Select value={form.proration} onValueChange={value => setForm({ ...form, proration: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sem prorrata</SelectItem><SelectItem value="create_prorations">Criar prorrata</SelectItem></SelectContent></Select></Field>}
        <Field label="Motivo"><Select value={form.reason} onValueChange={value => setForm({ ...form, reason: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{reasonLabels.map(reason => <SelectItem key={reason} value={reason}>{reason}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Nota interna" wide><Textarea value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} rows={2} /></Field>
      </div>
      {form.timing === "immediate" && <p className="text-xs text-warning flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />Uma alteração imediata com prorrata poderá gerar um ajuste proporcional na próxima fatura.</p>}
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={showPreview} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Rever condição</Button></DialogFooter>
    </DialogContent></Dialog>

    <Dialog open={confirming} onOpenChange={setConfirming}><DialogContent><DialogHeader><DialogTitle>Confirmar condição comercial</DialogTitle><DialogDescription>Confirme o impacto antes de alterar a subscrição no Stripe.</DialogDescription></DialogHeader>{preview && <div className="grid grid-cols-2 gap-3 text-sm"><Metric label="Oficina" value={data.shop.name} /><Metric label="Plano" value={`${String(preview.target_plan_name || nameOf(preview.target_plan || data.subscription.plan)).toUpperCase()} · ${preview.target_cycle === "yearly" ? "anual" : "mensal"}${preview.plan_changed ? " (alteração)" : ""}`} /><Metric label="Preço normal" value={money(preview.base_amount_minor, data.currency)} /><Metric label="Novo preço" value={money(preview.effective_amount_minor, data.currency)} /><Metric label="Início" value={new Date(preview.starts_at_seconds * 1000).toLocaleDateString("pt-PT")} /><Metric label="Fim previsto" value={preview.ends_at_seconds ? new Date(preview.ends_at_seconds * 1000).toLocaleDateString("pt-PT") : "Sem data final"} /><Metric label="Depois" value={money(preview.base_amount_minor, data.currency)} /><Metric label="Stripe" value={data.stripe_connected ? "Será aplicado agora" : "Preparada para o checkout"} /></div>}<DialogFooter><Button variant="outline" onClick={() => setConfirming(false)}>Voltar</Button><Button onClick={apply} disabled={busy}>{busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Aplicar condição</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md border p-3 min-w-0"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold mt-1 break-words">{value}</p></div>; }
function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) { return <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>; }