import { useState, useEffect, Suspense, useMemo, useCallback, useRef } from "react";
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
  TrendingUp,
} from "lucide-react";
import { useSidebarPrefs } from "@/hooks/useSidebarPrefs";
import SidebarCustomizer from "@/components/SidebarCustomizer";
import { supabase } from "@/integrations/supabase/client";
import { signOutRealm } from "@/integrations/supabase/realmBridge";
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
import AppointmentsBell from "@/components/AppointmentsBell";
import { prefetchRoute } from "@/lib/routePrefetch";
import { pageCache } from "@/lib/pageCache";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Language } from "@/i18n/translations";
import { useEnabledFeatureSet } from "@/lib/features";
import { useShopMarketStatus } from "@/hooks/useShopMarketStatus";
import { useGlobalMarketEnabled } from "@/hooks/useGlobalMarketEnabled";
import { clearShopRoleCache, useShopRole } from "@/hooks/useShopRole";
import { canOpenPath } from "@/lib/rolePaths";
import { usePrimaryShopId } from "@/hooks/usePrimaryShopId";
import { useOwnedShops } from "@/hooks/useOwnedShops";
import { useSystemFeature } from "@/hooks/useSystemFeature";
import { Store, ShoppingCart, Truck, History } from "lucide-react";

// Group-level admin surfaces: only visible / navigable from the "Oficina Mãe"
// (primary shop). Even the account owner does NOT see these when the active
// shop is a child. Keep in sync with PRIMARY_ONLY_PATHS in src/App.tsx.
const PRIMARY_SHOP_ONLY_PATHS = new Set<string>([
  "/billing",
  "/settings/billing-integration",
]);

type NavItem = {
  path: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
  planBadge?: "Pro" | "Garage";
  locked?: boolean;
  /** Feature slug from `plan_features`. If set and disabled for plan, item is hidden. */
  featureSlug?: string;
};

type FinancialNavItem = {
  path: string;
  label: string;
  planBadge?: "Pro" | "Garage";
  locked?: boolean;
};

// Lite Mode: only daily essentials. RBAC is applied before this list, so a
// role never sees an item here unless canOpenPath() also allows it.
const ESSENTIAL_NAV_PATHS = ["/dashboard", "/clients", "/vehicles", "/quotes", "/services", "/workshop", "/agenda"];

const isFinancialRoute = (pathname: string) =>
  pathname.startsWith("/invoices") || pathname.startsWith("/financial");

const isPathActive = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

