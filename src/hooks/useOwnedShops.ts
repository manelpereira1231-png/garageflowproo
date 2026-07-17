import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export interface OwnedShop {
  id: string;
  name: string | null;
  city: string | null;
  currency: string | null;
  logo_url: string | null;
  created_at: string;
}

/**
 * Returns every shop owned by the authenticated account (shops.user_id =
 * auth.uid()), ordered by creation (oldest first). The oldest is the
 * "Oficina Mãe"; the rest are "Oficinas Filhas".
 *
 * Used exclusively by the Dashboard Group Mode to aggregate KPIs across
 * the whole group without touching RLS, RBAC, or the ShopSwitcher. Because
 * every row is scoped by `user_id = auth.uid()`, this can NEVER return
 * shops from another account — enforced both by RLS on `shops` and by the
 * explicit `.eq("user_id", user.id)` filter here.
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
        .select("id, name, city, currency, logo_url, created_at")
        .eq("user_id", user.id)
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
