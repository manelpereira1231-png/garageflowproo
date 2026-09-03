import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Exceções por oficina (`shop_overrides`) — geridas no painel Admin.
 *
 * Permitem ligar/desligar funcionalidades ou alterar limites numéricos para
 * UMA oficina específica, por cima do que o plano define. Aplica-se em toda
 * a app (menu, gates, contadores) e em tempo real.
 */
export interface ShopOverrides {
  features: Record<string, boolean>;
  limits: Record<string, number>;
  notes: string | null;
  loaded: boolean;
}

const EMPTY: ShopOverrides = { features: {}, limits: {}, notes: null, loaded: false };

const cache = new Map<string, ShopOverrides>();
const inflight = new Map<string, Promise<ShopOverrides>>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((fn) => { try { fn(); } catch { /* noop */ } });
}

async function load(shopId: string, force = false): Promise<ShopOverrides> {
  if (!force && cache.has(shopId)) return cache.get(shopId)!;
  if (!force && inflight.has(shopId)) return inflight.get(shopId)!;

  const req = (async () => {
    const { data } = await supabase
      .from("shop_overrides" as any)
      .select("features,limits,notes")
      .eq("shop_id", shopId)
      .maybeSingle();
    const row: any = data ?? {};
    const value: ShopOverrides = {
      features: (row.features ?? {}) as Record<string, boolean>,
      limits: (row.limits ?? {}) as Record<string, number>,
      notes: row.notes ?? null,
      loaded: true,
    };
    cache.set(shopId, value);
    emit();
    return value;
  })();

  inflight.set(shopId, req);
  try {
    return await req;
  } finally {
    inflight.delete(shopId);
  }
}

export function invalidateShopOverrides(shopId?: string) {
  if (shopId) cache.delete(shopId);
  else cache.clear();
  if (shopId) void load(shopId, true);
  else emit();
}

export function useShopOverrides(shopId: string | null | undefined): ShopOverrides {
  const [, force] = useState(0);

  useEffect(() => {
    const tick = () => force((n) => n + 1);
    listeners.add(tick);
    return () => { listeners.delete(tick); };
  }, []);

  useEffect(() => {
    if (!shopId) return;
    void load(shopId);
    const ch = supabase
      .channel(`shop-overrides-${shopId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_overrides", filter: `shop_id=eq.${shopId}` },
        () => { void load(shopId, true); },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [shopId]);

  if (!shopId) return EMPTY;
  return cache.get(shopId) ?? EMPTY;
}
