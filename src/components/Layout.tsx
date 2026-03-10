import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, Users, Car, FileText, Wrench, Settings, 
  Menu, X, LogOut, ChevronRight, Globe, CreditCard, Bell, Shield, UserPlus, MessageCircle,
  Receipt, ChevronDown, CalendarDays, BookOpen, Package, ClipboardCheck, Star, Megaphone, HardHat
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useSubscription } from "@/hooks/useSubscription";
import { useShopContext } from "@/hooks/useShopContext";
import ShopSwitcher from "@/components/ShopSwitcher";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Language } from "@/i18n/translations";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAlertCount, setPendingAlertCount] = useState(0);
  const [shopName, setShopName] = useState("");
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { isSuperAdmin } = useSuperAdmin();
  const { canUseFeature, plan, subscriptionLoaded } = useSubscription();
  const { shops, activeShopId, switchShop, hasMultipleShops } = useShopContext();

  useEffect(() => {
    const loadAlertCount = async () => {
      if (!activeShopId) return;
      const { data: shop } = await supabase.from("shops").select("id, name").eq("id", activeShopId).maybeSingle();
      if (!shop) return;
      setShopName(shop.name || "");
      const { count } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shop.id)
        .eq("status", "pending");
      setPendingAlertCount(count || 0);
    };
    loadAlertCount();
    const interval = setInterval(loadAlertCount, 60000);
    return () => clearInterval(interval);
  }, [activeShopId]);

  const [financialOpen, setFinancialOpen] = useState(
    location.pathname.startsWith('/invoices') || location.pathname.startsWith('/financial')
  );

  const navItems = [
    { path: "/dashboard", label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: "/clients", label: t('nav.clients'), icon: Users },
    { path: "/vehicles", label: t('nav.vehicles'), icon: Car },
    { path: "/quotes", label: t('nav.quotes'), icon: FileText },
    { path: "/services", label: t('nav.services'), icon: Wrench },
    { path: "/agenda", label: t('nav.agenda'), icon: CalendarDays },
    { path: "/catalog", label: t('nav.catalog'), icon: BookOpen },
    { path: "/stock", label: t('nav.stock'), icon: Package },
    { path: "/inspections", label: t('nav.inspections'), icon: ClipboardCheck },
    ...(canUseFeature('loyalty') ? [{ path: "/loyalty", label: t('nav.loyalty'), icon: Star, planBadge: 'Garage' as const }] : []),
    ...(canUseFeature('marketing') ? [{ path: "/marketing", label: t('nav.marketing'), icon: Megaphone, planBadge: 'Garage' as const }] : []),
    { path: "/alerts", label: t('nav.alerts'), icon: Bell, badge: pendingAlertCount },
    { path: "/team", label: t('nav.team'), icon: UserPlus },
    ...(canUseFeature('chatbot') ? [{ path: "/chat", label: t('nav.chat'), icon: MessageCircle }] : []),
    { path: "/billing", label: t('nav.billing'), icon: CreditCard },
    { path: "/settings", label: t('nav.settings'), icon: Settings },
  ];

  const financialSubItems = [
    { path: "/invoices", label: t('nav.invoices') },
    { path: "/financial/reports", label: t('nav.financialReports') },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Get current page title for mobile header
  const currentNav = navItems.find(item => item.path === location.pathname);
  const pageTitle = currentNav?.label || shopName || "GarageFlow";

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[270px] lg:w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Sidebar header */}
        <div className="h-14 lg:h-16 flex items-center px-4 lg:px-5 border-b border-sidebar-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center shrink-0">
              <Wrench className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-sidebar-accent-foreground tracking-tight">
              Garage<span className="text-sidebar-primary">Flow</span>
            </span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {navItems.map((item, idx) => {
            const isActive = location.pathname === item.path;
            const navLink = (
              <Link key={item.path} to={item.path} onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}>
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
                {'badge' in item && item.badge && item.badge > 0 ? (
                  <span className="ml-auto bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : isActive ? (
                  <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" />
                ) : null}
              </Link>
            );

            // Insert Financial submenu before Alerts
            if (item.path === "/alerts") {
              const finActive = location.pathname.startsWith('/invoices') || location.pathname.startsWith('/financial');
              return (
                <div key="fin-group">
                  <button
                    onClick={() => setFinancialOpen(!financialOpen)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full ${
                      finActive ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                    }`}>
                    <Receipt className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{t('nav.financial')}</span>
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform ${financialOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {financialOpen && (
                    <div className="ml-7 mt-0.5 space-y-0.5">
                      {financialSubItems.map(fi => {
                        const fiActive = location.pathname === fi.path;
                        return (
                          <Link key={fi.path} to={fi.path} onClick={() => setSidebarOpen(false)}
                            className={`block px-3 py-2 rounded-lg text-sm transition-all ${
                              fiActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground hover:bg-sidebar-accent'
                            }`}>
                            {fi.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                  {navLink}
                </div>
              );
            }
            return navLink;
          })}
        </nav>

        {/* Admin Link */}
        {isSuperAdmin && (
          <div className="px-2.5 pb-1">
            <Link to="/admin" onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all">
              <Shield className="w-[18px] h-[18px] shrink-0" />
              {t('nav.adminPanel')}
            </Link>
          </div>
        )}

        {/* Shop Switcher (GARAGE plan multi-shop) */}
        {(hasMultipleShops || canUseFeature('multiShop')) && (
          <ShopSwitcher
            shops={shops}
            activeShopId={activeShopId}
            onSwitch={(id) => {
              switchShop(id);
              // Force reload to refresh all shop-dependent data
              setTimeout(() => window.location.reload(), 100);
            }}
            showCreate={canUseFeature('multiShop')}
          />
        )}

        {/* Language Selector */}
        <div className="px-2.5 pb-1.5">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Globe className="w-4 h-4 text-sidebar-foreground shrink-0" />
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="h-8 bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Logout */}
        <div className="p-2.5 border-t border-sidebar-border shrink-0">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-destructive hover:bg-destructive/10 transition-all">
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {t('auth.logout')}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top header bar */}
        <header className="h-14 lg:h-16 border-b border-border flex items-center px-3 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30 shrink-0">
          {/* Mobile: hamburger + page title */}
          <Button variant="ghost" size="icon" className="lg:hidden mr-2 shrink-0 h-9 w-9" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>
          
          <span className="text-sm font-semibold truncate lg:hidden">{pageTitle}</span>

          {/* Desktop: show shop name */}
          <span className="text-sm font-medium text-muted-foreground hidden lg:block truncate">{shopName}</span>
          
          {/* Spacer */}
          <div className="flex-1" />

          {/* Alerts shortcut */}
          {pendingAlertCount > 0 && (
            <Link to="/alerts" className="relative p-2 rounded-lg hover:bg-muted transition-colors mr-1">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingAlertCount > 9 ? '9+' : pendingAlertCount}
              </span>
            </Link>
          )}

          {/* Mobile logout button - always visible */}
          <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9 text-muted-foreground hover:text-destructive" onClick={handleLogout} title={t('auth.logout')}>
            <LogOut className="w-[18px] h-[18px]" />
          </Button>
        </header>

        {/* Page content */}
        <div className="flex-1 p-3 sm:p-4 lg:p-6 animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}