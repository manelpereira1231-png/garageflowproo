/**
 * usePlatformStats — números reais e agregados da plataforma para a landing page.
 *
 * Lê a RPC pública `get_public_platform_stats` (SECURITY DEFINER), que devolve
 * apenas contagens agregadas — nunca dados de oficinas ou clientes.
 * Sem dados => o consumidor esconde a secção (política Zero Fake UX).
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PlatformStats = {
  shops: number;
  work_orders: number;
  vehicles: number;
  reviews: number;
  avg_rating: number | null;
};

export function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("get_public_platform_stats");
      if (cancelled) return;
      if (!error && data) {
        const d = data as Record<string, unknown>;
        setStats({
          shops: Number(d.shops ?? 0),
          work_orders: Number(d.work_orders ?? 0),
          vehicles: Number(d.vehicles ?? 0),
          reviews: Number(d.reviews ?? 0),
          avg_rating: d.avg_rating != null ? Number(d.avg_rating) : null,
        });
      }
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  return { stats, loaded };
}
