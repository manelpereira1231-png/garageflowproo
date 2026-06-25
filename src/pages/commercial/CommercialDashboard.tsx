import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, TrendingUp, Users, DollarSign, AlertTriangle, CheckCircle2 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type KPI = { label: string; value: string; icon: any; hint?: string };

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v || 0);

export default function CommercialDashboard() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [growthSeries, setGrowthSeries] = useState<{ month: string; shops: number; revenue: number }[]>([]);
  const [planSeries, setPlanSeries] = useState<{ plan: string; count: number }[]>([]);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const todayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const yearStart = new Date(now.getFullYear(), 0, 1).toISOString();
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const last30 = new Date(now.getTime() - 30 * 86400000).toISOString();

      const [shopsRes, subsRes, paymentsAllRes, paymentsMonthRes, paymentsYearRes, paymentsPrevMonthRes, newTodayRes, newWeekRes, newMonthRes, activeRes, cancelledRes] = await Promise.all([
        supabase.from("shops").select("id, created_at, status", { count: "exact", head: false }),
        supabase.from("subscriptions").select("plan, status, shop_id"),
        supabase.from("payments").select("amount, paid_at"),
        supabase.from("payments").select("amount").gte("paid_at", monthStart),
        supabase.from("payments").select("amount").gte("paid_at", yearStart),
        supabase.from("payments").select("amount").gte("paid_at", prevMonthStart).lt("paid_at", monthStart),
        supabase.from("shops").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
        supabase.from("shops").select("id", { count: "exact", head: true }).gte("created_at", weekAgo),
        supabase.from("shops").select("id", { count: "exact", head: true }).gte("created_at", monthStart),
        supabase.from("shops").select("id", { count: "exact", head: true }).gte("last_seen_at", last30),
        supabase.from("subscriptions").select("id", { count: "exact", head: true }).eq("status", "canceled"),
      ]);

      const totalShops = shopsRes.count ?? (shopsRes.data?.length ?? 0);
      const subs = subsRes.data || [];
      const paying = subs.filter((s: any) => s.status === "active").length;
      const trial = subs.filter((s: any) => s.status === "trialing").length;
      const cancelled = cancelledRes.count ?? 0;
      const inactiveShops = Math.max(0, totalShops - (activeRes.count ?? 0));

      const totalRevenue = (paymentsAllRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const monthRevenue = (paymentsMonthRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const yearRevenue = (paymentsYearRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
      const prevMonthRevenue = (paymentsPrevMonthRes.data || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0);

      const monthGrowth = prevMonthRevenue > 0 ? ((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 : 0;
      const retention = totalShops > 0 ? ((totalShops - cancelled) / totalShops) * 100 : 100;
      const churn = totalShops > 0 ? (cancelled / totalShops) * 100 : 0;
      const arpu = paying > 0 ? totalRevenue / paying : 0;

      setKpis([
        { label: "Oficinas Registadas", value: String(totalShops), icon: Building2 },
        { label: "Oficinas Ativas (30d)", value: String(activeRes.count ?? 0), icon: CheckCircle2 },
        { label: "Oficinas Inativas", value: String(inactiveShops), icon: AlertTriangle },
        { label: "Novas Hoje", value: String(newTodayRes.count ?? 0), icon: TrendingUp },
        { label: "Novas Esta Semana", value: String(newWeekRes.count ?? 0), icon: TrendingUp },
        { label: "Novas Este Mês", value: String(newMonthRes.count ?? 0), icon: TrendingUp },
        { label: "Pagantes", value: String(paying), icon: DollarSign },
        { label: "Em Teste", value: String(trial), icon: Users },
        { label: "Canceladas", value: String(cancelled), icon: AlertTriangle },
        { label: "Receita Total", value: fmtMoney(totalRevenue), icon: DollarSign },
        { label: "Receita Mensal", value: fmtMoney(monthRevenue), icon: DollarSign },
        { label: "Receita Anual", value: fmtMoney(yearRevenue), icon: DollarSign },
        { label: "Crescimento Mensal", value: `${monthGrowth.toFixed(1)}%`, icon: TrendingUp },
        { label: "Taxa de Retenção", value: `${retention.toFixed(1)}%`, icon: CheckCircle2 },
        { label: "Taxa de Cancelamento", value: `${churn.toFixed(1)}%`, icon: AlertTriangle },
        { label: "ARPU (Receita/Oficina)", value: fmtMoney(arpu), icon: DollarSign },
      ]);

      // Growth series — last 12 months
      const months: { key: string; month: string; shops: number; revenue: number }[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
        months.push({ key, month: label, shops: 0, revenue: 0 });
      }
      (shopsRes.data || []).forEach((s: any) => {
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
      setGrowthSeries(months.map(({ month, shops, revenue }) => ({ month, shops, revenue })));

      // Plans distribution
      const planCounts: Record<string, number> = {};
      subs.forEach((s: any) => {
        const k = s.plan || "free";
        planCounts[k] = (planCounts[k] || 0) + 1;
      });
      setPlanSeries(Object.entries(planCounts).map(([plan, count]) => ({ plan, count })));

      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">A carregar métricas reais…</div>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard Executivo</h2>
        <p className="text-sm text-muted-foreground">Indicadores em tempo real, calculados a partir da base de dados da plataforma.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">{k.label}</span>
                <k.icon className="w-4 h-4 text-primary" />
              </div>
              <div className="text-xl font-bold">{k.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Crescimento de Oficinas (12 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={growthSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="shops" stroke="hsl(var(--primary))" name="Oficinas" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Evolução de Receita (12 meses)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={growthSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip formatter={(v: any) => fmtMoney(Number(v))} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" name="Receita" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Distribuição por Plano</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={planSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="plan" fontSize={11} />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" name="Oficinas" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
