import { useEffect, useState } from "react";
import { getBackendHealth, type BackendHealth } from "@/lib/resilientFetch";

/**
 * Global connectivity banner.
 *
 * Purely presentational: listens to the health signal emitted by
 * `resilientFetch` and to browser online/offline events. It never blocks the
 * UI — the rest of the app keeps working with whatever data is already loaded.
 */
const COPY = {
  pt: {
    offline: "Estás sem ligação à internet. Os teus dados não foram perdidos.",
    degraded: "Estamos com dificuldades temporárias em contactar o servidor. Os teus dados não foram perdidos.",
    retry: "Tentar novamente",
  },
  en: {
    offline: "You are offline. Your data has not been lost.",
    degraded: "We are having temporary trouble reaching the server. Your data has not been lost.",
    retry: "Try again",
  },
  es: {
    offline: "Estás sin conexión a internet. Tus datos no se han perdido.",
    degraded: "Tenemos dificultades temporales para contactar el servidor. Tus datos no se han perdido.",
    retry: "Reintentar",
  },
} as const;

function lang(): keyof typeof COPY {
  try {
    const v = localStorage.getItem("garageflow_language");
    if (v === "en" || v === "es") return v;
  } catch {
    /* noop */
  }
  return "pt";
}

export function ConnectivityBanner() {
  const [health, setHealth] = useState<BackendHealth>(getBackendHealth());
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && navigator.onLine === false);

  useEffect(() => {
    const onHealth = (e: Event) => setHealth((e as CustomEvent<BackendHealth>).detail);
    const onOffline = () => setOffline(true);
    const onOnline = () => setOffline(false);
    window.addEventListener("garageflow:backend-health", onHealth);
    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);
    return () => {
      window.removeEventListener("garageflow:backend-health", onHealth);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  const visible = offline || health === "degraded";
  if (!visible) return null;

  const t = COPY[lang()];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-3 left-1/2 z-[100] w-[min(94vw,520px)] -translate-x-1/2 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" />
        <p className="flex-1 text-xs leading-snug text-foreground">{offline ? t.offline : t.degraded}</p>
        <button
          onClick={() => window.location.reload()}
          className="min-h-[36px] shrink-0 rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground"
        >
          {t.retry}
        </button>
      </div>
    </div>
  );
}

export default ConnectivityBanner;
