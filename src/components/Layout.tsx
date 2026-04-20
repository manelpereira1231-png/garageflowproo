import { useState, useEffect, Suspense } from "react";
import { Link, useLocation } from "react-router-dom";
import MarketInspectionBanner from "@/components/MarketInspectionBanner";
import {
  LayoutDashboard,
  Users,
  Car,
  FileText,
  Wrench,
  Settings,
  Menu,
  X,
  LogOut,
  ChevronRight,
  Globe,
  CreditCard,
  Bell,
  Shield,
  UserPlus,
  MessageCircle,
  Receipt,
  ChevronDown,
  CalendarDays,
  BookOpen,
  Package,
  ClipboardCheck,
  Star,
  Megaphone,
  HardHat,
  Zap,
  Code,
  Search,
  Gift,
  ShieldCheck,
  Lock,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useSubscription } from "@/hooks/useSubscription";
import { useShopContext } from "@/hooks/useShopContext";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import ShopSwitcher from "@/components/ShopSwitcher";
import AppModeToggle from "@/components/AppModeToggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Language } from "@/i18n/translations";

type NavItem = {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  planBadge?: "Pro" | "Garage";
  locked?: boolean;
};

type FinancialNavItem = {
  path: string;
  label: string;
  planBadge?: "Pro" | "Garage";
  locked?: boolean;
};

const ESSENTIAL_NAV_PATHS = ["/dashboard", "/clients", "/vehicles", "/quotes", "/settings"];

const isFinancialRoute = (pathname: string) =>
  pathname.startsWith("/invoices") || pathname.startsWith("/financial");

const isPathActive = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

