import { useState, useEffect, useCallback, useRef, lazy, Suspense, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, FileText, Wrench, Users, DollarSign, BarChart3, Bell, AlertTriangle, CheckCircle, Clock, CreditCard, Star, Search, Gift, Shield, ChevronRight, Building2, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link, Navigate } from "react-router-dom";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubscription } from "@/hooks/useSubscription";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useShopRole } from "@/hooks/useShopRole";
import { useOwnedShops } from "@/hooks/useOwnedShops";
import MarketActivityCard from "@/components/MarketActivityCard";
import { setActiveShopAndSync } from "@/lib/shopContextSync";

// Lazy-loaded role-specific dashboards. Owner/Admin/Manager/Super Admin keep
// the full dashboard below; the other roles get lean, focused screens.
const TechnicianDashboard = lazy(() => import("@/pages/dashboards/TechnicianDashboard"));
const ReceptionDashboard = lazy(() => import("@/pages/dashboards/ReceptionDashboard"));
const CommercialDashboard = lazy(() => import("@/pages/dashboards/CommercialDashboard"));
const ManagerDashboard = lazy(() => import("@/pages/dashboards/ManagerDashboard"));



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
  const { role, loading: roleLoading } = useShopRole();
  // Role-specific dashboards: never fall back to the most privileged view.
  if (roleLoading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;
  if (role === "technician") return <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}><TechnicianDashboard /></Suspense>;
  if (role === "reception") return <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}><ReceptionDashboard /></Suspense>;
  if (role === "commercial") return <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}><CommercialDashboard /></Suspense>;
  if (role === "manager") return <Suspense fallback={<div className="p-6"><Skeleton className="h-64 w-full" /></div>}><ManagerDashboard /></Suspense>;
  if (role === "owner" || role === "admin" || role === "super_admin") return <OwnerDashboard />;
  return <Navigate to="/onboarding" replace />;
}

