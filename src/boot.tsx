import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import { loadCountriesFromDB, detectCountryByIP, reloadCountriesFromDB } from "@/lib/regionConfig";
import { clearPricingCache } from "@/hooks/useCountryPricing";
import { loadPlatformSettings, notifyPlatformSettingsUpdated } from "@/lib/platformSettings";
import { ensurePromotionsLoaded, clearPromotionsCache } from "@/lib/planPromotions";
import { supabase } from "@/integrations/supabase/client";
import RootErrorBoundary from "@/components/RootErrorBoundary";
import { initSentry } from "@/lib/sentry";

// Boot Sentry as early as possible (no-op if VITE_SENTRY_DSN unset).
initSentry();

const bootRegionalConfig = () => {
  void loadCountriesFromDB().then(() => detectCountryByIP());
  // Preload admin-managed platform settings (plan limits + feature gates).
  void loadPlatformSettings();
  // Preload active plan promotions (single source of truth for landing/billing/checkout).
  void ensurePromotionsLoaded();
  // Realtime: any admin change to country_settings / platform_settings / plan_promotions
  // propagates to every open session within ~1s — landing, dashboard,
  // billing, checkout and every feature gate re-read instantly.
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "platform_settings" },
        () => { notifyPlatformSettingsUpdated(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "plan_promotions" },
        () => {
          clearPromotionsCache();
          void ensurePromotionsLoaded().then(() => {
            try { window.dispatchEvent(new CustomEvent("garageflow:pricing-updated")); } catch { /* ignore */ }
          });
        }
      )
      .subscribe();
  } catch {}

  // Country persistence: after login (or when the user switches shop), pull
  // the ACTIVE SHOP's country_code from the DB and sync it into
  // localStorage `garageflow_country`. Fixes the "chose Brasil, ERP still
  // behaves as Portugal after refresh/logout/other browser" bug — the shop
  // row is the single source of truth, and every legacy helper resolves
  // from it via `setCountryCode()` inside `getShopCountry()`.
  void import("@/hooks/useShopCountry").then((m) => {
    void m.getShopCountry();
    const onShopChange = () => { void m.getShopCountry(); };
    window.addEventListener("garageflow:shop-context-changed", onShopChange);
    window.addEventListener("garageflow:active-shop-changed", onShopChange);
    try {
      supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
          void m.getShopCountry();
        }
      });
    } catch {}
  });
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