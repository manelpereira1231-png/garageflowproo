import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface OwnedShop {
  id: string;
  name: string | null;
  address: string | null;
  currency: string | null;
  logo_url: string | null;
  created_at: string;
}

/**
 * Returns every shop in the authenticated account's group
 * (`shops.group_owner_id = auth.uid()`), ordered by creation (oldest first).
 * The oldest is the "Oficina Mãe"; the rest are "Oficinas Filhas".
 *
 * Used exclusively by the Dashboard Group Mode to aggregate KPIs across
 * the whole group without touching RLS, RBAC, or the ShopSwitcher. Child
 * accounts have a different auth id from `group_owner_id`, so they never see
 * siblings through this hook.
 */
/**
 * Module-level cache (TTL 60s) keyed by user id. The same list was being
 * re-fetched by every mount of Dashboard/Layout (~15k identical queries
 * measured in pg_stat_statements). Cache kills the redundant round-trips
 * without changing behaviour.
 */
const CACHE_TTL_MS = 60_000;
let cache: { userId: string; at: number; shops: OwnedShop[] } | null = null;
let inflight: { userId: string; p: Promise<OwnedShop[]> } | null = null;

async function fetchOwnedShops(userId: string): Promise<OwnedShop[]> {
  if (cache && cache.userId === userId && Date.now() - cache.at < CACHE_TTL_MS) return cache.shops;
  if (inflight && inflight.userId === userId) return inflight.p;
  const p = (async () => {
    const { data } = await supabase
      .from("shops")
      .select("id, name, address, currency, logo_url, created_at")
      .eq("group_owner_id", userId)
      .order("created_at", { ascending: true });
    const list = ((data as OwnedShop[]) ?? []).filter((s) => (s.name || "").trim().length > 0);
    cache = { userId, at: Date.now(), shops: list };
    inflight = null;
    return list;
  })();
  inflight = { userId, p };
  return p;
}

/** Invalidate after creating/deleting a shop. */
export function invalidateOwnedShops() {
  cache = null;
  inflight = null;
}

export function useOwnedShops() {
  const { isReady, user } = useAuthReady();
  const [shops, setShops] = useState<OwnedShop[]>(() =>
    user && cache?.userId === user.id ? cache.shops : [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) { setLoading(true); return; }
    if (!user) { setShops([]); setLoading(false); return; }
    let alive = true;
    (async () => {
      const list = await fetchOwnedShops(user.id);
      if (!alive) return;
      setShops(list);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isReady, user]);

  const primaryShopId = shops[0]?.id ?? null;
  return { shops, primaryShopId, loading };
}
