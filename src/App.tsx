import { useEffect, useState, lazy, Suspense, Component, type ReactNode, type ErrorInfo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import CommandPalette from "@/components/CommandPalette";
import { TooltipProvider } from "@/components/ui/tooltip";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { LanguageProvider } from "@/i18n/LanguageContext";
import NotFound from "@/pages/NotFound";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useAuthReady } from "@/hooks/useAuthReady";
const PlanGate = lazy(() => import("@/components/PlanGate"));

// Critical path - eagerly loaded for instant navigation
import Auth from "@/pages/Auth";
import LandingPage from "@/pages/LandingPage";
const AffiliateSignup = lazy(() => import("@/pages/AffiliateSignup"));
const AffiliateDashboard = lazy(() => import("@/pages/AffiliateDashboard"));

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

// Lazy-loaded pages for code splitting & performance at scale
const OnboardingWizard = lazyRetry(() => import("@/pages/OnboardingWizard"));
const Dashboard = lazyRetry(() => import("@/pages/Dashboard"));
const Clients = lazyRetry(() => import("@/pages/Clients"));
const Vehicles = lazyRetry(() => import("@/pages/Vehicles"));
const Quotes = lazyRetry(() => import("@/pages/Quotes"));
const QuoteForm = lazyRetry(() => import("@/pages/QuoteForm"));
const Services = lazyRetry(() => import("@/pages/Services"));
const ServiceForm = lazyRetry(() => import("@/pages/ServiceForm"));
const SettingsPage = lazyRetry(() => import("@/pages/Settings"));
const Billing = lazyRetry(() => import("@/pages/Billing"));
const Alerts = lazyRetry(() => import("@/pages/Alerts"));
const Team = lazyRetry(() => import("@/pages/Team"));
const Chat = lazyRetry(() => import("@/pages/Chat"));
const Invoices = lazyRetry(() => import("@/pages/Invoices"));
const InvoiceForm = lazyRetry(() => import("@/pages/InvoiceForm"));
const InvoiceDetail = lazyRetry(() => import("@/pages/InvoiceDetail"));
const FinancialReports = lazyRetry(() => import("@/pages/FinancialReports"));
const Agenda = lazyRetry(() => import("@/pages/Agenda"));
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
  return (
    normalized.includes("loading chunk") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("dynamically imported module") ||
    normalized.includes("module script") ||
    normalized.includes("import")
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
];

const shopRoutes = [
  { path: "/dashboard", element: <Layout><Dashboard /></Layout> },
  { path: "/clients", element: <Layout><Clients /></Layout> },
  { path: "/vehicles", element: <Layout><Vehicles /></Layout> },
  { path: "/quotes", element: <Layout><Quotes /></Layout> },
  { path: "/quotes/new", element: <Layout><QuoteForm /></Layout> },
  { path: "/quotes/edit/:id", element: <Layout><QuoteForm /></Layout> },
  { path: "/services", element: <Layout><Services /></Layout> },
  { path: "/services/new", element: <Layout><ServiceForm /></Layout> },
  { path: "/services/edit/:id", element: <Layout><ServiceForm /></Layout> },
  { path: "/settings", element: <Layout><SettingsPage /></Layout> },
  { path: "/billing", element: <Layout><Billing /></Layout> },
  { path: "/alerts", element: <Layout><PlanGate feature="basicAlerts" requiredPlan="pro"><Alerts /></PlanGate></Layout> },
  { path: "/team", element: <Layout><PlanGate feature="teamManagement" requiredPlan="pro"><Team /></PlanGate></Layout> },
  { path: "/chat", element: <Layout><PlanGate feature="chatbot" requiredPlan="garage"><Chat /></PlanGate></Layout> },
  { path: "/invoices", element: <Layout><Invoices /></Layout> },
  { path: "/invoices/new", element: <Layout><InvoiceForm /></Layout> },
  { path: "/invoices/:id", element: <Layout><InvoiceDetail /></Layout> },
  { path: "/financial/reports", element: <Layout><PlanGate feature="basicReports" requiredPlan="pro"><FinancialReports /></PlanGate></Layout> },
  { path: "/agenda", element: <Layout><Agenda /></Layout> },
  { path: "/catalog", element: <Layout><ServiceCatalog /></Layout> },
  { path: "/stock", element: <Layout><Stock /></Layout> },
  { path: "/inspections", element: <Layout><Inspections /></Layout> },
  { path: "/loyalty", element: <Layout><PlanGate feature="loyalty" requiredPlan="garage"><Loyalty /></PlanGate></Layout> },
  { path: "/marketing", element: <Layout><PlanGate feature="marketing" requiredPlan="garage"><Marketing /></PlanGate></Layout> },
  { path: "/workshop", element: <Layout><Workshop /></Layout> },
  { path: "/automations", element: <Layout><PlanGate feature="automations" requiredPlan="garage"><Automations /></PlanGate></Layout> },
  { path: "/developers", element: <Layout><PlanGate feature="api" requiredPlan="garage"><Developers /></PlanGate></Layout> },
  { path: "/partners", element: <Layout><PartnersPortal /></Layout> },
  { path: "/referrals", element: <Layout><Referrals /></Layout> },
  { path: "/warranties", element: <Layout><Warranties /></Layout> },
];

