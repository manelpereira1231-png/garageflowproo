import { useEffect, useState, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import IndiaLanguagePrompt from "@/components/IndiaLanguagePrompt";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/NotFound";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getUserAccessProfile } from "@/lib/authRealm";
import { setSentryUser } from "@/lib/sentry";
const PlanGate = lazy(() => import("@/components/PlanGate"));
const CommandPalette = lazy(() => import("@/components/CommandPalette"));

// Critical path - eagerly loaded for instant navigation
import Auth from "@/pages/Auth";
import LandingPage from "@/pages/LandingPage";
const MarketAuth = lazyRetry(() => import("@/pages/MarketAuth"));
const AffiliateSignup = lazy(() => import("@/pages/AffiliateSignup"));
const AffiliateLogin = lazy(() => import("@/pages/AffiliateLogin"));
const AffiliateDashboard = lazy(() => import("@/pages/AffiliateDashboard"));
const SeoLandingPage = lazy(() => import("@/pages/seo/SeoLandingPage"));
const SeoCityPage = lazy(() => import("@/pages/seo/SeoCityPage"));
const SeoBlogIndex = lazy(() => import("@/pages/seo/SeoBlogIndex"));
const SeoBlogPost = lazy(() => import("@/pages/seo/SeoBlogPost"));

// Non-critical lazy-loaded with retry
function lazyRetry(factory: () => Promise<any>) {
  return lazy(() =>
    factory().catch(() => {
      // Retry once after a brief delay (handles chunk load failures)
      return new Promise<any>((resolve) => {
        setTimeout(() => resolve(factory()), 1500);
      });
    })
  );
}

const ResetPassword = lazyRetry(() => import("@/pages/ResetPassword"));
const QuoteApproval = lazyRetry(() => import("@/pages/QuoteApproval"));
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import MarketLayout from "@/components/MarketLayout";

// Lazy-loaded pages for code splitting & performance at scale
const Dashboard = lazyRetry(() => import("@/pages/Dashboard"));
const Clients = lazyRetry(() => import("@/pages/Clients"));
const Vehicles = lazyRetry(() => import("@/pages/Vehicles"));
const Quotes = lazyRetry(() => import("@/pages/Quotes"));
const Services = lazyRetry(() => import("@/pages/Services"));
const SettingsPage = lazyRetry(() => import("@/pages/Settings"));
const EmailTemplates = lazyRetry(() => import("@/pages/EmailTemplates"));
const Agenda = lazyRetry(() => import("@/pages/Agenda"));
const Invoices = lazyRetry(() => import("@/pages/Invoices"));
const OnboardingWizard = lazyRetry(() => import("@/pages/OnboardingWizard"));
const QuoteForm = lazyRetry(() => import("@/pages/QuoteForm"));
const ServiceForm = lazyRetry(() => import("@/pages/ServiceForm"));
const Billing = lazyRetry(() => import("@/pages/Billing"));
const Alerts = lazyRetry(() => import("@/pages/Alerts"));
const Team = lazyRetry(() => import("@/pages/Team"));
const Chat = lazyRetry(() => import("@/pages/Chat"));
const InvoiceForm = lazyRetry(() => import("@/pages/InvoiceForm"));
const InvoiceDetail = lazyRetry(() => import("@/pages/InvoiceDetail"));
const FinancialReports = lazyRetry(() => import("@/pages/FinancialReports"));
const PublicBooking = lazyRetry(() => import("@/pages/PublicBooking"));
const ClientPortal = lazyRetry(() => import("@/pages/ClientPortal"));
const ServiceCatalog = lazyRetry(() => import("@/pages/ServiceCatalog"));
const Stock = lazyRetry(() => import("@/pages/Stock"));
const Inspections = lazyRetry(() => import("@/pages/Inspections"));
const Loyalty = lazyRetry(() => import("@/pages/Loyalty"));
const Marketing = lazyRetry(() => import("@/pages/Marketing"));
const Workshop = lazyRetry(() => import("@/pages/Workshop"));
const Automations = lazyRetry(() => import("@/pages/Automations"));
const Developers = lazyRetry(() => import("@/pages/Developers"));
const PartnersPortal = lazyRetry(() => import("@/pages/PartnersPortal"));
const Referrals = lazyRetry(() => import("@/pages/Referrals"));
const Warranties = lazyRetry(() => import("@/pages/Warranties"));

// Market pages (GarageFlow Market)
const CarityMarketplace = lazyRetry(() => import("@/pages/CarityMarketplace"));
const CarityListingDetail = lazyRetry(() => import("@/pages/CarityListingDetail"));
const CaritySellCar = lazyRetry(() => import("@/pages/CaritySellCar"));
const CarityPayInspection = lazyRetry(() => import("@/pages/CarityPayInspection"));
const CaritySellerDashboard = lazyRetry(() => import("@/pages/CaritySellerDashboard"));
const CarityShopInspections = lazyRetry(() => import("@/pages/CarityShopInspections"));
const MarketDashboard = lazyRetry(() => import("@/pages/MarketDashboard"));
const MarketMessages = lazyRetry(() => import("@/pages/MarketMessages"));
const MarketProfile = lazyRetry(() => import("@/pages/MarketProfile"));
const CarityAuth = lazyRetry(() => import("@/pages/CarityAuth"));
const CarityByMake = lazyRetry(() => import("@/pages/CarityByMake"));
const CarityByCity = lazyRetry(() => import("@/pages/CarityByCity"));
const CarityByModel = lazyRetry(() => import("@/pages/CarityByModel"));
const CarityByPrice = lazyRetry(() => import("@/pages/CarityByPrice"));
const CarityFavorites = lazyRetry(() => import("@/pages/CarityFavorites"));
const CarityListingSEO = lazyRetry(() => import("@/pages/CarityListingSEO"));
const MarketPurchases = lazyRetry(() => import("@/pages/MarketPurchases"));
const MarketPayoutInfo = lazyRetry(() => import("@/pages/MarketPayoutInfo"));
const MarketStandsDirectory = lazyRetry(() => import("@/pages/MarketStandsDirectory"));
const MarketStandPublic = lazyRetry(() => import("@/pages/MarketStandPublic"));
const MarketVerifyCertificate = lazyRetry(() => import("@/pages/MarketVerifyCertificate"));
const MarketDealerDashboard = lazyRetry(() => import("@/pages/MarketDealerDashboard"));
const MarketDealerBulkAdd = lazyRetry(() => import("@/pages/MarketDealerBulkAdd"));
const MarketWallet = lazyRetry(() => import("@/pages/MarketWallet"));

// Legal pages (RGPD)
const PrivacyPolicy = lazyRetry(() => import("@/pages/legal/PrivacyPolicy"));
const TermsOfService = lazyRetry(() => import("@/pages/legal/TermsOfService"));
const CookiePolicy = lazyRetry(() => import("@/pages/legal/CookiePolicy"));
const DPA = lazyRetry(() => import("@/pages/legal/DPA"));
const MyData = lazyRetry(() => import("@/pages/legal/MyData"));
const MarketTerms = lazyRetry(() => import("@/pages/legal/MarketTerms"));
const Support = lazyRetry(() => import("@/pages/Support"));
import CookieConsentBanner from "@/components/CookieConsentBanner";
import SupportFab from "@/components/SupportFab";

// Admin pages
const AdminDashboard = lazyRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminShops = lazyRetry(() => import("@/pages/admin/AdminShops"));
const AdminShopDetail = lazyRetry(() => import("@/pages/admin/AdminShopDetail"));
const AdminLogs = lazyRetry(() => import("@/pages/admin/AdminLogs"));
const AdminReports = lazyRetry(() => import("@/pages/admin/AdminReports"));
const AdminBilling = lazyRetry(() => import("@/pages/admin/AdminBilling"));
const AdminAlerts = lazyRetry(() => import("@/pages/admin/AdminAlerts"));
const AdminSettings = lazyRetry(() => import("@/pages/admin/AdminSettings"));
const AdminUsers = lazyRetry(() => import("@/pages/admin/AdminUsers"));
const AdminEmailLogs = lazyRetry(() => import("@/pages/admin/AdminEmailLogs"));
const AdminFeatureAdoption = lazyRetry(() => import("@/pages/admin/AdminFeatureAdoption"));
const AdminSystemHealth = lazyRetry(() => import("@/pages/admin/AdminSystemHealth"));
const AdminPartners = lazyRetry(() => import("@/pages/admin/AdminPartners"));
const AdminTraffic = lazyRetry(() => import("@/pages/admin/AdminTraffic"));
const AdminCarity = lazyRetry(() => import("@/pages/admin/AdminCarity"));
const AdminMarketDashboard = lazyRetry(() => import("@/pages/admin/AdminMarketDashboard"));
const AdminMarketKYC = lazyRetry(() => import("@/pages/admin/AdminMarketKYC"));
const AdminSupport = lazyRetry(() => import("@/pages/admin/AdminSupport"));
const AdminCountries = lazyRetry(() => import("@/pages/admin/AdminCountries"));
const AdminMarketing = lazyRetry(() => import("@/pages/admin/AdminMarketing"));
const AdminFinance = lazyRetry(() => import("@/pages/admin/AdminFinance"));
const AdminSystemControl = lazyRetry(() => import("@/pages/admin/AdminSystemControl"));
const AdminCoupons = lazyRetry(() => import("@/pages/admin/AdminCoupons"));
const AdminRiskEngine = lazyRetry(() => import("@/pages/admin/AdminRiskEngine"));
const AdminVehiclesGlobal = lazyRetry(() => import("@/pages/admin/AdminVehiclesGlobal"));
const AdminMarketListings = lazyRetry(() => import("@/pages/admin/AdminMarketListings"));
const AdminMarketEscrows = lazyRetry(() => import("@/pages/admin/AdminMarketEscrows"));
const AdminSeo = lazyRetry(() => import("@/pages/admin/AdminSeo"));
const AdminSeoBlog = lazyRetry(() => import("@/pages/admin/AdminSeoBlog"));

// Optimized QueryClient for scale (staleTime, gcTime, retries)
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min stale
      gcTime: 1000 * 60 * 10,   // 10 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const AUTO_RECOVERY_KEY = "garageflow_auto_recover_attempted";

const isRecoverableLoadError = (message: string) => {
  const normalized = message.toLowerCase();
  // Tight match: only chunk/dynamic-import load failures, never generic errors
  // that happen to mention "import" somewhere in the stack.
  return (
    normalized.includes("loading chunk") ||
    normalized.includes("failed to fetch dynamically imported module") ||
    normalized.includes("dynamically imported module") ||
    normalized.includes("importing a module script failed") ||
    normalized.includes("error loading dynamically imported module")
  );
};

// Error Boundary to catch lazy-load / chunk failures
class ChunkErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    const message = error?.message || "";
    const alreadyRetried = sessionStorage.getItem(AUTO_RECOVERY_KEY) === "1";

    if (!alreadyRetried && isRecoverableLoadError(message)) {
      sessionStorage.setItem(AUTO_RECOVERY_KEY, "1");
      window.location.reload();
      return;
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          <p className="text-sm text-muted-foreground">
            {(() => {
              const lang = localStorage.getItem('garageflow_language') || 'pt';
              if (lang === 'en') return 'An error occurred loading the page.';
              if (lang === 'es') return 'Ocurrió un error al cargar la página.';
              return 'Ocorreu um erro ao carregar a página.';
            })()}
          </p>
          <button onClick={() => window.location.reload()} className="text-sm text-primary underline">
            {(() => {
              const lang = localStorage.getItem('garageflow_language') || 'pt';
              if (lang === 'en') return 'Reload';
              if (lang === 'es') return 'Recargar';
              return 'Recarregar';
            })()}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const getSafeRedirectPath = (candidate: string | null, fallback: string) => {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//")) {
    return fallback;
  }

  return candidate;
};

const isMarketPath = (path: string) => path === "/market" || path.startsWith("/market/");

const getSafeGarageRedirectPath = (candidate: string | null, fallback: string) => {
  const safePath = getSafeRedirectPath(candidate, fallback);
  return isMarketPath(safePath) ? fallback : safePath;
};

const getSafeMarketRedirectPath = (candidate: string | null, fallback: string) => {
  const safePath = getSafeRedirectPath(candidate, fallback);
  return isMarketPath(safePath) ? safePath : fallback;
};

function LoginRouteRedirect() {
  const location = useLocation();
  const redirect = `${location.pathname}${location.search}${location.hash}`;
  const params = new URLSearchParams({ mode: "login" });

  if (redirect !== "/auth" && redirect !== "/auth?mode=login") {
    params.set("redirect", redirect);
  }

  return <Navigate to={`/auth?${params.toString()}`} replace />;
}

function MarketLoginRouteRedirect() {
  const location = useLocation();
  const redirect = `${location.pathname}${location.search}${location.hash}`;
  const params = new URLSearchParams({ mode: "login" });

  if (redirect !== "/market/auth" && redirect !== "/market/auth?mode=login") {
    params.set("redirect", redirect);
  }

  return <Navigate to={`/market/auth?${params.toString()}`} replace />;
}

function AuthRouteRedirect({
  fallback,
  realm = "garage",
}: {
  fallback: string;
  realm?: "garage" | "market";
}) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const redirectParam = params.get("redirect");

  if (redirectParam) {
    const nextPath = realm === "market"
      ? getSafeMarketRedirectPath(redirectParam, fallback)
      : getSafeGarageRedirectPath(redirectParam, fallback);

    return <Navigate to={nextPath} replace />;
  }

  return <Navigate to={fallback} replace />;
}