const isEssentialPath = (pathname: string) =>
  ESSENTIAL_NAV_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingAlertCount, setPendingAlertCount] = useState(0);
  const [pendingQuoteApprovalCount, setPendingQuoteApprovalCount] = useState(0);
  const [pendingMarketCount, setPendingMarketCount] = useState(0);
  const [shopName, setShopName] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { isSuperAdmin } = useSuperAdmin();
  const { canUseFeature, mustSubscribe } = useSubscription();
  const { shops, activeShopId, switchShop } = useShopContext();
  const { isReady, user } = useAuthReady();
  const { isGuidedMode } = useOnboardingStatus();
  const { primaryShopId, loading: primaryShopLoading } = usePrimaryShopId();
  const { shops: ownedShops } = useOwnedShops();
  // The active shop is a "Oficina Filha" (child) when the account owns other
  // shops and the one currently selected is NOT the oldest (primary). Child
  // shops NEVER see Billing/Stripe surfaces and NEVER trigger the paywall
  // — the mother shop owns the subscription for the entire group.
  const isPrimaryShopActive = Boolean(primaryShopId && activeShopId && primaryShopId === activeShopId);
  const isChildShopContext = Boolean(
    !primaryShopLoading && activeShopId && !isPrimaryShopActive,
  );
  const sidebarPrefs = useSidebarPrefs(activeShopId);
  const touchStartRef = useRef<{ x: number; y: number; path: string } | null>(null);

  // Single source of truth for Market enrollment. Subscribes to realtime
  // changes on the shop row, so the sidebar flips from "Ativar Market" to the
  // full Market navigation the instant `enroll_shop_in_market` runs — and
  // never re-shows "Ativar Market" while the shop is an active partner.
  const { ready: marketStatusReady, isPartner, isActive, isMarketEnabled: isCarityPartner, shop: shopMarketRow } = useShopMarketStatus(activeShopId);
  const { enabled: globalMarketEnabled } = useGlobalMarketEnabled();
  const { enabled: supplierNetworkEnabled } = useSystemFeature("supplier_network_enabled");

  useEffect(() => {
    if (shopMarketRow?.name !== undefined) setShopName(shopMarketRow?.name || "");
  }, [shopMarketRow?.name]);

  // Hard paywall: there is NO free tier. When the trial/subscription expires
  // (canceled, past_due, trial_expired, admin-managed expired), the user is
  // forced to /trial-expired and can only reach billing/support/logout.
  //
  // BUT: child shops (Oficinas Filhas) NEVER trigger the paywall. Billing is a
  // group-level responsibility that lives on the primary shop (Oficina Mãe).
  // If the child shop's `subscriptions` row is stale/expired for any reason,
  // sending the child user to /trial-expired → /billing creates an infinite
  // redirect loop (RoleProtectedRoute in App.tsx bounces /billing back out
  // because it is a PRIMARY_ONLY path). Skip the paywall entirely here and
  // let the mother account handle billing.
  //
  // Super admins bypass this lock entirely.
  useEffect(() => {
    if (!mustSubscribe) return;
    if (isSuperAdmin) return;
    if (isChildShopContext) return;
    const allowed = ["/trial-expired", "/billing", "/support", "/auth"];
    if (!allowed.some((p) => location.pathname.startsWith(p))) {
      navigate("/trial-expired", { replace: true });
    }
  }, [mustSubscribe, isSuperAdmin, isChildShopContext, location.pathname, navigate]);


  useEffect(() => {
    if (!activeShopId) return;
    let cancelled = false;
    const loadAlertCount = async () => {
      const { count } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", activeShopId)
        .eq("status", "pending");
      if (!cancelled) setPendingAlertCount(count || 0);
    };
    loadAlertCount();

    // Realtime: any change to this shop's alerts → refresh badge instantly.
    const channel = supabase
      .channel(`global-alerts-${activeShopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "alerts", filter: `shop_id=eq.${activeShopId}` },
        () => loadAlertCount(),
      )
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [activeShopId]);

  // Global realtime: quote approvals from the public client link.
  // The database creates the notification at approval time; this listener makes
  // the workshop see it immediately without refreshing the ERP.
  useEffect(() => {
    if (!activeShopId) {
      setPendingQuoteApprovalCount(0);
      return;
    }

    let cancelled = false;
    const isQuoteApprovalNotification = (row: any) => row?.data?.event === "quote_approved";
    const loadQuoteApprovalCount = async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", activeShopId)
        .eq("type", "success")
        .eq("read", false)
        .contains("data", { event: "quote_approved" });
      if (!cancelled) setPendingQuoteApprovalCount(count || 0);
    };

    loadQuoteApprovalCount();

    const channel = supabase
      .channel(`global-quote-approvals-${activeShopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `shop_id=eq.${activeShopId}` },
        (payload: any) => {
          const row = payload.new;
          if (!isQuoteApprovalNotification(row)) return;
          pageCache.clear(`quotes:${activeShopId}:`);
          loadQuoteApprovalCount();

          try {
            const raw = localStorage.getItem(`garageflow_sidebar_prefs_${activeShopId}`);
            if (raw && JSON.parse(raw)?.mutedNotif?.includes("/quotes")) return;
          } catch { /* ignore */ }

          const quoteNumber = row.data?.quote_number ? ` ${row.data.quote_number}` : "";
          toast.success(`✅ Orçamento${quoteNumber} aprovado`, {
            description: row.message || "O cliente aprovou o orçamento.",
            action: { label: "Ver", onClick: () => navigate("/quotes") },
            duration: 20000,
          });
        }
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [activeShopId, navigate]);

  useEffect(() => {
    if (!activeShopId || location.pathname !== "/quotes") return;
    if (pendingQuoteApprovalCount === 0) return;

    const markQuoteApprovalsRead = async () => {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("shop_id", activeShopId)
        .eq("type", "success")
        .eq("read", false)
        .contains("data", { event: "quote_approved" });
      setPendingQuoteApprovalCount(0);
    };

    markQuoteApprovalsRead();
  }, [activeShopId, location.pathname, pendingQuoteApprovalCount]);

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

  // Global realtime: notify on new portal appointment bookings (works in Lite mode too)
  useEffect(() => {
    if (!activeShopId) return;
    const channel = supabase
      .channel(`global-appts-${activeShopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "appointments", filter: `shop_id=eq.${activeShopId}` },
        (payload: any) => {
          const row = payload.new;
          if (row?.source !== "portal") return;
          try {
            const raw = localStorage.getItem(`garageflow_sidebar_prefs_${activeShopId}`);
            if (raw && JSON.parse(raw)?.mutedNotif?.includes("/agenda")) return;
          } catch { /* ignore */ }
          toast.info("📅 Nova marcação do portal", {
            description: `${row.client_name || "Cliente"} — ${row.date} ${String(row.time || "").slice(0, 5)}`,
            action: { label: "Ver agenda", onClick: () => window.location.assign("/agenda") },
            duration: 20000,
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeShopId]);


  // Lite/Pro mode is fully user-controlled via the topbar toggle (Binance-style).
  // We no longer auto-exit Lite based on data activity — keeps the experience
  // predictable across sessions.

  const _allNavItems: NavItem[] = useMemo(() => [
    { path: "/dashboard", label: t("nav.dashboard"), icon: LayoutDashboard, featureSlug: "dashboard" },

    // ── Operação Diária ──
    { path: "/clients", label: t("nav.clients"), icon: Users, featureSlug: "clients" },
    { path: "/vehicles", label: t("nav.vehicles"), icon: Car, featureSlug: "vehicles" },
    { path: "/quotes", label: t("nav.quotes"), icon: FileText, badge: pendingQuoteApprovalCount, featureSlug: "quotes" },
    { path: "/services", label: t("nav.services"), icon: Wrench, featureSlug: "services" },
    { path: "/workshop", label: t("nav.workshop"), icon: HardHat, featureSlug: "workshop_mode" },
    { path: "/agenda", label: t("nav.agenda"), icon: CalendarDays, featureSlug: "agenda" },
    // Inspeções ERP removidas — só as do Marketplace fazem sentido neste contexto (/market/inspections).

    // ── Inventário ──
    { path: "/catalog", label: t("nav.catalog"), icon: BookOpen, featureSlug: "service_catalog" },
    { path: "/stock", label: t("nav.stock"), icon: Package, featureSlug: "stock" },
    { path: "/warranties", label: t("nav.warranties"), icon: ShieldCheck, featureSlug: "warranties" },

    // ── Fornecedor (Supplier Network — B2B parts marketplace) ──
    // Hidden entirely when the global feature flag is OFF.
    ...(supplierNetworkEnabled ? [
      { path: "/parts", label: "Comprar Peças", icon: ShoppingCart } as NavItem,
      { path: "/parts/suppliers", label: "Fornecedores", icon: Store } as NavItem,
      { path: "/parts/orders", label: "Encomendas", icon: Truck } as NavItem,
      { path: "/parts/favorites", label: "Favoritos", icon: Star } as NavItem,
    ] : []),

    // ── Faturação ──
    { path: "/invoices", label: t("nav.invoices"), icon: Receipt, featureSlug: "invoices" },
    { path: "/financial/reports", label: t("nav.financialReports"), icon: Receipt, featureSlug: "financial_reports_basic" },
    { path: "/billing", label: t("nav.billing"), icon: CreditCard, featureSlug: "billing" },

    // ── Comunicação ──
    {
      path: "/alerts",
      label: t("nav.alerts"),
      icon: Bell,
      badge: pendingAlertCount,
      featureSlug: "alerts_basic",
    },
    { path: "/chat", label: t("nav.chat"), icon: MessageCircle, featureSlug: "chat" },

    // ── Crescimento ──
    { path: "/automations", label: t("nav.automations"), icon: Zap, featureSlug: "automations" },
    { path: "/loyalty", label: t("nav.loyalty"), icon: Star, featureSlug: "loyalty" },
    { path: "/referrals", label: t("nav.referrals"), icon: Gift, featureSlug: "referrals" },

    // ── Market (módulo interno do ERP — partilha sessão, sidebar, dashboard) ──
    // Sempre visíveis para oficinas parceiras. "Explorar carros" liga ao Market público.
    ...(!globalMarketEnabled
      ? [] // Global kill-switch: hide every Market entry from the ERP sidebar when Super Admin disables `market_enabled`.
      : !marketStatusReady
      ? [] // Wait for the single source of truth before deciding which Market items to show — prevents "Ativar Market" flashing for already-enrolled shops.
      : isCarityPartner
      ? [
          { path: "/market/opportunities", label: "Vendas Market", icon: Search, badge: pendingMarketCount } as NavItem,
          { path: "/market/inspections", label: "Inspeções", icon: ClipboardCheck } as NavItem,
          { path: "/market/offers", label: "Propostas", icon: FileText } as NavItem,
          { path: "/market/wallet", label: "Carteira", icon: Wallet } as NavItem,
          { path: "/market/history", label: "Histórico", icon: Receipt } as NavItem,
          { path: "/market/stats", label: "Estatísticas", icon: TrendingUp } as NavItem,
          { path: "/market", label: "Explorar carros", icon: ShieldCheck } as NavItem,
        ]
      : [
          { path: "/market/inspections", label: "Ativar Market", icon: ShieldCheck } as NavItem,
        ]),

    // ── Administração ──
    { path: "/team", label: t("nav.team"), icon: UserPlus, featureSlug: "team_management" },
    { path: "/developers", label: "API", icon: Code, featureSlug: "api" },
    { path: "/settings", label: t("nav.settings"), icon: Settings, featureSlug: "settings" },
    { path: "/settings/messages", label: "Mensagens automáticas", icon: Settings, featureSlug: "settings" },
  ], [pendingAlertCount, pendingMarketCount, pendingQuoteApprovalCount, t, marketStatusReady, isCarityPartner, globalMarketEnabled, supplierNetworkEnabled]);

  // Show every item, but mark the ones the current plan can't use as
  // `locked`. The sidebar renders a padlock + upgrade toast on click —
  // the user always sees what they would unlock by upgrading.
  const enabledFeatures = useEnabledFeatureSet();
  const navItems: NavItem[] = useMemo(
    () => _allNavItems.map((i) => {
      if (!i.featureSlug) return i;
      const allowed = enabledFeatures.has(i.featureSlug);
      return allowed ? i : { ...i, locked: true };
    }),
    [_allNavItems, enabledFeatures]
  );

  // Linear/Notion-style grouping. Order = workshop daily priority.
  // Inventário fica imediatamente acima da Faturação.
  const NAV_GROUPS: { id: string; label: string; paths: string[] }[] = useMemo(() => [
    { id: "ops", label: "Operação Diária", paths: ["/clients","/vehicles","/quotes","/services","/workshop","/agenda"] },
    { id: "inventory", label: "Inventário", paths: ["/catalog","/stock","/warranties"] },
    ...(supplierNetworkEnabled ? [{ id: "supplier", label: "Fornecedor", paths: ["/parts","/parts/suppliers","/parts/orders","/parts/favorites"] }] : []),
    { id: "finance", label: "Faturação", paths: ["/invoices","/financial/reports","/billing"] },
    { id: "comms", label: "Comunicação", paths: ["/alerts","/chat"] },
    { id: "growth", label: "Crescimento", paths: ["/marketing","/automations","/loyalty","/referrals"] },
    { id: "market", label: "Market", paths: ["/market","/market/opportunities","/market/inspections","/market/offers","/market/wallet","/market/history","/market/stats"] },
    { id: "admin", label: "Administração", paths: ["/team","/developers","/settings"] },
  ], [supplierNetworkEnabled]);

  const handleLogout = async () => {
    sessionStorage.removeItem("garageflow_user_type_cache");
    clearShopRoleCache();
    // Sign out ONLY of the ERP realm — Market session (if any) stays intact.
    await signOutRealm("erp");
  };

  const handlePrefetch = useCallback((path: string) => {
    prefetchRoute(path);
  }, []);

  const currentNav = navItems.find((item) => isPathActive(location.pathname, item.path));
  const pageTitle = currentNav?.label || shopName || "GarageFlow";
  // Wide-layout routes: list pages with many columns and action buttons that
  // need to breathe on 1920×1080 at 100% zoom. Keep this list tight — only
  // pages where the max-width shell caused truncated columns.
  const WIDE_LIST_ROUTES = ["/services", "/quotes", "/invoices"];
  const isServicesListRoute = WIDE_LIST_ROUTES.includes(location.pathname);
  // Plan-based feature gating: hide items the current plan can't use.
  // Upgrade prompts remain available inside the destination page (PlanGate),
  // but the sidebar shows only what the user can actually open.
  // Keep locked items visible so users discover what they would unlock
  // by upgrading. The click handler intercepts and redirects to /billing.
  const planVisibleItems = navItems;
  const { role, can, loading: roleLoading } = useShopRole();
  // "Oficina Mãe" account = user owns 2+ shops (i.e. has actually created a group).
  // Only this account can see/use the shop switcher and Multi-Oficina surfaces.
  // A child-only user (team member of a single child shop) or a single-shop owner
  // must NEVER see that other shops exist.
  const isGroupOwner = ownedShops.length > 1;
  const roleFilteredItems = useMemo(
    () => planVisibleItems.filter((item) => {
      if (roleLoading || !role) return false;
      if (PRIMARY_SHOP_ONLY_PATHS.has(item.path) && !isPrimaryShopActive) return false;
      return canOpenPath(item.path, role, can);
    }),
    [planVisibleItems, role, roleLoading, can, isPrimaryShopActive]
  );
  const baseVisibleItems = isGuidedMode
    ? roleFilteredItems.filter((item) => ESSENTIAL_NAV_PATHS.includes(item.path) || item.path === "/market/inspections")
    : roleFilteredItems.filter((item) => !sidebarPrefs.isHidden(item.path));

  // Role-specific dashboard content is rendered at /dashboard for every role.

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
    <div className="h-screen flex w-full bg-background overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={`fixed lg:static top-0 left-0 z-50 h-screen w-[270px] lg:w-64 bg-sidebar border-r border-sidebar-border flex flex-col shrink-0 transition-transform duration-300 ${
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
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label={t("common.close") || "Fechar menu"}
            className="ml-auto lg:hidden p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground min-h-11 min-w-11 flex items-center justify-center"
          >
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
            const renderItem = (item: NavItem) => {
              const isActive = isPathActive(location.pathname, item.path);
              const muted = sidebarPrefs.isMuted(item.path);
              const showBadge = !muted && item.badge && item.badge > 0;
              const closeMobileSidebar = () => {
                if (window.matchMedia("(max-width: 1023px)").matches) {
                  setSidebarOpen(false);
                }
              };
              const handleLockedIntercept = (e: React.SyntheticEvent) => {
                e.preventDefault();
                e.stopPropagation();
                closeMobileSidebar();
                toast.warning("Esta funcionalidade não está disponível no seu plano atual.", {
                  description: "Faça upgrade para desbloquear.",
                  action: { label: "Ver planos", onClick: () => navigate("/billing") },
                });
                navigate("/billing");
              };
              const handleClick = (e: React.MouseEvent) => {
                if (item.locked) { handleLockedIntercept(e); return; }
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                closeMobileSidebar();
                navigate(item.path);
              };
              const handlePointerDown = (e: React.PointerEvent) => {
                if (e.pointerType !== "touch") return;
                touchStartRef.current = { x: e.clientX, y: e.clientY, path: item.path };
              };
              const handlePointerUp = (e: React.PointerEvent) => {
                if (e.pointerType !== "touch") return;
                const start = touchStartRef.current;
                touchStartRef.current = null;
                if (!start || start.path !== item.path) return;
                const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
                if (moved > 10) return;

                // Mobile Safari/Chrome can treat the first tap as focus/hover
                // when a transformed drawer is open. Navigate on pointer-up so
                // every sidebar item opens with one tap.
                e.preventDefault();
                e.stopPropagation();
                if (item.locked) { handleLockedIntercept(e); return; }
                closeMobileSidebar();
                navigate(item.path);
              };
              const navLink = (
                <Link
                  to={item.path}
                  onClick={handleClick}
                  onPointerDown={handlePointerDown}
                  onPointerUp={handlePointerUp}
                  onMouseEnter={() => handlePrefetch(item.path)}
                  onFocus={() => handlePrefetch(item.path)}
                  title={item.locked ? "Bloqueado pelo seu plano — clique para fazer upgrade" : undefined}
                  className={`flex min-h-11 touch-manipulation select-none items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                      : item.locked
                      ? "text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground/70"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                  <span className="ml-auto flex items-center gap-1 shrink-0">
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
                  </span>
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
                    {favoriteItems.map((it) => renderItem(it))}
                    <div className="mt-2 border-t border-sidebar-border/60" />
                  </div>
                )}

                {dashboardItem && (
                  <div className="mb-2">{renderItem(dashboardItem)}</div>
                )}

                {isGuidedMode
                  ? groupedRegular.map((it) => renderItem(it))
                  : NAV_GROUPS.map((group) => {
                      const groupItems = groupedRegular.filter(i => group.paths.includes(i.path));
                      if (groupItems.length === 0) return null;
                      // Market é grupo colapsável como qualquer outro — Market
                      // é um módulo interno do ERP.



                      // Auto-flatten single-item groups: render the item directly so the
                      // group header doesn't swallow the click.
                      if (groupItems.length === 1) {
                        return (
                          <div key={group.id} className="mb-1">
                            {renderItem(groupItems[0])}
                          </div>
                        );
                      }
                      const hasActive = groupItems.some(i => isPathActive(location.pathname, i.path));
                      const totalBadge = groupItems.reduce((sum, i) => sum + (!sidebarPrefs.isMuted(i.path) && i.badge ? i.badge : 0), 0);
                      return (
                        <div key={group.id} className="mb-1">
                          <div
                            className={`flex items-center w-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors rounded-md ${
                              hasActive ? "text-sidebar-primary" : "text-sidebar-foreground/55"
                            }`}
                          >
                            <span className="flex-1 text-left">{group.label}</span>
                            {totalBadge > 0 && (
                              <span className="bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full min-w-4 h-4 px-1 flex items-center justify-center">
                                {totalBadge > 99 ? "99+" : totalBadge}
                              </span>
                            )}
                          </div>
                          <div className="space-y-0.5 mt-0.5">
                            {groupItems.map((it) => renderItem(it))}
                          </div>
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
              items={roleFilteredItems.map((i) => ({ path: i.path, label: i.label }))}
            />
          </div>
        )}

        {/* Toggle Lite/Pro só faz sentido para papéis com menu extenso.
            Técnico/Receção/Comercial já têm sidebar naturalmente reduzida pelo RBAC,
            portanto o toggle seria confuso e sem efeito prático. */}
        {(role === "owner" || role === "admin" || role === "manager" || role === "super_admin") && (
          <div className="px-2.5 pt-2 pb-1 border-t border-sidebar-border">
            <AppModeToggle className="w-full justify-between" />
          </div>
        )}

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

        {isGroupOwner && (
          <ShopSwitcher
            shops={ownedShops.map((s) => ({ id: s.id, name: s.name ?? "", logo_url: s.logo_url ?? null }))}
            activeShopId={activeShopId}
            onSwitch={(id) => {
              // Extra safety: only allow switching to shops this account actually owns.
              if (!ownedShops.some((s) => s.id === id)) return;
              switchShop(id);
              navigate(location.pathname, { replace: true });
            }}
            showCreate={(canUseFeature("multiShop") || enabledFeatures.has("multiShop") || enabledFeatures.has("multi_shop")) && isPrimaryShopActive}
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

      <main className="flex-1 flex flex-col h-screen min-w-0 overflow-y-auto overflow-x-hidden">
        <MarketInspectionBanner shopId={activeShopId} isPartner={isCarityPartner} />
        <header className="h-14 lg:h-16 border-b border-border/60 flex items-center px-3 lg:px-6 bg-card/70 backdrop-blur-xl sticky top-0 z-30 shrink-0 shadow-premium-sm">

          <Button
            variant="ghost"
            size="icon"
            aria-label="Abrir menu"
            className="lg:hidden mr-2 shrink-0 h-11 w-11"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>

          <span className="text-sm font-semibold truncate lg:hidden">{pageTitle}</span>

          <span className="text-sm font-medium text-muted-foreground hidden lg:block truncate tracking-tight">{shopName}</span>

          <div className="flex-1 flex justify-center px-2 lg:px-6 min-w-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
              className="group inline-flex items-center gap-2 w-full max-w-md h-9 px-3 rounded-lg border border-border/60 bg-muted/40 hover:bg-muted hover:border-border transition-colors text-left"
              title={language === "pt" ? "Pesquisar (Ctrl+K)" : "Search (Ctrl+K)"}
              aria-label={language === "pt" ? "Pesquisar" : "Search"}
            >
              <Search className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground truncate flex-1">
                {language === "pt" ? "Pesquisar…" : "Search…"}
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-mono text-muted-foreground bg-background border border-border/60 rounded px-1.5 py-0.5">
                <span className="text-xs">⌘</span>K
              </kbd>
            </button>
          </div>

          <ThemeToggle className="mr-1" />

          <AppointmentsBell />

          {pendingAlertCount > 0 && (
            <Link
              to="/alerts"
              aria-label={`${pendingAlertCount} alertas pendentes`}
              className="relative p-2 rounded-lg hover:bg-muted transition-colors mr-1 group"
            >
              <Bell className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center ring-2 ring-background">
                {pendingAlertCount > 9 ? "9+" : pendingAlertCount}
              </span>
            </Link>
          )}

          <Button
            variant="ghost"
            size="icon"
            aria-label={t("auth.logout")}
            className="lg:hidden h-11 w-11 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
            title={t("auth.logout")}
          >
            <LogOut className="w-[18px] h-[18px]" />
          </Button>
        </header>

        <div className={`flex-1 page-in ${isServicesListRoute ? "p-2 sm:p-3 lg:p-4" : "p-3 sm:p-4 lg:p-6"}`}>
          <div className={isServicesListRoute ? "w-full min-w-0" : "page-shell"}>
            {/* No fallback — keeps the previous page visible until the next chunk
                is ready. Combined with hover/idle prefetch, navigation feels instant. */}
            <Suspense fallback={null}>
              {children}
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