const publicRoutes = [
  { path: "/quote/:token", element: <QuoteApproval /> },
  { path: "/portal/:token", element: <ClientPortal /> },
  { path: "/book/:slug", element: <PublicBooking /> },
  { path: "/", element: <LandingPage /> },
  { path: "/afiliados", element: <Suspense fallback={<PageLoader />}><AffiliateSignup /></Suspense> },
];

function AuthenticatedRoutes() {
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [ready, setReady] = useState(false);
  const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();
  const { isReady: authReady, user } = useAuthReady();

  useEffect(() => {
    if (adminLoading || !authReady) return;
    if (isSuperAdmin) { setReady(true); return; }

    const checkUserState = async () => {
      if (!user) { setReady(true); return; }

      // Check if affiliate
      const { data: partnerData } = await supabase
        .from("partners")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (partnerData) {
        setIsAffiliate(true);
        setReady(true);
        return;
      }

      // Shop exists — go directly to dashboard (progressive setup handles missing fields)
      setReady(true);
    };
    checkUserState();
  }, [isSuperAdmin, adminLoading, authReady, user]);

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
            {adminRoutes.map(r => (
              <Route key={r.path} path={r.path} element={<AdminLayout>{r.element}</AdminLayout>} />
            ))}
            {shopRoutes.map(r => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            {publicRoutes.map(r => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}
            <Route path="/affiliate-dashboard" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
            <Route path="/onboarding" element={<OnboardingWizard onComplete={() => {}} />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    );
  }

  const defaultRoute = isAffiliate ? "/affiliate-dashboard" : "/dashboard";

  return (
    <ChunkErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/admin/*" element={<Navigate to={defaultRoute} replace />} />
          <Route path="/auth" element={<Navigate to={defaultRoute} replace />} />
          {publicRoutes.map(r => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route path="/onboarding" element={<OnboardingWizard onComplete={() => {}} />} />
          {shopRoutes.map(r => (
            <Route key={r.path} path={r.path} element={r.element} />
          ))}
          <Route path="/affiliate-dashboard" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
          <Route path="*" element={<Navigate to={defaultRoute} replace />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!loading) {
      sessionStorage.removeItem(AUTO_RECOVERY_KEY);
    }
  }, [loading]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error && error.message?.includes('session_not_found')) {
        supabase.auth.signOut();
        setSession(null);
      } else {
        setSession(session);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
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
            <Route path="/afiliados" element={<Suspense fallback={<PageLoader />}><AffiliateSignup /></Suspense>} />
            <Route path="/affiliate-dashboard" element={<Suspense fallback={<PageLoader />}><AffiliateDashboard /></Suspense>} />
            <Route path="/book/:slug" element={<PublicBooking />} />
            <Route path="*" element={<LandingPage />} />
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
      <LanguageProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CommandPalette />
          <AppRoutes />
        </BrowserRouter>
        <PWAInstallPrompt />
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