const adminRoutes = [
  { path: "/admin", element: <AdminDashboard /> },
  { path: "/admin/shops", element: <AdminShops /> },
  { path: "/admin/shops/:id", element: <AdminShopDetail /> },
  { path: "/admin/billing", element: <AdminBilling /> },
  { path: "/admin/alerts", element: <AdminAlerts /> },
  { path: "/admin/reports", element: <AdminReports /> },
  { path: "/admin/emails", element: <AdminEmailLogs /> },
  { path: "/admin/adoption", element: <AdminFeatureAdoption /> },
  { path: "/admin/settings", element: <AdminSettings /> },
  { path: "/admin/logs", element: <AdminLogs /> },
  { path: "/admin/users", element: <AdminUsers /> },
  { path: "/admin/system-health", element: <AdminSystemHealth /> },
  { path: "/admin/partners", element: <AdminPartners /> },
  { path: "/admin/traffic", element: <AdminTraffic /> },
  { path: "/admin/market", element: <AdminCarity /> },
  { path: "/admin/market-dashboard", element: <AdminMarketDashboard /> },
  { path: "/admin/market-kyc", element: <AdminMarketKYC /> },
  { path: "/admin/support", element: <AdminSupport /> },
  { path: "/admin/countries", element: <AdminCountries /> },
  { path: "/admin/marketing", element: <AdminMarketing /> },
  { path: "/admin/finance", element: <AdminFinance /> },
  { path: "/admin/system", element: <AdminSystemControl /> },
  { path: "/admin/coupons", element: <AdminCoupons /> },
  { path: "/admin/risk-engine", element: <AdminRiskEngine /> },
  { path: "/admin/vehicles", element: <AdminVehiclesGlobal /> },
  { path: "/admin/market-listings", element: <AdminMarketListings /> },
  { path: "/admin/market-escrows", element: <AdminMarketEscrows /> },
  { path: "/admin/seo", element: <AdminSeo /> },
  { path: "/admin/seo-blog", element: <AdminSeoBlog /> },
];

