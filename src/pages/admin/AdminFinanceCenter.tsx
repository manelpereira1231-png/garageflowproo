/**
 * Centro Financeiro (Admin) — visão consolidada: receita, despesas, rentabilidade,
 * custo de operação, break-even, cash flow, liquidez, CAC/LTV, projeções e alertas.
 *
 * Não substitui nenhuma página existente: reutiliza as mesmas fontes de dados
 * (subscrições Stripe reais + despesas da plataforma) através de `platformFinance`.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart,
  Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, Calculator, CircleDollarSign,
  Download, Euro, Pencil, Plus, RefreshCw, Search, Target, Trash2, TrendingUp, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlatformFinance } from "@/hooks/usePlatformFinance";
import { ExpenseDialog } from "@/components/admin/finance/ExpenseDialog";
import { EmptyHint, KpiCard, SectionTitle, SourceBadge } from "@/components/admin/finance/FinanceBits";
import {
  categoryLabel, CHANNEL_LABEL, eur, pct, projectScenario, resolvePeriod,
  SCENARIO_SIZES, type ExpenseRow, type PeriodPreset, type ProjectionAssumptions,
} from "@/lib/platformFinance";

const PERIODS: { value: PeriodPreset; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "week", label: "Esta semana" },
  { value: "month", label: "Este mês" },
  { value: "last_month", label: "Mês anterior" },
  { value: "quarter", label: "Trimestre" },
  { value: "year", label: "Este ano" },
  { value: "last_year", label: "Ano anterior" },
  { value: "custom", label: "Período personalizado" },
];

const CHART_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ef4444", "#06b6d4", "#eab308"];

function toCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) { toast.info("Nada para exportar neste período."); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(";"),
    ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(";")),
  ].join("\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminFinanceCenter() {
  const [preset, setPreset] = useState<PeriodPreset>("month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => resolvePeriod(preset, custom), [preset, custom]);

  const { loading, error, expenses, settings, stripe, stripeLoading, metrics, reload, reloadStripe, setSettingsLocal } =
    usePlatformFinance(range);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [deleting, setDeleting] = useState<ExpenseRow | null>(null);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "amount">("date");
  const [assumptions, setAssumptions] = useState<ProjectionAssumptions | null>(null);
  const [distPct, setDistPct] = useState(25);
  const [reserveDraft, setReserveDraft] = useState<string>("");
  const [bankDraft, setBankDraft] = useState<string>("");

  const a: ProjectionAssumptions = assumptions ?? metrics.assumptions;

  const filteredExpenses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return metrics.periodExpenses
      .filter(e => catFilter === "all" || e.category === catFilter)
      .filter(e => !q || e.description.toLowerCase().includes(q) || (e.vendor || "").toLowerCase().includes(q))
      .sort((x, y) => sortBy === "amount"
        ? Number(y.amount_total) - Number(x.amount_total)
        : y.expense_date.localeCompare(x.expense_date));
  }, [metrics.periodExpenses, search, catFilter, sortBy]);

  const removeExpense = async () => {
    if (!deleting) return;
    const { error: delError } = await supabase.from("platform_expenses").delete().eq("id", deleting.id);
    if (delError) { toast.error("Não foi possível eliminar a despesa."); return; }
    toast.success("Despesa eliminada.");
    setDeleting(null);
    reload();
  };

  const saveSettings = async (patch: Record<string, unknown>) => {
    const { error: upError } = await supabase
      .from("platform_finance_settings")
      .update(patch as never)
      .eq("singleton", true);
    if (upError) { toast.error("Não foi possível guardar as definições."); return; }
    toast.success("Definições guardadas.");
    setSettingsLocal(prev => ({ ...prev, ...(patch as never) }));
    reload();
  };

  // -------------------------------------------------------------- Alertas
  const alerts = useMemo(() => {
    const out: { level: "warn" | "danger" | "info"; text: string }[] = [];
    const t = settings.alert_thresholds;
    const m = metrics.monthly;
    if (m.length >= 2) {
      const cur = m[m.length - 1].mrr, prev = m[m.length - 2].mrr;
      if (prev > 0 && ((prev - cur) / prev) * 100 >= (t.mrrDropPct ?? 10)) {
        out.push({ level: "danger", text: `Queda de MRR: ${eur(prev)} → ${eur(cur)}.` });
      }
    }
    if (metrics.churnMonthly >= (t.churnPct ?? 5)) {
      out.push({ level: "warn", text: `Churn mensal em ${pct(metrics.churnMonthly)} (limite ${pct(t.churnPct ?? 5, 0)}).` });
    }
    if (metrics.runway !== null && metrics.runway < (t.runwayMonths ?? 6)) {
      out.push({ level: "danger", text: `Runway estimado de ${metrics.runway.toFixed(1)} meses.` });
    }
    if (metrics.profitability.operatingMargin !== null && metrics.profitability.operatingMargin < 0) {
      out.push({ level: "warn", text: `Resultado operacional negativo: ${eur(metrics.profitability.operatingResult)}/mês.` });
    }
    if (stripe?.ok && (stripe.failedCount ?? 0) > 0) {
      out.push({ level: "warn", text: `${stripe.failedCount} pagamento(s) falhado(s) nos últimos 12 meses (${eur(stripe.failedAmount)}).` });
    }
    if (stripe?.ok && (stripe.disputesCount ?? 0) > 0) {
      out.push({ level: "danger", text: `${stripe.disputesCount} chargeback(s) registado(s) (${eur(stripe.disputesAmount)}).` });
    }
    const tech = metrics.monthlyCost.byCategory.find(c => c.key === "technology");
    if (tech && metrics.mrr > 0 && tech.monthly / metrics.mrr > 0.4) {
      out.push({ level: "warn", text: `Custos tecnológicos representam ${pct((tech.monthly / metrics.mrr) * 100)} do MRR.` });
    }
    if (metrics.breakEven.available && metrics.breakEven.shopsNeeded !== null) {
      const gap = metrics.breakEven.shopsNeeded - metrics.payingCustomers;
      if (gap > 0 && gap <= 5) out.push({ level: "info", text: `Faltam ${gap} oficina(s) pagante(s) para atingir o break-even.` });
      if (gap <= 0) out.push({ level: "info", text: "Break-even atingido com as oficinas pagantes atuais." });
    }
    if (metrics.cac.available && metrics.ltv && metrics.ltvCacRatio !== null && metrics.ltvCacRatio < 3) {
      out.push({ level: "warn", text: `Rácio LTV/CAC em ${metrics.ltvCacRatio.toFixed(1)}x (referência saudável: 3x).` });
    }
    return out;
  }, [metrics, settings, stripe]);

  const integrations = [
    {
      name: "Stripe",
      status: stripeLoading ? "ATUALIZAÇÃO EM CURSO" : stripe?.ok ? "CONECTADO" : stripe?.error === "not_configured" ? "NÃO CONFIGURADO" : "ERRO",
      detail: stripe?.ok ? `Última sincronização: ${new Date(stripe.syncedAt!).toLocaleString("pt-PT")}` : stripe?.error || "sem dados",
    },
    { name: "Base de dados (subscrições)", status: loading ? "ATUALIZAÇÃO EM CURSO" : error ? "ERRO" : "ATUALIZADO", detail: `${metrics.payingCustomers} subscrições pagas` },
    { name: "Despesas", status: expenses.length ? "ATUALIZADO" : "NÃO CONFIGURADO", detail: `${expenses.length} registos` },
    { name: "Contas bancárias", status: settings.known_bank_balance !== null ? "MANUAL" : "NÃO CONFIGURADO", detail: settings.known_bank_balance !== null ? `Atualizado manualmente` : "Saldo por introduzir" },
  ];

  const scenarios = SCENARIO_SIZES.map(n => projectScenario(n, a));

  return (
    <div className="p-3 sm:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Cabeçalho + filtros temporais */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <CircleDollarSign className="h-6 w-6 text-primary" /> Centro Financeiro
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Receita, custos, lucro, liquidez e projeções da GarageFlow — {range.label} ({range.from} a {range.to})
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={preset} onValueChange={v => setPreset(v as PeriodPreset)}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{PERIODS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          {preset === "custom" && (
            <>
              <Input type="date" className="h-9 w-[145px]" value={custom.from} onChange={e => setCustom(c => ({ ...c, from: e.target.value }))} />
              <Input type="date" className="h-9 w-[145px]" value={custom.to} onChange={e => setCustom(c => ({ ...c, to: e.target.value }))} />
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => { reload(); reloadStripe(); }} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading || stripeLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => { setEditing(null); setExpenseOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar despesa
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="p-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {/* Estado das integrações */}
      <div className="flex flex-wrap gap-2">
        {integrations.map(i => (
          <Badge key={i.name} variant="outline" className="text-[11px] py-1" title={i.detail}>
            <span className={`mr-1.5 h-2 w-2 rounded-full inline-block ${
              i.status === "CONECTADO" || i.status === "ATUALIZADO" ? "bg-emerald-500"
              : i.status === "ATUALIZAÇÃO EM CURSO" ? "bg-amber-500"
              : i.status === "ERRO" ? "bg-destructive" : "bg-muted-foreground"}`} />
            {i.name}: {i.status}
          </Badge>
        ))}
      </div>

      <Tabs defaultValue="resumo">
        <TabsList className="w-full flex-wrap h-auto justify-start">
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="receita">Receita</TabsTrigger>
          <TabsTrigger value="despesas">Despesas</TabsTrigger>
          <TabsTrigger value="rentabilidade">Rentabilidade</TabsTrigger>
          <TabsTrigger value="cashflow">Cash flow</TabsTrigger>
          <TabsTrigger value="crescimento">CAC / LTV</TabsTrigger>
          <TabsTrigger value="projecoes">Projeções</TabsTrigger>
          <TabsTrigger value="distribuicao">Distribuição</TabsTrigger>
          <TabsTrigger value="alertas">Alertas {alerts.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{alerts.length}</Badge>}</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------------ RESUMO */}
        <TabsContent value="resumo" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="MRR" value={eur(metrics.mrr)} source="database" icon={<TrendingUp className="h-4 w-4" />}
              hint={`${metrics.payingCustomers} oficinas pagantes`}
              formula="Soma das subscrições Stripe ativas (plano × (1 − desconto)). Só contam subscrições com pagamento Stripe confirmado."
              drill={<div className="space-y-1">{metrics.byPlan.map(p => (
                <div key={p.plan} className="flex justify-between text-[11px]"><span className="capitalize">{p.plan} ({p.count})</span><span>{eur(p.mrr)}</span></div>
              ))}</div>} />
            <KpiCard label="Custo mensal de operação" value={eur(metrics.monthlyCost.total)} source={metrics.monthlyCost.hasData ? "database" : "unavailable"}
              icon={<Banknote className="h-4 w-4" />} hint={`Fixo ${eur(metrics.monthlyCost.fixed)} · Variável ${eur(metrics.monthlyCost.variable)}`}
              formula="Despesas recorrentes normalizadas a mês + média mensal das despesas pontuais dos últimos 3 meses."
              drill={<div className="space-y-1">{metrics.monthlyCost.byCategory.map(c => (
                <div key={c.key} className="flex justify-between text-[11px]"><span>{c.label}</span><span>{eur(c.monthly)}</span></div>
              ))}</div>} />
            <KpiCard label="Resultado operacional" value={eur(metrics.profitability.operatingResult)} source="estimate"
              tone={metrics.profitability.operatingResult >= 0 ? "positive" : "negative"}
              hint={`Margem ${pct(metrics.profitability.operatingMargin)}`}
              icon={metrics.profitability.operatingResult >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
              formula="MRR − custo mensal total. Estimativa: depende das despesas registadas." />
            <KpiCard label="Break-even" value={metrics.breakEven.shopsNeeded !== null ? `${metrics.breakEven.shopsNeeded} oficinas` : "—"}
              source={metrics.breakEven.available ? "estimate" : "unavailable"} icon={<Target className="h-4 w-4" />}
              hint={metrics.breakEven.available ? `Receita necessária ${eur(metrics.breakEven.revenueNeeded)}/mês` : "Faltam despesas ou ARPU"}
              formula="Custo mensal ÷ contribuição por oficina (ARPU − custo variável por oficina)." />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="ARR" value={eur(metrics.arr)} source="database" formula="MRR × 12." />
            <KpiCard label="ARPU" value={eur(metrics.arpu, 2)} source={metrics.arpu !== null ? "database" : "unavailable"} formula="MRR ÷ oficinas pagantes." />
            <KpiCard label="Dinheiro conhecido" value={metrics.knownCash !== null ? eur(metrics.knownCash) : "—"}
              source={metrics.knownCash !== null ? (stripe?.ok ? "api" : "manual") : "unavailable"} icon={<Wallet className="h-4 w-4" />}
              hint="SALDO PARCIAL / FONTES NÃO INTEGRADAS"
              formula="Saldo Stripe disponível + saldo bancário introduzido manualmente. Não inclui contas não integradas." />
            <KpiCard label="Runway" value={metrics.runway !== null ? `${metrics.runway.toFixed(1)} meses` : "—"}
              source={metrics.runway !== null ? "estimate" : "unavailable"}
              hint={metrics.runway === null ? (metrics.burnRate <= 0 ? "Sem burn rate (operação positiva)" : "Dados insuficientes") : `Burn ${eur(metrics.burnRate)}/mês`}
              formula="Dinheiro disponível ÷ burn rate mensal (custo mensal − MRR)." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Evolução MRR (12 meses)</CardTitle></CardHeader>
              <CardContent className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={metrics.monthly}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="label" fontSize={11} /><YAxis fontSize={11} />
                    <RTooltip formatter={(v: number) => eur(v)} />
                    <Area type="monotone" dataKey="mrr" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} name="MRR" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Custo mensal por categoria</CardTitle></CardHeader>
              <CardContent className="h-[260px]">
                {metrics.monthlyCost.byCategory.length === 0 ? <EmptyHint>Ainda não há despesas registadas.</EmptyHint> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={metrics.monthlyCost.byCategory} dataKey="monthly" nameKey="label" outerRadius={90} label={(e: any) => e.label}>
                        {metrics.monthlyCost.byCategory.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <RTooltip formatter={(v: number) => eur(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------------ RECEITA */}
        <TabsContent value="receita" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="MRR" value={eur(metrics.mrr)} source="database" formula="Subscrições Stripe ativas." />
            <KpiCard label="ARR" value={eur(metrics.arr)} source="database" formula="MRR × 12." />
            <KpiCard label="Receita faturada (Stripe, 12m)" value={stripe?.ok ? eur(stripe.chargesTotal) : "—"} source={stripe?.ok ? "api" : "unavailable"}
              hint={stripe?.ok ? `${stripe.chargesCount} pagamentos` : "Stripe indisponível"} formula="Soma dos pagamentos com sucesso no Stripe nos últimos 12 meses." />
            <KpiCard label="Receita recebida (saldo + pagos)" value={stripe?.ok ? eur((stripe.chargesTotal ?? 0) - (stripe.refundsTotal ?? 0) - (stripe.fees ?? 0)) : "—"}
              source={stripe?.ok ? "api" : "unavailable"} hint="Líquido de reembolsos e taxas" formula="Pagamentos − reembolsos − taxas Stripe." />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Subscrições ativas" value={String(metrics.payingCustomers)} source="database" formula="Subscrições pagas ativas." />
            <KpiCard label="Novas no período" value={String(metrics.newSubsInPeriod)} source="database" formula="Subscrições pagas criadas dentro do período." />
            <KpiCard label="Cancelamentos no período" value={String(metrics.cancelledInPeriod)} source="database" formula="Subscrições Stripe canceladas no período." />
            <KpiCard label="Receita média por oficina" value={eur(metrics.arpu, 2)} source={metrics.arpu !== null ? "database" : "unavailable"} formula="MRR ÷ oficinas pagantes." />
          </div>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Receita por plano</CardTitle>
              <Button variant="outline" size="sm" onClick={() => toCsv(metrics.byPlan.map(p => ({ plano: p.plan, subscricoes: p.count, mrr: p.mrr.toFixed(2), arr: (p.mrr * 12).toFixed(2) })), "receita-por-plano")}>
                <Download className="h-4 w-4 mr-1" /> CSV
              </Button>
            </CardHeader>
            <CardContent>
              {metrics.byPlan.length === 0 ? <EmptyHint>Sem subscrições pagas.</EmptyHint> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Plano</TableHead><TableHead>Subscrições</TableHead><TableHead>MRR</TableHead><TableHead>ARR</TableHead><TableHead>% do MRR</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {metrics.byPlan.map(p => (
                      <TableRow key={p.plan}>
                        <TableCell className="capitalize font-medium">{p.plan}</TableCell>
                        <TableCell>{p.count}</TableCell>
                        <TableCell>{eur(p.mrr)}</TableCell>
                        <TableCell>{eur(p.mrr * 12)}</TableCell>
                        <TableCell>{metrics.mrr > 0 ? pct((p.mrr / metrics.mrr) * 100) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">IVA</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><p className="text-xs text-muted-foreground">IVA cobrado</p><p className="text-lg font-semibold">—</p><SourceBadge source="unavailable" /></div>
              <div><p className="text-xs text-muted-foreground">IVA das despesas (período)</p><p className="text-lg font-semibold">{eur(metrics.vatOnExpenses, 2)}</p><SourceBadge source="database" /></div>
              <div><p className="text-xs text-muted-foreground">IVA líquido estimado</p><p className="text-lg font-semibold">{eur(-metrics.vatOnExpenses, 2)}</p><SourceBadge source="estimate" /></div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------------------------------------------- DESPESAS */}
        <TabsContent value="despesas" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Despesas do período" value={eur(metrics.expenseSummary.total, 2)} source="database" hint={`${metrics.expenseSummary.count} registos`} />
            <KpiCard label="Recorrentes" value={eur(metrics.expenseSummary.recurring, 2)} source="database" hint={`Pontuais ${eur(metrics.expenseSummary.oneOff, 2)}`} />
            <KpiCard label="Custo operacional" value={eur(metrics.expenseSummary.operational, 2)} source="database" hint={`Crescimento ${eur(metrics.expenseSummary.growth, 2)}`} />
            <KpiCard label="Por pagar" value={eur(metrics.expenseSummary.unpaid, 2)} source="database" hint={`Pagas ${eur(metrics.expenseSummary.paid, 2)}`} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <CardTitle className="text-sm">Despesas ({filteredExpenses.length})</CardTitle>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input className="h-9 pl-7 w-[180px]" placeholder="Pesquisar..." value={search} onChange={e => setSearch(e.target.value)} />
                  </div>
                  <Select value={catFilter} onValueChange={setCatFilter}>
                    <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as categorias</SelectItem>
                      {metrics.expenseSummary.byCategory.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={v => setSortBy(v as "date" | "amount")}>
                    <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="date">Mais recentes</SelectItem><SelectItem value="amount">Maior valor</SelectItem></SelectContent>
                  </Select>
                  <Button variant="outline" size="sm" onClick={() => toCsv(filteredExpenses.map(e => ({
                    data: e.expense_date, descricao: e.description, categoria: categoryLabel(e.category), subcategoria: e.subcategory || "",
                    fornecedor: e.vendor || "", sem_iva: e.amount_net, iva: e.vat_amount, total: e.amount_total,
                    recorrente: e.is_recurring ? "Sim" : "Não", periodicidade: e.frequency || "", paga: e.is_paid ? "Sim" : "Não",
                    tipo: e.cost_type === "growth" ? "Crescimento" : "Operacional", canal: e.acquisition_channel || "", origem: e.source,
                  })), "despesas")}>
                    <Download className="h-4 w-4 mr-1" /> CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {filteredExpenses.length === 0 ? (
                <EmptyHint>Sem despesas neste período. Use "Adicionar despesa" para registar custos.</EmptyHint>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Data</TableHead><TableHead>Descrição</TableHead><TableHead>Categoria</TableHead>
                      <TableHead>Fornecedor</TableHead><TableHead className="text-right">Sem IVA</TableHead>
                      <TableHead className="text-right">IVA</TableHead><TableHead className="text-right">Total</TableHead>
                      <TableHead>Estado</TableHead><TableHead></TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {filteredExpenses.map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="whitespace-nowrap text-xs">{new Date(e.expense_date).toLocaleDateString("pt-PT")}</TableCell>
                          <TableCell className="font-medium">
                            {e.description}
                            {e.is_recurring && <Badge variant="secondary" className="ml-2 text-[10px]">Recorrente</Badge>}
                          </TableCell>
                          <TableCell className="text-xs">{categoryLabel(e.category)}{e.subcategory ? ` · ${e.subcategory}` : ""}</TableCell>
                          <TableCell className="text-xs">{e.vendor || "—"}</TableCell>
                          <TableCell className="text-right">{eur(Number(e.amount_net), 2)}</TableCell>
                          <TableCell className="text-right">{eur(Number(e.vat_amount), 2)}</TableCell>
                          <TableCell className="text-right font-semibold">{eur(Number(e.amount_total), 2)}</TableCell>
                          <TableCell><Badge variant={e.is_paid ? "secondary" : "outline"} className="text-[10px]">{e.is_paid ? "Paga" : "Por pagar"}</Badge></TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing(e); setExpenseOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Próximas despesas recorrentes</CardTitle></CardHeader>
            <CardContent>
              {expenses.filter(e => e.is_recurring).length === 0 ? <EmptyHint>Sem despesas recorrentes.</EmptyHint> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Descrição</TableHead><TableHead>Periodicidade</TableHead><TableHead>Próxima</TableHead><TableHead className="text-right">Custo mensal</TableHead><TableHead className="text-right">Custo anual</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {expenses.filter(e => e.is_recurring).map(e => {
                      const monthly = e.frequency === "yearly" ? Number(e.amount_total) / 12 : e.frequency === "quarterly" ? Number(e.amount_total) / 3 : e.frequency === "weekly" ? Number(e.amount_total) * 4.33 : Number(e.amount_total);
                      return (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{e.description}</TableCell>
                          <TableCell className="text-xs">{{ weekly: "Semanal", monthly: "Mensal", quarterly: "Trimestral", yearly: "Anual" }[e.frequency || "monthly"] || "Outra"}</TableCell>
                          <TableCell className="text-xs">{e.next_due_date ? new Date(e.next_due_date).toLocaleDateString("pt-PT") : "—"}</TableCell>
                          <TableCell className="text-right">{eur(monthly, 2)}</TableCell>
                          <TableCell className="text-right">{eur(monthly * 12, 2)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------ RENTABILIDADE */}
        <TabsContent value="rentabilidade" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Receita (MRR)" value={eur(metrics.profitability.revenue)} source="database" />
            <KpiCard label="Lucro bruto" value={eur(metrics.profitability.grossProfit)} source="estimate"
              hint={`Margem ${pct(metrics.profitability.grossMargin)}`} formula="MRR − custos operacionais mensais." />
            <KpiCard label="Resultado operacional" value={eur(metrics.profitability.operatingResult)} source="estimate"
              hint={`Margem ${pct(metrics.profitability.operatingMargin)}`} formula="MRR − custos totais (operacionais + crescimento)." />
            <KpiCard label="Lucro líquido estimado" value={eur(metrics.profitability.netProfitEstimate)} source="estimate"
              hint={`Margem ${pct(metrics.profitability.netMargin)} · IRC 21%`} formula="Resultado operacional − 21% de imposto quando positivo." />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Custo de manter a GarageFlow (mensal)</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Custo fixo (recorrente)</span><strong>{eur(metrics.monthlyCost.fixed, 2)}</strong></div>
                <div className="flex justify-between"><span>Custo variável (média 3 meses)</span><strong>{eur(metrics.monthlyCost.variable, 2)}</strong></div>
                <div className="flex justify-between"><span>Custo operacional</span><strong>{eur(metrics.monthlyCost.operational, 2)}</strong></div>
                <div className="flex justify-between"><span>Custo de crescimento</span><strong>{eur(metrics.monthlyCost.growth, 2)}</strong></div>
                <div className="flex justify-between border-t pt-2"><span>Total</span><strong>{eur(metrics.monthlyCost.total, 2)}</strong></div>
                <div className="flex justify-between"><span>Custo médio por oficina</span><strong>{metrics.monthlyCost.perShop !== null ? eur(metrics.monthlyCost.perShop, 2) : "—"}</strong></div>
                <SourceBadge source={metrics.monthlyCost.hasData ? "database" : "unavailable"} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Break-even</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between"><span>Custo mensal a cobrir</span><strong>{eur(metrics.breakEven.monthlyCost, 2)}</strong></div>
                <div className="flex justify-between"><span>Contribuição por oficina</span><strong>{metrics.breakEven.contributionPerShop !== null ? eur(metrics.breakEven.contributionPerShop, 2) : "—"}</strong></div>
                <div className="flex justify-between"><span>Oficinas pagantes necessárias</span><strong>{metrics.breakEven.shopsNeeded ?? "—"}</strong></div>
                <div className="flex justify-between"><span>Oficinas pagantes atuais</span><strong>{metrics.breakEven.currentShops}</strong></div>
                <div className="flex justify-between border-t pt-2"><span>Margem de segurança</span><strong>{pct(metrics.breakEven.safetyMargin)}</strong></div>
                <SourceBadge source={metrics.breakEven.available ? "estimate" : "unavailable"} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---------------------------------------------------- CASH FLOW */}
        <TabsContent value="cashflow" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Saldo Stripe disponível" value={stripe?.ok ? eur(stripe.balanceAvailable, 2) : "—"} source={stripe?.ok ? "api" : "unavailable"}
              hint={stripe?.ok ? `Pendente ${eur(stripe.balancePending, 2)}` : "Stripe indisponível"} />
            <KpiCard label="Saldo bancário conhecido" value={settings.known_bank_balance !== null ? eur(settings.known_bank_balance, 2) : "—"}
              source={settings.known_bank_balance !== null ? "manual" : "unavailable"}
              hint={settings.known_bank_balance_updated_at ? `Atualizado a ${new Date(settings.known_bank_balance_updated_at).toLocaleDateString("pt-PT")}` : "Por introduzir"} />
            <KpiCard label="Burn rate" value={eur(metrics.burnRate, 2)} source="estimate" formula="Custo mensal − MRR (0 quando a operação é positiva)." />
            <KpiCard label="Runway" value={metrics.runway !== null ? `${metrics.runway.toFixed(1)} meses` : "—"} source={metrics.runway !== null ? "estimate" : "unavailable"} />
          </div>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Cash flow mensal (caixa)</CardTitle>
              <Button variant="outline" size="sm" onClick={() => toCsv(metrics.cashFlow.map(c => ({
                mes: c.month, entradas: c.inflow.toFixed(2), saidas: c.outflow.toFixed(2), liquido: c.net.toFixed(2), saldo: c.balance.toFixed(2),
                receita_contabilistica: c.accrualRevenue.toFixed(2), despesa_contabilistica: c.accrualExpenses.toFixed(2),
              })), "cash-flow")}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            </CardHeader>
            <CardContent className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.cashFlow}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" fontSize={10} /><YAxis fontSize={11} />
                  <RTooltip formatter={(v: number) => eur(v, 2)} /><Legend />
                  <Bar dataKey="inflow" name="Entradas" fill="#10b981" />
                  <Bar dataKey="outflow" name="Saídas" fill="#ef4444" />
                  <Line type="monotone" dataKey="balance" name="Saldo" stroke="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Liquidez e definições de caixa</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Saldo bancário conhecido (€)</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" placeholder={settings.known_bank_balance !== null ? String(settings.known_bank_balance) : "Não introduzido"}
                    value={bankDraft} onChange={e => setBankDraft(e.target.value)} />
                  <Button variant="outline" onClick={() => saveSettings({ known_bank_balance: parseFloat(bankDraft) || 0, known_bank_balance_updated_at: new Date().toISOString() })}>Guardar</Button>
                </div>
                <p className="text-[11px] text-muted-foreground">SALDO PARCIAL / FONTES NÃO INTEGRADAS — apenas o que for introduzido aqui e o saldo Stripe.</p>
              </div>
              <div className="space-y-2">
                <Label>Reserva mínima de caixa (€)</Label>
                <div className="flex gap-2">
                  <Input type="number" step="0.01" placeholder={String(settings.min_cash_reserve)} value={reserveDraft} onChange={e => setReserveDraft(e.target.value)} />
                  <Button variant="outline" onClick={() => saveSettings({ min_cash_reserve: parseFloat(reserveDraft) || 0 })}>Guardar</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------------------------------------------------- CAC / LTV */}
        <TabsContent value="crescimento" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="CAC" value={metrics.cac.cac !== null ? eur(metrics.cac.cac, 2) : "—"} source={metrics.cac.available ? "estimate" : "unavailable"}
              hint={metrics.cac.available ? `${eur(metrics.cac.acquisitionSpend, 2)} ÷ ${metrics.cac.newCustomers} novos` : "Sem custos de aquisição ou sem novos clientes no período"}
              formula="Custos de crescimento do período ÷ novas oficinas pagantes do período." />
            <KpiCard label="LTV" value={metrics.ltv !== null ? eur(metrics.ltv, 2) : "—"} source={metrics.ltv !== null ? "estimate" : "unavailable"}
              formula="ARPU × margem bruta ÷ churn mensal." />
            <KpiCard label="LTV / CAC" value={metrics.ltvCacRatio !== null ? `${metrics.ltvCacRatio.toFixed(1)}x` : "—"} source={metrics.ltvCacRatio !== null ? "estimate" : "unavailable"} />
            <KpiCard label="Churn mensal" value={pct(metrics.churnMonthly)} source="database" formula="Cancelamentos dos últimos 60 dias ÷ 2 ÷ oficinas pagantes." />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Investimento e ROI por canal</CardTitle></CardHeader>
            <CardContent>
              {metrics.cac.byChannel.length === 0 ? (
                <EmptyHint>Sem custos de crescimento com canal atribuído neste período.</EmptyHint>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Canal</TableHead><TableHead className="text-right">Investimento</TableHead><TableHead className="text-right">Clientes</TableHead><TableHead className="text-right">CAC</TableHead><TableHead className="text-right">ROI</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {metrics.cac.byChannel.map(c => (
                      <TableRow key={c.channel}>
                        <TableCell>{CHANNEL_LABEL[c.channel] || c.label}</TableCell>
                        <TableCell className="text-right">{eur(c.spend, 2)}</TableCell>
                        <TableCell className="text-right"><SourceBadge source="unavailable" /></TableCell>
                        <TableCell className="text-right"><SourceBadge source="unavailable" /></TableCell>
                        <TableCell className="text-right"><SourceBadge source="unavailable" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
              <p className="text-[11px] text-muted-foreground mt-3">
                Clientes por canal ficam NÃO DISPONÍVEL enquanto não houver atribuição de origem por oficina — os valores nunca são inventados.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --------------------------------------------------- PROJEÇÕES */}
        <TabsContent value="projecoes" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> Pressupostos <Badge variant="outline" className="text-[10px]">PROJEÇÃO</Badge></CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {([
                ["arpu", "ARPU (€)"], ["monthlyGrowthPct", "Crescimento mensal (%)"], ["churnPct", "Churn (%)"], ["cac", "CAC (€)"],
                ["fixedCosts", "Custos fixos (€)"], ["variableCostPerShop", "Custo variável/oficina (€)"], ["salesReps", "Nº comerciais"],
                ["costPerRep", "Custo por comercial (€)"], ["marketingSpend", "Investimento marketing (€)"], ["taxRate", "Taxa de imposto (%)"],
              ] as [keyof ProjectionAssumptions, string][]).map(([k, label]) => (
                <div key={k}>
                  <Label className="text-xs">{label}</Label>
                  <Input type="number" value={a[k]} onChange={e => setAssumptions({ ...a, [k]: parseFloat(e.target.value) || 0 })} />
                </div>
              ))}
              <div className="flex items-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAssumptions(null)}>Repor</Button>
                <Button variant="outline" size="sm" onClick={() => saveSettings({ assumptions: a })}>Guardar</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between">
              <CardTitle className="text-sm">Cenários de escala</CardTitle>
              <Button variant="outline" size="sm" onClick={() => toCsv(scenarios.map(s => ({
                oficinas: s.shops, mrr: s.mrr.toFixed(2), arr: s.arr.toFixed(2), custos: s.costs.toFixed(2),
                lucro: s.profit.toFixed(2), margem: s.margin?.toFixed(1) ?? "", custo_por_oficina: s.costPerShop.toFixed(2),
                break_even_oficinas: s.breakEvenShops ?? "", cash_flow: s.cashFlow.toFixed(2),
              })), "projecoes")}><Download className="h-4 w-4 mr-1" /> CSV</Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Oficinas</TableHead><TableHead className="text-right">MRR</TableHead><TableHead className="text-right">ARR</TableHead>
                    <TableHead className="text-right">Custos</TableHead><TableHead className="text-right">Lucro</TableHead><TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Custo/oficina</TableHead><TableHead className="text-right">Break-even</TableHead><TableHead className="text-right">Cash flow</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {scenarios.map(s => (
                      <TableRow key={s.shops}>
                        <TableCell className="font-semibold">{s.shops}</TableCell>
                        <TableCell className="text-right">{eur(s.mrr)}</TableCell>
                        <TableCell className="text-right">{eur(s.arr)}</TableCell>
                        <TableCell className="text-right">{eur(s.costs)}</TableCell>
                        <TableCell className={`text-right font-semibold ${s.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{eur(s.profit)}</TableCell>
                        <TableCell className="text-right">{pct(s.margin)}</TableCell>
                        <TableCell className="text-right">{eur(s.costPerShop, 2)}</TableCell>
                        <TableCell className="text-right">{s.breakEvenShops ?? "—"}</TableCell>
                        <TableCell className="text-right">{eur(s.cashFlow)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={scenarios}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="shops" fontSize={11} /><YAxis fontSize={11} />
                    <RTooltip formatter={(v: number) => eur(v)} /><Legend />
                    <Line type="monotone" dataKey="mrr" name="MRR" stroke="#f59e0b" />
                    <Line type="monotone" dataKey="costs" name="Custos" stroke="#ef4444" />
                    <Line type="monotone" dataKey="profit" name="Lucro" stroke="#10b981" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------ DISTRIBUIÇÃO */}
        <TabsContent value="distribuicao" className="space-y-4 mt-4">
          <Card className="border-amber-500/40">
            <CardContent className="p-3 text-xs text-muted-foreground flex gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              Esta secção é apenas uma SIMULAÇÃO DE GESTÃO. Todos os valores são ESTIMATIVA e não constituem qualquer decisão fiscal ou contabilística.
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Saldo disponível conhecido" value={metrics.distribution.knownCash !== null ? eur(metrics.distribution.knownCash, 2) : "—"}
              source={metrics.distribution.knownCash !== null ? "manual" : "unavailable"} />
            <KpiCard label="Compromissos futuros" value={eur(metrics.distribution.commitments, 2)} source="database" hint="Despesas por pagar + recorrentes mensais" />
            <KpiCard label="Impostos previstos" value={eur(metrics.distribution.taxesEstimate, 2)} source="estimate" hint="21% do resultado operacional positivo" />
            <KpiCard label="Reserva mínima de caixa" value={eur(metrics.distribution.minReserve, 2)} source="manual" />
          </div>

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Montante potencialmente disponível <Badge variant="outline" className="ml-1 text-[10px]">ESTIMATIVA</Badge></CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!metrics.distribution.available ? (
                <EmptyHint>Introduza o saldo bancário conhecido no separador Cash flow para simular.</EmptyHint>
              ) : (
                <>
                  <p className="text-3xl font-bold">{eur(metrics.distribution.potentiallyAvailable, 2)}</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Simular distribuição de {distPct}%</Label>
                    <Slider value={[distPct]} min={0} max={100} step={5} onValueChange={v => setDistPct(v[0])} />
                    <div className="flex flex-wrap gap-2">
                      {[10, 25, 50, 75, 100].map(p => (
                        <Button key={p} size="sm" variant={distPct === p ? "default" : "outline"} onClick={() => setDistPct(p)}>{p}%</Button>
                      ))}
                    </div>
                    <p className="text-sm">
                      Distribuir {distPct}% → <strong>{eur((metrics.distribution.potentiallyAvailable ?? 0) * (distPct / 100), 2)}</strong>
                      {" · "}Fica em caixa: {eur((metrics.distribution.potentiallyAvailable ?? 0) * (1 - distPct / 100) + metrics.distribution.minReserve, 2)}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------------ ALERTAS */}
        <TabsContent value="alertas" className="space-y-4 mt-4">
          <SectionTitle title="Alertas financeiros" description="Gerados a partir dos dados reais existentes — sem alertas inventados." />
          {alerts.length === 0 ? (
            <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Sem alertas neste momento.</CardContent></Card>
          ) : (
            <div className="space-y-2">
              {alerts.map((al, i) => (
                <Card key={i} className={al.level === "danger" ? "border-destructive/40" : al.level === "warn" ? "border-amber-500/40" : ""}>
                  <CardContent className="p-3 flex items-start gap-2 text-sm">
                    <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${al.level === "danger" ? "text-destructive" : al.level === "warn" ? "text-amber-500" : "text-muted-foreground"}`} />
                    {al.text}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Limites de alerta</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(settings.alert_thresholds).map(([k, v]) => (
                <div key={k}>
                  <Label className="text-xs">{{
                    cacIncreasePct: "Aumento do CAC (%)", mrrDropPct: "Queda de MRR (%)", expenseIncreasePct: "Aumento de despesas (%)",
                    churnPct: "Churn máximo (%)", runwayMonths: "Runway mínimo (meses)", marginDropPct: "Queda de margem (%)",
                  }[k] || k}</Label>
                  <Input type="number" defaultValue={v} onBlur={e => {
                    const next = { ...settings.alert_thresholds, [k]: parseFloat(e.target.value) || 0 };
                    if (next[k] !== v) saveSettings({ alert_thresholds: next });
                  }} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} expense={editing} extraCategories={[]} onSaved={reload} />

      <AlertDialog open={!!deleting} onOpenChange={o => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting?.description} — {eur(Number(deleting?.amount_total || 0), 2)}. Esta ação fica registada na auditoria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={removeExpense}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
