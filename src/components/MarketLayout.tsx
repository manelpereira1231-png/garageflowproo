import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { ShieldCheck, LayoutDashboard, Car, MessageCircle, User, Plus, LogOut, Menu, X, CreditCard, Heart, Search, Building2, Sparkles, Crown, FileCheck, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Suspense, createContext, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import MarketPendingPaymentBanner from "@/components/MarketPendingPaymentBanner";
import LegalFooter from "@/components/LegalFooter";
import ThemeToggle from "@/components/ThemeToggle";
import { useTheme } from "@/components/ThemeProvider";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useMarketT } from "@/i18n/marketTranslations";

const NAV_ITEM_DEFS = [
  { path: "/market/dashboard", labelKey: "market.nav.dashboard", icon: LayoutDashboard },
  { path: "/market/my-listings", labelKey: "market.nav.listings", icon: Car },
  { path: "/market/favoritos", labelKey: "market.nav.favorites", icon: Heart },
  { path: "/market/purchases", labelKey: "market.nav.purchases", icon: CreditCard },
  { path: "/market/messages", labelKey: "market.nav.messages", icon: MessageCircle },
  { path: "/market/profile", labelKey: "market.nav.profile", icon: User },
];

// Dealer navigation — distinct from particular
const DEALER_NAV_DEFS = [
  { path: "/market/dealer-dashboard", label: "Painel Stand", icon: Building2 },
  { path: "/market/dealer/bulk", label: "Bulk listing", icon: Sparkles },
  { path: "/market/my-listings", label: "Inventário", icon: Car },
  { path: "/market/messages", label: "Mensagens", icon: MessageCircle },
  { path: "/market/profile", label: "Stand", icon: Settings },
];

// Context to detect when MarketLayout is already mounted higher up.
// Lets pages keep `<MarketLayout>` wrappers without producing a double chrome
// when the router-level layout is in use (nested routing path).
const MarketLayoutContext = createContext(false);

const PageFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function MarketLayout({ children, variant }: { children?: React.ReactNode; variant?: "particular" | "dealer" }) {
  const alreadyWrapped = useContext(MarketLayoutContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [favCount, setFavCount] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const t = useMarketT();
  const { theme } = useTheme();
  const isLight = theme === "light";
  const isDealer = variant === "dealer" || location.pathname.startsWith("/market/dealer");
  const NAV_ITEMS = isDealer
    ? DEALER_NAV_DEFS
    : NAV_ITEM_DEFS.map((i) => ({ ...i, label: t(i.labelKey) }));

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQ.trim();
    navigate(q ? `/market?q=${encodeURIComponent(q)}` : "/market");
    setMobileOpen(false);
  };

  useEffect(() => {
    if (alreadyWrapped) return;
    let cancelled = false;
    let channel: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const [{ count: unread }, { count: favs }] = await Promise.all([
        supabase.from("carity_chat_messages").select("id", { count: "exact", head: true }).eq("receiver_id", user.id).eq("read", false),
        supabase.from("listing_favorites" as any).select("listing_id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      if (cancelled) return;
      setUnreadCount(unread || 0);
      setFavCount(favs || 0);
      // Realtime: refresh badge on new incoming message
      channel = supabase.channel(`market-nav-${user.id}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "carity_chat_messages", filter: `receiver_id=eq.${user.id}` }, () => {
          setUnreadCount((c) => c + 1);
        })
        .subscribe();
    })();
    return () => { cancelled = true; if (channel) supabase.removeChannel(channel); };
  }, [alreadyWrapped, location.pathname]);

  const badgeFor = (path: string): number => {
    if (path === "/market/messages") return unreadCount;
    if (path === "/market/favoritos") return favCount;
    return 0;
  };

  // If another MarketLayout is already mounted above (router-level), this
  // instance becomes a transparent passthrough — keeps page-level `<MarketLayout>`
  // imports valid while avoiding duplicated header/sidebar.
  if (alreadyWrapped) {
    return <>{children ?? <Outlet />}</>;
  }

  const handleLogout = async () => {
    sessionStorage.removeItem("garageflow_user_type_cache");
    await supabase.auth.signOut();
    toast.success(t("market.toast.signedOut"));
    navigate("/market");
  };

  return (
    <MarketLayoutContext.Provider value={true}>
      <div className={`market-root ${isLight ? "market-light" : "market-dark"} min-h-screen ${isDealer ? "bg-zinc-950" : "bg-background"}`}>
        <MarketPendingPaymentBanner />
        {/* Dealer signature bar */}
        {isDealer && (
          <div className="bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-zinc-900 text-[11px] font-bold tracking-[0.2em] uppercase text-center py-1 shadow-md">
            <Crown className="inline w-3 h-3 mr-1.5 -mt-0.5" /> Conta Profissional · GarageFlow Stand Pro
          </div>
        )}
        {/* Top nav — premium glass */}
        <nav className={`${isDealer ? "bg-zinc-950/95 border-b border-amber-500/20" : "bg-slate-950/95 border-b border-white/[0.06]"} backdrop-blur-xl text-white px-4 py-3 sticky top-0 z-50 shadow-lg`}>
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <Link to={isDealer ? "/market/dealer-dashboard" : "/market"} className="flex items-center gap-2.5 group">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${isDealer ? "bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/40 shadow-md shadow-amber-500/30" : "bg-amber-400/15 border border-amber-400/30 group-hover:bg-amber-400/25"}`}>
                {isDealer ? <Building2 className="h-4 w-4 text-zinc-900" /> : <ShieldCheck className="h-4 w-4 text-amber-400" />}
              </div>
              <span className="text-lg font-bold tracking-tight">
                GarageFlow <span className="text-amber-400">{isDealer ? "Stand" : "Market"}</span>
              </span>
              {isDealer && (
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 ml-1 rounded text-[9px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 tracking-wider">
                  PRO
                </span>
              )}
            </Link>

            {/* Desktop search — only for particular */}
            {!isDealer && (
              <form onSubmit={submitSearch} className="hidden md:flex flex-1 max-w-md mx-6 relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder={t("market.search.placeholder") || "Pesquisar marca, modelo ou cidade…"}
                  className="h-9 pl-9 pr-3 bg-white/[0.06] border-white/10 text-white placeholder:text-white/40 focus-visible:ring-amber-400/40 focus-visible:border-amber-400/40"
                />
              </form>
            )}

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-0.5">
              {NAV_ITEMS.map((item: any) => {
                const active = location.pathname === item.path;
                const badge = badgeFor(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={() => prefetchRoute(item.path)}
                    onFocus={() => prefetchRoute(item.path)}
                    onTouchStart={() => prefetchRoute(item.path)}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`relative h-9 text-white/65 hover:text-white hover:bg-white/[0.08] transition-all ${active ? (isDealer ? "bg-amber-500/15 text-amber-300" : "bg-white/10 text-white") : ""}`}
                    >
                      <item.icon className="h-4 w-4 mr-1.5" />
                      {item.label}
                      {badge > 0 && (
                        <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-slate-900 text-[10px] font-bold">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </Button>
                  </Link>
                );
              })}
              {!isDealer && (
                <Link to="/market/sell" onMouseEnter={() => prefetchRoute("/market/sell")} onFocus={() => prefetchRoute("/market/sell")}>
                  <Button size="sm" className="h-9 bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold ml-2 shadow-md shadow-amber-500/20 btn-interactive">
                    <Plus className="h-4 w-4 mr-1" /> {t("market.nav.newListing")}
                  </Button>
                </Link>
              )}
              {isDealer && (
                <Link to="/market/dealer/bulk" onMouseEnter={() => prefetchRoute("/market/dealer/bulk")}>
                  <Button size="sm" className="h-9 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-900 hover:from-amber-400 hover:to-amber-500 font-semibold ml-2 shadow-md shadow-amber-500/30">
                    <Sparkles className="h-4 w-4 mr-1" /> Publicar lote
                  </Button>
                </Link>
              )}
              <div className="ml-1 [&_button]:text-white/65 [&_button:hover]:text-white [&_button:hover]:bg-white/[0.08]">
                <ThemeToggle />
              </div>
              <Button variant="ghost" size="sm" className="text-white/40 hover:text-white hover:bg-white/[0.08] ml-1" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>

            {/* Mobile toggle */}
            <button className="md:hidden text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>

          {/* Mobile nav */}
          {mobileOpen && (
            <div className="md:hidden mt-3 pb-2 border-t border-white/[0.08] pt-3 space-y-1 animate-fade-in">
              {/* Mobile search */}
              <form onSubmit={submitSearch} className="relative mb-2">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                <Input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder={t("market.search.placeholder") || "Pesquisar marca, modelo ou cidade…"}
                  className="h-10 pl-9 pr-3 bg-white/[0.06] border-white/10 text-white placeholder:text-white/40"
                />
              </form>
              {NAV_ITEMS.map(item => {
                const active = location.pathname === item.path;
                const badge = badgeFor(item.path);
                return (
                  <Link key={item.path} to={item.path} onClick={() => setMobileOpen(false)}>
                    <div className={`flex items-center gap-2 px-3 py-2.5 rounded-lg transition-colors ${active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/[0.05]"}`}>
                      <item.icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {badge > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-amber-500 text-slate-900 text-xs font-bold">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
              <Link to="/market/sell" onClick={() => setMobileOpen(false)}>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-amber-400 font-semibold hover:bg-amber-400/10 transition-colors">
                  <Plus className="h-4 w-4" /> {t("market.nav.newListing")}
                </div>
              </Link>
              <button onClick={handleLogout} className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-white/50 hover:text-white hover:bg-white/[0.05] w-full text-left transition-colors">
                <LogOut className="h-4 w-4" /> {t("market.nav.logout")}
              </button>
            </div>
          )}
        </nav>

        <div className="max-w-6xl mx-auto px-4 py-6 page-in">
          <Suspense fallback={<PageFallback />}>
            {children ?? <Outlet />}
          </Suspense>
        </div>
        <LegalFooter />
      </div>
    </MarketLayoutContext.Provider>
  );
}
