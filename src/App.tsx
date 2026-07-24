import { useEffect, useState, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation, useParams } from "react-router-dom";
import { LanguageProvider } from "@/i18n/LanguageContext";
import IndiaLanguagePrompt from "@/components/IndiaLanguagePrompt";
import { ThemeProvider } from "@/components/ThemeProvider";
import NotFound from "@/pages/NotFound";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useCommercialAdmin } from "@/hooks/useCommercialAdmin";
import { useAuthReady } from "@/hooks/useAuthReady";
import { getUserAccessProfile } from "@/lib/authRealm";
import { setSentryUser } from "@/lib/sentry";
const PlanGate = lazy(() => import("@/components/PlanGate"));
const FeatureGate = lazy(() => import("@/components/FeatureGate"));
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
const GratisLanding = lazy(() => import("@/pages/GratisLanding"));
const ErpLanding = lazy(() => import("@/pages/ErpLanding"));

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
const AcceptInvite = lazyRetry(() => import("@/pages/AcceptInvite"));
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
const MessageTemplates = lazyRetry(() => import("@/pages/settings/MessageTemplates"));
const BillingIntegration = lazyRetry(() => import("@/pages/settings/BillingIntegration"));
const EmailTemplates = lazyRetry(() => import("@/pages/EmailTemplates"));
const Agenda = lazyRetry(() => import("@/pages/Agenda"));
const Invoices = lazyRetry(() => import("@/pages/Invoices"));
const OnboardingWizard = lazyRetry(() => import("@/pages/OnboardingWizard"));
const QuoteForm = lazyRetry(() => import("@/pages/QuoteForm"));
const ServiceForm = lazyRetry(() => import("@/pages/ServiceForm"));
const Billing = lazyRetry(() => import("@/pages/Billing"));
const TrialExpired = lazyRetry(() => import("@/pages/TrialExpired"));
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
const AutomationsHub = lazyRetry(() => import("@/pages/AutomationsHub"));
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
const CarityByFuel = lazyRetry(() => import("@/pages/CarityByFuel"));
const CarityBySegment = lazyRetry(() => import("@/pages/CarityBySegment"));
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

// Market — sub-páginas internas do ERP (renderizam dentro do Layout ERP)
const MarketOpportunities = lazyRetry(() => import("@/pages/market/MarketOpportunities"));
const MarketOffers = lazyRetry(() => import("@/pages/market/MarketOffers"));
const MarketHistory = lazyRetry(() => import("@/pages/market/MarketHistory"));
const MarketStats = lazyRetry(() => import("@/pages/market/MarketStats"));

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
import { erpSupabase } from "@/integrations/supabase/realmClients";
import { useShopRole } from "@/hooks/useShopRole";
import { usePrimaryShopId } from "@/hooks/usePrimaryShopId";
import { canOpenPath, homeForRole } from "@/lib/rolePaths";
import { useGlobalMarketEnabled } from "@/hooks/useGlobalMarketEnabled";
import PublicRouteTracker from "@/components/PublicRouteTracker";

