import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { loadCountriesFromDB } from "@/lib/regionConfig";

// Boot: load country configs from DB (async, non-blocking)
loadCountriesFromDB();

createRoot(document.getElementById("root")!).render(<App />);