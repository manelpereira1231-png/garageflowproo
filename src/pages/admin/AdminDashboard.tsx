import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Wrench, AlertTriangle, TrendingUp, DollarSign, Download, Car, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { useNavigate } from "react-router-dom";

interface AdminStats {
  totalShops: number;
  activeShops: number;
  suspendedShops: number;
  totalClients: number;
  totalVehicles: number;
  totalWorkOrders: number;
  totalQuotes: number;
  totalAlerts: number;
  totalRevenue: number;
  avgTicket: number;
  pendingAlerts: number;
  openQuotes: number;
  approvedQuotes: number;
  newShopsThisMonth: number;
  planBreakdown: { free: number; pro: number; garage: number };
  monthlyRevenue: { month: string; revenue: number }[];
  monthlyNewShops: { month: string; shops: number }[];
  topShops: { name: string; clients: number }[];
}

const PLAN_COLORS = ["hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--success))"];

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStats = async () => {
      const [shops, clients, vehicles, workOrders, alerts, subscriptions, quotes] = await Promise.all([
        supabase.from("shops").select("id, name, status, created_at"),
        supabase.from("clients").select("id, shop_id"),
        supabase.from("vehicles").select("id"),
        supabase.from("work_orders").select("id, total, status, created_at"),
        supabase.from("alerts").select("id, status"),
        supabase.from("subscriptions").select("plan, status"),
        supabase.from("quotes").select("id, status"),
      ]);

      const completedOrders = (workOrders.data || []).filter(wo => wo.status === 'completed' || wo.status === 'delivered');
      const totalRevenue = completedOrders.reduce((sum, wo) => sum + Number(wo.total || 0), 0);
      const avgTicket = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      const planBreakdown = { free: 0, pro: 0, garage: 0 };
      (subscriptions.data || []).forEach(s => {
        if (s.plan === 'free') planBreakdown.free++;
        else if (s.plan === 'pro') planBreakdown.pro++;
        else if (s.plan === 'garage') planBreakdown.garage++;
      });

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const newShopsThisMonth = (shops.data || []).filter(s => new Date(s.created_at) >= thisMonthStart).length;

      // Monthly revenue & new shops (last 6 months)
      const monthlyRevenue: { month: string; revenue: number }[] = [];
      const monthlyNewShops: { month: string; shops: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
        const revenue = (workOrders.data || [])
          .filter(wo => {
            const woDate = new Date(wo.created_at);
            return woDate.getMonth() === d.getMonth() && woDate.getFullYear() === d.getFullYear()
              && (wo.status === "completed" || wo.status === "delivered");
          })
          .reduce((sum, wo) => sum + Number(wo.total || 0), 0);
        monthlyRevenue.push({ month: monthStr, revenue: Math.round(revenue * 100) / 100 });

        const newShops = (shops.data || []).filter(s => {
          const sd = new Date(s.created_at);
          return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        }).length;
        monthlyNewShops.push({ month: monthStr, shops: newShops });
      }

      // Top shops by clients
      const shopClientCount = new Map<string, number>();
      (clients.data || []).forEach(c => {
        shopClientCount.set(c.shop_id, (shopClientCount.get(c.shop_id) || 0) + 1);
      });
      const topShops = (shops.data || [])
        .map(s => ({ name: s.name || "Sem nome", clients: shopClientCount.get(s.id) || 0 }))
        .sort((a, b) => b.clients - a.clients)
        .slice(0, 5);

      const openQuotes = (quotes.data || []).filter(q => q.status === 'draft' || q.status === 'sent').length;
      const approvedQuotes = (quotes.data || []).filter(q => q.status === 'approved').length;
      const pendingAlerts = (alerts.data || []).filter(a => a.status === 'pending').length;

      setStats({
        totalShops: shops.data?.length || 0,
        activeShops: (shops.data || []).filter(s => s.status === 'active').length,
        suspendedShops: (shops.data || []).filter(s => s.status === 'suspended').length,
        totalClients: clients.data?.length || 0,
        totalVehicles: vehicles.data?.length || 0,
        totalWorkOrders: workOrders.data?.length || 0,
        totalQuotes: quotes.data?.length || 0,
        totalAlerts: alerts.data?.length || 0,
        totalRevenue, avgTicket,
        pendingAlerts, openQuotes, approvedQuotes,
        newShopsThisMonth,
        planBreakdown, monthlyRevenue, monthlyNewShops, topShops,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  const exportGlobalCSV = () => {
    if (!stats) return;
    const lines = [
      "Métrica;Valor",
      `Oficinas Totais;${stats.totalShops}`,
      `Oficinas Ativas;${stats.activeShops}`,
      `Oficinas Suspensas;${stats.suspendedShops}`,
      `Novas Este Mês;${stats.newShopsThisMonth}`,
      `Clientes Totais;${stats.totalClients}`,
      `Veículos Totais;${stats.totalVehicles}`,
      `Ordens de Serviço;${stats.totalWorkOrders}`,
      `Orçamentos Totais;${stats.totalQuotes}`,
      `Alertas Totais;${stats.totalAlerts}`,
      `Faturação Total;€${stats.totalRevenue.toFixed(2)}`,
      `Ticket Médio;€${stats.avgTicket.toFixed(2)}`,
      `Alertas Pendentes;${stats.pendingAlerts}`,
      `Plano Free;${stats.planBreakdown.free}`,
      `Plano Pro;${stats.planBreakdown.pro}`,
      `Plano Garage;${stats.planBreakdown.garage}`,
    ];
    const csv = lines.join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_global_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpiCards = [
    { label: "Oficinas Totais", value: stats.totalShops, icon: Building2, color: "text-primary" },
    { label: "Oficinas Ativas", value: stats.activeShops, icon: Building2, color: "text-success" },
    { label: "Suspensas", value: stats.suspendedShops, icon: Building2, color: "text-destructive" },
    { label: "Novas Este Mês", value: stats.newShopsThisMonth, icon: TrendingUp, color: "text-info" },
    { label: "Clientes Totais", value: stats.totalClients, icon: Users, color: "text-primary" },
    { label: "Veículos Totais", value: stats.totalVehicles, icon: Car, color: "text-primary" },
    { label: "Ordens de Serviço", value: stats.totalWorkOrders, icon: Wrench, color: "text-primary" },
    { label: "Orçamentos Totais", value: stats.totalQuotes, icon: FileText, color: "text-primary" },
    { label: "Faturação Total", value: `€${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-success" },
    { label: "Ticket Médio", value: `€${stats.avgTicket.toFixed(2)}`, icon: TrendingUp, color: "text-primary" },
    { label: "Alertas Pendentes", value: stats.pendingAlerts, icon: AlertTriangle, color: "text-warning" },
    { label: "Alertas Totais", value: stats.totalAlerts, icon: AlertTriangle, color: "text-muted-foreground" },
  ];

  const planPieData = [
    { name: "Free", value: stats.planBreakdown.free },
    { name: "Pro", value: stats.planBreakdown.pro },
    { name: "Garage", value: stats.planBreakdown.garage },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Dashboard Admin</h1>
          <p className="text-sm text-muted-foreground">Visão global do sistema GarageFlow</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportGlobalCSV} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {kpiCards.map((kpi) => (
          <div key={kpi.label} className="stat-card flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold mono">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Line Chart */}
        <div className="stat-card lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Faturação Mensal</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number) => [`€${value.toFixed(2)}`, "Faturação"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution Pie */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Distribuição de Planos</h2>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {planPieData.map((_, index) => (
                    <Cell key={index} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Growth chart */}
      <div className="stat-card">
        <h2 className="text-lg font-semibold mb-4">Crescimento - Novas Oficinas/Mês</h2>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.monthlyNewShops}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" className="text-xs" />
              <YAxis className="text-xs" allowDecimals={false} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Bar dataKey="shops" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Novas Oficinas" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top shops histogram */}
      {stats.topShops.length > 0 && (
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Oficinas com Mais Clientes</h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topShops}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="clients" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
