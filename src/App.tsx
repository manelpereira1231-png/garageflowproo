import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { LanguageProvider } from "@/i18n/LanguageContext";
import Layout from "@/components/Layout";
import AdminLayout from "@/components/AdminLayout";
import Auth from "@/pages/Auth";
import OnboardingWizard from "@/pages/OnboardingWizard";
import ResetPassword from "@/pages/ResetPassword";
import QuoteApproval from "@/pages/QuoteApproval";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Vehicles from "@/pages/Vehicles";
import Quotes from "@/pages/Quotes";
import QuoteForm from "@/pages/QuoteForm";
import Services from "@/pages/Services";
import ServiceForm from "@/pages/ServiceForm";
import SettingsPage from "@/pages/Settings";
import Billing from "@/pages/Billing";
import Alerts from "@/pages/Alerts";
import Team from "@/pages/Team";
import Chat from "@/pages/Chat";
import NotFound from "@/pages/NotFound";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminShops from "@/pages/admin/AdminShops";
import AdminShopDetail from "@/pages/admin/AdminShopDetail";
import AdminLogs from "@/pages/admin/AdminLogs";
import AdminReports from "@/pages/admin/AdminReports";
import AdminBilling from "@/pages/admin/AdminBilling";
import AdminAlerts from "@/pages/admin/AdminAlerts";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminUsers from "@/pages/admin/AdminUsers";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

const queryClient = new QueryClient();

const adminRoutes = [
  { path: "/admin", element: <AdminDashboard /> },
  { path: "/admin/shops", element: <AdminShops /> },
  { path: "/admin/shops/:id", element: <AdminShopDetail /> },
  { path: "/admin/billing", element: <AdminBilling /> },
  { path: "/admin/alerts", element: <AdminAlerts /> },
  { path: "/admin/reports", element: <AdminReports /> },
  { path: "/admin/settings", element: <AdminSettings /> },
  { path: "/admin/logs", element: <AdminLogs /> },
  { path: "/admin/users", element: <AdminUsers /> },
];

function AuthenticatedRoutes() {
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const { isSuperAdmin, loading: adminLoading } = useSuperAdmin();

  useEffect(() => {
    const checkShop = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: shop } = await supabase
        .from("shops")
        .select("name")
        .eq("user_id", user.id)
        .maybeSingle();
      setNeedsOnboarding(!shop?.name || shop.name.trim() === '');
    };
    checkShop();
  }, []);

  // Super admin skips onboarding and goes straight to admin panel
  if (!adminLoading && isSuperAdmin && needsOnboarding) {
    return (
      <Routes>
        {adminRoutes.map(r => (
          <Route key={r.path} path={r.path} element={<AdminLayout>{r.element}</AdminLayout>} />
        ))}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />;
  }

  return (
    <Routes>
      {/* Admin routes - only for super_admin */}
      {isSuperAdmin && adminRoutes.map(r => (
        <Route key={r.path} path={r.path} element={<AdminLayout>{r.element}</AdminLayout>} />
      ))}

      {/* Redirect non-admin users away from /admin routes */}
      {!isSuperAdmin && (
        <Route path="/admin/*" element={<Navigate to="/dashboard" replace />} />
      )}

      {/* Shop routes */}
      <Route path="/quote/:token" element={<QuoteApproval />} />
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
      <Route path="*" element={<NotFound />} />
    </Routes>
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
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
      <Routes>
        <Route path="/quote/:token" element={<QuoteApproval />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="*" element={<Auth />} />
      </Routes>
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
