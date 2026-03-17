import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, FileText, Wrench, Users, DollarSign, BarChart3, Bell, AlertTriangle, CheckCircle, Clock, CreditCard, Star, Search } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";
import OnboardingChecklist from "@/components/OnboardingChecklist";

interface KPIData {
  revenue: number;
  profit: number;
  serviceCount: number;
  avgTicket: number;
  openQuotes: number;
  activeClients: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: 'hsl(210, 80%, 55%)',
  diagnosis: 'hsl(45, 90%, 50%)',
  in_progress: 'hsl(260, 70%, 60%)',
  completed: 'hsl(145, 65%, 45%)',
  delivered: 'hsl(210, 15%, 60%)',
  cancelled: 'hsl(0, 70%, 55%)',
};

export default function Dashboard() {
  const { t } = useLanguage();
  const { plan, isTrialing, trialDaysLeft, limits } = useSubscription();
  const [kpis, setKpis] = useState<KPIData>({ revenue: 0, profit: 0, serviceCount: 0, avgTicket: 0, openQuotes: 0, activeClients: 0 });
  const [recentServices, setRecentServices] = useState<any[]>([]);
  const [currency, setCurrency] = useState("€");
  const [shopName, setShopName] = useState("");
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);
  const [pendingAlerts, setPendingAlerts] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ month: string; revenue: number; profit: number }[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<{ name: string; value: number; color: string }[]>([]);
  const [conversionRate, setConversionRate] = useState(0);
  const [topParts, setTopParts] = useState<{ name: string; count: number }[]>([]);

  const getActiveShopId = async (): Promise<string | null> => {
    const stored = localStorage.getItem("garageflow_active_shop");
    if (stored) return stored;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).maybeSingle();
    return shop?.id || null;
  };

  useEffect(() => {
    const loadData = async () => {
      const shopId = await getActiveShopId();
      if (!shopId) return;
      const { data: shop } = await supabase.from("shops").select("id, currency, name, logo_url").eq("id", shopId).maybeSingle();
      if (!shop) return;
      setCurrency(shop.currency === 'EUR' ? '€' : shop.currency);
      setShopName(shop.name || '');
      setShopLogoUrl(shop.logo_url || null);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

      const [ordersRes, quotesRes, clientsRes, alertsRes, allOrdersRes, lowStockRes, overdueRes, allQuotesRes, partsUsedRes] = await Promise.all([
        supabase.from("work_orders")
          .select("total, profit, status, number, created_at, clients(name), vehicles(make, model)")
          .eq("shop_id", shop.id)
          .gte("created_at", monthStart)
          .order("created_at", { ascending: false }),
        supabase.from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shop.id)
          .in("status", ['draft', 'sent']),
        supabase.from("work_orders")
          .select("client_id")
          .eq("shop_id", shop.id)
          .gte("created_at", monthStart),
        supabase.from("alerts")
          .select("id, title, type, status, due_date, created_at")
          .eq("shop_id", shop.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("work_orders")
          .select("total, profit, status, created_at")
          .eq("shop_id", shop.id)
          .gte("created_at", sixMonthsAgo)
          .in("status", ['completed', 'delivered']),
        supabase.from("parts")
          .select("id, name, stock_quantity, min_stock")
          .eq("shop_id", shop.id)
          .eq("active", true),
        supabase.from("invoices")
          .select("id, number, total, due_date, clients(name)")
          .eq("shop_id", shop.id)
          .in("status", ['issued', 'partial'])
          .lt("due_date", new Date().toISOString().slice(0, 10)),
        // All quotes for conversion rate
        supabase.from("quotes")
          .select("id, status")
          .eq("shop_id", shop.id)
          .gte("created_at", sixMonthsAgo),
        // Parts used in stock movements
        supabase.from("stock_movements")
          .select("quantity, parts(name)")
          .eq("shop_id", shop.id)
          .eq("type", "out")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const orders = ordersRes.data || [];
      const delivered = orders.filter(o => ['completed', 'delivered'].includes(o.status));
      const revenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
      const profit = delivered.reduce((s, o) => s + (o.profit || 0), 0);
      const uniqueClients = new Set((clientsRes.data || []).map(c => c.client_id));

      setKpis({
        revenue,
        profit,
        serviceCount: orders.length,
        avgTicket: delivered.length > 0 ? revenue / delivered.length : 0,
        openQuotes: quotesRes.count || 0,
        activeClients: uniqueClients.size,
      });

      setRecentServices(orders.slice(0, 5));

      // Combine DB alerts with auto-generated alerts for low stock & overdue invoices
      const dbAlerts = alertsRes.data || [];
      const autoAlerts: any[] = [];
      
      const lowStockParts = (lowStockRes.data || []).filter((p: any) => p.stock_quantity <= p.min_stock && p.min_stock > 0);
      if (lowStockParts.length > 0) {
        autoAlerts.push({
          id: 'auto-low-stock',
          title: `${lowStockParts.length} ${lowStockParts.length === 1 ? 'peça com stock baixo' : 'peças com stock baixo'}`,
          type: 'stock_low',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }

      const overdueInvoices = overdueRes.data || [];
      if (overdueInvoices.length > 0) {
        const overdueTotal = overdueInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
        autoAlerts.push({
          id: 'auto-overdue',
          title: `${overdueInvoices.length} faturas vencidas (€${overdueTotal.toFixed(0)})`,
          type: 'payment_failed',
          status: 'pending',
          created_at: new Date().toISOString(),
        });
      }

      setPendingAlerts([...autoAlerts, ...dbAlerts].slice(0, 8));

      // Build monthly revenue chart data
      const allOrders = allOrdersRes.data || [];
      const monthMap = new Map<string, { revenue: number; profit: number }>();
      const monthNames = { pt: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'], en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'] };
      const names = monthNames[plan ? 'pt' : 'pt']; // use stored language if available

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, { revenue: 0, profit: 0 });
      }

      allOrders.forEach(o => {
        const d = new Date(o.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const entry = monthMap.get(key);
        if (entry) {
          entry.revenue += o.total || 0;
          entry.profit += o.profit || 0;
        }
      });

      setMonthlyRevenue(
        Array.from(monthMap.entries()).map(([key, val]) => {
          const [y, m] = key.split('-');
          return { month: names[parseInt(m) - 1] || m, revenue: Math.round(val.revenue), profit: Math.round(val.profit) };
        })
      );

      // Build status distribution
      const statusCounts = new Map<string, number>();
      orders.forEach(o => { statusCounts.set(o.status, (statusCounts.get(o.status) || 0) + 1); });
      setStatusDistribution(
        Array.from(statusCounts.entries())
          .filter(([, v]) => v > 0)
          .map(([name, value]) => ({ name: t(`service.${name}`), value, color: STATUS_COLORS[name] || '#888' }))
      );
    };
    loadData();
  }, []);

  const alertTypeColors: Record<string, string> = {
    payment_failed: "text-destructive",
    expired_quote: "text-warning",
    revision: "text-warning",
    oil: "text-warning",
    inspection: "text-info",
    warranty: "text-destructive",
    inactive_client: "text-info",
    service_due: "text-warning",
    quote_pending: "text-warning",
  };

  const stats = [
    { label: t('dashboard.revenueMonth'), value: `${currency}${kpis.revenue.toFixed(2)}`, icon: DollarSign },
    { label: t('dashboard.profitMonth'), value: `${currency}${kpis.profit.toFixed(2)}`, icon: TrendingUp },
    { label: t('dashboard.servicesMonth'), value: String(kpis.serviceCount), icon: Wrench },
    { label: t('dashboard.avgTicket'), value: `${currency}${kpis.avgTicket.toFixed(2)}`, icon: BarChart3 },
    { label: t('dashboard.openQuotes'), value: String(kpis.openQuotes), icon: FileText },
    { label: t('dashboard.activeClients'), value: String(kpis.activeClients), icon: Users },
  ];

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-4">
          {shopLogoUrl ? (
            <img src={shopLogoUrl} alt={shopName} className="w-12 h-12 rounded-xl object-contain border border-border bg-background" />
          ) : (
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Wrench className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="page-title">{shopName || t('dashboard.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('dashboard.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-muted-foreground">{stat.label}</span>
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <stat.icon className="w-4.5 h-4.5 text-primary" />
              </div>
            </div>
            <div className="text-2xl font-bold mono">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Plan Banner */}
      {(plan === 'free' || isTrialing) && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Star className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isTrialing
                  ? `${t('dashboard.trialBanner')} — ${trialDaysLeft} ${t('dashboard.daysLeft')}`
                  : t('dashboard.freeBanner')}
              </p>
              <p className="text-xs text-muted-foreground">{t('dashboard.upgradeBenefits')}</p>
            </div>
          </div>
          <Link to="/billing">
            <Button size="sm" className="shrink-0">
              <CreditCard className="w-4 h-4 mr-1" />{t('dashboard.upgrade')}
            </Button>
          </Link>
        </div>
      )}

      {/* Charts Row */}
      {plan !== 'free' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Monthly Revenue Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              {t('dashboard.revenueChart')}
            </h2>
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyRevenue} barGap={4}>
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `${currency}${v}`} />
                  <Tooltip
                    formatter={(value: number) => [`${currency}${value}`, '']}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  />
                  <Bar dataKey="revenue" name={t('dashboard.revenueMonth')} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" name={t('dashboard.profitMonth')} fill="hsl(var(--primary) / 0.4)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">{t('dashboard.noData')}</div>
            )}
          </div>

          {/* Status Distribution Pie */}
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              {t('dashboard.statusChart')}
            </h2>
            {statusDistribution.length > 0 ? (
              <div>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                      {statusDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-2 mt-2">
                  {statusDistribution.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-muted-foreground">{s.name} ({s.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-[160px] text-muted-foreground text-sm">{t('dashboard.noData')}</div>
            )}
          </div>
        </div>
      )}

      {pendingAlerts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Bell className="w-4.5 h-4.5 text-warning" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">{t('alerts.widget.title')}</h2>
                <p className="text-xs text-muted-foreground">
                  {pendingAlerts.length} {t('alerts.widget.pendingAlerts')}
                </p>
              </div>
            </div>
            <Link to="/alerts" className="text-sm text-primary hover:underline font-medium">
              {t('alerts.widget.viewAll')} →
            </Link>
          </div>
          <div className="space-y-2">
            {pendingAlerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${alertTypeColors[alert.type] || 'text-warning'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`alerts.type.${alert.type}`)} · {alert.due_date ? new Date(alert.due_date).toLocaleDateString() : new Date(alert.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {t('alerts.statusPending')}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: t('dashboard.newClient'), icon: Users, href: "/clients" },
            { label: t('dashboard.newVehicle'), icon: "🚗", href: "/vehicles" },
            { label: t('dashboard.newQuote'), icon: FileText, href: "/quotes/new" },
            { label: t('dashboard.newService'), icon: Wrench, href: "/services/new" },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-border 
                hover:border-primary/30 hover:bg-primary/5 transition-all text-center group"
            >
              {typeof action.icon === 'string' ? (
                <span className="text-2xl">{action.icon}</span>
              ) : (
                <action.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
              <span className="text-sm font-medium">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Services */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.recentServices')}</h2>
        {recentServices.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">{t('dashboard.noServices')}</p>
        ) : (
          <div className="space-y-3">
            {recentServices.map(s => (
              <div key={s.number} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <span className="mono text-sm font-medium">{s.number}</span>
                  <span className="text-muted-foreground text-sm ml-2">{(s.clients as any)?.name}</span>
                </div>
                <span className="mono font-semibold">{currency}{(s.total || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}