// Admin pages
const AdminDashboard = lazyRetry(() => import("@/pages/admin/AdminDashboard"));
const AdminShops = lazyRetry(() => import("@/pages/admin/AdminShops"));
const AdminShopDetail = lazyRetry(() => import("@/pages/admin/AdminShopDetail"));
const AdminLogs = lazyRetry(() => import("@/pages/admin/AdminLogs"));
const AdminReports = lazyRetry(() => import("@/pages/admin/AdminReports"));
const AdminBilling = lazyRetry(() => import("@/pages/admin/AdminBilling"));
const AdminAlerts = lazyRetry(() => import("@/pages/admin/AdminAlerts"));
const AdminSettings = lazyRetry(() => import("@/pages/admin/AdminSettings"));
const AdminFeatureMatrix = lazyRetry(() => import("@/pages/admin/AdminFeatureMatrix"));
const AdminPlans = lazyRetry(() => import("@/pages/admin/AdminPlans"));
const AdminAIControl = lazyRetry(() => import("@/pages/admin/AdminAIControl"));
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
const AdminMarketing = lazyRetry(() => import("@/pages/admin/AdminMarketingHub"));
const AdminFinance = lazyRetry(() => import("@/pages/admin/AdminFinance"));
const AdminSystemControl = lazyRetry(() => import("@/pages/admin/AdminSystemControl"));
const AdminCoupons = lazyRetry(() => import("@/pages/admin/AdminCoupons"));
const AdminRiskEngine = lazyRetry(() => import("@/pages/admin/AdminRiskEngine"));
const AdminVehiclesGlobal = lazyRetry(() => import("@/pages/admin/AdminVehiclesGlobal"));
const AdminMarketListings = lazyRetry(() => import("@/pages/admin/AdminMarketListings"));
const AdminMarketEscrows = lazyRetry(() => import("@/pages/admin/AdminMarketEscrows"));
const AdminMarketActivations = lazyRetry(() => import("@/pages/admin/AdminMarketActivations"));
const AdminSeo = lazyRetry(() => import("@/pages/admin/AdminSeo"));
const AdminSeoBlog = lazyRetry(() => import("@/pages/admin/AdminSeoBlog"));
const AdminGrowthOpportunities = lazyRetry(() => import("@/pages/admin/AdminGrowthOpportunities"));
const AdminBusinessMetrics = lazyRetry(() => import("@/pages/admin/AdminBusinessMetrics"));
const AdminComplaints = lazyRetry(() => import("@/pages/admin/AdminComplaints"));
const AdminActionQueue = lazyRetry(() => import("@/pages/admin/AdminActionQueue"));
const AdminRateLimits = lazyRetry(() => import("@/pages/admin/AdminRateLimits"));
const AdminMarketingAutopilot = lazyRetry(() => import("@/pages/admin/AdminMarketingAutopilot"));
const AdminGrowth = lazyRetry(() => import("@/pages/admin/AdminGrowth"));
const AdminAccounting = lazyRetry(() => import("@/pages/admin/AdminAccounting"));
const OficinasPiloto = lazyRetry(() => import("@/pages/OficinasPiloto"));
const StatusPage = lazyRetry(() => import("@/pages/StatusPage"));

// Commercial admin (Administrador Comercial) panel
const CommercialLayout = lazyRetry(() => import("@/components/CommercialLayout"));
const CommercialDashboard = lazyRetry(() => import("@/pages/commercial/CommercialDashboard"));
const CommercialCRM = lazyRetry(() => import("@/pages/commercial/CommercialCRM"));
const CommercialPipeline = lazyRetry(() => import("@/pages/commercial/CommercialPipeline"));
const CommercialMeetings = lazyRetry(() => import("@/pages/commercial/CommercialMeetings"));
const CommercialRetention = lazyRetry(() => import("@/pages/commercial/CommercialRetention"));
const CommercialIntelligence = lazyRetry(() => import("@/pages/commercial/CommercialIntelligence"));
const CommercialReports = lazyRetry(() => import("@/pages/commercial/CommercialReports"));
const CommercialObjectives = lazyRetry(() => import("@/pages/commercial/CommercialObjectives"));
const CommercialDemos = lazyRetry(() => import("@/pages/commercial/CommercialDemos"));
const AdminDemoRequests = lazyRetry(() => import("@/pages/admin/AdminDemoRequests"));
const DemoRequestPage = lazyRetry(() => import("@/pages/DemoRequest"));

