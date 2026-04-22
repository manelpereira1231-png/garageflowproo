import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, DollarSign, Users, TrendingDown, Award, Globe, Download, RefreshCw, Activity } from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { toast } from "sonner";

interface Cohort {
  cohortMonth: string;
  size: number;
  retention: number[];
}

interface FinanceState {
  mrr: number;
  arr: number;
  arpu: number;
  ltv: number;
  cac: number;
  ltvCacRatio: number;
  churnMonthly: number;
  netRevenueRetention: number;
  payingCustomers: number;
  trialingCustomers: number;
  countryBreakdown: { country: string; revenue: number; customers: number; flag: string }[];
  monthlyMrrTrend: { month: string; mrr: number; new: number; churn: number }[];
  topPayingShops: { id: string; name: string; plan: string; mrr: number; since: string }[];
  cohorts: Cohort[];
  recentRevenue30d: number;
  recentRevenue7d: number;
  expansionMrr: number;
}

const PLAN_PRICE_EUR: Record<string, number> = { free: 0, pro: 49, garage: 99 };

export default function AdminFinance() {
  const [state, setState] = useState<FinanceState | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [shopsRes, subsRes, paymentsRes, ordersRes] = await Promise.all([
        supabase.from("shops").select("id, name, country, created_at"),
        supabase.from("subscriptions").select("shop_id, plan, status, trial_end, updated_at, created_at, discount_percent"),
        supabase.from("payments" as any).select("amount, currency, created_at, shop_id, status").limit(2000).order("created_at", { ascending: false }),
        supabase.from("work_orders").select("total, status, created_at, shop_id"),
      ]);

      const shops = shopsRes.data || [];
      const subs = subsRes.data || [];

      // MRR (paying only)
      const paying = subs.filter(s => (s.status === "active" || s.status === "trialing") && s.plan !== "free" && s.status !== "trialing");
      const mrr = paying.reduce((sum, s) => {
        const base = PLAN_PRICE_EUR[s.plan] || 0;
        const disc = s.discount_percent || 0;
        return sum + base * (1 - disc / 100);
      }, 0);
      const arr = mrr * 12;
      const payingCustomers = paying.length;
      const trialingCustomers = subs.filter(s => s.status === "trialing").length;
      const arpu = payingCustomers > 0 ? mrr / payingCustomers : 0;

      // Churn — last 60 days
      const sixty = Date.now() - 60 * 86400000;
      const cancelled60 = subs.filter(s => s.status === "canceled" && new Date(s.updated_at).getTime() > sixty).length;
      const active60 = subs.filter(s => (s.status === "active" || s.status === "trialing")).length;
      const churnMonthly = active60 > 0 ? (cancelled60 / 2 / active60) * 100 : 0;
      const ltv = churnMonthly > 0 ? arpu / (churnMonthly / 100) : arpu * 24;
      const cac = 35; // estimated until ad data is integrated
      const ltvCacRatio = cac > 0 ? ltv / cac : 0;

      // Country breakdown
      const flags: Record<string, string> = { Portugal: "🇵🇹", Brasil: "🇧🇷", Brazil: "🇧🇷", Spain: "🇪🇸", España: "🇪🇸", Espanha: "🇪🇸", France: "🇫🇷", Germany: "🇩🇪", US: "🇺🇸", UK: "🇬🇧", India: "🇮🇳" };
      const byCountry = new Map<string, { revenue: number; customers: number }>();
      shops.forEach(s => {
        const sub = subs.find(x => x.shop_id === s.id);
        if (!sub || sub.status !== "active" || sub.plan === "free") return;
        const country = s.country || "Outro";
        const rev = (PLAN_PRICE_EUR[sub.plan] || 0) * (1 - (sub.discount_percent || 0) / 100);
        const cur = byCountry.get(country) || { revenue: 0, customers: 0 };
        byCountry.set(country, { revenue: cur.revenue + rev, customers: cur.customers + 1 });
      });
      const countryBreakdown = Array.from(byCountry.entries())
        .map(([country, v]) => ({ country, revenue: v.revenue, customers: v.customers, flag: flags[country] || "🌍" }))
        .sort((a, b) => b.revenue - a.revenue);

      // Top paying shops
      const shopsMap = new Map(shops.map(s => [s.id, s]));
      const topPayingShops = paying
        .map(s => ({
          id: s.shop_id,
          name: shopsMap.get(s.shop_id)?.name || "—",
          plan: s.plan,
          mrr: (PLAN_PRICE_EUR[s.plan] || 0) * (1 - (s.discount_percent || 0) / 100),
          since: s.created_at,
        }))
        .sort((a, b) => b.mrr - a.mrr)
        .slice(0, 10);

      // MRR trend last 6 months
      const months: { month: string; mrr: number; new: number; churn: number }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
        const monthLabel = m.toLocaleDateString("pt-PT", { month: "short" });
        const newSubs = subs.filter(s => {
          const c = new Date(s.created_at).getTime();
          return c >= m.getTime() && c <= mEnd.getTime() && s.plan !== "free";
        }).length;
        const churned = subs.filter(s => {
          const c = new Date(s.updated_at).getTime();
          return s.status === "canceled" && c >= m.getTime() && c <= mEnd.getTime();
        }).length;
        const monthMrr = subs.filter(s => {
          const c = new Date(s.created_at).getTime();
          return c <= mEnd.getTime() && (s.status === "active") && s.plan !== "free";
        }).reduce((sum, s) => sum + (PLAN_PRICE_EUR[s.plan] || 0) * (1 - (s.discount_percent || 0) / 100), 0);
        months.push({ month: monthLabel, mrr: Math.round(monthMrr), new: newSubs, churn: churned });
      }

      // Cohorts: monthly signups + retention
      const cohortsMap = new Map<string, string[]>();
      shops.forEach(s => {
        const k = new Date(s.created_at).toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
        const arr = cohortsMap.get(k) || [];
        arr.push(s.id);
        cohortsMap.set(k, arr);
      });
      const orders = ordersRes.data || [];
      const cohorts: Cohort[] = Array.from(cohortsMap.entries()).slice(-6).map(([cohortMonth, shopIds]) => {
        const retention: number[] = [];
        for (let m = 0; m < 4; m++) {
          const start = Date.now() - (3 - m) * 30 * 86400000;
          const active = shopIds.filter(id => orders.some(o => o.shop_id === id && new Date(o.created_at).getTime() >= start)).length;
          retention.push(shopIds.length > 0 ? Math.round((active / shopIds.length) * 100) : 0);
        }
        return { cohortMonth, size: shopIds.length, retention };
      });

      // Revenue last 30 / 7d (from work orders completed)
      const completedOrders = orders.filter(o => o.status === "completed" || o.status === "delivered");
      const revenue30d = completedOrders.filter(o => new Date(o.created_at).getTime() > Date.now() - 30 * 86400000).reduce((s, o) => s + Number(o.total || 0), 0);
      const revenue7d = completedOrders.filter(o => new Date(o.created_at).getTime() > Date.now() - 7 * 86400000).reduce((s, o) => s + Number(o.total || 0), 0);

      setState({
        mrr,
        arr,
        arpu,
        ltv,
        cac,
        ltvCacRatio,
        churnMonthly,
        netRevenueRetention: 100 - churnMonthly,
        payingCustomers,
        trialingCustomers,
        countryBreakdown,
        monthlyMrrTrend: months,
        topPayingShops,
        cohorts,
        recentRevenue30d: revenue30d,
        recentRevenue7d: revenue7d,
        expansionMrr: 0,
      });
    } catch (e: any) {
      toast.error("Falha ao carregar finanças: " + (e?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const exportCsv = () => {
    if (!state) return;
    const rows = [
      ["Métrica", "Valor"],
      ["MRR (€)", state.mrr.toFixed(2)],
      ["ARR (€)", state.arr.toFixed(2)],
      ["ARPU (€)", state.arpu.toFixed(2)],
      ["LTV (€)", state.ltv.toFixed(2)],
      ["CAC estimado (€)", state.cac.toFixed(2)],
      ["LTV/CAC ratio", state.ltvCacRatio.toFixed(2)],
      ["Churn mensal %", state.churnMonthly.toFixed(2)],
      ["Clientes pagantes", state.payingCustomers],
      ["Em trial", state.trialingCustomers],
    ];
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `garageflow-finance-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  if (loading || !state) return <div className="p-6 text-sm text-muted-foreground">A carregar finanças…</div>;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Finanças & Crescimento</h1>
          <p className="text-sm text-muted-foreground mt-1">MRR, ARR, retenção, cohorts e ranking de clientes pagantes.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-2" />Atualizar</Button>
          <Button onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Exportar CSV</Button>
        </div>
      </div>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="MRR" value={`€${Math.round(state.mrr).toLocaleString("pt-PT")}`} icon={<DollarSign className="w-5 h-5" />} hint={`${state.payingCustomers} pagantes`} accent="text-success" />
        <KpiCard label="ARR" value={`€${Math.round(state.arr).toLocaleString("pt-PT")}`} icon={<TrendingUp className="w-5 h-5" />} hint="Receita anualizada" accent="text-primary" />
        <KpiCard label="ARPU" value={`€${state.arpu.toFixed(0)}`} icon={<Users className="w-5 h-5" />} hint="Receita / cliente" />
        <KpiCard label="LTV" value={`€${Math.round(state.ltv).toLocaleString("pt-PT")}`} icon={<Award className="w-5 h-5" />} hint={`Ratio ${state.ltvCacRatio.toFixed(1)}x CAC`} accent="text-amber-500" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Churn mensal" value={`${state.churnMonthly.toFixed(1)}%`} icon={<TrendingDown className="w-5 h-5" />} hint="Últimos 60d /2" accent={state.churnMonthly > 5 ? "text-destructive" : "text-success"} />
        <KpiCard label="Net Revenue Retention" value={`${state.netRevenueRetention.toFixed(0)}%`} icon={<Activity className="w-5 h-5" />} hint="Saúde da base" />
        <KpiCard label="Receita últimos 30d" value={`€${Math.round(state.recentRevenue30d).toLocaleString("pt-PT")}`} icon={<DollarSign className="w-5 h-5" />} hint="Ordens concluídas" />
        <KpiCard label="Receita últimos 7d" value={`€${Math.round(state.recentRevenue7d).toLocaleString("pt-PT")}`} icon={<DollarSign className="w-5 h-5" />} hint="Curto prazo" />
      </div>

      {/* MRR trend */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução do MRR (6 meses)</CardTitle>
          <CardDescription>Receita recorrente, novos pagantes e churns por mês</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={state.monthlyMrrTrend}>
              <defs>
                <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Area type="monotone" dataKey="mrr" stroke="hsl(var(--primary))" fill="url(#mrrGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Country breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="w-4 h-4" />Receita por país</CardTitle>
            <CardDescription>Distribuição geográfica do MRR</CardDescription>
          </CardHeader>
          <CardContent>
            {state.countryBreakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem dados ainda.</p>
            ) : (
              <div className="space-y-2">
                {state.countryBreakdown.map(c => {
                  const total = state.countryBreakdown.reduce((s, x) => s + x.revenue, 0);
                  const pct = total > 0 ? (c.revenue / total) * 100 : 0;
                  return (
                    <div key={c.country} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/30 transition-colors">
                      <span className="text-2xl">{c.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium">{c.country}</span>
                          <span className="font-semibold tabular-nums">€{Math.round(c.revenue).toLocaleString("pt-PT")}</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                          <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{c.customers} cliente(s) — {pct.toFixed(0)}%</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top paying */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Award className="w-4 h-4 text-amber-500" />Top 10 clientes pagantes</CardTitle>
            <CardDescription>Maiores fontes de receita recorrente</CardDescription>
          </CardHeader>
          <CardContent>
            {state.topPayingShops.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem clientes pagantes ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {state.topPayingShops.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-accent/30 transition-colors">
                    <span className="text-xs font-mono text-muted-foreground w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">desde {new Date(s.since).toLocaleDateString("pt-PT")}</div>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{s.plan}</Badge>
                    <span className="text-sm font-semibold tabular-nums w-16 text-right">€{s.mrr.toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cohort retention */}
      <Card>
        <CardHeader>
          <CardTitle>Cohort de retenção</CardTitle>
          <CardDescription>% de oficinas ativas (com ordens) por mês desde o registo</CardDescription>
        </CardHeader>
        <CardContent>
          {state.cohorts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem cohorts suficientes.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="py-2 pr-4">Cohort</th>
                    <th className="py-2 pr-4 text-right">Tamanho</th>
                    <th className="py-2 px-2 text-center">M0</th>
                    <th className="py-2 px-2 text-center">M1</th>
                    <th className="py-2 px-2 text-center">M2</th>
                    <th className="py-2 px-2 text-center">M3</th>
                  </tr>
                </thead>
                <tbody>
                  {state.cohorts.map(c => (
                    <tr key={c.cohortMonth} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium capitalize">{c.cohortMonth}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">{c.size}</td>
                      {c.retention.map((r, i) => {
                        const intensity = Math.min(100, r) / 100;
                        return (
                          <td key={i} className="py-1 px-2 text-center">
                            <span
                              className="inline-block px-2 py-1 rounded text-[11px] font-medium tabular-nums"
                              style={{
                                background: `hsl(var(--primary) / ${intensity * 0.4 + 0.05})`,
                                color: r > 50 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                              }}
                            >{r}%</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, icon, hint, accent }: { label: string; value: string; icon: React.ReactNode; hint?: string; accent?: string }) {
  return (
    <Card className="card-premium">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
          <span className={accent || "text-muted-foreground"}>{icon}</span>
        </div>
        <div className={`text-3xl font-bold mt-2 tracking-tight tabular-nums ${accent || ""}`}>{value}</div>
        {hint && <div className="text-[11px] text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}
