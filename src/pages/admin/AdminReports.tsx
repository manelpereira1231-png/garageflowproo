import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, DollarSign, Users, ArrowDownRight } from "lucide-react";

interface ReportData {
  monthlyRevenue: { month: string; revenue: number }[];
  planDistribution: { name: string; value: number }[];
  totalRevenue: number;
  avgTicket: number;
  churnRate: number;
  trialConversion: number;
}

const PLAN_COLORS = ["hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--success))"];

export default function AdminReports() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [woRes, subsRes] = await Promise.all([
        supabase.from("work_orders").select("total, status, created_at"),
        supabase.from("subscriptions").select("plan, status, trial_end, created_at"),
      ]);

      const workOrders = woRes.data || [];
      const subscriptions = subsRes.data || [];

      // Monthly revenue (last 6 months)
      const now = new Date();
      const monthlyRevenue: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = d.toLocaleDateString("pt-PT", { month: "short", year: "2-digit" });
        const revenue = workOrders
          .filter(wo => {
            const woDate = new Date(wo.created_at);
            return woDate.getMonth() === d.getMonth() && woDate.getFullYear() === d.getFullYear()
              && (wo.status === "completed" || wo.status === "delivered");
          })
          .reduce((sum, wo) => sum + Number(wo.total || 0), 0);
        monthlyRevenue.push({ month: monthStr, revenue: Math.round(revenue * 100) / 100 });
      }

      // Plan distribution
      const planCounts = { Free: 0, Pro: 0, Garage: 0 };
      subscriptions.forEach(s => {
        if (s.plan === "free") planCounts.Free++;
        else if (s.plan === "pro") planCounts.Pro++;
        else if (s.plan === "garage") planCounts.Garage++;
      });
      const planDistribution = Object.entries(planCounts).map(([name, value]) => ({ name, value }));

      // KPIs
      const completedOrders = workOrders.filter(wo => wo.status === "completed" || wo.status === "delivered");
      const totalRevenue = completedOrders.reduce((sum, wo) => sum + Number(wo.total || 0), 0);
      const avgTicket = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      // Churn: cancelled / total
      const cancelled = subscriptions.filter(s => s.status === "cancelled" || s.status === "canceled").length;
      const churnRate = subscriptions.length > 0 ? (cancelled / subscriptions.length) * 100 : 0;

      // Trial → Pro conversion
      const hadTrial = subscriptions.filter(s => s.trial_end).length;
      const convertedFromTrial = subscriptions.filter(s => s.trial_end && (s.plan === "pro" || s.plan === "garage")).length;
      const trialConversion = hadTrial > 0 ? (convertedFromTrial / hadTrial) * 100 : 0;

      setData({ monthlyRevenue, planDistribution, totalRevenue, avgTicket, churnRate, trialConversion });
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: "Faturação Total", value: `€${data.totalRevenue.toFixed(2)}`, icon: DollarSign, color: "text-success" },
    { label: "Ticket Médio", value: `€${data.avgTicket.toFixed(2)}`, icon: TrendingUp, color: "text-primary" },
    { label: "Churn Rate", value: `${data.churnRate.toFixed(1)}%`, icon: ArrowDownRight, color: "text-destructive" },
    { label: "Conversão Trial→PRO", value: `${data.trialConversion.toFixed(1)}%`, icon: Users, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Métricas globais e análise de performance</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
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
        {/* Revenue Chart */}
        <div className="stat-card lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Faturação Mensal</h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number) => [`€${value.toFixed(2)}`, "Faturação"]}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Distribuição de Planos</h2>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.planDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {data.planDistribution.map((_, index) => (
                    <Cell key={index} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
