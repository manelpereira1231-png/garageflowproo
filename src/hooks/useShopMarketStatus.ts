import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShopMarketStatus = {
  ready: boolean;
  isPartner: boolean;
  isActive: boolean;
  isMarketEnabled: boolean;
  shop: {
    id: string;
    name: string | null;
    phone: string | null;
    address: string | null;
    email: string | null;
    nif: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  refresh: () => Promise<void>;
};

type CachedMarketStatus = Omit<ShopMarketStatus, "refresh">;

const marketStatusCache = new Map<string, CachedMarketStatus>();
const inFlightLoads = new Map<string, Promise<CachedMarketStatus>>();

const defaultStatus: CachedMarketStatus = {
  ready: false,
  isPartner: false,
  isActive: false,
  isMarketEnabled: false,
  shop: null,
};

const storageKey = (shopId: string) => `garageflow_market_status_${shopId}`;

function readCachedStatus(shopId: string | null | undefined): CachedMarketStatus | null {
  if (!shopId) return null;
  const inMemory = marketStatusCache.get(shopId);
  if (inMemory) return inMemory;
  try {
    const raw = sessionStorage.getItem(storageKey(shopId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedMarketStatus;
    if (parsed?.ready) {
      marketStatusCache.set(shopId, parsed);
      return parsed;
    }
  } catch {
    // Ignore corrupted/unavailable session storage.
  }
  return null;
}

function writeCachedStatus(shopId: string, status: CachedMarketStatus) {
  marketStatusCache.set(shopId, status);
  try {
    sessionStorage.setItem(storageKey(shopId), JSON.stringify(status));
  } catch {
    // Memory cache still protects route-to-route navigation.
  }
}

async function fetchMarketStatus(shopId: string): Promise<CachedMarketStatus> {
  const existing = inFlightLoads.get(shopId);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase
      .from("shops")
      .select("id, name, phone, address, email, nif, latitude, longitude, is_carity_partner, carity_active")
      .eq("id", shopId)
      .maybeSingle();

    const previous = readCachedStatus(shopId);

    if (error) {
      // Critical: never collapse an already-enabled Market menu to false because
      // a route change caused a transient query/RLS/network failure.
      return previous ? { ...previous, ready: true } : { ...defaultStatus, ready: true };
    }

    if (!data) {
      const status = previous?.isMarketEnabled ? { ...previous, ready: true } : { ...defaultStatus, ready: true };
      writeCachedStatus(shopId, status);
      return status;
    }

    const isPartner = (data as any).is_carity_partner === true;
    const isActive = (data as any).carity_active !== false;
    const status: CachedMarketStatus = {
      ready: true,
      isPartner,
      isActive,
      isMarketEnabled: isPartner && isActive,
      shop: {
        id: data.id,
        name: data.name ?? null,
        phone: (data as any).phone ?? null,
        address: (data as any).address ?? null,
        email: (data as any).email ?? null,
        nif: (data as any).nif ?? null,
        latitude: (data as any).latitude ?? null,
        longitude: (data as any).longitude ?? null,
      },
    };
    writeCachedStatus(shopId, status);
    return status;
  })().finally(() => {
    inFlightLoads.delete(shopId);
  });

  inFlightLoads.set(shopId, promise);
  return promise;
}

/**
 * Global, session-persistent source of truth for a shop's Market activation.
 * It loads once per shop/session, keeps a memory + sessionStorage cache, and
 * only changes to false when the backend explicitly returns false for that shop.
 */
export function useShopMarketStatus(shopId: string | null | undefined): ShopMarketStatus {
  const [status, setStatus] = useState<CachedMarketStatus>(() => readCachedStatus(shopId) || defaultStatus);

  const load = useCallback(async (force = false) => {
    if (!shopId) {
      setStatus({ ...defaultStatus, ready: true });
      return;
    }

    const cached = readCachedStatus(shopId);
    if (cached) setStatus(cached);
    if (cached && !force) return;

    const next = await fetchMarketStatus(shopId);
    setStatus(next);
  }, [shopId]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  useEffect(() => {
    if (!shopId) {
      setStatus({ ...defaultStatus, ready: true });
      return;
    }
    const cached = readCachedStatus(shopId);
    setStatus(cached || defaultStatus);
    void load(false);
  }, [shopId, load]);

  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel(`shop-market-status-${shopId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shops", filter: `id=eq.${shopId}` },
        () => { void refresh(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId, refresh]);

  useEffect(() => {
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  return {
    ...status,
    refresh,
  };
}