const isEssentialPath = (pathname: string) =>
  ESSENTIAL_NAV_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAlertCount, setPendingAlertCount] = useState(0);
  const [pendingMarketCount, setPendingMarketCount] = useState(0);
  const [shopName, setShopName] = useState("");
  const [isCarityPartner, setIsCarityPartner] = useState(false);
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const { isSuperAdmin } = useSuperAdmin();
  const { canUseFeature } = useSubscription();
  const { shops, activeShopId, switchShop, hasMultipleShops } = useShopContext();
  const { isReady, user } = useAuthReady();
  const { isGuidedMode } = useOnboardingStatus();

  useEffect(() => {
    const loadAlertCount = async () => {
      if (!activeShopId) return;
      const { data: shop } = await supabase.from("shops").select("id, name, is_carity_partner, carity_active").eq("id", activeShopId).maybeSingle();
      if (!shop) return;
      setShopName(shop.name || "");
      setIsCarityPartner(shop.is_carity_partner === true && shop.carity_active !== false);
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

  // Global realtime listener for new inspection offers (Market) + pending count
  useEffect(() => {
    if (!activeShopId || !isCarityPartner) {
      setPendingMarketCount(0);
      return;
    }

    const loadPendingMarket = async () => {
      const { count } = await supabase
        .from("carity_inspection_offers")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", activeShopId)
        .eq("status", "pending");
      setPendingMarketCount(count || 0);
    };
    loadPendingMarket();

    const channel = supabase
      .channel(`global-offers-${activeShopId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "carity_inspection_offers",
          filter: `shop_id=eq.${activeShopId}`,
        },
        (payload: any) => {
          loadPendingMarket();
          if (payload.eventType === "INSERT") {
            toast.info("🚗 Nova inspeção Market disponível!", {
              description: "Tem um novo pedido de inspeção para aceitar.",
              action: {
                label: "Ver",
                onClick: () => window.location.assign("/market/inspections"),
              },
              duration: 15000,
            });
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeShopId, isCarityPartner]);

  // Lite/Pro mode is fully user-controlled via the topbar toggle (Binance-style).
  // We no longer auto-exit Lite based on data activity — keeps the experience
  // predictable across sessions.

  const [financialOpen, setFinancialOpen] = useState(isFinancialRoute(location.pathname));

  const navItems: NavItem[] = [
    { path: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    { path: "/clients", label: t("nav.clients"), icon: Users },
    { path: "/vehicles", label: t("nav.vehicles"), icon: Car },
    { path: "/quotes", label: t("nav.quotes"), icon: FileText },
    { path: "/services", label: t("nav.services"), icon: Wrench },
    { path: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    { path: "/catalog", label: t("nav.catalog"), icon: BookOpen },
    { path: "/stock", label: t("nav.stock"), icon: Package },
    { path: "/inspections", label: t("nav.inspections"), icon: ClipboardCheck },
    { path: "/workshop", label: t("nav.workshop"), icon: HardHat },
    { path: "/warranties", label: t("nav.warranties"), icon: ShieldCheck },
    { path: "/market/inspections", label: "Market", icon: ShieldCheck, badge: pendingMarketCount },
    ...(isCarityPartner ? [{ path: "/market/wallet", label: "Carteira Market", icon: Wallet }] : []),
    { path: "/loyalty", label: t("nav.loyalty"), icon: Star, planBadge: "Garage", locked: !canUseFeature("loyalty") },
    { path: "/marketing", label: t("nav.marketing"), icon: Megaphone, planBadge: "Garage", locked: !canUseFeature("marketing") },
    { path: "/automations", label: t("nav.automations"), icon: Zap, planBadge: "Garage", locked: !canUseFeature("automations") },
    { path: "/developers", label: "API", icon: Code, planBadge: "Garage", locked: !canUseFeature("api") },
    {
      path: "/alerts",
      label: t("nav.alerts"),
      icon: Bell,
      badge: pendingAlertCount,
      planBadge: !canUseFeature("basicAlerts") ? "Pro" : undefined,
      locked: !canUseFeature("basicAlerts"),
    },
    { path: "/team", label: t("nav.team"), icon: UserPlus, planBadge: !canUseFeature("teamManagement") ? "Pro" : undefined, locked: !canUseFeature("teamManagement") },
    { path: "/chat", label: t("nav.chat"), icon: MessageCircle, planBadge: "Garage", locked: !canUseFeature("chatbot") },
    { path: "/referrals", label: t("nav.referrals"), icon: Gift },
    { path: "/billing", label: t("nav.billing"), icon: CreditCard },
    { path: "/settings", label: t("nav.settings"), icon: Settings },
  ];

  const financialSubItems: FinancialNavItem[] = [
    { path: "/invoices", label: t("nav.invoices") },
    { path: "/financial/reports", label: t("nav.financialReports"), planBadge: !canUseFeature("basicReports") ? "Pro" : undefined, locked: !canUseFeature("basicReports") },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const currentNav = navItems.find((item) => isPathActive(location.pathname, item.path));
  const pageTitle = currentNav?.label || shopName || "GarageFlow";
  const visibleNavItems = isGuidedMode
    ? navItems.filter((item) => ESSENTIAL_NAV_PATHS.includes(item.path) || item.path === "/market/inspections")
    : navItems;

  const liteHintLabel =
    t("appMode.liteSidebarHint") === "appMode.liteSidebarHint"
      ? "Modo Lite ativo — mostramos só o essencial. Muda para Pro no topo para veres tudo."
      : t("appMode.liteSidebarHint");

  return (
    <div className="min-h-screen flex w-full bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 h-screen w-[270px] lg:w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
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

        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-0.5">
          {isGuidedMode && (
            <div className="mb-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  ✨ Lite
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-sidebar-foreground/75">
                {liteHintLabel}
              </p>
            </div>
          )}

          {visibleNavItems.map((item) => {
            const isActive = isPathActive(location.pathname, item.path);
            const navLink = (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  {item.planBadge && (
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                        isActive
                          ? "bg-sidebar-primary-foreground/10 text-sidebar-primary-foreground/80"
                          : "bg-sidebar-accent text-sidebar-foreground/70"
                      }`}
                    >
                      {item.planBadge}
                    </span>
                  )}
                  {item.locked && <Lock className="w-3.5 h-3.5 opacity-70" />}
                  {item.badge && item.badge > 0 ? (
                    <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                  {isActive ? <ChevronRight className="w-3.5 h-3.5" /> : null}
                </div>
              </Link>
            );

            if (item.path === "/alerts") {
              const finActive = isFinancialRoute(location.pathname);
              return (
                <div key="fin-group">
                  <button
                    onClick={() => setFinancialOpen(!financialOpen)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 w-full ${
                      finActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <Receipt className="w-[18px] h-[18px] shrink-0" />
                    <span className="truncate">{t("nav.financial")}</span>
                    <ChevronDown className={`w-3.5 h-3.5 ml-auto shrink-0 transition-transform ${financialOpen ? "rotate-180" : ""}`} />
                  </button>
                  {financialOpen && (
                    <div className="ml-7 mt-0.5 space-y-0.5">
                      {financialSubItems.map((fi) => {
                        const fiActive = isPathActive(location.pathname, fi.path);
                        return (
                          <Link
                            key={fi.path}
                            to={fi.path}
                            onClick={() => setSidebarOpen(false)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all ${
                              fiActive
                                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                                : "text-sidebar-foreground hover:bg-sidebar-accent"
                            }`}
                          >
                            <span className="truncate">{fi.label}</span>
                            <div className="ml-auto flex items-center gap-1.5 shrink-0">
                              {fi.planBadge && (
                                <span
                                  className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                    fiActive
                                      ? "bg-sidebar-primary-foreground/10 text-sidebar-primary-foreground/80"
                                      : "bg-sidebar-accent text-sidebar-foreground/70"
                                  }`}
                                >
                                  {fi.planBadge}
                                </span>
                              )}
                              {fi.locked && <Lock className="w-3.5 h-3.5 opacity-70" />}
                            </div>
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

        {isSuperAdmin && (
          <div className="px-2.5 pb-1">
            <Link
              to="/admin"
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all"
            >
              <Shield className="w-[18px] h-[18px] shrink-0" />
              {t("nav.adminPanel")}
            </Link>
          </div>
        )}

        {(hasMultipleShops || canUseFeature("multiShop")) && (
          <ShopSwitcher
            shops={shops}
            activeShopId={activeShopId}
            onSwitch={(id) => {
              switchShop(id);
              setTimeout(() => window.location.reload(), 100);
            }}
            showCreate={canUseFeature("multiShop")}
          />
        )}

        <div className="px-2.5 pb-1.5">
          <div className="flex items-center gap-2 px-3 py-1.5">
            <Globe className="w-4 h-4 text-sidebar-foreground shrink-0" />
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="h-8 bg-sidebar-accent border-sidebar-border text-sidebar-foreground text-xs flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pt">🇵🇹 Português</SelectItem>
                <SelectItem value="pt-BR">🇧🇷 Brasileiro</SelectItem>
                <SelectItem value="en">🇬🇧 English</SelectItem>
                <SelectItem value="es">🇪🇸 Español</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-2.5 border-t border-sidebar-border shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-destructive hover:bg-destructive/10 transition-all"
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {t("auth.logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        <MarketInspectionBanner shopId={activeShopId} isPartner={isCarityPartner} />
        <header className="h-14 lg:h-16 border-b border-border flex items-center px-3 lg:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-30 shrink-0">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2 shrink-0 h-9 w-9" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>

          <span className="text-sm font-semibold truncate lg:hidden">{pageTitle}</span>

          <span className="text-sm font-medium text-muted-foreground hidden lg:block truncate">{shopName}</span>

          <button
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden lg:flex items-center gap-2 ml-4 px-3 py-1.5 rounded-lg border border-border bg-muted/50 hover:bg-muted text-muted-foreground text-xs transition-all"
          >
            <Search className="w-3.5 h-3.5" />
            {t("common.search")}...
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono">⌘K</kbd>
          </button>

          <div className="flex-1" />

          {/* Lite ⇄ Pro mode toggle — Binance/Coinbase style, always visible */}
          <AppModeToggle className="mr-2" compact />

          {pendingAlertCount > 0 && (
            <Link to="/alerts" className="relative p-2 rounded-lg hover:bg-muted transition-colors mr-1">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                {pendingAlertCount > 9 ? "9+" : pendingAlertCount}
              </span>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-9 w-9 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            title={t("auth.logout")}
          >
            <LogOut className="w-[18px] h-[18px]" />
          </Button>
        </header>

        <div className="flex-1 p-3 sm:p-4 lg:p-6">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
