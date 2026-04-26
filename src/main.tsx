import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { loadCountriesFromDB, detectCountryByIP } from "@/lib/regionConfig";

const bootRegionalConfig = () => {
  void loadCountriesFromDB().then(() => detectCountryByIP());
};

// Boot after first paint: static country/pricing fallbacks render instantly;
// DB/IP enrichment updates the UI later without blocking page opening.
if (typeof window.requestIdleCallback === "function") {
  window.requestIdleCallback(bootRegionalConfig, { timeout: 1500 });
} else {
  window.setTimeout(bootRegionalConfig, 600);
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
