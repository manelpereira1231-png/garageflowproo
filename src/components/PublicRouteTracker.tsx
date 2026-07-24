import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackLandingVisit } from "@/lib/landingTracker";

/**
 * Regista automaticamente uma visita no sistema SEO/landing sempre que o
 * pathname muda para uma rota pública.
 *
 * Reutiliza integralmente `trackLandingVisit` (dedup por path na sessão,
 * classificação de tráfego interno, retries, engagement) — apenas garante que
 * é invocado para TODAS as páginas públicas, não só `/` e `/erp`.
 *
 * Rotas privadas/autenticadas são explicitamente ignoradas.
 */
const PRIVATE_PREFIXES = [
  "/dashboard",
  "/admin",
  "/super-admin",
  "/login",
  "/signup",
  "/register",
  "/reset-password",
  "/forgot-password",
  "/auth",
  "/settings",
  "/billing",
  "/portal",
  "/quote",
  "/book",
  "/onboarding",
  "/checkout",
  "/clients",
  "/vehicles",
  "/work-orders",
  "/workorders",
  "/services",
  "/agenda",
  "/calendar",
  "/inventory",
  "/stock",
  "/financial",
  "/financials",
  "/invoices",
  "/invoice",
  "/reports",
  "/team",
  "/notifications",
  "/chat",
  "/workshop",
  "/profile",
  "/support",
  "/ai-",
  "/market/admin",
  "/market/dashboard",
  "/market/portal",
  "/market/settings",
  "/market/checkout",
  "/market/sell",
  "/market/inbox",
  "/market/my-",
];

function isPublicPath(pathname: string): boolean {
  const p = (pathname || "/").toLowerCase();
  for (const prefix of PRIVATE_PREFIXES) {
    if (p === prefix || p.startsWith(prefix + "/") || p.startsWith(prefix)) {
      return false;
    }
  }
  return true;
}

export default function PublicRouteTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isPublicPath(pathname)) return;
    // Defer to next tick so o React acabe de montar a rota antes de registar.
    const id = window.setTimeout(() => {
      try {
        trackLandingVisit(pathname);
      } catch {
        /* nunca bloquear a UX */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [pathname]);

  return null;
}
