import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Wrench, AlertTriangle, TrendingUp, DollarSign } from "lucide-react";

interface AdminStats {
  totalShops: number;
  activeShops: number;
  totalClients: number;
  totalWorkOrders: number;
  totalRevenue: number;
  pendingAlerts: number;
  planBreakdown: { free: number; pro: number; garage: number };
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats>({
    totalShops: 0, activeShops: 0, totalClients: 0, totalWorkOrders: 0,
    totalRevenue: 0, pendingAlerts: 0, planBreakdown: { free: 0, pro: 0, garage: 0 },
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      const [shops, clients, workOrders, alerts, subscriptions] = await Promise.all([
        supabase.from("shops").select("id, status"),
        supabase.from("clients").select("id"),
        supabase.from("work_orders").select("id, total, status"),
        supabase.from("alerts").select("id, status").eq("status", "pending"),
        supabase.from("subscriptions").select("plan, status"),
      ]);

      const totalRevenue = (workOrders.data || [])
        .filter(wo => wo.status === 'completed' || wo.status === 'delivered')
        .reduce((sum, wo) => sum + Number(wo.total || 0), 0);

      const planBreakdown = { free: 0, pro: 0, garage: 0 };
      (subscriptions.data || []).forEach(s => {
        if (s.plan === 'free') planBreakdown.free++;
        else if (s.plan === 'pro') planBreakdown.pro++;
        else if (s.plan === 'garage') planBreakdown.garage++;
      });

      setStats({
        totalShops: shops.data?.length || 0,
        activeShops: (shops.data || []).filter(s => s.status === 'active').length,
        totalClients: clients.data?.length || 0,
        totalWorkOrders: workOrders.data?.length || 0,
        totalRevenue,
        pendingAlerts: alerts.data?.length || 0,
        planBreakdown,
      });
      setLoading(false);
    };
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpiCards = [
    { label: "Oficinas Totais", value: stats.totalShops, icon: Building2, color: "text-primary" },
    { label: "Oficinas Ativas", value: stats.activeShops, icon: Building2, color: "text-success" },
    { label: "Clientes Totais", value: stats.totalClients, icon: Users, color: "text-info" },
    { label: "Ordens de Serviço", value: stats.totalWorkOrders, icon: Wrench, color: "text-primary" },
    { label: "Faturação Total", value: `€${stats.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-success" },
    { label: "Alertas Pendentes", value: stats.pendingAlerts, icon: AlertTriangle, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard Admin</h1>
        <p className="text-sm text-muted-foreground">Visão global do sistema GarageFlow</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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

      {/* Plan Breakdown */}
      <div className="stat-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Distribuição de Planos
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 rounded-lg bg-muted/50">
            <p className="text-2xl font-bold mono text-muted-foreground">{stats.planBreakdown.free}</p>
            <p className="text-sm text-muted-foreground mt-1">Free</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-primary/10">
            <p className="text-2xl font-bold mono text-primary">{stats.planBreakdown.pro}</p>
            <p className="text-sm text-muted-foreground mt-1">Pro</p>
          </div>
          <div className="text-center p-4 rounded-lg bg-success/10">
            <p className="text-2xl font-bold mono text-success">{stats.planBreakdown.garage}</p>
            <p className="text-sm text-muted-foreground mt-1">Garage</p>
          </div>
        </div>
      </div>
    </div>
  );
}
