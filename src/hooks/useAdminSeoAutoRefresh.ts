import { useEffect, useState } from "react";

/**
 * Refresca periodicamente os dados de SEO no painel admin.
 * Padrão idêntico ao useAdminStripeAutoSync: silencioso, focus/online aware.
 */
export function useAdminSeoAutoRefresh(reload: () => void | Promise<void>, intervalMs = 45000) {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      if (document.hidden) return;
      try {
        setRefreshing(true);
        await reload();
        if (!cancelled) setLastRefresh(new Date());
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    };

    const start = () => {
      if (timer) window.clearInterval(timer);
      timer = window.setInterval(tick, intervalMs);
    };

    start();
    const onFocus = () => void tick();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [reload, intervalMs]);

  return { refreshing, lastRefresh };
}
