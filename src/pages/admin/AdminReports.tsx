import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend
} from "recharts";
import {
  TrendingUp, DollarSign, Users, ArrowDownRight, Building2, FileText,
  CreditCard, ShieldCheck, Calendar, RefreshCw, Download, Activity
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlansCatalog } from "@/hooks/usePlansCatalog";

// Fonte única de verdade: preços, planos e ordem lidos do catálogo dinâmico.
// Nunca hardcoded — se o admin criar/renomear um plano em /admin/plans,
// este relatório reflete a alteração automaticamente.
const CHART_PALETTE = [
  "hsl(var(--muted-foreground))",
  "hsl(var(--primary))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];
const STATUS_COLORS: Record<string, string> = {
  active: "hsl(var(--chart-3))",
  trialing: "hsl(var(--primary))",
  cancelled: "hsl(var(--destructive))",
  canceled: "hsl(var(--destructive))",
  expired: "hsl(var(--muted-foreground))",
};
const STATUS_COLORS: Record<string, string> = {
  active: "hsl(var(--chart-3))",
  trialing: "hsl(var(--primary))",
  cancelled: "hsl(var(--destructive))",
  canceled: "hsl(var(--destructive))",
  expired: "hsl(var(--muted-foreground))",
};

interface ReportData {
  // Revenue
  monthlyRevenue: { month: string; revenue: number; invoices: number }[];
  totalRevenue: number;
  avgTicket: number;
  // Subscriptions
  planDistribution: { name: string; value: number; color: string }[];
  statusDistribution: { name: string; value: number; color: string }[];
  mrrReal: number;
  arrReal: number;
  discountImpact: number;
  // Growth
  registrationsByMonth: { month: string; shops: number }[];
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  // Conversion
  funnel: { stage: string; count: number; percent: number }[];
  churnRate: number;
  trialConversion: number;
  // Trials
  trialRecords: number;
  blockedTrials: number;
  // Activity
  totalClients: number;
  totalVehicles: number;
  totalQuotes: number;
  totalInvoices: number;
  totalWorkOrders: number;
  // Top shops
  topShops: { name: string; revenue: number; orders: number }[];
}

export default function AdminReports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("6");
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    const months = parseInt(period);
    const [shopsRes, subsRes, woRes, invRes, clientsRes, vehiclesRes, quotesRes, trialRes] = await Promise.all([
      supabase.from("shops").select("id, name, status, created_at"),
      supabase.from("subscriptions").select("plan, status, trial_end, created_at, discount_percent, discount_expires_at, revenue_type, stripe_subscription_id"),
      supabase.from("work_orders").select("total, status, created_at, shop_id"),
      supabase.from("invoices").select("total, status, created_at, shop_id"),
      supabase.from("clients").select("id", { count: "exact", head: true }),
      supabase.from("vehicles").select("id", { count: "exact", head: true }),
      supabase.from("quotes").select("id, status", { count: "exact" }),
      supabase.from("trial_records").select("id, email, created_at"),
    ]);

    const shops = shopsRes.data || [];
    const subscriptions = subsRes.data || [];
    const workOrders = (woRes.data || []) as any[];
    const invoices = invRes.data || [];
    const quotes = quotesRes.data || [];
    const trials = trialRes.data || [];
    const now = new Date();

    // === MONTHLY REVENUE (work orders + invoices) ===
    const monthlyRevenue: { month: string; revenue: number; invoices: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
      const matchMonth = (dateStr: string) => {
        const dt = new Date(dateStr);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      };
      const woRev = workOrders
        .filter(wo => matchMonth(wo.created_at) && (wo.status === "completed" || wo.status === "delivered"))
        .reduce((sum, wo) => sum + Number(wo.total || 0), 0);
      const invRev = invoices
        .filter(inv => matchMonth(inv.created_at) && inv.status === "paid")
        .reduce((sum, inv) => sum + Number(inv.total || 0), 0);
      const invCount = invoices.filter(inv => matchMonth(inv.created_at)).length;
      monthlyRevenue.push({ month: monthStr, revenue: Math.round((woRev + invRev) * 100) / 100, invoices: invCount });
    }

    const completedOrders = workOrders.filter(wo => wo.status === "completed" || wo.status === "delivered");
    const totalRevenue = completedOrders.reduce((sum, wo) => sum + Number(wo.total || 0), 0);
    const avgTicket = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // === MRR/ARR — APENAS STRIPE PAID (receita real) ===
    const activeSubs = subscriptions.filter(s => s.status === "active" || s.status === "trialing");
    const stripePaidSubs = activeSubs.filter(s => 
      s.revenue_type === 'stripe_paid' || ((s as any).stripe_subscription_id && s.plan !== 'free')
    );
    let mrrReal = 0;
    let discountImpact = 0;
    stripePaidSubs.forEach(s => {
      const base = PLAN_PRICES[s.plan] || 0;
      const disc = Number(s.discount_percent || 0);
      const expired = s.discount_expires_at && new Date(s.discount_expires_at) < now;
      const effectiveDisc = expired ? 0 : disc;
      const discounted = base * (effectiveDisc / 100);
      mrrReal += base - discounted;
      discountImpact += discounted;
    });

    // === PLAN DISTRIBUTION ===
    const planCounts: Record<string, number> = { Free: 0, Pro: 0, Garage: 0 };
    subscriptions.forEach(s => {
      if (s.plan === "free") planCounts.Free++;
      else if (s.plan === "pro") planCounts.Pro++;
      else if (s.plan === "garage") planCounts.Garage++;
    });
    const planDistribution = Object.entries(planCounts).map(([name, value], i) => ({
      name, value, color: PLAN_COLORS[i]
    }));

    // === STATUS DISTRIBUTION ===
    const statusCounts: Record<string, number> = {};
    subscriptions.forEach(s => {
      const st = s.status || "unknown";
      statusCounts[st] = (statusCounts[st] || 0) + 1;
    });
    const statusDistribution = Object.entries(statusCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: STATUS_COLORS[name] || "hsl(var(--muted-foreground))"
    }));

    // === REGISTRATION GROWTH ===
    const registrationsByMonth: { month: string; shops: number }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
      const count = shops.filter(s => {
        const dt = new Date(s.created_at);
        return dt.getMonth() === d.getMonth() && dt.getFullYear() === d.getFullYear();
      }).length;
      registrationsByMonth.push({ month: monthStr, shops: count });
    }

    // === FUNNEL ===
    const totalAccounts = shops.length;
    const freeSubs = subscriptions.filter(s => s.plan === "free").length;
    const trialingSubs = subscriptions.filter(s => s.status === "trialing").length;
    const paidSubs = stripePaidSubs.filter(s => s.status === "active").length;
    const cancelledSubs = subscriptions.filter(s => s.status === "cancelled" || s.status === "canceled").length;
    const funnelMax = Math.max(totalAccounts, 1);
    const funnel = [
      { stage: "Contas Criadas", count: totalAccounts, percent: 100 },
      { stage: "Start", count: freeSubs, percent: Math.round((freeSubs / funnelMax) * 100) },
      { stage: "Trial", count: trialingSubs, percent: Math.round((trialingSubs / funnelMax) * 100) },
      { stage: "Pago", count: paidSubs, percent: Math.round((paidSubs / funnelMax) * 100) },
      { stage: "Cancelado", count: cancelledSubs, percent: Math.round((cancelledSubs / funnelMax) * 100) },
    ];

    // === CHURN & CONVERSION ===
    const churnRate = subscriptions.length > 0 ? (cancelledSubs / subscriptions.length) * 100 : 0;
    const hadTrial = subscriptions.filter(s => s.trial_end).length;
    const convertedFromTrial = subscriptions.filter(s => s.trial_end && (s.plan === "pro" || s.plan === "garage") && s.status === "active").length;
    const trialConversion = hadTrial > 0 ? (convertedFromTrial / hadTrial) * 100 : 0;

    // === TOP SHOPS BY REVENUE ===
    const shopRevMap: Record<string, { name: string; revenue: number; orders: number }> = {};
    shops.forEach(s => { shopRevMap[s.id] = { name: s.name || "Sem nome", revenue: 0, orders: 0 }; });
    completedOrders.forEach(wo => {
      if (shopRevMap[wo.shop_id]) {
        shopRevMap[wo.shop_id].revenue += Number(wo.total || 0);
        shopRevMap[wo.shop_id].orders++;
      }
    });
    const topShops = Object.values(shopRevMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    setData({
      monthlyRevenue, totalRevenue, avgTicket,
      planDistribution, statusDistribution, mrrReal, arrReal: mrrReal * 12, discountImpact,
      registrationsByMonth, totalShops: shops.length,
      activeShops: shops.filter(s => s.status === "active").length,
      suspendedShops: shops.filter(s => s.status === "suspended").length,
      funnel, churnRate, trialConversion,
      trialRecords: trials.length, blockedTrials: 0,
      totalClients: clientsRes.count || 0,
      totalVehicles: vehiclesRes.count || 0,
      totalQuotes: quotes.length,
      totalInvoices: invoices.length,
      totalWorkOrders: workOrders.length,
      topShops,
    });
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [period]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: "MRR Real", value: `€${data.mrrReal.toFixed(0)}`, sub: `ARR: €${data.arrReal.toFixed(0)}`, icon: DollarSign, color: "text-chart-3" },
    { label: "Impacto Descontos", value: `-€${data.discountImpact.toFixed(0)}/mês`, sub: `Apenas Stripe pagantes`, icon: CreditCard, color: "text-destructive" },
    { label: "Oficinas Ativas", value: data.activeShops.toString(), sub: `${data.suspendedShops} suspensas`, icon: Building2, color: "text-primary" },
    { label: "Taxa de Cancelamento", value: `${data.churnRate.toFixed(1)}%`, sub: `Conv. Trial: ${data.trialConversion.toFixed(1)}%`, icon: ArrowDownRight, color: "text-destructive" },
    { label: "Ticket Médio", value: `€${data.avgTicket.toFixed(2)}`, sub: `${data.totalWorkOrders} ordens`, icon: TrendingUp, color: "text-primary" },
    { label: "Faturação Total", value: `€${data.totalRevenue.toFixed(0)}`, sub: "ordens concluídas", icon: FileText, color: "text-chart-3" },
  ];

  const activityKpis = [
    { label: "Clientes", value: data.totalClients, icon: Users },
    { label: "Veículos", value: data.totalVehicles, icon: Activity },
    { label: "Orçamentos", value: data.totalQuotes, icon: FileText },
    { label: "Faturas", value: data.totalInvoices, icon: CreditCard },
    { label: "Trials Registados", value: data.trialRecords, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Relatórios Avançados</h1>
          <p className="text-sm text-muted-foreground">Métricas reais do SaaS • Dados em tempo real</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className="stat-card">
            <div className="flex items-center gap-2 mb-1">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-lg font-bold mono">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="revenue" className="space-y-4">
        <TabsList>
          <TabsTrigger value="revenue">Faturação</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscrições</TabsTrigger>
          <TabsTrigger value="growth">Crescimento</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="activity">Atividade</TabsTrigger>
        </TabsList>

        {/* REVENUE TAB */}
        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="stat-card lg:col-span-2">
              <h2 className="text-sm font-semibold mb-3">Faturação Mensal (Ordens de Serviço + Faturas Pagas)</h2>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }}
                      formatter={(value: number, name: string) => [
                        name === "revenue" ? `€${value.toFixed(2)}` : value,
                        name === "revenue" ? "Faturação" : "Faturas"
                      ]}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="invoices" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="stat-card">
              <h2 className="text-sm font-semibold mb-3">Top 10 Oficinas por Receita</h2>
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {data.topShops.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
                {data.topShops.map((shop, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-border/50">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] shrink-0">#{i + 1}</Badge>
                      <span className="truncate">{shop.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-medium">€{shop.revenue.toFixed(0)}</span>
                      <span className="text-muted-foreground ml-1">({shop.orders})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* SUBSCRIPTIONS TAB */}
        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="stat-card">
              <h2 className="text-sm font-semibold mb-3">Distribuição de Planos</h2>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.planDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {data.planDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="stat-card">
              <h2 className="text-sm font-semibold mb-3">Estado das Subscrições</h2>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={data.statusDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {data.statusDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="stat-card text-center">
              <p className="text-xs text-muted-foreground">MRR (Stripe)</p>
              <p className="text-xl font-bold mono text-chart-3">€{data.mrrReal.toFixed(0)}</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs text-muted-foreground">ARR (Stripe)</p>
              <p className="text-xl font-bold mono text-chart-3">€{data.arrReal.toFixed(0)}</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs text-muted-foreground">Impacto Descontos</p>
              <p className="text-xl font-bold mono text-destructive">-€{data.discountImpact.toFixed(0)}/mês</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs text-muted-foreground">Conversão Trial</p>
              <p className="text-xl font-bold mono">{data.trialConversion.toFixed(1)}%</p>
            </div>
          </div>
        </TabsContent>

        {/* GROWTH TAB */}
        <TabsContent value="growth" className="space-y-4">
          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3">Registos de Oficinas por Mês</h2>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.registrationsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: 12 }} />
                  <Area type="monotone" dataKey="shops" fill="hsl(var(--primary)/0.2)" stroke="hsl(var(--primary))" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        {/* FUNNEL TAB */}
        <TabsContent value="funnel" className="space-y-4">
          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3">Funil de Conversão</h2>
            <div className="space-y-3">
              {data.funnel.map((stage, i) => (
                <div key={stage.stage}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium">{stage.stage}</span>
                    <span className="mono text-muted-foreground">{stage.count} ({stage.percent}%)</span>
                  </div>
                  <div className="h-8 bg-muted rounded-lg overflow-hidden">
                    <div
                      className="h-full rounded-lg transition-all duration-700 flex items-center justify-center text-xs font-medium"
                      style={{
                        width: `${Math.max(stage.percent, 2)}%`,
                        backgroundColor: i === 0 ? "hsl(var(--primary))" : i === 3 ? "hsl(var(--chart-3))" : i === 4 ? "hsl(var(--destructive))" : "hsl(var(--primary)/0.6)",
                      }}
                    >
                      {stage.percent > 10 && `${stage.percent}%`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="stat-card text-center">
              <p className="text-xs text-muted-foreground">Taxa de Cancelamento</p>
              <p className="text-xl font-bold mono text-destructive">{data.churnRate.toFixed(1)}%</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs text-muted-foreground">Trial → Pago</p>
              <p className="text-xl font-bold mono text-chart-3">{data.trialConversion.toFixed(1)}%</p>
            </div>
            <div className="stat-card text-center">
              <p className="text-xs text-muted-foreground">Trials Registados</p>
              <p className="text-xl font-bold mono">{data.trialRecords}</p>
            </div>
          </div>
        </TabsContent>

        {/* ACTIVITY TAB */}
        <TabsContent value="activity" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {activityKpis.map(kpi => (
              <div key={kpi.label} className="stat-card text-center">
                <kpi.icon className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-2xl font-bold mono">{kpi.value.toLocaleString("pt-PT")}</p>
              </div>
            ))}
          </div>
          <div className="stat-card">
            <h2 className="text-sm font-semibold mb-3">Resumo da Plataforma</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Oficinas</p>
                <p className="font-bold text-lg">{data.totalShops}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ativas</p>
                <p className="font-bold text-lg text-chart-3">{data.activeShops}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Suspensas</p>
                <p className="font-bold text-lg text-destructive">{data.suspendedShops}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ordens de Serviço</p>
                <p className="font-bold text-lg">{data.totalWorkOrders}</p>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
