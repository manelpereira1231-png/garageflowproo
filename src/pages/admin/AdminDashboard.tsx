import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Building2, Users, Wrench, AlertTriangle, TrendingUp, DollarSign, Download, Car, FileText, Clock, ArrowRight, Zap, CalendarDays, Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from "recharts";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

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
  newShopsThisWeek: number;
  newShopsToday: number;
  planBreakdown: { free: number; pro: number; garage: number };
  monthlyRevenue: { month: string; revenue: number }[];
  monthlyNewShops: { month: string; shops: number }[];
  topShops: { name: string; clients: number; id: string }[];
  mrr: number;
  mrrWithDiscounts: number;
  arr: number;
  arpu: number;
  ltv: number;
  churnRate: number;
  trialCount: number;
  paidCount: number;
  freeCount: number;
  canceledCount: number;
  conversionRate: number;
  totalAccounts: number;
  discountImpact: number;
  manualCount: number;
}

interface RecentActivity {
  id: string;
  type: 'shop_created' | 'plan_changed' | 'subscription_updated' | 'shop_suspended';
  label: string;
  detail: string;
  time: string;
  shopId?: string;
}

const PLAN_COLORS = ["hsl(var(--muted-foreground))", "hsl(var(--primary))", "hsl(var(--success))"];

export default function AdminDashboard() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [recentShops, setRecentShops] = useState<{ id: string; name: string; email: string; plan: string; status: string; created_at: string }[]>([]);
  const navigate = useNavigate();

  const fetchStats = useCallback(async () => {
    try {
      const [shops, clients, vehicles, workOrders, alerts, subscriptions, quotes] = await Promise.all([
        supabase.from("shops").select("id, name, email, status, created_at"),
        supabase.from("clients").select("id, shop_id"),
        supabase.from("vehicles").select("id"),
        supabase.from("work_orders").select("id, total, status, created_at"),
        supabase.from("alerts").select("id, status"),
        supabase.from("subscriptions").select("shop_id, plan, status, trial_end, updated_at, discount_percent, discount_expires_at, revenue_type, stripe_subscription_id"),
        supabase.from("quotes").select("id, status"),
      ]);

      const completedOrders = (workOrders.data || []).filter(wo => wo.status === 'completed' || wo.status === 'delivered');
      const totalRevenue = completedOrders.reduce((sum, wo) => sum + Number(wo.total || 0), 0);
      const avgTicket = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

      const planBreakdown = { free: 0, pro: 0, garage: 0 };
      const subsMap = new Map<string, string>();
      (subscriptions.data || []).forEach(s => {
        if (s.plan === 'free') planBreakdown.free++;
        else if (s.plan === 'pro') planBreakdown.pro++;
        else if (s.plan === 'garage') planBreakdown.garage++;
        subsMap.set(s.shop_id, s.plan);
      });

      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate() - now.getDay());
      thisWeekStart.setHours(0, 0, 0, 0);
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

      const allShops = shops.data || [];
      const newShopsThisMonth = allShops.filter(s => new Date(s.created_at) >= thisMonthStart).length;
      const newShopsThisWeek = allShops.filter(s => new Date(s.created_at) >= thisWeekStart).length;
      const newShopsToday = allShops.filter(s => new Date(s.created_at) >= todayStart).length;

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

        const newShops = allShops.filter(s => {
          const sd = new Date(s.created_at);
          return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
        }).length;
        monthlyNewShops.push({ month: monthStr, shops: newShops });
      }

      const shopClientCount = new Map<string, number>();
      (clients.data || []).forEach(c => {
        shopClientCount.set(c.shop_id, (shopClientCount.get(c.shop_id) || 0) + 1);
      });
      const topShops = allShops
        .map(s => ({ name: s.name || "Sem nome", clients: shopClientCount.get(s.id) || 0, id: s.id }))
        .sort((a, b) => b.clients - a.clients)
        .slice(0, 5);

      const openQuotes = (quotes.data || []).filter(q => q.status === 'draft' || q.status === 'sent').length;
      const approvedQuotes = (quotes.data || []).filter(q => q.status === 'approved').length;
      const pendingAlerts = (alerts.data || []).filter(a => a.status === 'pending').length;

      const PLAN_PRICES: Record<string, number> = { free: 0, pro: 49, garage: 99 };
      const activeSubs = (subscriptions.data || []).filter(s => s.status === 'active' || s.status === 'trialing');
      
      // REGRA: Apenas subscrições com pagamento Stripe real contam como receita
      const stripePaidSubs = activeSubs.filter(s => 
        s.revenue_type === 'stripe_paid' || (s.stripe_subscription_id && s.plan !== 'free')
      );
      const manualAdminSubs = activeSubs.filter(s => 
        s.revenue_type === 'manual_admin' || (!s.stripe_subscription_id && s.plan !== 'free' && s.status === 'active')
      );
      
      // MRR REAL: apenas Stripe paid
      const mrr = stripePaidSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan] || 0), 0);
      const mrrWithDiscounts = stripePaidSubs.reduce((sum, s) => {
        const basePrice = PLAN_PRICES[s.plan] || 0;
        const discount = Number(s.discount_percent || 0);
        const discountExpired = s.discount_expires_at && new Date(s.discount_expires_at) < now;
        const effectiveDiscount = discountExpired ? 0 : discount;
        return sum + (basePrice * (1 - effectiveDiscount / 100));
      }, 0);
      const discountImpact = mrr - mrrWithDiscounts;
      
      const arr = mrrWithDiscounts * 12;
      const paidCount = stripePaidSubs.length;
      const freeCount = activeSubs.filter(s => s.plan === 'free').length;
      const manualCount = manualAdminSubs.length;
      const arpu = paidCount > 0 ? mrrWithDiscounts / paidCount : 0;
      const canceledCount = (subscriptions.data || []).filter(s => s.status === 'canceled' || s.status === 'cancelled').length;
      const totalSubCount = (subscriptions.data || []).length;
      const churnRate = totalSubCount > 0 ? (canceledCount / totalSubCount) * 100 : 0;
      const ltv = churnRate > 0 ? (arpu / (churnRate / 100)) : arpu * 24;
      const trialCount = activeSubs.filter(s => s.status === 'trialing').length;
      const conversionRate = (trialCount + paidCount) > 0 ? (paidCount / (trialCount + paidCount)) * 100 : 0;

      // Recent shops (last 10)
      const sortedShops = [...allShops].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 10);
      setRecentShops(sortedShops.map(s => ({
        ...s,
        plan: subsMap.get(s.id) || 'free',
      })));

      setStats({
        totalShops: allShops.length,
        activeShops: allShops.filter(s => s.status === 'active').length,
        suspendedShops: allShops.filter(s => s.status === 'suspended').length,
        totalClients: clients.data?.length || 0,
        totalVehicles: vehicles.data?.length || 0,
        totalWorkOrders: workOrders.data?.length || 0,
        totalQuotes: quotes.data?.length || 0,
        totalAlerts: alerts.data?.length || 0,
        totalRevenue, avgTicket,
        pendingAlerts, openQuotes, approvedQuotes,
        newShopsThisMonth, newShopsThisWeek, newShopsToday,
        planBreakdown, monthlyRevenue, monthlyNewShops, topShops,
        mrr, mrrWithDiscounts, arr, arpu, ltv, churnRate, trialCount, paidCount, freeCount,
        canceledCount, conversionRate, totalAccounts: totalSubCount, discountImpact, manualCount,
      });
    } catch (err) {
      console.error("Failed to fetch admin stats:", err);
      setStats({
        totalShops: 0, activeShops: 0, suspendedShops: 0, totalClients: 0,
        totalVehicles: 0, totalWorkOrders: 0, totalQuotes: 0, totalAlerts: 0,
        totalRevenue: 0, avgTicket: 0, pendingAlerts: 0, openQuotes: 0,
        approvedQuotes: 0, newShopsThisMonth: 0, newShopsThisWeek: 0, newShopsToday: 0,
        planBreakdown: { free: 0, pro: 0, garage: 0 },
        monthlyRevenue: [], monthlyNewShops: [], topShops: [],
        mrr: 0, mrrWithDiscounts: 0, arr: 0, arpu: 0, ltv: 0, churnRate: 0, trialCount: 0,
        paidCount: 0, freeCount: 0, canceledCount: 0, conversionRate: 0,
        totalAccounts: 0, discountImpact: 0,
        manualCount: 0,
      });
    }
    setLoading(false);
  }, []);

  const fetchActivity = useCallback(async () => {
    const { data: logs } = await supabase
      .from("audit_logs")
      .select("id, action, entity_type, entity_id, details, created_at")
      .order("created_at", { ascending: false })
      .limit(15);

    if (logs) {
      setRecentActivity(logs.map(l => {
        const det = l.details as any || {};
        let label = l.action;
        let detail = det.name || det.email || l.entity_type || '';
        if (l.action === 'plan_changed') {
          label = `${t('admin.activity.planChanged')}: ${(det.from || '').toUpperCase()} → ${(det.to || '').toUpperCase()}`;
          detail = det.name || '';
        } else if (l.action === 'shop_activated') {
          label = t('admin.activity.shopActivated');
          detail = det.name || '';
        } else if (l.action === 'shop_suspended') {
          label = t('admin.activity.shopSuspended');
          detail = det.name || '';
        } else if (l.action === 'trial_reset') {
          label = t('admin.activity.trialReset');
          detail = det.name || '';
        } else if (l.action === 'shop_deleted') {
          label = t('admin.activity.shopDeleted');
          detail = det.name || '';
        } else if (l.action === 'settings_updated') {
          label = t('admin.activity.settingsUpdated');
          detail = t('admin.activity.platform');
        }

        return {
          id: l.id,
          type: 'plan_changed' as const,
          label,
          detail,
          time: new Date(l.created_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
          shopId: l.entity_id || undefined,
        };
      }));
    }
  }, [t]);

  useEffect(() => {
    fetchStats();
    fetchActivity();

    // Realtime: refresh on shop or subscription changes
    const channel = supabase
      .channel("admin-dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, () => {
        fetchStats();
        fetchActivity();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
        fetchStats();
        fetchActivity();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchStats, fetchActivity]);

  const exportGlobalCSV = () => {
    if (!stats) return;
    const lines = [
      `${t('admin.csv.metric')};${t('admin.csv.value')}`,
      `${t('admin.dashboard.totalShops')};${stats.totalShops}`,
      `${t('admin.dashboard.activeShops')};${stats.activeShops}`,
      `${t('admin.dashboard.suspended')};${stats.suspendedShops}`,
      `${t('admin.dashboard.newThisMonth')};${stats.newShopsThisMonth}`,
      `${t('admin.dashboard.totalClients')};${stats.totalClients}`,
      `${t('admin.dashboard.totalVehicles')};${stats.totalVehicles}`,
      `${t('admin.dashboard.workOrders')};${stats.totalWorkOrders}`,
      `${t('admin.dashboard.totalRevenue')};€${stats.totalRevenue.toFixed(2)}`,
      `${t('admin.dashboard.avgTicket')};€${stats.avgTicket.toFixed(2)}`,
      `MRR;€${stats.mrr.toFixed(2)}`,
      `ARR;€${stats.arr.toFixed(2)}`,
      `ARPU;€${stats.arpu.toFixed(2)}`,
      `${t('admin.dashboard.ltvEstimated')};€${stats.ltv.toFixed(2)}`,
      `${t('admin.dashboard.churnRate')};${stats.churnRate.toFixed(1)}%`,
      `${t('admin.csv.trialConversion')};${stats.conversionRate.toFixed(1)}%`,
      `${t('admin.dashboard.pendingAlerts')};${stats.pendingAlerts}`,
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

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: "bg-muted text-muted-foreground",
      pro: "bg-primary/15 text-primary border-primary/30",
      garage: "bg-success/15 text-success border-success/30",
    };
    return <Badge variant="outline" className={colors[plan] || ""}>{plan.toUpperCase()}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="page-title">{t('admin.dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.dashboard.subtitle')}</p>
        </div>
        <div className="stat-card p-8 text-center">
          <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-lg font-medium">{t('admin.dashboard.noData')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.dashboard.noDataDesc')}</p>
        </div>
      </div>
    );
  }

  const heroMetrics = [
    { label: "MRR (Stripe)", value: `€${stats.mrrWithDiscounts.toFixed(0)}`, icon: DollarSign, color: "text-success", sub: stats.discountImpact > 0 ? `−€${stats.discountImpact.toFixed(0)} desc.` : "Apenas pagamentos reais" },
    { label: "ARR (Stripe)", value: `€${stats.arr.toFixed(0)}`, icon: TrendingUp, color: "text-success" },
    { label: t('admin.dashboard.trialToPaid'), value: `${stats.conversionRate.toFixed(0)}%`, icon: TrendingUp, color: "text-primary" },
    { label: t('admin.dashboard.churnRate'), value: `${stats.churnRate.toFixed(1)}%`, icon: AlertTriangle, color: stats.churnRate > 10 ? "text-destructive" : "text-warning" },
  ];

  const shopMetrics = [
    { label: t('admin.dashboard.totalShops'), value: stats.totalShops, icon: Building2, color: "text-primary", link: "/admin/shops" },
    { label: t('admin.dashboard.activeShops'), value: stats.activeShops, icon: Building2, color: "text-success" },
    { label: t('admin.dashboard.suspended'), value: stats.suspendedShops, icon: Building2, color: "text-destructive" },
    { label: t('admin.dashboard.inTrial'), value: stats.trialCount, icon: Clock, color: "text-warning" },
    { label: t('admin.dashboard.paying'), value: stats.paidCount, icon: DollarSign, color: "text-success" },
  ];

  const operationalMetrics = [
    { label: t('admin.dashboard.totalClients'), value: stats.totalClients, icon: Users, color: "text-primary" },
    { label: t('admin.dashboard.totalVehicles'), value: stats.totalVehicles, icon: Car, color: "text-primary" },
    { label: t('admin.dashboard.workOrders'), value: stats.totalWorkOrders, icon: Wrench, color: "text-primary" },
    { label: t('admin.dashboard.totalRevenue'), value: `€${stats.totalRevenue.toFixed(0)}`, icon: DollarSign, color: "text-success" },
    { label: t('admin.dashboard.avgTicket'), value: `€${stats.avgTicket.toFixed(0)}`, icon: TrendingUp, color: "text-primary" },
    { label: "ARPU", value: `€${stats.arpu.toFixed(0)}`, icon: TrendingUp, color: "text-primary" },
    { label: t('admin.dashboard.ltvEstimated'), value: `€${stats.ltv.toFixed(0)}`, icon: TrendingUp, color: "text-primary" },
    { label: t('admin.dashboard.pendingAlerts'), value: stats.pendingAlerts, icon: AlertTriangle, color: "text-warning", link: "/admin/alerts" },
  ];
  const planPieData = [
    { name: "Free", value: stats.planBreakdown.free },
    { name: "Pro", value: stats.planBreakdown.pro },
    { name: "Garage", value: stats.planBreakdown.garage },
  ];

  const funnelData = [
    { stage: "Contas Criadas", count: stats.totalAccounts, color: "hsl(var(--muted-foreground))" },
    { stage: "Free", count: stats.freeCount, color: "hsl(var(--muted-foreground))" },
    { stage: "Em Trial", count: stats.trialCount, color: "hsl(var(--warning))" },
    { stage: "Pagantes", count: stats.paidCount, color: "hsl(var(--success))" },
    { stage: "Cancelados", count: stats.canceledCount, color: "hsl(var(--destructive))" },
  ];

  const renderKpiCard = (kpi: { label: string; value: string | number; icon: any; color: string; link?: string; sub?: string }, size: 'hero' | 'normal' = 'normal') => (
    <div
      key={kpi.label}
      className={`stat-card flex items-center gap-3 ${kpi.link ? 'cursor-pointer hover:border-primary/30 transition-colors' : ''} ${size === 'hero' ? 'border-primary/10 bg-gradient-to-br from-card to-muted/30' : ''}`}
      onClick={() => kpi.link && navigate(kpi.link)}
    >
      <div className={`${size === 'hero' ? 'w-11 h-11' : 'w-9 h-9'} rounded-lg bg-muted flex items-center justify-center flex-shrink-0 ${kpi.color}`}>
        <kpi.icon className={size === 'hero' ? 'w-5 h-5' : 'w-4 h-4'} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
        <p className={`${size === 'hero' ? 'text-2xl' : 'text-lg'} font-bold mono leading-tight`}>{kpi.value}</p>
        {kpi.sub && <p className="text-[10px] text-warning mt-0.5">{kpi.sub}</p>}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('admin.dashboard.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.dashboard.subtitle')}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={exportGlobalCSV} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> {t('admin.dashboard.exportCSV')}
          </Button>
          <Button onClick={() => navigate("/admin/shops")} size="sm" className="gap-2">
            <Building2 className="w-4 h-4" /> {t('admin.dashboard.manageShops')}
          </Button>
          <Button onClick={() => navigate("/admin/settings")} variant="outline" size="sm" className="gap-2">
            <Zap className="w-4 h-4" /> {t('admin.dashboard.settings')}
          </Button>
        </div>
      </div>

      {/* Hero Financial Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {heroMetrics.map(kpi => renderKpiCard(kpi, 'hero'))}
      </div>

      {/* Shop Metrics */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Oficinas & Subscrições</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {shopMetrics.map(kpi => renderKpiCard(kpi))}
        </div>
      </div>

      {/* Operational Metrics */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">Operacional</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {operationalMetrics.map(kpi => renderKpiCard(kpi))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Line Chart */}
        <div className="stat-card lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">{t('admin.dashboard.monthlyRevenue')}</h2>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  formatter={(value: number) => [`€${value.toFixed(2)}`, t('admin.dashboard.revenue')]}
                />
                <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Plan Distribution Pie */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">{t('admin.dashboard.planDistribution')}</h2>
          <div className="h-[280px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={planPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90} dataKey="value"
                  label={({ name, value }) => `${name}: ${value}`}>
                  {planPieData.map((_, index) => (
                    <Cell key={index} fill={PLAN_COLORS[index % PLAN_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {planPieData.map((p, i) => (
              <div key={p.name} className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: PLAN_COLORS[i] }} />
                <span className="text-muted-foreground">{p.name}: <span className="font-medium text-foreground">{p.value}</span></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Registration Breakdown + Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration breakdown */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" /> Novos Registos
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold mono text-primary">{stats.newShopsToday}</p>
              <p className="text-xs text-muted-foreground mt-1">Hoje</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold mono text-primary">{stats.newShopsThisWeek}</p>
              <p className="text-xs text-muted-foreground mt-1">Esta Semana</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <p className="text-3xl font-bold mono text-primary">{stats.newShopsThisMonth}</p>
              <p className="text-xs text-muted-foreground mt-1">Este Mês</p>
            </div>
          </div>
          {stats.discountImpact > 0 && (
            <div className="mt-4 p-3 rounded-lg border border-warning/30 bg-warning/5">
              <div className="flex items-center gap-2 text-sm">
                <Percent className="w-4 h-4 text-warning" />
                <span className="text-muted-foreground">Impacto de descontos no MRR:</span>
                <span className="font-bold text-warning">-€{stats.discountImpact.toFixed(2)}/mês</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
              MRR base Stripe: €{stats.mrr.toFixed(0)} → MRR real: €{stats.mrrWithDiscounts.toFixed(0)} • Manuais (não contabilizados): {(stats as any).manualCount || 0}
              </p>
            </div>
          )}
        </div>

        {/* Conversion Funnel */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Funil de Conversão
          </h2>
          <div className="space-y-3">
            {funnelData.map((step, i) => {
              const maxCount = Math.max(...funnelData.map(d => d.count), 1);
              const pct = (step.count / maxCount) * 100;
              return (
                <div key={step.stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{step.stage}</span>
                    <span className="text-sm font-bold mono">{step.count}</span>
                  </div>
                  <div className="h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(pct, 2)}%`, background: step.color }}
                    />
                  </div>
                  {i < funnelData.length - 1 && i > 0 && step.count > 0 && funnelData[0].count > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {((step.count / funnelData[0].count) * 100).toFixed(1)}% do total
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity Feed */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Atividade Recente
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/logs")} className="text-xs gap-1">
              Ver todos <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {recentActivity.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sem atividade registada</p>
            )}
            {recentActivity.map(a => (
              <div
                key={a.id}
                className={`flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 transition-colors ${a.shopId ? 'cursor-pointer' : ''}`}
                onClick={() => a.shopId && navigate(`/admin/shops/${a.shopId}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{a.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{a.detail}</p>
                </div>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap ml-3">{a.time}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Shops */}
        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Últimas Oficinas
            </h2>
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/shops")} className="text-xs gap-1">
              Ver todas <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
          <div className="space-y-1 max-h-[350px] overflow-y-auto">
            {recentShops.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Sem oficinas registadas</p>
            )}
            {recentShops.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate(`/admin/shops/${s.id}`)}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.name || "Sem nome"}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  {planBadge(s.plan)}
                  <Badge variant="outline" className={`text-[10px] ${s.status === 'active' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                    {s.status === 'active' ? 'Ativa' : 'Suspensa'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {new Date(s.created_at).toLocaleDateString("pt-PT")}
                  </span>
                </div>
              </div>
            ))}
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

      {/* Top shops */}
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
                <Bar dataKey="clients" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}
                  onClick={(data: any) => data?.id && navigate(`/admin/shops/${data.id}`)}
                  className="cursor-pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
