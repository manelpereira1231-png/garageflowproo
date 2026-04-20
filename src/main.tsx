import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { loadCountriesFromDB, detectCountryByIP } from "@/lib/regionConfig";

// Boot: load country configs from DB, then detect country by IP (non-blocking)
loadCountriesFromDB().then(() => detectCountryByIP());

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