function OwnerDashboard() {
  const { t, language } = useLanguage();
  const { isReady, user } = useAuthReady();
  const { isTrialing, trialDaysLeft, isEntryPlan } = useSubscription();
  const { isGuidedMode } = useOnboardingStatus();
  const activeShopId = useActiveShopId();
  const { shops: ownedShops } = useOwnedShops();
  // Oficinas Filhas nunca vêem informação comercial (planos, trial, upgrade,
  // billing). A subscrição pertence à Empresa e é gerida pela Oficina Mãe.
  const { isChildShop } = useIsChildShop();
  const canSeeCommercial = !isChildShop;

  // Seletor de contexto — apenas a Oficina Mãe vê o grupo. O hook lê a
  // hierarquia real (`group_owner_id`) e filhas independentes não entram aqui.
  const isOwnerOfGroup = ownedShops.length > 1;
  const [selectedFilter, setSelectedFilterRaw] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    return localStorage.getItem('garageflow_dashboard_filter') || 'all';
  });
  const isGroupMode = isOwnerOfGroup && selectedFilter === 'all';
  const setSelectedFilter = (v: string) => {
    setSelectedFilterRaw(v);
    try { localStorage.setItem('garageflow_dashboard_filter', v); } catch { /* noop */ }
    // Ao escolher uma oficina específica, sincroniza o activeShopId global
    // via o helper oficial (localStorage + broadcast + microtask flush) para
    // que os cartões, navegação e destinos filtrem já pela oficina
    // selecionada, sem refresh.
    if (v !== 'all' && v !== activeShopId) {
      void setActiveShopAndSync(v, { reason: "switch" });
    }
  };

  const groupShopIds = useMemo(() => ownedShops.map((s) => s.id), [ownedShops]);


  const [kpis, setKpis] = useState<KPIData>({ revenue: 0, profit: 0, serviceCount: 0, avgTicket: 0, openQuotes: 0, activeClients: 0 });
  const [prevKpis, setPrevKpis] = useState<{ revenue: number; profit: number; serviceCount: number; avgTicket: number }>({ revenue: 0, profit: 0, serviceCount: 0, avgTicket: 0 });
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
  const [perShopBreakdown, setPerShopBreakdown] = useState<Array<{
    id: string; name: string; address: string | null; revenue: number; profit: number;
    services: number; clients: number; vehicles: number; growth: number;
  }>>([]);

  const loadData = useCallback(async () => {
      if (!isReady) return;

      if (!user) {
        setDataLoaded(true);
        return;
      }

      setDataLoaded(false);

      try {
        let shopId = activeShopId;
        if (!shopId) {
          const { data: fallbackShops } = await supabase
            .from("shops")
            .select("id, name, created_at")
            .eq("user_id", user.id)
            .order("created_at", { ascending: true })
            .limit(10);
          const shop = (fallbackShops || []).find((s: any) => (s.name || "").trim().length > 0) ?? fallbackShops?.[0];
          if (shop) {
            shopId = shop.id;
            // Fallback path: user has a shop but activeShopId was null (fresh
            // session, cache miss). Route through the official primitive so
            // every live useShopContext instance picks it up.
            void setActiveShopAndSync(shop.id, { reason: "fallback" });
          } else {
            return;
          }
        }

        const { data: shop } = await supabase.from("shops").select("id, currency, name, logo_url").eq("id", shopId).maybeSingle();
        if (!shop) {
          return;
        }
        setCurrency(shop.currency === 'EUR' ? '€' : shop.currency);
        setShopName(isGroupMode ? (t('dashboard.groupTitle') !== 'dashboard.groupTitle' ? t('dashboard.groupTitle') : 'Grupo — Todas as oficinas') : (shop.name || ''));
        setShopLogoUrl(isGroupMode ? null : (shop.logo_url || null));

        // Grupo Mode → agregar todas as oficinas do dono (RLS já garante que
        // `shops.user_id = auth.uid()`; groupShopIds nunca cruza contas).
        // Modo Oficina → apenas a shop ativa.
        const shopIds: string[] = isGroupMode && groupShopIds.length > 0 ? groupShopIds : [shop.id];

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString();

        const [ordersRes, quotesRes, clientsRes, alertsRes, allOrdersRes, lowStockRes, overdueRes, allQuotesRes, partsUsedRes, invoicesMonthRes, allClientsRes] = await Promise.all([
          supabase.from("work_orders")
            .select("shop_id, total, profit, status, number, created_at, clients(name), vehicles(plate, make, model)")
            .in("shop_id", shopIds)
            .gte("created_at", monthStart)
            .order("created_at", { ascending: false }),
          supabase.from("quotes")
            .select("id", { count: "exact", head: true })
            .in("shop_id", shopIds)
            .in("status", ['draft', 'sent']),
          supabase.from("work_orders")
            .select("client_id")
            .in("shop_id", shopIds)
            .gte("created_at", monthStart),
          supabase.from("alerts")
            .select("id, title, type, status, due_date, created_at")
            .in("shop_id", shopIds)
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(5),
          supabase.from("work_orders")
            .select("shop_id, total, profit, status, created_at")
            .in("shop_id", shopIds)
            .gte("created_at", sixMonthsAgo)
            .in("status", ['completed', 'delivered']),
          supabase.from("parts")
            .select("id, name, stock_quantity, min_stock")
            .in("shop_id", shopIds)
            .eq("active", true),
          supabase.from("invoices")
            .select("id, number, total, due_date, clients(name)")
            .in("shop_id", shopIds)
            .in("status", ['issued', 'partial'])
            .lt("due_date", new Date().toISOString().slice(0, 10)),
          supabase.from("quotes")
            .select("id, status")
            .in("shop_id", shopIds)
            .gte("created_at", sixMonthsAgo),
          supabase.from("stock_movements")
            .select("quantity, parts(name)")
            .in("shop_id", shopIds)
            .eq("type", "out")
            .order("created_at", { ascending: false })
            .limit(100),
          // Faturas do mês para KPI de faturação real
          supabase.from("invoices")
            .select("shop_id, total, subtotal, vat_total, status")
            .in("shop_id", shopIds)
            .gte("created_at", monthStart),
          // Total de clientes ativos (não apagados) — em modo grupo: soma
          // de todas as oficinas; em modo oficina: só a shop atual.
          supabase.from("clients")
            .select("id", { count: "exact", head: true })
            .in("shop_id", shopIds)
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

        // Previous month KPIs (reuses allOrdersRes — no extra queries)
        const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevEnd = new Date(now.getFullYear(), now.getMonth(), 1);
        const prevOrdersAll = (allOrdersRes.data || []).filter((o: any) => {
          const d = new Date(o.created_at);
          return d >= prevStart && d < prevEnd;
        });
        const prevDelivered = prevOrdersAll; // allOrdersRes already filters to completed/delivered
        const prevRevenue = prevDelivered.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
        const prevProfit = prevDelivered.reduce((s: number, o: any) => s + Number(o.profit || 0), 0);
        setPrevKpis({
          revenue: prevRevenue,
          profit: prevProfit,
          serviceCount: prevDelivered.length,
          avgTicket: prevDelivered.length > 0 ? prevRevenue / prevDelivered.length : 0,
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

        allOrders.forEach((o: any) => {
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
        if (isEntryPlan) {
          const monthStart2 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const { count: qCount } = await supabase
            .from("quotes")
            .select("id", { count: "exact", head: true })
            .in("shop_id", shopIds)
            .gte("created_at", monthStart2);
          setMonthlyQuoteCount(qCount || 0);
        }

        // === Per-shop breakdown (apenas em Modo Grupo) ===
        // Query única extra por métrica (2 queries agregadas totais para clientes
        // e veículos), calculando o resto em JS a partir dos dados já obtidos.
        if (isGroupMode && groupShopIds.length > 0) {
          const [clientsPerShopRes, vehiclesPerShopRes] = await Promise.all([
            supabase.from("clients")
              .select("shop_id")
              .in("shop_id", groupShopIds)
              .is("deleted_at", null),
            supabase.from("vehicles")
              .select("shop_id")
              .in("shop_id", groupShopIds),
          ]);
          const cliCount = new Map<string, number>();
          (clientsPerShopRes.data || []).forEach((r: any) => cliCount.set(r.shop_id, (cliCount.get(r.shop_id) || 0) + 1));
          const vehCount = new Map<string, number>();
          (vehiclesPerShopRes.data || []).forEach((r: any) => vehCount.set(r.shop_id, (vehCount.get(r.shop_id) || 0) + 1));

          // Faturação/lucro/serviços do mês corrente por oficina
          const currRev = new Map<string, number>();
          const currProfit = new Map<string, number>();
          const currServices = new Map<string, number>();
          delivered.forEach((o: any) => {
            currRev.set(o.shop_id, (currRev.get(o.shop_id) || 0) + Number(o.total || 0));
            currProfit.set(o.shop_id, (currProfit.get(o.shop_id) || 0) + Number(o.profit || 0));
          });
          orders.forEach((o: any) => {
            currServices.set(o.shop_id, (currServices.get(o.shop_id) || 0) + 1);
          });

          // Faturação mês anterior por oficina para calcular crescimento
          const prevRevByShop = new Map<string, number>();
          (allOrdersRes.data || []).forEach((o: any) => {
            const d = new Date(o.created_at);
            if (d >= prevStart && d < prevEnd) {
              prevRevByShop.set(o.shop_id, (prevRevByShop.get(o.shop_id) || 0) + Number(o.total || 0));
            }
          });

          const breakdown = ownedShops.map((s) => {
            const rev = currRev.get(s.id) || 0;
            const pv = prevRevByShop.get(s.id) || 0;
            const growth = pv > 0 ? ((rev - pv) / pv) * 100 : (rev > 0 ? 100 : 0);
            return {
              id: s.id,
              name: s.name || '—',
              address: s.address,
              revenue: rev,
              profit: currProfit.get(s.id) || 0,
              services: currServices.get(s.id) || 0,
              clients: cliCount.get(s.id) || 0,
              vehicles: vehCount.get(s.id) || 0,
              growth: Math.round(growth),
            };
          });
          setPerShopBreakdown(breakdown);
        } else {
          setPerShopBreakdown([]);
        }
      } catch (error) {
        console.error("Dashboard load error:", error);
      } finally {
        setDataLoaded(true);
      }
  }, [language, activeShopId, isReady, user, isGroupMode, groupShopIds, ownedShops, t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime: refresh dashboard data automatically when relevant tables change for this shop.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!activeShopId) return;
    const debouncedReload = () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => { loadData(); }, 400);
    };
    const tables = [
      "work_orders",
      "quotes",
      "invoices",
      "alerts",
      "appointments",
      "stock_movements",
      "parts",
      "clients",
    ];
    const channel = supabase.channel(`dashboard-live-${activeShopId}`);
    tables.forEach((table) => {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `shop_id=eq.${activeShopId}` },
        debouncedReload,
      );
    });
    channel.subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
  }, [activeShopId, loadData]);

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

  const pctDelta = (curr: number, prev: number): { text: string; tone: 'up' | 'down' | 'flat' } | null => {
    if (!prev && !curr) return null;
    if (!prev) return { text: '— vs mês anterior', tone: 'flat' };
    const pct = ((curr - prev) / prev) * 100;
    if (!isFinite(pct)) return null;
    const rounded = Math.round(pct);
    if (rounded === 0) return { text: '0% vs mês anterior', tone: 'flat' };
    return {
      text: `${rounded > 0 ? '+' : ''}${rounded}% vs mês anterior`,
      tone: rounded > 0 ? 'up' : 'down',
    };
  };

  const stats = [
    { label: t('dashboard.revenueMonth'), value: `${currency}${kpis.revenue.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-500', delta: pctDelta(kpis.revenue, prevKpis.revenue), href: '/financial/reports' },
    { label: t('dashboard.profitMonth'), value: `${currency}${kpis.profit.toFixed(2)}`, icon: TrendingUp, color: 'text-primary', delta: pctDelta(kpis.profit, prevKpis.profit), href: '/financial/reports?view=profit' },
    { label: t('dashboard.servicesMonth'), value: String(kpis.serviceCount), icon: Wrench, color: 'text-blue-500', delta: pctDelta(kpis.serviceCount, prevKpis.serviceCount), href: '/services' },
    { label: t('dashboard.avgTicket'), value: `${currency}${kpis.avgTicket.toFixed(2)}`, icon: BarChart3, color: 'text-purple-500', delta: pctDelta(kpis.avgTicket, prevKpis.avgTicket), href: '/financial/reports?view=ticket' },
    { label: t('dashboard.openQuotes'), value: String(kpis.openQuotes), icon: FileText, color: 'text-amber-500', delta: null, href: '/quotes?status=open' },
    { label: t('dashboard.activeClients'), value: String(kpis.activeClients), icon: Users, color: 'text-cyan-500', delta: null, href: '/clients?filter=active' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-4">
          {isGroupMode ? (
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Layers className="w-6 h-6 text-primary-foreground" />
            </div>
          ) : shopLogoUrl ? (
            <img src={shopLogoUrl} alt={shopName} className="w-12 h-12 rounded-xl object-contain border border-border bg-background" />
          ) : (
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center">
              <Wrench className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <div>
            <h1 className="page-title flex items-center gap-2">
              {shopName || t('dashboard.title')}
              {isGroupMode && (
                <Badge variant="outline" className="text-[10px] border-primary/40 text-primary uppercase tracking-wider">
                  {ownedShops.length} oficinas
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {isGroupMode
                ? `Visão consolidada de todas as oficinas do grupo · ${t('dashboard.subtitle')}`
                : t('dashboard.subtitle')}
            </p>
          </div>
        </div>
        {/* Seletor de contexto — visível apenas para a Oficina Mãe (dono) no plano Garage com >1 oficina */}
        {isOwnerOfGroup && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground hidden sm:inline">Contexto</span>
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="h-9 min-w-[180px] text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    Todas as oficinas ({ownedShops.length})
                  </span>
                </SelectItem>
                {ownedShops.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {s.name || '—'}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

      </div>


      {/* Lite Mode = simplified guided dashboard. The Lite/Pro toggle lives in the topbar. */}


      {/* Welcome + Next Step for guided mode */}
      {isGuidedMode && dataLoaded && (
        <div className="space-y-4">
          <div className="text-center py-4 space-y-2">
            <h2 className="text-2xl sm:text-3xl font-bold">
              {t('dashboard.welcome') || 'Bem-vindo ao GarageFlow'} 👋
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base max-w-md mx-auto">
              {t('dashboard.welcomeSubtitle') || 'Comece em 3 passos simples: crie um cliente, um veículo e um orçamento.'}
            </p>
          </div>

          {/* Single primary CTA — next step */}
          <Link to="/clients" className="block">
            <div className="bg-gradient-to-br from-primary/10 to-primary/20 border-2 border-primary/30 rounded-2xl p-6 sm:p-8 text-center hover:shadow-xl hover:shadow-primary/10 hover:border-primary/50 active:scale-[0.98] transition-all cursor-pointer group">
              <span className="text-4xl sm:text-5xl block mb-3">👤</span>
              <p className="text-lg sm:text-xl font-bold group-hover:text-primary transition-colors">
                {t('dashboard.newClient') || 'Criar primeiro cliente'}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {'O primeiro passo para começar a faturar'}
              </p>
              <div className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm font-semibold group-hover:shadow-lg transition-all">
                {'Começar agora'} <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </Link>

          {/* Secondary actions — subtle */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t('dashboard.newVehicle') || 'Veículo', href: "/vehicles", emoji: "🚗" },
              { label: t('dashboard.newQuote') || 'Orçamento', href: "/quotes/new", emoji: "📋" },
              { label: t('nav.settings') || 'Definições', href: "/settings", emoji: "⚙️" },
            ].map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-card border border-border
                  hover:border-primary/30 hover:bg-primary/5 active:scale-95 transition-all text-center group"
              >
                <span className="text-xl">{action.emoji}</span>
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">{action.label}</span>
              </Link>
            ))}
          </div>

          <div className="text-center text-xs text-muted-foreground">
            {t('appMode.switchToProHint') === 'appMode.switchToProHint'
              ? 'Pronto para mais? Muda para Pro no topo da página para ver tudo.'
              : t('appMode.switchToProHint')}
          </div>
        </div>
      )}

      {/* Quick Actions — full mode */}
      {!isGuidedMode && (
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
      )}

      {/* === Sections hidden for new users === */}
      {!isGuidedMode && (<>

      {/* Trust Signal */}
      {dataLoaded && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Shield className="w-3.5 h-3.5 text-success" />
          <span>{t('dashboard.dataSaved')}</span>
          <span className="text-muted-foreground/50">·</span>
          <span>{t('dashboard.lastUpdate')}</span>
        </div>
      )}

      {/* Plan Banner — celebrates the auto-Pro trial, becomes urgent near the end */}
      {(isEntryPlan || isTrialing) && (() => {
        const ending = isTrialing && trialDaysLeft <= 5;
        const expired = isEntryPlan && !isTrialing;
        const tone = ending
          ? "bg-amber-50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800/50"
          : expired
            ? "bg-destructive/5 border-destructive/30"
            : "bg-primary/5 border-primary/20";
        const iconWrap = ending
          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
          : expired
            ? "bg-destructive/10 text-destructive"
            : "bg-primary/10 text-primary";
        const title = isTrialing
          ? trialDaysLeft > 0
            ? `🎁 Plano Pro grátis ativo — ${trialDaysLeft} ${trialDaysLeft === 1 ? "dia" : "dias"} restantes`
            : "O teu trial Pro termina hoje"
          : "O teu trial Pro terminou — escolhe um plano para continuar";
        const sub = isTrialing
          ? ending
            ? "Ativa um plano agora para não perderes alertas, automações e relatórios."
            : "Tens acesso total a alertas, equipa, relatórios, exportação e mais. Sem cartão de crédito."
          : "Mantém tudo o que ganhaste durante o trial. Cancela quando quiseres.";
        return (
          <div className={`border rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${tone}`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${iconWrap}`}>
                <Star className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
            <Link to="/billing">
              <Button size="sm" className="shrink-0" variant={ending || expired ? "default" : "outline"}>
                <CreditCard className="w-4 h-4 mr-1" />
                {expired ? "Escolher plano" : ending ? "Renovar agora" : "Ver planos"}
              </Button>
            </Link>
          </div>
        );
      })()}

      {/* Usage Nudge for Free users */}
      {isEntryPlan && monthlyQuoteCount > 0 && (
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
            <div key={i} className="bg-card border border-border/60 rounded-xl p-4 space-y-3 shadow-premium-sm">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-9 rounded-lg" />
              </div>
              <Skeleton className="h-7 w-32" />
            </div>
          ))
        ) : (
          stats.map((stat) => (
            <Link
              key={stat.label}
              to={stat.href}
              aria-label={stat.label}
              className="stat-card group relative overflow-hidden cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
            >
              {/* Subtle gradient accent on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              <div className="relative flex items-center justify-between mb-3">
                <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 flex items-center justify-center group-hover:from-primary/25 group-hover:to-primary/10 group-hover:border-primary/20 transition-all duration-300">
                  <stat.icon className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="relative text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">{stat.value}</div>
              {stat.delta && (
                <div
                  className={`relative mt-1 text-[10px] sm:text-[11px] font-medium tabular-nums ${
                    stat.delta.tone === 'up'
                      ? 'text-emerald-500'
                      : stat.delta.tone === 'down'
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }`}
                >
                  {stat.delta.text}
                </div>
              )}
            </Link>
          ))
        )}
      </div>

      {/* === Modo Grupo: Rankings + Breakdown por oficina === */}
      {isGroupMode && dataLoaded && perShopBreakdown.length > 0 && (() => {
        const byRevenue = [...perShopBreakdown].sort((a, b) => b.revenue - a.revenue);
        const byProfit = [...perShopBreakdown].sort((a, b) => b.profit - a.profit);
        const byServices = [...perShopBreakdown].sort((a, b) => b.services - a.services);
        const byGrowth = [...perShopBreakdown].sort((a, b) => b.growth - a.growth);
        const rankings = [
          { label: 'Maior faturação', shop: byRevenue[0], value: `${currency}${byRevenue[0].revenue.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-500' },
          { label: 'Maior lucro', shop: byProfit[0], value: `${currency}${byProfit[0].profit.toFixed(2)}`, icon: TrendingUp, color: 'text-primary' },
          { label: 'Mais serviços', shop: byServices[0], value: `${byServices[0].services}`, icon: Wrench, color: 'text-blue-500' },
          { label: 'Maior crescimento', shop: byGrowth[0], value: `${byGrowth[0].growth >= 0 ? '+' : ''}${byGrowth[0].growth}%`, icon: BarChart3, color: byGrowth[0].growth >= 0 ? 'text-emerald-500' : 'text-destructive' },
        ];
        return (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {rankings.map((r) => (
                <div key={r.label} className="card-premium p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{r.label}</span>
                    <r.icon className={`w-4 h-4 ${r.color}`} />
                  </div>
                  <div className="text-lg font-bold tabular-nums truncate">{r.value}</div>
                  <div className="text-xs text-muted-foreground truncate mt-0.5">{r.shop.name}</div>
                </div>
              ))}
            </div>

            <div className="card-premium p-3 sm:p-5">
              <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Resumo por oficina
              </h2>
              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="py-2 px-3 font-semibold">Oficina</th>
                      <th className="py-2 px-3 font-semibold text-right">Faturação</th>
                      <th className="py-2 px-3 font-semibold text-right">Lucro</th>
                      <th className="py-2 px-3 font-semibold text-right">Serviços</th>
                      <th className="py-2 px-3 font-semibold text-right hidden sm:table-cell">Clientes</th>
                      <th className="py-2 px-3 font-semibold text-right hidden sm:table-cell">Veículos</th>
                      <th className="py-2 px-3 font-semibold text-right">Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRevenue.map((s) => (
                      <tr key={s.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-medium truncate max-w-[220px]">{s.name}</div>
                          {s.address && <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{s.address}</div>}
                        </td>
                        <td className="py-2.5 px-3 text-right mono tabular-nums font-medium">{currency}{s.revenue.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right mono tabular-nums">{currency}{s.profit.toFixed(2)}</td>
                        <td className="py-2.5 px-3 text-right mono tabular-nums">{s.services}</td>
                        <td className="py-2.5 px-3 text-right mono tabular-nums hidden sm:table-cell">{s.clients}</td>
                        <td className="py-2.5 px-3 text-right mono tabular-nums hidden sm:table-cell">{s.vehicles}</td>
                        <td className={`py-2.5 px-3 text-right mono tabular-nums text-xs ${s.growth > 0 ? 'text-emerald-500' : s.growth < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {s.growth > 0 ? '+' : ''}{s.growth}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        );
      })()}

      {/* Charts Row */}
      {!isEntryPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Monthly Revenue Chart */}
          <div className="lg:col-span-2 card-premium p-3 sm:p-5">
            <h2 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              {t('dashboard.revenueChart')}
            </h2>
            {!dataLoaded ? (
              <Skeleton className="h-[180px] w-full rounded-xl" />
            ) : monthlyRevenue.length > 0 ? (
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
          <div className="card-premium p-3 sm:p-5">
            <h2 className="text-xs sm:text-sm font-semibold mb-3 sm:mb-4 flex items-center gap-2">
              <Wrench className="w-4 h-4 text-primary" />
              {language === 'pt' || language === 'pt-BR' ? 'Estado dos Serviços' : t('dashboard.statusChart')}
            </h2>
            {!dataLoaded ? (
              <Skeleton className="h-[160px] w-full rounded-xl" />
            ) : statusDistribution.length > 0 ? (
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
      {!isEntryPlan && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card-premium p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              {t('dashboard.quoteConversion')}
            </h2>
            {!dataLoaded ? (
              <Skeleton className="h-12 w-full rounded-xl" />
            ) : <div className="flex items-center gap-4">
              <div className="text-4xl font-bold text-primary tabular-nums tracking-tight">{conversionRate}%</div>
              <p className="text-xs text-muted-foreground">{t('dashboard.last6months')}</p>
            </div>}
          </div>
          <div className="card-premium p-5">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              {t('dashboard.topParts')}
            </h2>
            {!dataLoaded ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : topParts.length > 0 ? (
              <div className="space-y-2">
                {topParts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="truncate">{p.name}</span>
                    <span className="mono font-medium text-muted-foreground">{p.count}x</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                As peças mais utilizadas aparecerão automaticamente após o registo dos primeiros serviços.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Alerts */}
      {pendingAlerts.length > 0 && (
        <div className="card-premium p-5">
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

      {/* GarageFlow Market activity */}
      <MarketActivityCard shopId={activeShopId} userId={user?.id ?? null} />

      {/* Recent Services */}
      <div className="card-premium p-5">
        <h2 className="text-lg font-semibold mb-4">{t('dashboard.recentServices')}</h2>
        {!dataLoaded ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
          </div>
        ) : recentServices.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            {t('dashboard.noServices')} — os últimos serviços criados aparecerão aqui automaticamente.
          </p>
        ) : (
          <div className="space-y-2.5">
            {recentServices.map(s => {
              const v = (s.vehicles as any) || {};
              const plate = v.plate || '';
              const makeModel = [v.make, v.model].filter(Boolean).join(' ');
              const time = s.created_at ? new Date(s.created_at).toLocaleTimeString(language === 'pt' ? 'pt-PT' : undefined, { hour: '2-digit', minute: '2-digit' }) : '';
              const shopBadge = isGroupMode ? (ownedShops.find(o => o.id === s.shop_id)?.name || null) : null;
              return (
                <div key={s.number} className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="mono text-sm font-medium">{s.number}</span>
                      {plate && <span className="mono text-[11px] px-1.5 py-0.5 rounded bg-muted/70 border border-border/60">{plate}</span>}
                      <span className="text-xs text-muted-foreground truncate">{makeModel}</span>
                      {shopBadge && <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{shopBadge}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span className="truncate">{(s.clients as any)?.name || '—'}</span>
                      {s.status && <><span>·</span><span>{t(`service.${s.status}`)}</span></>}
                      {time && <><span>·</span><span>{time}</span></>}
                    </div>
                  </div>
                  <span className="mono font-semibold shrink-0 text-sm">{currency}{(s.total || 0).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}
