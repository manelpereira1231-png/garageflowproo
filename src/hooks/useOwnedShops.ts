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
export function useOwnedShops() {
  const { isReady, user } = useAuthReady();
  const [shops, setShops] = useState<OwnedShop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) { setLoading(true); return; }
    if (!user) { setShops([]); setLoading(false); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("shops")
        .select("id, name, address, currency, logo_url, created_at")
        .eq("group_owner_id", user.id)
        .order("created_at", { ascending: true });
      if (!alive) return;
      setShops((data as OwnedShop[]) ?? []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isReady, user]);

  const primaryShopId = shops[0]?.id ?? null;
  return { shops, primaryShopId, loading };
}
