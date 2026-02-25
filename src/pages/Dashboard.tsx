import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, FileText, Wrench, Users, DollarSign, BarChart3 } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link } from "react-router-dom";

interface KPIData {
  revenue: number;
  profit: number;
  serviceCount: number;
  avgTicket: number;
  openQuotes: number;
  activeClients: number;
}

export default function Dashboard() {
  const { t } = useLanguage();
  const [kpis, setKpis] = useState<KPIData>({ revenue: 0, profit: 0, serviceCount: 0, avgTicket: 0, openQuotes: 0, activeClients: 0 });
  const [recentServices, setRecentServices] = useState<any[]>([]);
  const [currency, setCurrency] = useState("€");
  const [shopName, setShopName] = useState("");
  const [shopLogoUrl, setShopLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: shop } = await supabase.from("shops").select("id, currency, name, logo_url").eq("user_id", user.id).single();
      if (!shop) return;
      setCurrency(shop.currency === 'EUR' ? '€' : shop.currency);
      setShopName(shop.name || '');
      setShopLogoUrl(shop.logo_url || null);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: orders } = await supabase.from("work_orders")
        .select("total, profit, status, number, created_at, clients(name), vehicles(make, model)")
        .eq("shop_id", shop.id)
        .gte("created_at", monthStart)
        .order("created_at", { ascending: false });

      const delivered = (orders || []).filter(o => ['completed', 'delivered'].includes(o.status));
      const revenue = delivered.reduce((s, o) => s + (o.total || 0), 0);
      const profit = delivered.reduce((s, o) => s + (o.profit || 0), 0);

      const { count: openQuotes } = await supabase.from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .in("status", ['draft', 'sent']);

      const { data: clientsData } = await supabase.from("work_orders")
        .select("client_id")
        .eq("shop_id", shop.id)
        .gte("created_at", monthStart);
      const uniqueClients = new Set((clientsData || []).map(c => c.client_id));

      setKpis({
        revenue,
        profit,
        serviceCount: (orders || []).length,
        avgTicket: delivered.length > 0 ? revenue / delivered.length : 0,
        openQuotes: openQuotes || 0,
        activeClients: uniqueClients.size,
      });

      setRecentServices((orders || []).slice(0, 5));
    };
    loadData();
  }, []);

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
          {/* Shop Logo */}
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
