import { useState, useEffect, Suspense, useMemo, useCallback } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Star as StarIcon,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { useSidebarPrefs } from "@/hooks/useSidebarPrefs";
import SidebarCustomizer from "@/components/SidebarCustomizer";
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
import ThemeToggle from "@/components/ThemeToggle";
import AppModeToggle from "@/components/AppModeToggle";
import { prefetchRoute } from "@/lib/routePrefetch";
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

// Lite Mode: only the 5 essentials a workshop needs daily.
// Clientes, Veículos, Orçamentos, Serviços, Definições.
const ESSENTIAL_NAV_PATHS = ["/clients", "/vehicles", "/quotes", "/services", "/billing", "/settings"];

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
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { isSuperAdmin } = useSuperAdmin();
  const { canUseFeature } = useSubscription();
  const { shops, activeShopId, switchShop, hasMultipleShops } = useShopContext();
  const { isReady, user } = useAuthReady();
  const { isGuidedMode } = useOnboardingStatus();
  const sidebarPrefs = useSidebarPrefs(activeShopId);

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
            // Respect per-module notification mute (sidebar prefs)
            try {
              const raw = localStorage.getItem(`garageflow_sidebar_prefs_${activeShopId}`);
              if (raw && JSON.parse(raw)?.mutedNotif?.includes("/market/inspections")) return;
            } catch { /* ignore */ }
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

  const navItems: NavItem[] = useMemo(() => [
    { path: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard },
    // Operação
    { path: "/clients", label: t("nav.clients"), icon: Users },
    { path: "/vehicles", label: t("nav.vehicles"), icon: Car },
    { path: "/quotes", label: t("nav.quotes"), icon: FileText },
    { path: "/services", label: t("nav.services"), icon: Wrench },
    { path: "/agenda", label: t("nav.agenda"), icon: CalendarDays },
    { path: "/inspections", label: t("nav.inspections"), icon: ClipboardCheck },
    { path: "/workshop", label: t("nav.workshop"), icon: HardHat },
    // Catálogo
    { path: "/catalog", label: t("nav.catalog"), icon: BookOpen },
    { path: "/stock", label: t("nav.stock"), icon: Package },
    { path: "/warranties", label: t("nav.warranties"), icon: ShieldCheck },
    // Financeiro
    { path: "/invoices", label: t("nav.invoices"), icon: Receipt },
    { path: "/financial/reports", label: t("nav.financialReports"), icon: Receipt, planBadge: !canUseFeature("basicReports") ? "Pro" : undefined, locked: !canUseFeature("basicReports") },
    { path: "/billing", label: t("nav.billing"), icon: CreditCard },
    // Crescimento
    { path: "/marketing", label: t("nav.marketing"), icon: Megaphone, planBadge: "Garage", locked: !canUseFeature("marketing") },
    { path: "/automations", label: t("nav.automations"), icon: Zap, planBadge: "Garage", locked: !canUseFeature("automations") },
    { path: "/loyalty", label: t("nav.loyalty"), icon: Star, planBadge: "Garage", locked: !canUseFeature("loyalty") },
    { path: "/referrals", label: t("nav.referrals"), icon: Gift },
    { path: "/chat", label: t("nav.chat"), icon: MessageCircle, planBadge: "Garage", locked: !canUseFeature("chatbot") },
    {
      path: "/alerts",
      label: t("nav.alerts"),
      icon: Bell,
      badge: pendingAlertCount,
      planBadge: !canUseFeature("basicAlerts") ? "Pro" : undefined,
      locked: !canUseFeature("basicAlerts"),
    },
    // Market
    { path: "/market/inspections", label: "Market", icon: ShieldCheck, badge: pendingMarketCount },
    ...(isCarityPartner ? [{ path: "/market/wallet", label: "Carteira Market", icon: Wallet }] : []),
    // Sistema
    { path: "/team", label: t("nav.team"), icon: UserPlus, planBadge: !canUseFeature("teamManagement") ? "Pro" : undefined, locked: !canUseFeature("teamManagement") },
    { path: "/developers", label: "API", icon: Code, planBadge: "Garage", locked: !canUseFeature("api") },
    { path: "/settings", label: t("nav.settings"), icon: Settings },
  ], [canUseFeature, pendingAlertCount, pendingMarketCount, t, isCarityPartner]);

  // Logical grouping for premium SaaS feel (Linear/Notion-style).
  // Order optimized for workshop daily priority: day-to-day ops first, money next,
  // then growth/market/system. Catálogo & Stock goes LAST — it's reference data,
  // not something a workshop opens every day.
  const NAV_GROUPS: { id: string; label: string; paths: string[] }[] = useMemo(() => [
    { id: "ops", label: "Operação", paths: ["/clients","/vehicles","/quotes","/services","/agenda","/inspections","/workshop"] },
    { id: "finance", label: "Financeiro", paths: ["/invoices","/financial/reports","/billing"] },
    { id: "growth", label: "Crescimento", paths: ["/alerts","/marketing","/automations","/loyalty","/referrals","/chat"] },
    { id: "market", label: "Market", paths: ["/market/inspections","/market/wallet"] },
    { id: "system", label: "Sistema", paths: ["/team","/developers","/settings"] },
    { id: "catalog", label: "Catálogo & Stock", paths: ["/catalog","/stock","/warranties"] },
  ], []);

  const groupStateKey = `garageflow_sidebar_groups_${activeShopId || "global"}`;
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(groupStateKey);
      if (raw) return JSON.parse(raw);
    } catch { /* ignore */ }
    return { ops: true, catalog: false, finance: false, growth: false, market: false, system: false };
  });
  useEffect(() => {
    // Auto-open the group containing the current route for discoverability.
    const activeGroup = NAV_GROUPS.find(g => g.paths.some(p => isPathActive(location.pathname, p)));
    if (activeGroup && !openGroups[activeGroup.id]) {
      setOpenGroups(prev => ({ ...prev, [activeGroup.id]: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);
  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [id]: !prev[id] };
      try { localStorage.setItem(groupStateKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const handleLogout = async () => {
    sessionStorage.removeItem("garageflow_user_type_cache");
    await supabase.auth.signOut();
  };

  const handlePrefetch = useCallback((path: string) => {
    prefetchRoute(path);
  }, []);

  const currentNav = navItems.find((item) => isPathActive(location.pathname, item.path));
  const pageTitle = currentNav?.label || shopName || "GarageFlow";
  const baseVisibleItems = isGuidedMode
    ? navItems.filter((item) => ESSENTIAL_NAV_PATHS.includes(item.path) || item.path === "/market/inspections")
    : navItems.filter((item) => !sidebarPrefs.isHidden(item.path));

  // Split: favorites (user-ordered) + the rest. Disabled in guided mode for simplicity.
  const favoriteItems = isGuidedMode
    ? []
    : sidebarPrefs.favorites
        .map((p) => baseVisibleItems.find((i) => i.path === p))
        .filter((x): x is NavItem => Boolean(x));
  const regularItems = isGuidedMode
    ? baseVisibleItems
    : baseVisibleItems.filter((i) => !sidebarPrefs.isFavorite(i.path));

  const liteHintLabel =
    t("appMode.liteSidebarHint") === "appMode.liteSidebarHint"
      ? "Modo Lite ativo — mostramos só o essencial. Usa o botão em baixo para mudar para Pro."
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

          {(() => {
            const renderItem = (item: NavItem, opts: { fav: boolean; index?: number; total?: number }) => {
              const isActive = isPathActive(location.pathname, item.path);
              const muted = sidebarPrefs.isMuted(item.path);
              const showBadge = !muted && item.badge && item.badge > 0;
              const navLink = (
                <Link
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  onMouseEnter={() => handlePrefetch(item.path)}
                  onFocus={() => handlePrefetch(item.path)}
                  onTouchStart={() => handlePrefetch(item.path)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <div className="ml-auto flex items-center gap-1 shrink-0">
                    {!isGuidedMode && opts.fav && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); sidebarPrefs.moveFavorite(item.path, -1); }}
                          disabled={opts.index === 0}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-background/20 disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Subir"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); sidebarPrefs.moveFavorite(item.path, 1); }}
                          disabled={opts.total !== undefined && opts.index === opts.total - 1}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-background/20 disabled:opacity-20 disabled:hover:bg-transparent"
                          title="Descer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </>
                    )}
                    {!isGuidedMode && (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); sidebarPrefs.toggleFavorite(item.path); }}
                        className={`p-0.5 rounded hover:bg-background/20 transition-opacity ${
                          opts.fav ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                        title={opts.fav ? "Remover dos favoritos" : "Fixar nos favoritos"}
                      >
                        <StarIcon className={`w-3.5 h-3.5 ${opts.fav ? "fill-current" : ""}`} />
                      </button>
                    )}
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
                    {showBadge ? (
                      <span className="bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {item.badge! > 99 ? "99+" : item.badge}
                      </span>
                    ) : null}
                    {isActive ? <ChevronRight className="w-3.5 h-3.5" /> : null}
                  </div>
                </Link>
              );

              return <div key={item.path}>{navLink}</div>;
            };

            // Dashboard always pinned at very top (outside groups).
            const dashboardItem = regularItems.find(i => i.path === "/dashboard");
            const groupedRegular = regularItems.filter(i => i.path !== "/dashboard");

            return (
              <>
                {favoriteItems.length > 0 && (
                  <div className="mb-2">
                    <div className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/50 flex items-center gap-1.5">
                      <StarIcon className="w-3 h-3 fill-current" /> Favoritos
                    </div>
                    {favoriteItems.map((it, i) => renderItem(it, { fav: true, index: i, total: favoriteItems.length }))}
                    <div className="mt-2 border-t border-sidebar-border/60" />
                  </div>
                )}

                {dashboardItem && (
                  <div className="mb-2">{renderItem(dashboardItem, { fav: false })}</div>
                )}

                {isGuidedMode
                  ? groupedRegular.map((it) => renderItem(it, { fav: false }))
                  : NAV_GROUPS.map((group) => {
                      const groupItems = groupedRegular.filter(i => group.paths.includes(i.path));
                      if (groupItems.length === 0) return null;
                      const open = openGroups[group.id];
                      const hasActive = groupItems.some(i => isPathActive(location.pathname, i.path));
                      const totalBadge = groupItems.reduce((sum, i) => sum + (!sidebarPrefs.isMuted(i.path) && i.badge ? i.badge : 0), 0);
                      return (
                        <div key={group.id} className="mb-1">
                          <button
                            onClick={() => toggleGroup(group.id)}
                            className={`flex items-center w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-md ${
                              hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/55 hover:text-sidebar-foreground"
                            }`}
                          >
                            <ChevronDown className={`w-3 h-3 mr-1.5 transition-transform ${open ? "" : "-rotate-90"}`} />
                            <span className="flex-1 text-left">{group.label}</span>
                            {!open && totalBadge > 0 && (
                              <span className="bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                                {totalBadge > 99 ? "99+" : totalBadge}
                              </span>
                            )}
                          </button>
                          {open && (
                            <div className="space-y-0.5 mt-0.5 animate-accordion-down overflow-hidden">
                              {groupItems.map((it) => renderItem(it, { fav: false }))}
                            </div>
                          )}
                        </div>
                      );
                    })}
              </>
            );
          })()}
        </nav>

        {!isGuidedMode && (
          <div className="px-2.5 pt-1 border-t border-sidebar-border">
            <SidebarCustomizer
              shopId={activeShopId}
              items={navItems.map((i) => ({ path: i.path, label: i.label }))}
            />
          </div>
        )}

        <div className="px-2.5 pt-2 pb-1 border-t border-sidebar-border">
          <AppModeToggle className="w-full justify-between" />
        </div>

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
              navigate(location.pathname, { replace: true });
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
                <SelectItem value="hi">🇮🇳 हिन्दी</SelectItem>
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
        <header className="h-14 lg:h-16 border-b border-border/60 flex items-center px-3 lg:px-6 bg-card/70 backdrop-blur-xl sticky top-0 z-30 shrink-0 shadow-premium-sm">
          <Button variant="ghost" size="icon" className="lg:hidden mr-2 shrink-0 h-9 w-9" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </Button>

          <span className="text-sm font-semibold truncate lg:hidden">{pageTitle}</span>

          <span className="text-sm font-medium text-muted-foreground hidden lg:block truncate tracking-tight">{shopName}</span>

          <div className="flex-1" />

          <ThemeToggle className="mr-1" />

          {pendingAlertCount > 0 && (
            <Link to="/alerts" className="relative p-2 rounded-lg hover:bg-muted transition-colors mr-1 group">
              <Bell className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-background">
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

        <div className="flex-1 p-3 sm:p-4 lg:p-6 page-in">
          {/* No fallback — keeps the previous page visible until the next chunk
              is ready. Combined with hover/idle prefetch, navigation feels instant. */}
          <Suspense fallback={null}>
            {children}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