// GarageFlow Supplier Network (GSN) — módulo B2B isolado por feature flag
const AdminSupplierNetwork = lazyRetry(() => import("@/pages/admin/AdminSupplierNetwork"));
const SupplierNetworkGate = lazyRetry(() => import("@/components/supplier/SupplierNetworkGate"));
const SupplierLayout = lazyRetry(() => import("@/components/supplier/SupplierLayout"));
const SupplierDashboard = lazyRetry(() => import("@/pages/supplier/SupplierDashboard"));
const SupplierProducts = lazyRetry(() => import("@/pages/supplier/SupplierProducts"));
const SupplierProductForm = lazyRetry(() => import("@/pages/supplier/SupplierProductForm"));
const SupplierProfile = lazyRetry(() => import("@/pages/supplier/SupplierProfile"));
const SupplierPlaceholder = lazyRetry(() => import("@/pages/supplier/SupplierPlaceholder"));


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

function LegacyMarketListingRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/market/car/${id}` : "/market"} replace />;
}

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

// Marketplace entry MUST always render the actual Marketplace home — never
// auto-redirect an ERP-logged-in workshop into the shop panel. Workshops
// reach `/market/inspections` only by clicking it explicitly.
function GarageMarketEntryRedirect() {
  const { enabled, ready } = useGlobalMarketEnabled();
  if (ready && !enabled) return <Navigate to="/" replace />;
  return <Suspense fallback={<PageLoader />}><CarityMarketplace /></Suspense>;
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

// Paths that only the Oficina Mãe (primary shop of the account owner) may open.
// Keep in sync with PRIMARY_SHOP_ONLY_PATHS in src/components/Layout.tsx.
const PRIMARY_ONLY_PATHS = new Set<string>([
  "/billing",
  "/settings/billing-integration",
]);

function RoleProtectedRoute({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { role, loading, shopId, can } = useShopRole();
  const { primaryShopId, loading: primaryLoading } = usePrimaryShopId();

  if (loading || primaryLoading) return <PageLoader />;
  if (!shopId) return <Navigate to="/onboarding" replace />;
  if (!role) return <Navigate to="/onboarding" replace />;

  // Group-admin surfaces (Billing, Stripe integration, …) are reserved for the
  // Oficina Mãe. Even if the current user has role=owner/admin inside a child
  // shop, they cannot reach these routes from that context.
  const isPrimaryOnlyPath = Array.from(PRIMARY_ONLY_PATHS).some(
    (p) => location.pathname === p || location.pathname.startsWith(`${p}/`)
  );
  if (isPrimaryOnlyPath && (!primaryShopId || primaryShopId !== shopId)) {
    return <Navigate to={homeForRole(role)} replace />;
  }

  return canOpenPath(location.pathname, role, can)
    ? <>{children}</>
    : <Navigate to={homeForRole(role)} replace />;
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
  { path: "/admin/features", element: <AdminFeatureMatrix /> },
  { path: "/admin/plans", element: <AdminPlans /> },
  { path: "/admin/ai-control", element: <AdminAIControl /> },
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
  { path: "/admin/market-activations", element: <AdminMarketActivations /> },
  { path: "/admin/seo", element: <AdminSeo /> },
  { path: "/admin/seo-blog", element: <AdminSeoBlog /> },
  { path: "/admin/growth-opportunities", element: <AdminGrowthOpportunities /> },
  { path: "/admin/business-metrics", element: <AdminBusinessMetrics /> },
  { path: "/admin/complaints", element: <AdminComplaints /> },
  { path: "/admin/action-queue", element: <AdminActionQueue /> },
  { path: "/admin/rate-limits", element: <AdminRateLimits /> },
  { path: "/admin/marketing-autopilot", element: <AdminMarketingAutopilot /> },
  { path: "/admin/growth", element: <AdminGrowth /> },
  { path: "/admin/accounting", element: <AdminAccounting /> },
  { path: "/admin/demos", element: <AdminDemoRequests /> },
  { path: "/admin/supplier-network", element: <AdminSupplierNetwork /> },
];

const supplierRoutes = [
  { path: "/supplier", element: <SupplierDashboard />, exact: true },
  { path: "/supplier/products", element: <SupplierProducts /> },
  { path: "/supplier/products/new", element: <SupplierProductForm /> },
  { path: "/supplier/products/:id", element: <SupplierProductForm /> },
  { path: "/supplier/categories", element: <SupplierPlaceholder title="Categorias" description="Gestão de categorias do seu catálogo." /> },
  { path: "/supplier/stock", element: <SupplierPlaceholder title="Stock" description="Histórico de movimentos, ajustes e inventário." /> },
  { path: "/supplier/orders", element: <SupplierPlaceholder title="Encomendas" description="Encomendas recebidas de oficinas." /> },
  { path: "/supplier/customers", element: <SupplierPlaceholder title="Clientes" description="Oficinas que compram os seus produtos." /> },
  { path: "/supplier/payments", element: <SupplierPlaceholder title="Pagamentos" description="Pagamentos processados via Stripe Connect." /> },
  { path: "/supplier/carriers", element: <SupplierPlaceholder title="Transportadoras" description="CTT, DPD, GLS, MRW, DHL, UPS, Correos Express e outros." /> },
  { path: "/supplier/invoices", element: <SupplierPlaceholder title="Faturas" description="Faturas emitidas para cada encomenda." /> },
  { path: "/supplier/reviews", element: <SupplierPlaceholder title="Avaliações" description="Feedback recebido das oficinas compradoras." /> },
  { path: "/supplier/profile", element: <SupplierProfile /> },
  { path: "/supplier/settings", element: <SupplierPlaceholder title="Configurações" description="Notificações, preferências e conta." /> },
];


const shopRoutes = [
  { path: "/dashboard", element: <Dashboard /> },
  { path: "/clients", element: <FeatureGate feature="clients" requiredPlan="pro"><Clients /></FeatureGate> },
  { path: "/vehicles", element: <FeatureGate feature="vehicles" requiredPlan="pro"><Vehicles /></FeatureGate> },
  { path: "/quotes", element: <FeatureGate feature="quotes" requiredPlan="pro"><Quotes /></FeatureGate> },
  { path: "/quotes/new", element: <FeatureGate feature="quotes" requiredPlan="pro"><QuoteForm /></FeatureGate> },
  { path: "/quotes/edit/:id", element: <FeatureGate feature="quotes" requiredPlan="pro"><QuoteForm /></FeatureGate> },
  { path: "/services", element: <FeatureGate feature="services" requiredPlan="pro"><Services /></FeatureGate> },
  { path: "/services/new", element: <FeatureGate feature="services" requiredPlan="pro"><ServiceForm /></FeatureGate> },
  { path: "/services/edit/:id", element: <FeatureGate feature="services" requiredPlan="pro"><ServiceForm /></FeatureGate> },
  { path: "/settings", element: <SettingsPage /> },
  { path: "/settings/email-templates", element: <EmailTemplates /> },
  { path: "/settings/messages", element: <MessageTemplates /> },
  { path: "/settings/billing-integration", element: <BillingIntegration /> },
  { path: "/billing", element: <Billing /> },
  { path: "/trial-expired", element: <TrialExpired /> },
  { path: "/alerts", element: <PlanGate feature="basicAlerts" requiredPlan="pro"><Alerts /></PlanGate> },
  { path: "/team", element: <PlanGate feature="teamManagement" requiredPlan="pro"><Team /></PlanGate> },
  { path: "/chat", element: <PlanGate feature="chatbot" requiredPlan="garage"><Chat /></PlanGate> },
  { path: "/invoices", element: <FeatureGate feature="invoices" requiredPlan="pro"><Invoices /></FeatureGate> },
  { path: "/invoices/new", element: <FeatureGate feature="invoices" requiredPlan="pro"><InvoiceForm /></FeatureGate> },
  { path: "/invoices/:id", element: <FeatureGate feature="invoices" requiredPlan="pro"><InvoiceDetail /></FeatureGate> },
  { path: "/financial/reports", element: <PlanGate feature="basicReports" requiredPlan="pro"><FinancialReports /></PlanGate> },
  { path: "/agenda", element: <FeatureGate feature="agenda" requiredPlan="pro"><Agenda /></FeatureGate> },
  { path: "/catalog", element: <FeatureGate feature="service_catalog" requiredPlan="pro"><ServiceCatalog /></FeatureGate> },
  { path: "/stock", element: <FeatureGate feature="stock" requiredPlan="pro"><Stock /></FeatureGate> },
  { path: "/inspections", element: <FeatureGate feature="inspections" requiredPlan="pro"><Inspections /></FeatureGate> },
  { path: "/loyalty", element: <FeatureGate feature="loyalty" requiredPlan="garage"><Loyalty /></FeatureGate> },
  { path: "/marketing", element: <FeatureGate feature="automations" requiredPlan="garage"><AutomationsHub /></FeatureGate> },
  { path: "/workshop", element: <FeatureGate feature="workshop_mode" requiredPlan="pro"><Workshop /></FeatureGate> },
  { path: "/automations", element: <FeatureGate feature="automations" requiredPlan="garage"><AutomationsHub /></FeatureGate> },
  { path: "/developers", element: <FeatureGate feature="api" requiredPlan="garage"><Developers /></FeatureGate> },
  { path: "/partners", element: <PartnersPortal /> },
  { path: "/referrals", element: <FeatureGate feature="referrals" requiredPlan="pro"><Referrals /></FeatureGate> },
  { path: "/warranties", element: <FeatureGate feature="warranties" requiredPlan="pro"><Warranties /></FeatureGate> },
  // Market = módulo interno do ERP. Para oficinas autenticadas as rotas
  // operacionais Market renderizam DENTRO do Layout ERP (mesmo header, mesma
  // sidebar, mesma sessão). MarketLayout fica reservado a navegação pública
  // do Market e a sessões Market-only (compradores/vendedores externos).
  { path: "/market/opportunities", element: <MarketOpportunities /> },
  { path: "/market/inspections", element: <CarityShopInspections /> },
  { path: "/market/offers", element: <MarketOffers /> },
  { path: "/market/wallet", element: <MarketWallet /> },
  { path: "/market/payouts", element: <MarketPayoutInfo /> },
  { path: "/market/history", element: <MarketHistory /> },
  { path: "/market/stats", element: <MarketStats /> },
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
  { path: "/market/inspections", element: <CarityShopInspections /> },
  { path: "/market/wallet", element: <MarketWallet /> },
  { path: "/market/payouts", element: <MarketPayoutInfo /> },
];

const publicRoutes = [
  { path: "/quote/:token", element: <QuoteApproval /> },
  { path: "/portal/:token", element: <ClientPortal /> },
  { path: "/book/:slug", element: <PublicBooking /> },
  { path: "/accept-invite", element: <Suspense fallback={<PageLoader />}><AcceptInvite /></Suspense> },
  { path: "/", element: <LandingPage /> },
  { path: "/erp", element: <Suspense fallback={<PageLoader />}><ErpLanding /></Suspense> },
  { path: "/status", element: <Suspense fallback={<PageLoader />}><StatusPage /></Suspense> },
  { path: "/afiliados", element: <Suspense fallback={<PageLoader />}><AffiliateSignup /></Suspense> },
  { path: "/afiliados/login", element: <Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense> },
  { path: "/affiliate-login", element: <Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense> },
  { path: "/market", element: <GarageMarketEntryRedirect /> },
  { path: "/market/auth", element: <Suspense fallback={<PageLoader />}><MarketAuth /></Suspense> },
  { path: "/market/car/:id", element: <Suspense fallback={<PageLoader />}><CarityListingDetail /></Suspense> },
  { path: "/market/listing/:id", element: <LegacyMarketListingRedirect /> },
  { path: "/market/carros/:slug", element: <Suspense fallback={<PageLoader />}><CarityListingSEO /></Suspense> },
  { path: "/market/sell", element: <Suspense fallback={<PageLoader />}><CaritySellCar /></Suspense> },
  { path: "/market/pay/:id", element: <Suspense fallback={<PageLoader />}><CarityPayInspection /></Suspense> },
  { path: "/market/make/:make", element: <Suspense fallback={<PageLoader />}><CarityByMake /></Suspense> },
  { path: "/market/city/:city", element: <Suspense fallback={<PageLoader />}><CarityByCity /></Suspense> },
  { path: "/market/modelo/:make/:model", element: <Suspense fallback={<PageLoader />}><CarityByModel /></Suspense> },
  { path: "/market/preco/:range", element: <Suspense fallback={<PageLoader />}><CarityByPrice /></Suspense> },
  { path: "/market/combustivel/:fuel", element: <Suspense fallback={<PageLoader />}><CarityByFuel /></Suspense> },
  { path: "/market/segmento/:segment", element: <Suspense fallback={<PageLoader />}><CarityBySegment /></Suspense> },
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
const publicRoutesGarageAuthed = publicRoutesAuthed.filter((route) =>
  !route.path.startsWith("/market") && !route.path.startsWith("/carity"),
);
// Market shop routes (inspections/wallet/payouts) agora vivem dentro do
// Layout ERP — ver shopRoutes. Mantemos esta constante como array vazio para
// compatibilidade com o branch de roteamento abaixo.
const garageMarketShopRoutes: typeof marketAuthedRoutes = [];

// Public marketplace browse routes that ERP-logged-in workshops can visit
// without being kicked into the shop panel. They render inside MarketLayout
// so the Market chrome (with "Voltar ao ERP") is visible.
const garageMarketPublicRoutes = publicRoutes.filter((route) =>
  route.path.startsWith("/market") && route.path !== "/market/auth",
);

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
const ACCESS_PROFILE_TIMEOUT_MS = 3000;

type CachedUserType = {
  userId: string;
  isAffiliate: boolean;
  isCarityUser: boolean;
  hasGarageAccess?: boolean;
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

function timeoutResult<T>(value: T, ms = ACCESS_PROFILE_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

function AuthenticatedRoutes() {
  const location = useLocation();
  const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();
  const { isCommercialAdmin, loading: commercialLoading } = useCommercialAdmin();
  const { isReady: authReady, user } = useAuthReady();

  // Hydrate from session cache to AVOID the "create-shop / wrong dashboard" flash.
  const cached = readCachedUserType(user?.id);
  const hasCompleteCache = Boolean(cached && typeof cached.hasGarageAccess === "boolean");
  const [isAffiliate, setIsAffiliate] = useState(cached?.isAffiliate ?? false);
  const [isCarityUser, setIsCarityUser] = useState(cached?.isCarityUser ?? false);
  const [hasGarageAccess, setHasGarageAccess] = useState(cached?.hasGarageAccess ?? false);
  const [ready, setReady] = useState(hasCompleteCache);

  // Touch activity once when user is hydrated (login + page reloads).
  useEffect(() => {
    if (!user?.id) return;
    import("@/lib/trackEvent").then(({ touchActivity }) => touchActivity());
  }, [user?.id]);

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
      const accessProfile = await Promise.race([
        getUserAccessProfile(user),
        timeoutResult({ isAffiliate: false, isGarageUser: false, isMarketUser: false, hasGarageRole: false, hasMarketRole: false, hasShopAccess: false }),
      ]);

      if (cancelled) return;

      const isAff = accessProfile.isAffiliate;
      const isCarity = accessProfile.isMarketUser;
      const hasGarage = accessProfile.isGarageUser;

      setIsAffiliate(isAff);
      setIsCarityUser(isCarity);
      setHasGarageAccess(hasGarage);
      setReady(true);
      writeCachedUserType({ userId: user.id, isAffiliate: isAff, isCarityUser: isCarity, hasGarageAccess: hasGarage });
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

  // Public "Marcar Demonstração" page — sempre acessível, seja qual for a sessão.
  if (typeof window !== "undefined" && window.location.pathname === "/demo") {
    return (
      <Suspense fallback={<PageLoader />}>
        <DemoRequestPage />
      </Suspense>
    );
  }

  if (adminLoading || commercialLoading || !authReady || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }


  // Administrador Comercial — painel dedicado, sem acesso ao admin técnico
  if (isCommercialAdmin && !isSuperAdmin) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route element={<CommercialLayout />}>
              <Route path="/commercial" element={<CommercialDashboard />} />
              <Route path="/commercial/crm" element={<CommercialCRM />} />
              <Route path="/commercial/pipeline" element={<CommercialPipeline />} />
              <Route path="/commercial/meetings" element={<CommercialMeetings />} />
              <Route path="/commercial/retention" element={<CommercialRetention />} />
              <Route path="/commercial/intelligence" element={<CommercialIntelligence />} />
              <Route path="/commercial/reports" element={<CommercialReports />} />
              <Route path="/commercial/objectives" element={<CommercialObjectives />} />
              <Route path="/commercial/demos" element={<CommercialDemos />} />
            </Route>
            <Route path="/auth" element={<Navigate to="/commercial" replace />} />
            <Route path="/" element={<Navigate to="/commercial" replace />} />
            {publicRoutesAuthed.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="*" element={<Navigate to="/commercial" replace />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
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

  const routeParams = new URLSearchParams(location.search);
  const forcedErp = routeParams.get("realm") === "erp";
  const isMarketPath = location.pathname.startsWith("/market") || location.pathname.startsWith("/carity");
  const shouldUseMarketRoutes = isCarityUser && !forcedErp && (!hasGarageAccess || isMarketPath);

  const defaultRoute = isAffiliate
    ? "/affiliate-dashboard"
    : shouldUseMarketRoutes
      ? "/market/dashboard"
      : "/dashboard";

  if (shouldUseMarketRoutes) {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/admin/*" element={<Navigate to="/market/dashboard" replace />} />
            {/* Allow Market-logged users to reach the ERP signup/login (different realm) */}
            <Route path="/auth" element={<Suspense fallback={<PageLoader />}><Auth /></Suspense>} />
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
          {publicRoutesGarageAuthed.map((route) => (
            <Route key={route.path} path={route.path} element={route.element} />
          ))}
          <Route path="/onboarding" element={<OnboardingWizard onComplete={() => {}} />} />
          {/* /market (browse home) renders standalone — CarityMarketplace ships its own hero/nav, so we keep it OUT of MarketLayout to avoid a double navbar. */}
          <Route path="/market" element={<GarageMarketEntryRedirect />} />
          <Route element={<MarketLayout />}>
            {garageMarketShopRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            {garageMarketPublicRoutes
              .filter((route) => route.path !== "/market")
              .map((route) => (
                <Route key={`gmp-${route.path}`} path={route.path} element={route.element} />
              ))}
            {/* Market-account routes that need a Market session — push to Market login carrying the original path */}
            <Route path="/market/dashboard" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/my-listings" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/favoritos" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/purchases" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/messages" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/profile" element={<MarketLoginRouteRedirect />} />
          </Route>
          <Route path="/carity/*" element={<Navigate to="/market" replace />} />
          <Route element={<Layout><Outlet /></Layout>}>
            {shopRoutes.map((route) => (
              <Route
                key={route.path}
                path={route.path}
                element={(
                  <RoleProtectedRoute>
                    <Suspense fallback={<PageLoader />}>{route.element}</Suspense>
                  </RoleProtectedRoute>
                )}
              />
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
  const location = useLocation();
  const { isReady, session, user } = useAuthReady();
  const authRedirect = new URLSearchParams(location.search).get("redirect");

  useEffect(() => {
    if (isReady) {
      sessionStorage.removeItem(AUTO_RECOVERY_KEY);
    }
  }, [isReady]);

  useEffect(() => {
    setSentryUser(user ? { id: user.id, email: user.email } : null);
  }, [user]);

  if (location.pathname === "/auth") {
    if (isReady && session) {
      return <Navigate to={getSafeGarageRedirectPath(authRedirect, "/dashboard")} replace />;
    }

    return (
      <ChunkErrorBoundary>
        <Auth />
      </ChunkErrorBoundary>
    );
  }

  if (location.pathname === "/login") {
    return (
      <ChunkErrorBoundary>
        <Auth />
      </ChunkErrorBoundary>
    );
  }

  if (location.pathname === "/reset-password") {
    return (
      <ChunkErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <ResetPassword />
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

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
            <Route path="/erp" element={<Suspense fallback={<PageLoader />}><ErpLanding /></Suspense>} />
            <Route path="/gratis-3-meses" element={<Suspense fallback={<PageLoader />}><GratisLanding /></Suspense>} />
            <Route path="/oficinas-piloto" element={<Suspense fallback={<PageLoader />}><OficinasPiloto /></Suspense>} />
            <Route path="/piloto" element={<Navigate to="/oficinas-piloto" replace />} />
            <Route path="/gratis" element={<Navigate to="/gratis-3-meses" replace />} />
            <Route path="/trial" element={<Navigate to="/gratis-3-meses" replace />} />
            <Route path="/free" element={<Navigate to="/gratis-3-meses" replace />} />
            <Route path="/quote/:token" element={<QuoteApproval />} />
            <Route path="/portal/:token" element={<ClientPortal />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/accept-invite" element={<Suspense fallback={<PageLoader />}><AcceptInvite /></Suspense>} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/login" element={<Auth />} />
            <Route path="/marketing" element={<Auth defaultRedirect="/marketing" />} />
            <Route path="/admin/*" element={<LoginRouteRedirect />} />
            <Route path="/afiliados" element={<Suspense fallback={<PageLoader />}><AffiliateSignup /></Suspense>} />
            <Route path="/afiliados/login" element={<Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense>} />
            <Route path="/affiliate-login" element={<Suspense fallback={<PageLoader />}><AffiliateLogin /></Suspense>} />
            <Route path="/affiliate-dashboard" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
            <Route path="/book/:slug" element={<PublicBooking />} />
            <Route path="/market" element={<GarageMarketEntryRedirect />} />
            <Route path="/market/auth" element={<Suspense fallback={<PageLoader />}><MarketAuth /></Suspense>} />
            <Route path="/market/car/:id" element={<Suspense fallback={<PageLoader />}><CarityListingDetail /></Suspense>} />
            <Route path="/market/listing/:id" element={<LegacyMarketListingRedirect />} />
            <Route path="/market/carros/:slug" element={<Suspense fallback={<PageLoader />}><CarityListingSEO /></Suspense>} />
            <Route path="/market/sell" element={<Suspense fallback={<PageLoader />}><CaritySellCar /></Suspense>} />
            <Route path="/market/dashboard" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/messages" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/profile" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/my-listings" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/pay/:id" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/favoritos" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/purchases" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/inspections" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/wallet" element={<MarketLoginRouteRedirect />} />
            <Route path="/market/payouts" element={<MarketLoginRouteRedirect />} />
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
            <Route path="/demo" element={<Suspense fallback={<PageLoader />}><DemoRequestPage /></Suspense>} />
            {publicSeoRoutes.map((route) => (
              <Route key={route.path} path={route.path} element={route.element} />
            ))}
            <Route path="/carity" element={<Navigate to="/market" replace />} />
            <Route path="/carity/auth" element={<Navigate to="/market/auth" replace />} />
            <Route path="/carity/*" element={<Navigate to="/market" replace />} />
            <Route path="*" element={<LoginRouteRedirect />} />
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
          <PublicRouteTracker />
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
