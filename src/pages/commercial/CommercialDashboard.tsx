import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2, TrendingUp, Users, DollarSign, AlertTriangle, CheckCircle2,
  RefreshCw, Activity, Crown, Clock, ArrowUpRight, ArrowDownRight, Zap,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Link } from "react-router-dom";

type KPI = { label: string; value: string; icon: any; trend?: number; tone?: "good" | "bad" | "neutral" };
type ActivityItem = { id: string; type: "shop" | "payment" | "cancel"; label: string; sub: string; at: string };
type TopShop = { id: string; name: string; revenue: number; plan?: string };
type AtRiskShop = { id: string; name: string; reason: string; days: number };

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v || 0);

const fmtRel = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  return `há ${d}d`;
};

const PIE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#ef4444", "#6366f1", "#94a3b8"];

export default function CommercialDashboard() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [growthSeries, setGrowthSeries] = useState<{ month: string; shops: number; revenue: number; cumulative: number }[]>([]);
  const [planSeries, setPlanSeries] = useState<{ plan: string; count: number }[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [topShops, setTopShops] = useState<TopShop[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskShop[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const debounceRef = useRef<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    const now = new Date();
    const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const last30 = new Date(now.getTime() - 30 * 86400000).toISOString();

    const [
      shopsRes, subsRes, paymentsAllRes, paymentsMonthRes, paymentsYearRes,
      paymentsPrevMonthRes, newTodayRes, newWeekRes, newMonthRes, activeRes,
      cancelledRes, recentShopsRes, recentPaymentsRes,
    ] = await Promise.all([
      supabase.from("shops").select("id, name, created_at, status, last_seen_at"),
      supabase.from("subscriptions").select("plan, status, shop_id, current_period_end"),
      supabase.from("payments").select("amount, paid_at, shop_id"),
      supabase.from("payments").select("amount").gte("paid_at", monthStart),
      supabase.from("payments").select("amount").gte("paid_at", yearStart),
      supabase.from("payments").select("amount").gte("paid_at", prevMonthStart).lt("paid_at", monthStart),
      supabase.from("shops").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("shops").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
      supabase.from("shops").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
      supabase.from("shops").select("id", { count: "exact", head: true }).gte("last_seen_at", last30),
      supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "canceled"),
      supabase.from("shops").select("id, name, created_at").order("created_at", { ascending: false }).limit(8),
      supabase.from("payments").select("id, amount, paid_at, shop_id").order("paid_at", { ascending: false }).limit(8),
    ]);

    const allShops = shopsRes.data || [];
    const totalShops = allShops.length;
    const subs = subsRes.data || [];
    const paying = subs.filter((s: any) => s.status === "active").length;
    const trial = subs.filter((s: any) => s.status === "trialing").length;
    const cancelled = cancelledRes.count ?? 0;
    const activeCount = activeRes.count ?? 0;
    const inactiveShops = Math.max(0, totalShops - activeCount);

    const totalRevenue = (paymentsAllRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const monthRevenue = (paymentsMonthRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const yearRevenue = (paymentsYearRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const prevMonthRevenue = (paymentsPrevMonthRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

    const monthGrowth = prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;
    const retention = totalShops > 0 ? ((totalShops - cancelled) / totalShops) * 100 : 100;
    const churn = totalShops > 0 ? (cancelled / totalShops) * 100 : 0;
    const arpu = paying > 0 ? totalRevenue / paying : 0;
    const conversion = totalShops > 0 ? (paying / totalShops) * 100 : 0;
    const mrr = monthRevenue;

    setKpis([
      { label: "Receita Mensal (MRR)", value: fmtMoney(mrr), icon: DollarSign, trend: monthGrowth, tone: monthGrowth >= 0 ? "good" : "bad" },
      { label: "Receita Anual", value: fmtMoney(yearRevenue), icon: TrendingUp, tone: "good" },
      { label: "Receita Total", value: fmtMoney(totalRevenue), icon: DollarSign, tone: "neutral" },
      { label: "ARPU", value: fmtMoney(arpu), icon: Crown, tone: "good" },
      { label: "Oficinas Pagantes", value: String(paying), icon: CheckCircle2, tone: "good" },
      { label: "Em Trial", value: String(trial), icon: Clock, tone: "neutral" },
      { label: "Conversão Trial→Pago", value: `${conversion.toFixed(1)}%`, icon: Zap, tone: conversion >= 20 ? "good" : "bad" },
      { label: "Taxa Churn", value: `${churn.toFixed(1)}%`, icon: AlertTriangle, tone: churn <= 5 ? "good" : "bad" },
      { label: "Retenção", value: `${retention.toFixed(1)}%`, icon: CheckCircle2, tone: "good" },
      { label: "Oficinas Totais", value: String(totalShops), icon: Building2 },
      { label: "Ativas (30d)", value: String(activeCount), icon: Activity, tone: "good" },
      { label: "Inativas", value: String(inactiveShops), icon: AlertTriangle, tone: inactiveShops > totalShops * 0.3 ? "bad" : "neutral" },
      { label: "Novas Hoje", value: String(newTodayRes.count ?? 0), icon: TrendingUp },
      { label: "Novas Semana", value: String(newWeekRes.count ?? 0), icon: TrendingUp },
      { label: "Novas Mês", value: String(newMonthRes.count ?? 0), icon: TrendingUp },
      { label: "Canceladas", value: String(cancelled), icon: AlertTriangle, tone: "bad" },
    ]);

    // Growth series — last 12 months with cumulative
    const months: { key: string; month: string; shops: number; revenue: number; cumulative: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
      months.push({ key, month: label, shops: 0, revenue: 0, cumulative: 0 });
    }
    allShops.forEach((s: any) => {
      const d = new Date(s.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === k);
      if (m) m.shops += 1;
    });
    (paymentsAllRes.data || []).forEach((p: any) => {
      if (!p.paid_at) return;
      const d = new Date(p.paid_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const m = months.find((x) => x.key === k);
      if (m) m.revenue += Number(p.amount || 0);
    });
    let cum = 0;
    months.forEach((m) => { cum += m.shops; m.cumulative = cum; });
    setGrowthSeries(months.map(({ month, shops, revenue, cumulative }) => ({ month, shops, revenue, cumulative })));

    // Plans distribution
    const planCounts: Record<string, number> = {};
    subs.forEach((s: any) => {
      const k = s.plan || "free";
      planCounts[k] = (planCounts[k] || 0) + 1;
    });
    setPlanSeries(Object.entries(planCounts).map(([plan, count]) => ({ plan, count })));

    // Top shops by revenue
    const revenueByShop: Record<string, number> = {};
    (paymentsAllRes.data || []).forEach((p: any) => {
      if (!p.shop_id) return;
      revenueByShop[p.shop_id] = (revenueByShop[p.shop_id] || 0) + Number(p.amount || 0);
    });
    const shopMap = new Map(allShops.map((s: any) => [s.id, s]));
    const planByShop = new Map(subs.map((s: any) => [s.shop_id, s.plan]));
    const top = Object.entries(revenueByShop)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, revenue]) => ({
        id,
        name: (shopMap.get(id) as any)?.name || "Oficina",
        revenue,
        plan: planByShop.get(id) as string | undefined,
      }));
    setTopShops(top);

    // At-risk shops: inactive >14d OR trial ending in <3d
    const risk: AtRiskShop[] = [];
    const fourteenDays = 14 * 86400000;
    allShops.forEach((s: any) => {
      if (!s.last_seen_at) return;
      const daysInactive = Math.floor((Date.now() - new Date(s.last_seen_at).getTime()) / 86400000);
      if (daysInactive >= 14 && daysInactive <= 60) {
        risk.push({ id: s.id, name: s.name || "Oficina", reason: "Inativa", days: daysInactive });
      }
    });
    subs.forEach((s: any) => {
      if (s.status !== "trialing" || !s.current_period_end) return;
      const daysLeft = Math.floor((new Date(s.current_period_end).getTime() - Date.now()) / 86400000);
      if (daysLeft >= 0 && daysLeft <= 3) {
        const shop = shopMap.get(s.shop_id) as any;
        risk.push({ id: s.shop_id, name: shop?.name || "Oficina", reason: "Trial a expirar", days: daysLeft });
      }
    });
    setAtRisk(risk.slice(0, 6));

    // Activity feed (combine recent shops + payments)
    const feed: ActivityItem[] = [];
    (recentShopsRes.data || []).forEach((s: any) => {
      feed.push({ id: `s-${s.id}`, type: "shop", label: s.name || "Nova oficina", sub: "Registou-se", at: s.created_at });
    });
    (recentPaymentsRes.data || []).forEach((p: any) => {
      const shop = shopMap.get(p.shop_id) as any;
      feed.push({ id: `p-${p.id}`, type: "payment", label: shop?.name || "Pagamento", sub: `Pagou ${fmtMoney(Number(p.amount || 0))}`, at: p.paid_at });
    });
    feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    setActivity(feed.slice(0, 10));

    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  // Initial load
  useEffect(() => { void load(true); }, [load]);

  // Auto-refresh: realtime + polling + visibility
  useEffect(() => {
    if (!autoRefresh) return;

    const debouncedReload = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => void load(true), 1500);
    };

    const channel = supabase
      .channel("commercial-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, debouncedReload)
      .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, debouncedReload)
      .subscribe();

    const poll = window.setInterval(() => void load(true), 20000);
    const onFocus = () => void load(true);
    window.addEventListener("focus", onFocus);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(poll);
      window.removeEventListener("focus", onFocus);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [autoRefresh, load]);

  const pieData = useMemo(() => planSeries, [planSeries]);

  if (loading) return <div className="text-sm text-muted-foreground">A carregar métricas em tempo real…</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            Dashboard Executivo
            {autoRefresh && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> AO VIVO
            </span>}
          </h2>
          <p className="text-sm text-muted-foreground">
            Atualizado {fmtRel(lastUpdated.toISOString())} · sincroniza automaticamente com a plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAutoRefresh((v) => !v)}>
            <Activity className="w-3.5 h-3.5 mr-1.5" /> {autoRefresh ? "Pausar" : "Retomar"} live
          </Button>
          <Button variant="outline" size="sm" onClick={() => void load(false)} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className={`w-4 h-4 ${k.tone === "good" ? "text-green-500" : k.tone === "bad" ? "text-red-500" : "text-primary"}`} />
              </div>
              <div className="text-xl font-bold">{k.value}</div>
              {typeof k.trend === "number" && (
                <div className={`flex items-center gap-1 text-[11px] mt-1 ${k.trend >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {k.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(k.trend).toFixed(1)}% vs mês anterior
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Crescimento Acumulado (12m)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={growthSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="cumulative" stroke="hsl(var(--primary))" strokeWidth={2} name="Oficinas (acumulado)" />
                <Line type="monotone" dataKey="shops" stroke="#10b981" name="Novas no mês" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Plano</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={pieData} dataKey="count" nameKey="plan" cx="50%" cy="50%" outerRadius={80} label={(e: any) => e.plan}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-base">Evolução de Receita (12m)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={growthSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Bottom panels: activity, top shops, at-risk */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="w-4 h-4" /> Atividade ao Vivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 max-h-96 overflow-y-auto">
            {activity.length === 0 && <p className="text-xs text-muted-foreground">Sem atividade recente.</p>}
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg hover:bg-accent/40 transition-colors">
                <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${a.type === "payment" ? "bg-green-500" : a.type === "shop" ? "bg-blue-500" : "bg-red-500"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.sub} · {fmtRel(a.at)}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-amber-500" /> Top Oficinas</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {topShops.length === 0 && <p className="text-xs text-muted-foreground">Sem dados de receita ainda.</p>}
            {topShops.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-accent/40 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-500/20 text-amber-500" : "bg-muted text-muted-foreground"}`}>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    {s.plan && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{s.plan}</Badge>}
                  </div>
                </div>
                <span className="text-sm font-semibold flex-shrink-0">{fmtMoney(s.revenue)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-500" /> Em Risco</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {atRisk.length === 0 && <p className="text-xs text-muted-foreground">Nenhuma oficina em risco. 🎉</p>}
            {atRisk.map((s) => (
              <div key={`${s.id}-${s.reason}`} className="flex items-center justify-between p-2 rounded-lg border border-red-500/20 bg-red-500/5">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-red-500">{s.reason} · {s.days}d</p>
                </div>
                <Link to="/commercial/retention" className="text-xs text-primary hover:underline flex-shrink-0">Agir →</Link>
              </div>
            ))}
            {atRisk.length > 0 && (
              <Link to="/commercial/retention" className="block text-center text-xs text-primary hover:underline pt-2">
                Ver todas no Centro de Retenção →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
