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
import Auth from "@/pages/Auth";
import OnboardingWizard from "@/pages/OnboardingWizard";
import Dashboard from "@/pages/Dashboard";
import Clients from "@/pages/Clients";
import Vehicles from "@/pages/Vehicles";
import Quotes from "@/pages/Quotes";
import QuoteForm from "@/pages/QuoteForm";
import Services from "@/pages/Services";
import ServiceForm from "@/pages/ServiceForm";
import SettingsPage from "@/pages/Settings";
import Billing from "@/pages/Billing";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

function AppRoutes() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

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

  // Check if shop is configured
  useEffect(() => {
    if (!session) return;
    const checkShop = async () => {
      const { data: shop } = await supabase
        .from("shops")
        .select("name")
        .eq("user_id", session.user.id)
        .single();
      // If shop name is empty, needs onboarding
      setNeedsOnboarding(!shop?.name || shop.name.trim() === '');
    };
    checkShop();
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) return <Auth />;

  if (needsOnboarding) {
    return <OnboardingWizard onComplete={() => setNeedsOnboarding(false)} />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/vehicles" element={<Vehicles />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/new" element={<QuoteForm />} />
        <Route path="/services" element={<Services />} />
        <Route path="/services/new" element={<ServiceForm />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
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
