import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { loadCountriesFromDB } from "@/lib/regionConfig";

// Boot: load country configs from DB (async, non-blocking)
loadCountriesFromDB();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
