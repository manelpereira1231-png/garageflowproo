import { useEffect, useState, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { LanguageProvider } from "@/i18n/LanguageContext";
import NotFound from "@/pages/NotFound";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
const PlanGate = lazy(() => import("@/components/PlanGate"));

// Critical path - eagerly loaded for instant navigation
import Auth from "@/pages/Auth";
import LandingPage from "@/pages/LandingPage";

// Non-critical lazy-loaded
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const QuoteApproval = lazy(() => import("@/pages/QuoteApproval"));
const Layout = lazy(() => import("@/components/Layout"));
const AdminLayout = lazy(() => import("@/components/AdminLayout"));

// Lazy-loaded pages for code splitting & performance at scale
const OnboardingWizard = lazy(() => import("@/pages/OnboardingWizard"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Clients = lazy(() => import("@/pages/Clients"));
const Vehicles = lazy(() => import("@/pages/Vehicles"));
const Quotes = lazy(() => import("@/pages/Quotes"));
const QuoteForm = lazy(() => import("@/pages/QuoteForm"));
const Services = lazy(() => import("@/pages/Services"));
const ServiceForm = lazy(() => import("@/pages/ServiceForm"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const Billing = lazy(() => import("@/pages/Billing"));
const Alerts = lazy(() => import("@/pages/Alerts"));
const Team = lazy(() => import("@/pages/Team"));
const Chat = lazy(() => import("@/pages/Chat"));
const Invoices = lazy(() => import("@/pages/Invoices"));
const InvoiceForm = lazy(() => import("@/pages/InvoiceForm"));
const InvoiceDetail = lazy(() => import("@/pages/InvoiceDetail"));
const FinancialReports = lazy(() => import("@/pages/FinancialReports"));
const Agenda = lazy(() => import("@/pages/Agenda"));
const PublicBooking = lazy(() => import("@/pages/PublicBooking"));
const ClientPortal = lazy(() => import("@/pages/ClientPortal"));
const ServiceCatalog = lazy(() => import("@/pages/ServiceCatalog"));
const Stock = lazy(() => import("@/pages/Stock"));
const Inspections = lazy(() => import("@/pages/Inspections"));
const Loyalty = lazy(() => import("@/pages/Loyalty"));
const Marketing = lazy(() => import("@/pages/Marketing"));
const Workshop = lazy(() => import("@/pages/Workshop"));
const Automations = lazy(() => import("@/pages/Automations"));
const Developers = lazy(() => import("@/pages/Developers"));

// Admin pages
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminShops = lazy(() => import("@/pages/admin/AdminShops"));
const AdminShopDetail = lazy(() => import("@/pages/admin/AdminShopDetail"));
const AdminLogs = lazy(() => import("@/pages/admin/AdminLogs"));
const AdminReports = lazy(() => import("@/pages/admin/AdminReports"));
const AdminBilling = lazy(() => import("@/pages/admin/AdminBilling"));
const AdminAlerts = lazy(() => import("@/pages/admin/AdminAlerts"));
const AdminSettings = lazy(() => import("@/pages/admin/AdminSettings"));
const AdminUsers = lazy(() => import("@/pages/admin/AdminUsers"));
const AdminEmailLogs = lazy(() => import("@/pages/admin/AdminEmailLogs"));
const AdminFeatureAdoption = lazy(() => import("@/pages/admin/AdminFeatureAdoption"));

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
];

function AuthenticatedRoutes() {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();

  useEffect(() => {
    // Super admin NEVER needs onboarding — skip shop check entirely
    if (isSuperAdmin) {
      setNeedsOnboarding(false);
      return;
    }
    if (adminLoading) return; // wait for admin check first

    const checkShop = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setNeedsOnboarding(false); return; }
      for (let i = 0; i < 3; i++) {
        const { data: shop } = await supabase
          .from("shops")
          .select("name")
          .eq("user_id", user.id)
          .maybeSingle();
        if (shop) {
          setNeedsOnboarding(!shop.name || shop.name.trim() === '');
          return;
        }
        await new Promise(r => setTimeout(r, 1000));
      }
      setNeedsOnboarding(true);
    };
    checkShop();
  }, [isSuperAdmin, adminLoading]);

  if (adminLoading || needsOnboarding === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSuperAdmin) {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {adminRoutes.map(r => (
            <Route key={r.path} path={r.path} element={<AdminLayout>{r.element}</AdminLayout>} />
          ))}
          <Route path="/quote/:token" element={<QuoteApproval />} />
          <Route path="/portal/:token" element={<ClientPortal />} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/clients" element={<Layout><Clients /></Layout>} />
          <Route path="/vehicles" element={<Layout><Vehicles /></Layout>} />
          <Route path="/quotes" element={<Layout><Quotes /></Layout>} />
          <Route path="/quotes/new" element={<Layout><QuoteForm /></Layout>} />
          <Route path="/quotes/edit/:id" element={<Layout><QuoteForm /></Layout>} />
          <Route path="/services" element={<Layout><Services /></Layout>} />
          <Route path="/services/new" element={<Layout><ServiceForm /></Layout>} />
          <Route path="/services/edit/:id" element={<Layout><ServiceForm /></Layout>} />
          <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
          <Route path="/billing" element={<Layout><Billing /></Layout>} />
          <Route path="/alerts" element={<Layout><Alerts /></Layout>} />
          <Route path="/team" element={<Layout><Team /></Layout>} />
          <Route path="/chat" element={<Layout><Chat /></Layout>} />
          <Route path="/invoices" element={<Layout><Invoices /></Layout>} />
          <Route path="/invoices/new" element={<Layout><InvoiceForm /></Layout>} />
          <Route path="/invoices/:id" element={<Layout><InvoiceDetail /></Layout>} />
          <Route path="/financial/reports" element={<Layout><FinancialReports /></Layout>} />
          <Route path="/agenda" element={<Layout><Agenda /></Layout>} />
          <Route path="/catalog" element={<Layout><ServiceCatalog /></Layout>} />
          <Route path="/stock" element={<Layout><Stock /></Layout>} />
          <Route path="/inspections" element={<Layout><Inspections /></Layout>} />
          <Route path="/loyalty" element={<Layout><PlanGate feature="loyalty" requiredPlan="garage"><Loyalty /></PlanGate></Layout>} />
          <Route path="/marketing" element={<Layout><PlanGate feature="marketing" requiredPlan="garage"><Marketing /></PlanGate></Layout>} />
          <Route path="/workshop" element={<Layout><Workshop /></Layout>} />
          <Route path="/book/:slug" element={<PublicBooking />} />
          <Route path="/" element={<Navigate to="/admin" replace />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </Suspense>
    );
  }

  if (needsOnboarding) {
    return (
      <Suspense fallback={<PageLoader />}>
        <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
        <Route path="/auth" element={<Navigate to="/dashboard" replace />} />
        <Route path="/quote/:token" element={<QuoteApproval />} />
        <Route path="/portal/:token" element={<ClientPortal />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
        <Route path="/clients" element={<Layout><Clients /></Layout>} />
        <Route path="/vehicles" element={<Layout><Vehicles /></Layout>} />
        <Route path="/quotes" element={<Layout><Quotes /></Layout>} />
        <Route path="/quotes/new" element={<Layout><QuoteForm /></Layout>} />
        <Route path="/quotes/edit/:id" element={<Layout><QuoteForm /></Layout>} />
        <Route path="/services" element={<Layout><Services /></Layout>} />
        <Route path="/services/new" element={<Layout><ServiceForm /></Layout>} />
        <Route path="/services/edit/:id" element={<Layout><ServiceForm /></Layout>} />
        <Route path="/settings" element={<Layout><SettingsPage /></Layout>} />
        <Route path="/billing" element={<Layout><Billing /></Layout>} />
        <Route path="/alerts" element={<Layout><Alerts /></Layout>} />
        <Route path="/team" element={<Layout><Team /></Layout>} />
        <Route path="/chat" element={<Layout><Chat /></Layout>} />
        <Route path="/invoices" element={<Layout><Invoices /></Layout>} />
        <Route path="/invoices/new" element={<Layout><InvoiceForm /></Layout>} />
        <Route path="/invoices/:id" element={<Layout><InvoiceDetail /></Layout>} />
        <Route path="/financial/reports" element={<Layout><FinancialReports /></Layout>} />
        <Route path="/agenda" element={<Layout><Agenda /></Layout>} />
        <Route path="/catalog" element={<Layout><ServiceCatalog /></Layout>} />
        <Route path="/stock" element={<Layout><Stock /></Layout>} />
        <Route path="/inspections" element={<Layout><Inspections /></Layout>} />
        <Route path="/loyalty" element={<Layout><PlanGate feature="loyalty" requiredPlan="garage"><Loyalty /></PlanGate></Layout>} />
        <Route path="/marketing" element={<Layout><PlanGate feature="marketing" requiredPlan="garage"><Marketing /></PlanGate></Layout>} />
        <Route path="/workshop" element={<Layout><Workshop /></Layout>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/quote/:token" element={<QuoteApproval />} />
          <Route path="/portal/:token" element={<ClientPortal />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/book/:slug" element={<PublicBooking />} />
          <Route path="*" element={<LandingPage />} />
        </Routes>
      </Suspense>
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
          <AppRoutes />
        </BrowserRouter>
      </LanguageProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
