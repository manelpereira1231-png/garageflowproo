import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DemoRequestsBanner } from "@/components/DemoRequestsBanner";
import { MarketActivationsBanner } from "@/components/MarketActivationsBanner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Crown,
  DollarSign,
  RefreshCw,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type MoneyMap = Record<string, number>;
type KPI = { label: string; value: string; icon: any; trend?: number; tone?: "good" | "bad" | "neutral" };
type ActivityItem = { id: string; type: "shop" | "payment" | "cancel"; label: string; sub: string; at: string };
type TopCustomer = { id: string; name: string; email?: string | null; revenue: MoneyMap; plan?: string | null };
type AtRiskCustomer = { id: string; name: string; reason: string; days: number };

type UserActivity = {
  dau: number;
  wau: number;
  mau: number;
  recent: { user_id: string; last_seen_at: string; shop_id: string | null }[];
};

type StripeMetrics = {
  generated_at: string;
  source?: "stripe_live_api";
  degraded?: boolean;
  stripeError?: string | null;
  primaryCurrency?: string;
  mrr?: MoneyMap;
  monthlyRevenue?: MoneyMap;
  annualRevenue?: MoneyMap;
  totalRevenue?: MoneyMap;
  arpu?: MoneyMap;
  monthGrowth?: number;
  payingSubscriptions?: number;
  trialingSubscriptions?: number;
  trialToPaidConversions?: number;
  conversionRate?: number;
  cancellationsLast30?: number;
  churnRate?: number;
  retentionRate?: number;
  activeWorkshops?: number;
  inactiveWorkshops?: number;
  stripeCustomersWithSubscriptions?: number;
  monthlySeries?: { month: string; newSubscriptions: number; activeSubscriptions: number; revenue: MoneyMap }[];
  planSeries?: { plan: string; count: number }[];
  activity?: ActivityItem[];
  topCustomers?: TopCustomer[];
  atRisk?: AtRiskCustomer[];
  userActivity?: UserActivity;
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(var(--muted-foreground))",
];

const fmtRel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
};

const moneyValue = (map: MoneyMap | undefined, currency: string) => Number(map?.[currency] ?? map?.EUR ?? Object.values(map || {})[0] ?? 0);

const fmtMoney = (map: MoneyMap | number | undefined, currency = "EUR") => {
  const value = typeof map === "number" ? map : moneyValue(map, currency);
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency }).format(value || 0);
};