const shopRoutes = [
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/clients", element: <Clients /> },
  { path: "/vehicles", element: <Vehicles /> },
  { path: "/quotes", element: <Quotes /> },
  { path: "/quotes/new", element: <QuoteForm /> },
  { path: "/quotes/edit/:id", element: <QuoteForm /> },
  { path: "/services", element: <Services /> },
  { path: "/services/new", element: <ServiceForm /> },
  { path: "/services/edit/:id", element: <ServiceForm /> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/settings/email-templates", element: <EmailTemplates /> },
  { path: "/billing", element: <Billing /> },
  { path: "/alerts", element: <PlanGate feature="basicAlerts" requiredPlan="pro"><Alerts /></PlanGate> },
  { path: "/team", element: <PlanGate feature="teamManagement" requiredPlan="pro"><Team /></PlanGate> },
  { path: "/chat", element: <PlanGate feature="chatbot" requiredPlan="garage"><Chat /></PlanGate> },
  { path: "/invoices", element: <Invoices /> },
  { path: "/invoices/new", element: <InvoiceForm /> },
  { path: "/invoices/:id", element: <InvoiceDetail /> },
  { path: "/financial/reports", element: <PlanGate feature="basicReports" requiredPlan="pro"><FinancialReports /></PlanGate> },
  { path: "/agenda", element: <Agenda /> },
  { path: "/catalog", element: <ServiceCatalog /> },
  { path: "/stock", element: <Stock /> },
  { path: "/inspections", element: <Inspections /> },
  { path: "/loyalty", element: <PlanGate feature="loyalty" requiredPlan="garage"><Loyalty /></PlanGate> },
  { path: "/marketing", element: <PlanGate feature="marketing" requiredPlan="garage"><Marketing /></PlanGate> },
  { path: "/workshop", element: <Workshop /> },
  { path: "/automations", element: <PlanGate feature="automations" requiredPlan="garage"><Automations /></PlanGate> },
  { path: "/developers", element: <PlanGate feature="api" requiredPlan="garage"><Developers /></PlanGate> },
  { path: "/partners", element: <PartnersPortal /> },
  { path: "/referrals", element: <Referrals /> },
  { path: "/warranties", element: <Warranties /> },
  { path: "/market/inspections", element: <CarityShopInspections /> },
  { path: "/market/wallet", element: <MarketWallet /> },
  { path: "/market/payouts", element: <MarketPayoutInfo /> },
];

const preloadGarageNavigationRoutes = [
  () => import("@/pages/Dashboard"),
  () => import("@/pages/Clients"),
  () => import("@/pages/Vehicles"),
  () => import("@/pages/Quotes"),
  () => import("@/pages/Services"),
  () => import("@/pages/Settings"),
];

const preloadGarageSecondaryRoutes = [
  () => import("@/pages/ServiceCatalog"),
  () => import("@/pages/Stock"),
  () => import("@/pages/Inspections"),
  () => import("@/pages/Workshop"),
  () => import("@/pages/Warranties"),
  () => import("@/pages/Loyalty"),
  () => import("@/pages/Marketing"),
  () => import("@/pages/Automations"),
  () => import("@/pages/Developers"),
  () => import("@/pages/Alerts"),
  () => import("@/pages/Team"),
  () => import("@/pages/Chat"),
  () => import("@/pages/Referrals"),
  () => import("@/pages/Billing"),
  () => import("@/pages/FinancialReports"),
  () => import("@/pages/QuoteForm"),
  () => import("@/pages/ServiceForm"),
  () => import("@/pages/InvoiceForm"),
];

// Market pages that share the authenticated MarketLayout chrome
// (header, mobile nav, pending banner). Rendered via nested routing so the
// header stays mounted while pages swap — no flicker between routes.
const marketAuthedRoutes = [
  { path: "/market/my-listings", element: <CaritySellerDashboard /> },
  { path: "/market/dashboard", element: <MarketDashboard /> },
  { path: "/market/dealer-dashboard", element: <MarketDealerDashboard /> },
  { path: "/market/dealer/bulk", element: <MarketDealerBulkAdd /> },
  { path: "/market/messages", element: <MarketMessages /> },
  { path: "/market/profile", element: <MarketProfile /> },
  { path: "/market/favoritos", element: <CarityFavorites /> },
  { path: "/market/purchases", element: <MarketPurchases /> },
];

const publicRoutes = [
  { path: "/quote/:token", element: <QuoteApproval /> },
  { path: "/portal/:token", element: <ClientPortal /> },
  { path: "/book/:slug", element: <PublicBooking /> },
  { path: "/", element: <LandingPage /> },
  { path: "/afiliados", element: <Suspense fallback={<PageLoader />}><AffiliateSignup /></Suspense> },
  { path: "/afiliados/login", element: <Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense> },
  { path: "/affiliate-login", element: <Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense> },
  { path: "/market", element: <Suspense fallback={<PageLoader />}><CarityMarketplace /></Suspense> },
  { path: "/market/auth", element: <Suspense fallback={<PageLoader />}><MarketAuth /></Suspense> },
  { path: "/market/car/:id", element: <Suspense fallback={<PageLoader />}><CarityListingDetail /></Suspense> },
  { path: "/market/carros/:slug", element: <Suspense fallback={<PageLoader />}><CarityListingSEO /></Suspense> },
  { path: "/market/sell", element: <Suspense fallback={<PageLoader />}><CaritySellCar /></Suspense> },
  { path: "/market/pay/:id", element: <Suspense fallback={<PageLoader />}><CarityPayInspection /></Suspense> },
  { path: "/market/make/:make", element: <Suspense fallback={<PageLoader />}><CarityByMake /></Suspense> },
  { path: "/market/city/:city", element: <Suspense fallback={<PageLoader />}><CarityByCity /></Suspense> },
  { path: "/market/modelo/:make/:model", element: <Suspense fallback={<PageLoader />}><CarityByModel /></Suspense> },
  { path: "/market/preco/:range", element: <Suspense fallback={<PageLoader />}><CarityByPrice /></Suspense> },
  { path: "/market/stands", element: <Suspense fallback={<PageLoader />}><MarketStandsDirectory /></Suspense> },
  { path: "/market/stand/:slug", element: <Suspense fallback={<PageLoader />}><MarketStandPublic /></Suspense> },
  { path: "/market/verify/:token", element: <Suspense fallback={<PageLoader />}><MarketVerifyCertificate /></Suspense> },
  { path: "/carity", element: <Navigate to="/market" replace /> },
  { path: "/carity/auth", element: <Navigate to="/market/auth" replace /> },
  { path: "/carity/*", element: <Navigate to="/market" replace /> },
  // Legal / RGPD
  { path: "/legal/privacy", element: <Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense> },
  { path: "/legal/terms", element: <Suspense fallback={<PageLoader />}><TermsOfService /></Suspense> },
  { path: "/legal/cookies", element: <Suspense fallback={<PageLoader />}><CookiePolicy /></Suspense> },
  { path: "/legal/dpa", element: <Suspense fallback={<PageLoader />}><DPA /></Suspense> },
  { path: "/legal/my-data", element: <Suspense fallback={<PageLoader />}><MyData /></Suspense> },
  { path: "/legal/market-terms", element: <Suspense fallback={<PageLoader />}><MarketTerms /></Suspense> },
  { path: "/support", element: <Suspense fallback={<PageLoader />}><Support /></Suspense> },

  // ============ SEO PT (landing pages orgânicas) ============
  { path: "/software-gestao-oficinas", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/erp-oficina-automovel", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/alternativa-excel-oficinas", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/programa-faturacao-oficinas", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/orcamentos-oficina-digital", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/como-gerir-oficina", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/como-fazer-orcamentos-oficina", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/como-controlar-clientes-oficina", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/como-organizar-oficina-automovel", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/software-oficinas-vs-excel", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/melhor-software-oficinas-portugal", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  // Novas páginas SEO de intenção alta / problema / comparativa
  { path: "/software-oficinas-preco", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/software-oficinas-cloud", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/como-gerir-viaturas-oficina", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  { path: "/erp-vs-excel-oficina", element: <Suspense fallback={<PageLoader />}><SeoLandingPage /></Suspense> },
  // Cidades — URL canónica e variantes de intenção (conteúdo único por combinação)
  { path: "/oficinas/:cidade", element: <Suspense fallback={<PageLoader />}><SeoCityPage /></Suspense> },
  { path: "/gestao-oficinas/:cidade", element: <Suspense fallback={<PageLoader />}><SeoCityPage /></Suspense> },
  { path: "/erp-automovel/:cidade", element: <Suspense fallback={<PageLoader />}><SeoCityPage /></Suspense> },
  { path: "/software-oficinas/:cidade", element: <Suspense fallback={<PageLoader />}><SeoCityPage /></Suspense> },
  // Aliases com hífen → redirecionam para a URL canónica
  { path: "/oficinas-lisboa", element: <Navigate to="/oficinas/lisboa" replace /> },
  { path: "/oficinas-porto", element: <Navigate to="/oficinas/porto" replace /> },
  { path: "/oficinas-braga", element: <Navigate to="/oficinas/braga" replace /> },
  { path: "/oficinas-faro", element: <Navigate to="/oficinas/faro" replace /> },
  { path: "/oficinas-coimbra", element: <Navigate to="/oficinas/coimbra" replace /> },
  // Blog SEO
  { path: "/blog", element: <Suspense fallback={<PageLoader />}><SeoBlogIndex /></Suspense> },
  { path: "/blog/:slug", element: <Suspense fallback={<PageLoader />}><SeoBlogPost /></Suspense> },
];

// SeoLandingPage is matched via the explicit slug routes above; React Router resolves them
// without a wildcard so authenticated users keep being redirected for unknown paths.

const publicRoutesWithoutMarketAuth = publicRoutes.filter((route) => route.path !== "/market/auth");
// For authenticated users, "/" should redirect to their app dashboard — never show the landing page again.
const publicRoutesAuthed = publicRoutesWithoutMarketAuth.filter((route) => route.path !== "/");

const publicSeoRoutes = publicRoutes.filter((route) =>
  route.path === "/blog" ||
  route.path === "/blog/:slug" ||
  route.path === "/software-gestao-oficinas" ||
  route.path === "/erp-oficina-automovel" ||
  route.path === "/alternativa-excel-oficinas" ||
  route.path === "/programa-faturacao-oficinas" ||
  route.path === "/orcamentos-oficina-digital" ||
  route.path === "/como-gerir-oficina" ||
  route.path === "/como-fazer-orcamentos-oficina" ||
  route.path === "/como-controlar-clientes-oficina" ||
  route.path === "/como-organizar-oficina-automovel" ||
  route.path === "/software-oficinas-vs-excel" ||
  route.path === "/melhor-software-oficinas-portugal" ||
  route.path === "/software-oficinas-preco" ||
  route.path === "/software-oficinas-cloud" ||
  route.path === "/como-gerir-viaturas-oficina" ||
  route.path === "/erp-vs-excel-oficina" ||
  route.path === "/oficinas/:cidade" ||
  route.path === "/gestao-oficinas/:cidade" ||
  route.path === "/erp-automovel/:cidade" ||
  route.path === "/software-oficinas/:cidade" ||
  route.path === "/oficinas-lisboa" ||
  route.path === "/oficinas-porto" ||
  route.path === "/oficinas-braga" ||
  route.path === "/oficinas-faro" ||
  route.path === "/oficinas-coimbra"
);

const USER_TYPE_CACHE_KEY = "garageflow_user_type_cache";

type CachedUserType = {
  userId: string;
  isAffiliate: boolean;
  isCarityUser: boolean;
};

function readCachedUserType(userId: string | undefined): CachedUserType | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(USER_TYPE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedUserType;
    if (parsed?.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCachedUserType(value: CachedUserType) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(USER_TYPE_CACHE_KEY, JSON.stringify(value));
  } catch {
    /* storage full / disabled — ignore */
  }
}

function AuthenticatedRoutes() {
  const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();
  const { isReady: authReady, user } = useAuthReady();

  // Hydrate from session cache to AVOID the "create-shop / wrong dashboard" flash.
  const cached = readCachedUserType(user?.id);
  const [isAffiliate, setIsAffiliate] = useState(cached?.isAffiliate ?? false);
  const [isCarityUser, setIsCarityUser] = useState(cached?.isCarityUser ?? false);
  const [ready, setReady] = useState(Boolean(cached));

  useEffect(() => {
    if (adminLoading || !authReady) return;
    if (isSuperAdmin) {
      setReady(true);
      return;
    }
    if (!user) {
      setReady(true);
      return;
    }

    let cancelled = false;
    const checkUserState = async () => {
      const accessProfile = await getUserAccessProfile(user);

      if (cancelled) return;

      const isAff = accessProfile.isAffiliate;
      const isCarity = accessProfile.isMarketUser;

      setIsAffiliate(isAff);
      setIsCarityUser(isCarity);
      setReady(true);
      writeCachedUserType({ userId: user.id, isAffiliate: isAff, isCarityUser: isCarity });
    };

    void checkUserState();
    return () => { cancelled = true; };
  }, [isSuperAdmin, adminLoading, authReady, user]);

  useEffect(() => {
    if (!authReady || !user || isSuperAdmin || isAffiliate || isCarityUser) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;

    const preload = () => {
      void Promise.allSettled(preloadGarageNavigationRoutes.map((loadRoute) => loadRoute()));
      window.setTimeout(() => {
        void Promise.allSettled(preloadGarageSecondaryRoutes.map((loadRoute) => loadRoute()));
      }, 3500);
    };

    let timeoutId: number | null = null;
    let idleId: number | null = null;

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(preload, { timeout: 1200 });
    } else {
      timeoutId = window.setTimeout(preload, 800);
    }

    return () => {
      if (idleId !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [authReady, isAffiliate, isCarityUser, isSuperAdmin, user]);

  if (adminLoading || !authReady || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSuperAdmin) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<AdminLayout />}>
              {adminRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={<Suspense fallback={<PageLoader />}>{route.element}</Suspense>} />
              ))}
            </Route>
            <Route element={<Layout><Outlet /></Layout>}>
              {shopRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={<Suspense fallback={<PageLoader />}>{route.element}</Suspense>} />
              ))}
            </Route>
            <Route path="/auth" element={<AuthRouteRedirect fallback="/admin" realm="garage" />} />
            <Route path="/market/auth" element={<Suspense fallback={<PageLoader />}><MarketAuth /></Suspense>} />
            <Route element={<MarketLayout />}>
              {marketAuthedRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Route>
            <Route path="/" element={<Navigate to="/admin" replace />} />
            {publicRoutesAuthed.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="/affiliate-dashboard" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
            <Route path="/onboarding" element={<OnboardingWizard onComplete={() => {}} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  const defaultRoute = isAffiliate
    ? "/affiliate-dashboard"
    : isCarityUser
      ? "/market/dashboard"
      : "/dashboard";

  if (isCarityUser) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/admin/*" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/auth" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/market/auth" element={<AuthRouteRedirect fallback="/market/dashboard" realm="market" />} />
            <Route element={<MarketLayout />}>
              {marketAuthedRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={route.element} />
              ))}
            </Route>
            <Route path="/" element={<Navigate to="/market/dashboard" replace />} />
            {publicRoutesAuthed.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="/dashboard" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/clients" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/vehicles" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/quotes/*" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/services/*" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/settings" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/billing" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/invoices/*" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="/onboarding" element={<Navigate to="/market/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/market/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/admin/*" element={<Navigate to={defaultRoute} replace />} />
          <Route path="/auth" element={<AuthRouteRedirect fallback={isAffiliate ? "/affiliate-dashboard" : "/dashboard"} realm="garage" />} />
          <Route path="/market/auth" element={<Suspense fallback={<PageLoader />}><MarketAuth /></Suspense>} />
          <Route path="/" element={<Navigate to={defaultRoute} replace />} />
          {publicRoutesAuthed.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="/onboarding" element={<OnboardingWizard onComplete={() => {}} />} />
          <Route element={<MarketLayout />}>
            {marketAuthedRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
          </Route>
          <Route element={<Layout><Outlet /></Layout>}>
            {shopRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={<Suspense fallback={<PageLoader />}>{route.element}</Suspense>} />
            ))}
          </Route>
          <Route path="/affiliate-dashboard" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}

function AppRoutes() {
  const { isReady, session, user } = useAuthReady();

  useEffect(() => {
    if (isReady) {
      sessionStorage.removeItem(AUTO_RECOVERY_KEY);
    }
  }, [isReady]);

  useEffect(() => {
    setSentryUser(user ? { id: user.id, email: user.email } : null);
  }, [user]);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/quote/:token" element={<QuoteApproval />} />
            <Route path="/portal/:token" element={<ClientPortal />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/admin/*" element={<LoginRouteRedirect />} />
            <Route path="/afiliados" element={<Suspense fallback={<PageLoader />}><AffiliateSignup /></Suspense>} />
            <Route path="/afiliados/login" element={<Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense>} />
            <Route path="/affiliate-login" element={<Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense>} />
            <Route path="/affiliate-dashboard" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
            <Route path="/book/:slug" element={<PublicBooking />} />
            <Route path="/market" element={<Suspense fallback={<PageLoader />}><CarityMarketplace /></Suspense>} />
            <Route path="/market/auth" element={<Suspense fallback={<PageLoader />}><MarketAuth /></Suspense>} />
            <Route path="/market/car/:id" element={<Suspense fallback={<PageLoader />}><CarityListingDetail /></Suspense>} />
            <Route path="/market/carros/:slug" element={<Suspense fallback={<PageLoader />}><CarityListingSEO /></Suspense>} />
            <Route path="/market/sell" element={<Suspense fallback={<PageLoader />}><CaritySellCar /></Suspense>} />
            <Route path="/market/dashboard" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/messages" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/profile" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/my-listings" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/pay/:id" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/make/:make" element={<Suspense fallback={<PageLoader />}><CarityByMake /></Suspense>} />
            <Route path="/market/city/:city" element={<Suspense fallback={<PageLoader />}><CarityByCity /></Suspense>} />
            <Route path="/market/modelo/:make/:model" element={<Suspense fallback={<PageLoader />}><CarityByModel /></Suspense>} />
            <Route path="/market/preco/:range" element={<Suspense fallback={<PageLoader />}><CarityByPrice /></Suspense>} />
            <Route path="/legal/privacy" element={<Suspense fallback={<PageLoader />}><PrivacyPolicy /></Suspense>} />
            <Route path="/legal/terms" element={<Suspense fallback={<PageLoader />}><TermsOfService /></Suspense>} />
            <Route path="/legal/cookies" element={<Suspense fallback={<PageLoader />}><CookiePolicy /></Suspense>} />
            <Route path="/legal/dpa" element={<Suspense fallback={<PageLoader />}><DPA /></Suspense>} />
            <Route path="/legal/my-data" element={<Suspense fallback={<PageLoader />}><MyData /></Suspense>} />
            <Route path="/legal/market-terms" element={<Suspense fallback={<PageLoader />}><MarketTerms /></Suspense>} />
            <Route path="/support" element={<Suspense fallback={<PageLoader />}><Support /></Suspense>} />
            <Route path="/carity" element={<Navigate to="/market" replace />} />
            <Route path="/carity/auth" element={<Navigate to="/market/auth" replace />} />
            <Route path="/carity/*" element={<Navigate to="/market" replace />} />
            <Route path="*" element={<Navigate to="/auth?mode=login" replace />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  return <AuthenticatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ThemeProvider>
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={null}>
            <CommandPalette />
          </Suspense>
          <AppRoutes />
          <SupportFab />
          <CookieConsentBanner />
          <IndiaLanguagePrompt />
        </BrowserRouter>
        <PWAInstallPrompt />
      </LanguageProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
