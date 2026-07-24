/**
 * Feature flag global (tabela public.system_features).
 * Utilizado para ligar/desligar módulos inteiros sem deploy.
 * Realtime opcional — nesta fase revalida a cada 60s.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { enabled: boolean; at: number }>();
const listeners = new Map<string, Set<() => void>>();

async function fetchFlag(key: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("system_features" as any)
      .select("enabled")
      .eq("key", key)
      .maybeSingle();
    return !!(data as any)?.enabled;
  } catch {
    return false;
  }
}

export function useSystemFeature(key: string): { enabled: boolean; loaded: boolean; refresh: () => void } {
  const cached = cache.get(key);
  const [enabled, setEnabled] = useState<boolean>(cached?.enabled ?? false);
  const [loaded, setLoaded] = useState<boolean>(!!cached);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const v = await fetchFlag(key);
      if (cancelled) return;
      cache.set(key, { enabled: v, at: Date.now() });
      setEnabled(v);
      setLoaded(true);
      listeners.get(key)?.forEach((fn) => { try { fn(); } catch {} });
    };
    void load();
    const tick = () => setEnabled(cache.get(key)?.enabled ?? false);
    if (!listeners.has(key)) listeners.set(key, new Set());
    listeners.get(key)!.add(tick);
    // Realtime
    const ch = supabase
      .channel(`sys-feat-${key}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "system_features", filter: `key=eq.${key}` }, () => { void load(); })
      .subscribe();
    return () => {
      cancelled = true;
      listeners.get(key)?.delete(tick);
      supabase.removeChannel(ch);
    };
  }, [key]);

  return {
    enabled,
    loaded,
    refresh: () => { cache.delete(key); void fetchFlag(key).then((v) => { cache.set(key, { enabled: v, at: Date.now() }); setEnabled(v); }); },
  };
}

export async function setSystemFeature(key: string, enabled: boolean): Promise<void> {
  const { error } = await supabase
    .from("system_features" as any)
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) throw error;
  cache.set(key, { enabled, at: Date.now() });
}
