import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, FileText, Wrench, Users, DollarSign, BarChart3, Bell, AlertTriangle, CheckCircle, Clock, CreditCard, Star, Search, Gift, Shield } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import AutoOnboarding, { OnboardingBackupButton } from "@/components/AutoOnboarding";
import { useAuthReady } from "@/hooks/useAuthReady";

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

const MONTH_NAMES: Record<string, string[]> = {
  pt: ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  'pt-BR': ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'],
  en: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  es: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
};

export default function Dashboard() {
  const { t, language } = useLanguage();
  const { isReady, user } = useAuthReady();
  const { plan, isTrialing, trialDaysLeft } = useSubscription();
  const activeShopId = useActiveShopId();
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
  const [freeMonths, setFreeMonths] = useState(0);
  const [paidReferrals, setPaidReferrals] = useState(0);
  const [monthlyQuoteCount, setMonthlyQuoteCount] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      if (!isReady) return;

      if (!user) {
        setDataLoaded(true);
        return;
      }

      setDataLoaded(false);

      try {
        let shopId = activeShopId;
        if (!shopId) {
          // Fallback: try to get from user's shops
          const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).maybeSingle();
          if (shop) {
            shopId = shop.id;
            localStorage.setItem("garageflow_active_shop", shop.id);
          } else {
            return;
          }
        }
        const { data: shop } = await supabase.from("shops").select("id, currency, name, logo_url").eq("id", shopId).maybeSingle();
        if (!shop) {
          return;
        }
        setCurrency(shop.currency === 'EUR' ? '€' : shop.currency);
        setShopName(shop.name || '');
        setShopLogoUrl(shop.logo_url || null);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

        const [ordersRes, quotesRes, clientsRes, alertsRes, allOrdersRes, lowStockRes, overdueRes, allQuotesRes, partsUsedRes, invoicesMonthRes, allClientsRes] = await Promise.all([
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
          supabase.from("quotes")
            .select("id, status")
            .eq("shop_id", shop.id)
            .gte("created_at", sixMonthsAgo),
          supabase.from("stock_movements")
            .select("quantity, parts(name)")
            .eq("shop_id", shop.id)
            .eq("type", "out")
            .order("created_at", { ascending: false })
            .limit(100),
          // Faturas do mês para KPI de faturação real
          supabase.from("invoices")
            .select("total, subtotal, vat_total, status")
            .eq("shop_id", shop.id)
            .gte("created_at", monthStart),
          // Todos os clientes ativos (não apagados)
          supabase.from("clients")
            .select("id", { count: "exact", head: true })
            .eq("shop_id", shop.id)
            .is("deleted_at", null),
        ]);

        const orders = ordersRes.data || [];
        const delivered = orders.filter(o => ['completed', 'delivered'].includes(o.status));
        
        // Faturação: combinar work_orders completadas + faturas emitidas/pagas do mês
        const woRevenue = delivered.reduce((s, o) => s + Number(o.total || 0), 0);
        const woProfit = delivered.reduce((s, o) => s + Number(o.profit || 0), 0);
        
        const monthInvoices = (invoicesMonthRes.data || []).filter(
          (i: any) => ['issued', 'paid', 'partial'].includes(i.status)
        );
        const invRevenue = monthInvoices.reduce((s: number, i: any) => s + Number(i.total || 0), 0);
        
        // Usar o maior dos dois (evitar duplicação se fatura vem de work_order)
        const revenue = Math.max(woRevenue, invRevenue);
        const profit = woRevenue > 0 ? woProfit : (invRevenue * 0.3); // estimativa se só há faturas
        
        // Clientes ativos: total de clientes não apagados
        const totalClients = allClientsRes.count || 0;

        setKpis({
          revenue,
          profit: woRevenue > 0 ? woProfit : Math.round(profit * 100) / 100,
          serviceCount: orders.length,
          avgTicket: delivered.length > 0 ? woRevenue / delivered.length : (monthInvoices.length > 0 ? invRevenue / monthInvoices.length : 0),
          openQuotes: quotesRes.count || 0,
          activeClients: totalClients,
        });

        setRecentServices(orders.slice(0, 5));

      // Auto-generated alerts
        const dbAlerts = alertsRes.data || [];
        const autoAlerts: any[] = [];
      
        const lowStockParts = (lowStockRes.data || []).filter((p: any) => p.stock_quantity <= p.min_stock && p.min_stock > 0);
        if (lowStockParts.length > 0) {
          autoAlerts.push({
            id: 'auto-low-stock',
            title: `${lowStockParts.length} ${lowStockParts.length === 1 ? t('dashboard.lowStockSingle') || 'peça com stock baixo' : t('dashboard.lowStockPlural') || 'peças com stock baixo'}`,
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
            title: `${overdueInvoices.length} ${t('dashboard.overdueInvoices') || 'faturas vencidas'} (${currency}${overdueTotal.toFixed(0)})`,
            type: 'payment_failed',
            status: 'pending',
            created_at: new Date().toISOString(),
          });
        }

        setPendingAlerts([...autoAlerts, ...dbAlerts].slice(0, 8));

      // Monthly revenue chart
        const allOrders = allOrdersRes.data || [];
        const monthMap = new Map<string, { revenue: number; profit: number }>();
        const names = MONTH_NAMES[language] || MONTH_NAMES.pt;

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
            const [, m] = key.split('-');
            return { month: names[parseInt(m) - 1] || m, revenue: Math.round(val.revenue), profit: Math.round(val.profit) };
          })
        );

      // Status distribution
        const statusCounts = new Map<string, number>();
        orders.forEach(o => { statusCounts.set(o.status, (statusCounts.get(o.status) || 0) + 1); });
        setStatusDistribution(
          Array.from(statusCounts.entries())
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name: t(`service.${name}`), value, color: STATUS_COLORS[name] || '#888' }))
        );

      // Conversion rate
        const allQuotes = allQuotesRes.data || [];
        if (allQuotes.length > 0) {
          const approved = allQuotes.filter(q => ['approved', 'converted'].includes(q.status)).length;
          setConversionRate(Math.round((approved / allQuotes.length) * 100));
        }

      // Top parts
        const partsMap = new Map<string, number>();
        (partsUsedRes.data || []).forEach((m: any) => {
          const name = (m.parts as any)?.name;
          if (name) partsMap.set(name, (partsMap.get(name) || 0) + (m.quantity || 0));
        });
        setTopParts(
          Array.from(partsMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }))
        );
        // Load referral data
        const { data: refCode } = await supabase
          .from("referral_codes")
          .select("free_months_balance, paid_referrals_count")
          .eq("user_id", user.id)
          .maybeSingle();
        if (refCode) {
          setFreeMonths(refCode.free_months_balance || 0);
          setPaidReferrals(refCode.paid_referrals_count || 0);
        }
        // Monthly quote count for usage nudge
        if (plan === 'free') {
          const monthStart2 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const { count: qCount } = await supabase
            .from("quotes")
            .select("id", { count: "exact", head: true })
            .eq("shop_id", shop.id)
            .gte("created_at", monthStart2);
          setMonthlyQuoteCount(qCount || 0);
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setDataLoaded(true);
      }
    };
    loadData();
  }, [language, activeShopId, isReady, user]);

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
    stock_low: "text-warning",
  };

  const stats = [
    { label: t('dashboard.revenueMonth'), value: `${currency}${kpis.revenue.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-500' },
    { label: t('dashboard.profitMonth'), value: `${currency}${kpis.profit.toFixed(2)}`, icon: TrendingUp, color: 'text-primary' },
    { label: t('dashboard.servicesMonth'), value: String(kpis.serviceCount), icon: Wrench, color: 'text-blue-500' },
    { label: t('dashboard.avgTicket'), value: `${currency}${kpis.avgTicket.toFixed(2)}`, icon: BarChart3, color: 'text-purple-500' },
    { label: t('dashboard.openQuotes'), value: String(kpis.openQuotes), icon: FileText, color: 'text-amber-500' },
    { label: t('dashboard.activeClients'), value: String(kpis.activeClients), icon: Users, color: 'text-cyan-500' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
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
            <p className="text-muted-foreground text-sm mt-0.5">{t('dashboard.subtitle')}</p>
          </div>
        </div>
        {/* CMD+K hint - desktop only */}
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
          className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-all"
        >
          <Search className="w-3.5 h-3.5" />
          {t('dashboard.search') || 'Pesquisar'}
          <kbd className="ml-1 px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Auto Onboarding Bot */}
      <AutoOnboarding />
      <OnboardingBackupButton />


      {/* Trust Signal */}
      {dataLoaded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-success" />
          <span>{t('dashboard.dataSaved')}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{t('dashboard.lastUpdate')}</span>
        </div>
      )}

      {/* Quick Actions — TOP for maximum visibility */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 border-2 border-primary/20 rounded-xl p-4 sm:p-6">
        <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">{t('dashboard.quickActions')}</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {[
            { label: t('dashboard.newClient'), href: "/clients", emoji: "👤" },
            { label: t('dashboard.newVehicle'), href: "/vehicles", emoji: "🚗" },
            { label: t('dashboard.newQuote'), href: "/quotes/new", emoji: "📋" },
            { label: t('dashboard.newService'), href: "/services/new", emoji: "🔧" },
          ].map((action) => (
            <Link
              key={action.label}
              to={action.href}
              className="flex flex-col items-center gap-1.5 sm:gap-2.5 p-3 sm:p-5 rounded-xl bg-card border-2 border-border
                hover:border-primary hover:shadow-lg hover:shadow-primary/10 active:scale-95 sm:hover:-translate-y-0.5 transition-all text-center group"
            >
              <span className="text-2xl sm:text-3xl">{action.emoji}</span>
              <span className="text-xs sm:text-sm font-semibold group-hover:text-primary transition-colors leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Plan Banner */}
      {(plan === 'free' || isTrialing) && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
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

      {/* Usage Nudge for Free users */}
      {plan === 'free' && monthlyQuoteCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                {t('dashboard.usageNudge').replace('{percent}', String(Math.round((monthlyQuoteCount / 10) * 100)))}
              </p>
              <p className="text-xs text-muted-foreground">{t('dashboard.workshopsSave')}</p>
            </div>
          </div>
          {monthlyQuoteCount >= 7 && (
            <Link to="/billing">
              <Button size="sm" variant="outline" className="border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 shrink-0">
                {t('dashboard.upgradeNudge')} →
              </Button>
            </Link>
          )}
        </div>
      )}

      {(freeMonths > 0 || paidReferrals > 0) && (
        <Link to="/referrals" className="block">
          <div className="bg-gradient-to-r from-success/10 to-primary/10 border border-success/30 rounded-xl p-4 flex items-center gap-3 hover:shadow-md transition-all btn-interactive">
            <div className="w-10 h-10 rounded-lg bg-success/20 flex items-center justify-center shrink-0">
              <Gift className="w-5 h-5 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold">
                🎉 {t('dashboard.referrals.earned')
                  .replace('{count}', String(freeMonths))
                  .replace('{unit}', freeMonths === 1 ? t('dashboard.referrals.monthSingular') : t('dashboard.referrals.monthPlural'))}
              </p>
              <p className="text-xs text-muted-foreground">
                {paidReferrals}/5 {t('dashboard.referrals.paidReferrals')}
                {paidReferrals < 5 && ` — ${t('dashboard.referrals.bringMore')} ${5 - paidReferrals} ${t('dashboard.referrals.forBonus')}`}
              </p>
            </div>
          </div>
        </Link>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {!dataLoaded ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-32" />
            </div>
          ))
        ) : (
          stats.map((stat) => (
            <div key={stat.label} className="stat-card group hover:shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.label}</span>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="text-xl sm:text-2xl font-bold mono">{stat.value}</div>
            </div>
          ))
        )}
      </div>

      {/* Charts Row */}
      {plan !== 'free' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly Revenue Chart */}
          <div className="lg:col-span-2 bg-card border border-border rounded-xl p-3 sm:p-5">
            <h2 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              {t('dashboard.revenueChart')}
            </h2>
            {monthlyRevenue.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={monthlyRevenue} barGap={2}>
                  <XAxis dataKey="month" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={45} tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v}`} />
                  <Tooltip
                    formatter={(value: number) => [`${currency}${value}`, '']}
                    contentStyle={{ borderRadius: 8, border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }}
                  />
                  <Bar dataKey="revenue" name={t('dashboard.revenueMonth')} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="profit" name={t('dashboard.profitMonth')} fill="hsl(var(--primary) / 0.4)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-muted-foreground text-sm">{t('dashboard.noData')}</div>
            )}
          </div>

          {/* Status Distribution Pie */}
          <div className="bg-card border border-border rounded-xl p-3 sm:p-5">
            <h2 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-2">
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

      {/* Conversion Rate + Top Parts */}
      {plan !== 'free' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t('dashboard.quoteConversion')}
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-primary">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.last6months')}</p>
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t('dashboard.topParts')}
            </h2>
            {topParts.length > 0 ? (
              <div className="space-y-2">
                {topParts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="mono font-medium text-muted-foreground">{p.count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t('dashboard.noData')}</p>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {pendingAlerts.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Bell className="w-4 h-4 text-warning" />
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
              <div key={alert.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border group hover:bg-muted/80 transition-colors">
                <AlertTriangle className={`w-4 h-4 flex-shrink-0 ${alertTypeColors[alert.type] || 'text-warning'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{alert.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`alerts.type.${alert.type}`)} · {alert.due_date ? new Date(alert.due_date).toLocaleDateString() : new Date(alert.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Link to="/alerts" className="shrink-0">
                  <Button variant="ghost" size="sm" className="text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Bell className="w-3 h-3" />
                    {t('common.view') || 'Ver'}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Services */}
      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.recentServices')}</h2>
        {recentServices.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">{t('dashboard.noServices')}</p>
        ) : (
          <div className="space-y-3">
            {recentServices.map(s => (
              <div key={s.number} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <span className="mono text-sm font-medium">{s.number}</span>
                  <span className="text-muted-foreground text-sm ml-2 truncate">{(s.clients as any)?.name}</span>
                </div>
                <span className="mono font-semibold shrink-0">{currency}{(s.total || 0).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
