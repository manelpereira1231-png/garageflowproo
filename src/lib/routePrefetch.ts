// Hover/idle prefetch registry for SPA route chunks.
// Each entry triggers the dynamic import which Vite resolves once and caches.

const prefetched = new Set<string>();

const ROUTE_LOADERS: Record<string, () => Promise<unknown>> = {
  "/dashboard": () => import("@/pages/Dashboard"),
  "/clients": () => import("@/pages/Clients"),
  "/vehicles": () => import("@/pages/Vehicles"),
  "/quotes": () => import("@/pages/Quotes"),
  "/quotes/new": () => import("@/pages/QuoteForm"),
  "/services": () => import("@/pages/Services"),
  "/services/new": () => import("@/pages/ServiceForm"),
  "/agenda": () => import("@/pages/Agenda"),
  "/catalog": () => import("@/pages/ServiceCatalog"),
  "/stock": () => import("@/pages/Stock"),
  "/inspections": () => import("@/pages/Inspections"),
  "/workshop": () => import("@/pages/Workshop"),
  "/warranties": () => import("@/pages/Warranties"),
  "/loyalty": () => import("@/pages/Loyalty"),
  "/marketing": () => import("@/pages/Marketing"),
  "/automations": () => import("@/pages/Automations"),
  "/developers": () => import("@/pages/Developers"),
  "/alerts": () => import("@/pages/Alerts"),
  "/team": () => import("@/pages/Team"),
  "/chat": () => import("@/pages/Chat"),
  "/referrals": () => import("@/pages/Referrals"),
  "/billing": () => import("@/pages/Billing"),
  "/settings": () => import("@/pages/Settings"),
  "/invoices": () => import("@/pages/Invoices"),
  "/invoices/new": () => import("@/pages/InvoiceForm"),
  "/financial/reports": () => import("@/pages/FinancialReports"),
  "/market/inspections": () => import("@/pages/CarityShopInspections"),
  "/market/wallet": () => import("@/pages/MarketWallet"),
  "/market/payouts": () => import("@/pages/MarketPayoutInfo"),
  // Market authed routes (seller/buyer area)
  "/market/dashboard": () => import("@/pages/MarketDashboard"),
  "/market/my-listings": () => import("@/pages/CaritySellerDashboard"),
  "/market/messages": () => import("@/pages/MarketMessages"),
  "/market/profile": () => import("@/pages/MarketProfile"),
  "/market/purchases": () => import("@/pages/MarketPurchases"),
  "/market/favoritos": () => import("@/pages/CarityFavorites"),
  "/market/sell": () => import("@/pages/CaritySellCar"),
  // Admin panel routes
  "/admin": () => import("@/pages/admin/AdminDashboard"),
  "/admin/shops": () => import("@/pages/admin/AdminShops"),
  "/admin/users": () => import("@/pages/admin/AdminUsers"),
  "/admin/finance": () => import("@/pages/admin/AdminFinance"),
  "/admin/billing": () => import("@/pages/admin/AdminBilling"),
  "/admin/coupons": () => import("@/pages/admin/AdminCoupons"),
  "/admin/traffic": () => import("@/pages/admin/AdminTraffic"),
  "/admin/reports": () => import("@/pages/admin/AdminReports"),
  "/admin/marketing": () => import("@/pages/admin/AdminMarketing"),
  "/admin/system": () => import("@/pages/admin/AdminSystemControl"),
  "/admin/alerts": () => import("@/pages/admin/AdminAlerts"),
  "/admin/emails": () => import("@/pages/admin/AdminEmailLogs"),
  "/admin/adoption": () => import("@/pages/admin/AdminFeatureAdoption"),
  "/admin/system-health": () => import("@/pages/admin/AdminSystemHealth"),
  "/admin/countries": () => import("@/pages/admin/AdminCountries"),
  "/admin/partners": () => import("@/pages/admin/AdminPartners"),
  "/admin/logs": () => import("@/pages/admin/AdminLogs"),
  "/admin/settings": () => import("@/pages/admin/AdminSettings"),
};

export function prefetchRoute(path: string): void {
  if (typeof window === "undefined") return;
  if (prefetched.has(path)) return;
  const loader = ROUTE_LOADERS[path];
  if (!loader) return;
  prefetched.add(path);
  void loader().catch(() => {
    prefetched.delete(path);
  });
}
