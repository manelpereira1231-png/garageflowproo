/**
 * Tracking automático da sessão Demo dentro da app real:
 * page views por rota, cliques em botões/links e ponto de saída.
 * Ativo apenas quando há uma sessão demo (gf_sales_demo=1).
 */
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { isDemoSession } from "@/lib/salesDemo";
import { trackDemoEvent } from "@/lib/demoTracker";

export function useDemoTracking() {
  const location = useLocation();
  const active = isDemoSession();

  // Page views
  useEffect(() => {
    if (!active) return;
    trackDemoEvent("page_view", { path: location.pathname });
  }, [active, location.pathname]);

  // Cliques + saída
  useEffect(() => {
    if (!active) return;

    const onClick = (e: MouseEvent) => {
      try {
        const el = (e.target as HTMLElement | null)?.closest?.("a,button,[role='button']");
        if (!el) return;
        const label = (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80);
        if (!label) return;
        trackDemoEvent("click", { path: window.location.pathname, label });
      } catch {
        /* noop */
      }
    };

    const onHide = () => {
      trackDemoEvent("exit", { path: window.location.pathname });
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("pagehide", onHide);
    };
  }, [active]);
}
