import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { loadCountriesFromDB, detectCountryByIP, reloadCountriesFromDB } from "@/lib/regionConfig";
import { clearPricingCache } from "@/hooks/useCountryPricing";
import { supabase } from "@/integrations/supabase/client";
import RootErrorBoundary from "@/components/RootErrorBoundary";
import { initSentry } from "@/lib/sentry";

// Boot Sentry as early as possible (no-op if VITE_SENTRY_DSN unset).
initSentry();

const bootRegionalConfig = () => {
  void loadCountriesFromDB().then(() => detectCountryByIP());
  // Realtime: any admin change to country_settings propagates to every open
  // session within ~1s — landing, dashboard, billing, checkout all re-read.
  try {
    supabase
      .channel("country_settings_pricing")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "country_settings" },
        () => {
          clearPricingCache();
          void reloadCountriesFromDB();
        }
      )
      .subscribe();
  } catch {}
};


// Boot after first paint: static country/pricing fallbacks render instantly;
// DB/IP enrichment updates the UI later without blocking page opening.
if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(bootRegionalConfig, { timeout: 1500 });
} else {
  window.setTimeout(bootRegionalConfig, 600);
}

createRoot(document.getElementById("root")!).render(
  <RootErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </RootErrorBoundary>
);