export default function CommercialDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [metrics, setMetrics] = useState<StripeMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    setError(null);
    const { data, error } = await supabase.functions.invoke<StripeMetrics>("admin-commercial-stripe-metrics");
    if (error) {
      setError(error.message || "Não foi possível ler métricas diretamente da Stripe.");
    } else if (data) {
      setMetrics(data);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { void load(true); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const debouncedReload = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void load(true), 750);
    };
    const poll = window.setInterval(debouncedReload, 60000);
    window.addEventListener("focus", debouncedReload);
    window.addEventListener("online", debouncedReload);
    return () => {
      window.clearInterval(poll);
      window.removeEventListener("focus", debouncedReload);
      window.removeEventListener("online", debouncedReload);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [autoRefresh, load]);

  const currency = metrics?.primaryCurrency || "EUR";

  const kpis: KPI[] = useMemo(() => {
    if (!metrics) return [];
    const monthGrowth = metrics.monthGrowth ?? 0;
    const conversionRate = metrics.conversionRate ?? 0;
    const churnRate = metrics.churnRate ?? 0;
    const retentionRate = metrics.retentionRate ?? 0;
    return [
      { label: "MRR Stripe", value: fmtMoney(metrics.mrr, currency), icon: DollarSign, trend: monthGrowth, tone: monthGrowth >= 0 ? "good" : "bad" },
      { label: "Receita Mensal Stripe", value: fmtMoney(metrics.monthlyRevenue, currency), icon: TrendingUp, tone: "good" },
      { label: "Receita Anual Stripe", value: fmtMoney(metrics.annualRevenue, currency), icon: TrendingUp, tone: "good" },
      { label: "Receita Total Stripe", value: fmtMoney(metrics.totalRevenue, currency), icon: DollarSign, tone: "neutral" },
      { label: "ARPU Stripe", value: fmtMoney(metrics.arpu, currency), icon: Crown, tone: "good" },
      { label: "Oficinas Pagantes", value: String(metrics.payingSubscriptions ?? 0), icon: CheckCircle2, tone: "good" },
      { label: "Em Trial Stripe", value: String(metrics.trialingSubscriptions ?? 0), icon: Clock, tone: "neutral" },
      { label: "Conversão Trial→Pago", value: `${conversionRate.toFixed(1)}%`, icon: Zap, tone: conversionRate >= 20 ? "good" : "bad" },
      { label: "Taxa Churn Stripe", value: `${churnRate.toFixed(1)}%`, icon: AlertTriangle, tone: churnRate <= 5 ? "good" : "bad" },
      { label: "Retenção Stripe", value: `${retentionRate.toFixed(1)}%`, icon: CheckCircle2, tone: "good" },
      { label: "Billing Ativo", value: String(metrics.activeWorkshops ?? 0), icon: Activity, tone: "good" },
      { label: "Billing Inativo", value: String(metrics.inactiveWorkshops ?? 0), icon: AlertTriangle, tone: (metrics.inactiveWorkshops ?? 0) > 0 ? "bad" : "neutral" },
      { label: "Cancelamentos 30d", value: String(metrics.cancellationsLast30 ?? 0), icon: AlertTriangle, tone: (metrics.cancellationsLast30 ?? 0) > 0 ? "bad" : "neutral" },
      { label: "Conversões Reais", value: String(metrics.trialToPaidConversions ?? 0), icon: Users, tone: "good" },
    ];
  }, [currency, metrics]);

  const growthSeries = useMemo(() => (metrics?.monthlySeries || []).map((row) => ({
    month: row.month,
    subscriptions: row.activeSubscriptions,
    newSubscriptions: row.newSubscriptions,
    revenue: moneyValue(row.revenue, currency),
  })), [currency, metrics]);

  if (loading) return <div className="text-sm text-muted-foreground">A carregar métricas diretamente da Stripe…</div>;

  return (
    <div className="space-y-6">
      <MarketActivationsBanner target="/admin/market-activations" />
      <DemoRequestsBanner target="/commercial/demos" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Dashboard Executivo
            {autoRefresh && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-600/10 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> STRIPE LIVE
              </span>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Fonte exclusiva: Stripe API · {metrics ? `atualizado ${fmtRel(metrics.generated_at)}` : "sem métricas carregadas"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh((v) => !v)}>
            <Activity className="w-3.5 h-3.5 mr-1.5" /> {autoRefresh ? "Pausar" : "Retomar"} live
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load(false)} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar Stripe
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {metrics?.degraded && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm text-amber-700 dark:text-amber-400">
            Stripe indisponível no momento{metrics.stripeError ? `: ${metrics.stripeError}` : ""}. Métricas financeiras serão atualizadas no próximo ciclo. Dados de acesso (abaixo) continuam em tempo real.
          </CardContent>
        </Card>
      )}

      {metrics?.userActivity && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-600" /> Último Acesso (tempo real)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Ativos hoje (DAU)</p><p className="text-2xl font-bold">{metrics.userActivity.dau}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Últimos 7 dias (WAU)</p><p className="text-2xl font-bold">{metrics.userActivity.wau}</p></div>
              <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">Últimos 30 dias (MAU)</p><p className="text-2xl font-bold">{metrics.userActivity.mau}</p></div>
            </div>
            <div className="space-y-1.5 max-h-72 overflow-auto">
              {metrics.userActivity.recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sem acessos recentes.</p>
              ) : metrics.userActivity.recent.map((r) => (
                <div key={r.user_id} className="flex items-center justify-between text-xs border-b border-border/40 py-1.5">
                  <span className="font-mono truncate max-w-[60%]" title={r.user_id}>{r.user_id.slice(0, 8)}…</span>
                  <span className="text-muted-foreground">{fmtRel(r.last_seen_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {!metrics || (metrics.degraded && !metrics.mrr) ? (
        <Card>
          <CardContent className="p-8 text-sm text-muted-foreground">Aguardando resposta da Stripe… Os dados financeiros aparecerão automaticamente assim que disponíveis.</CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {kpis.map((k) => (
              <Card key={k.label} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="text-xs text-muted-foreground leading-tight">{k.label}</span>
                    <k.icon className={`w-4 h-4 shrink-0 ${k.tone === "good" ? "text-emerald-600" : k.tone === "bad" ? "text-destructive" : "text-primary"}`} />
                  </div>
                  <div className="text-xl font-bold tabular-nums break-words">{k.value}</div>
                  {typeof k.trend === "number" && (
                    <div className={`flex items-center gap-1 text-[11px] mt-1 ${k.trend >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {k.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(k.trend).toFixed(1)}% vs mês anterior Stripe
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-base">Subscrições Stripe (12m)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={growthSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => Number(v).toLocaleString("pt-PT")} />
                    <Legend />
                    <Line type="monotone" dataKey="subscriptions" stroke="hsl(var(--primary))" strokeWidth={2} name="Subscrições criadas" />
                    <Line type="monotone" dataKey="newSubscriptions" stroke="hsl(var(--chart-2))" name="Novas no mês" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Planos Stripe</CardTitle></CardHeader>
              <CardContent>
                {(metrics.planSeries || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sem subscrições Stripe ativas ou em trial.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={metrics.planSeries} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius="70%" innerRadius="40%">
                        {metrics.planSeries.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={30} iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card className="lg:col-span-3">
              <CardHeader><CardTitle className="text-base">Invoices Stripe Pagas (12m)</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={growthSeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip formatter={(v: any) => fmtMoney(Number(v), currency)} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita Stripe" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Atividade Stripe</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-96 overflow-y-auto">
                {metrics.activity.length === 0 && <p className="text-xs text-muted-foreground">Sem pagamentos ou cancelamentos Stripe recentes.</p>}
                {metrics.activity.map((a) => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/40 transition-colors">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === "payment" ? "bg-emerald-600" : "bg-destructive"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.label}</p>
                      <p className="text-xs text-muted-foreground">{a.sub} · {fmtRel(a.at)}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-amber-600" /> Top Clientes Stripe</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {metrics.topCustomers.length === 0 && <p className="text-xs text-muted-foreground">Sem invoices Stripe pagas ainda.</p>}
                {metrics.topCustomers.map((s, i) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-accent/40 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold bg-muted text-muted-foreground">{i + 1}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        {s.email && <Badge variant="secondary" className="text-[10px] h-4 px-1.5 max-w-full truncate">{s.email}</Badge>}
                      </div>
                    </div>
                    <span className="text-sm font-semibold flex-shrink-0 tabular-nums">{fmtMoney(s.revenue, currency)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" /> Risco Stripe</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {metrics.atRisk.length === 0 && <p className="text-xs text-muted-foreground">Nenhum risco financeiro Stripe neste momento.</p>}
                {metrics.atRisk.map((s) => (
                  <div key={`${s.id}-${s.reason}`} className="flex items-center justify-between p-2 rounded-lg border border-destructive/20 bg-destructive/5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs text-destructive">{s.reason}{s.days > 0 ? ` · ${s.days}d` : ""}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}