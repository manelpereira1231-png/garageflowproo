import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Shop {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
  language: string;
}

const STORAGE_KEY = "garageflow_active_shop";

export function useShopContext() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadShops = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Get shops where user is owner
    const { data: ownedShops } = await supabase
      .from("shops")
      .select("id, name, logo_url, currency, language")
      .eq("user_id", user.id);

    // Get shops where user is a team member
    const { data: memberEntries } = await supabase
      .from("shop_users")
      .select("shop_id")
      .eq("user_id", user.id);

    const memberShopIds = (memberEntries || [])
      .map(e => e.shop_id)
      .filter(id => !(ownedShops || []).some(s => s.id === id));

    let memberShops: Shop[] = [];
    if (memberShopIds.length > 0) {
      const { data } = await supabase
        .from("shops")
        .select("id, name, logo_url, currency, language")
        .in("id", memberShopIds);
      memberShops = data || [];
    }

    const allShops = [...(ownedShops || []), ...memberShops];
    setShops(allShops);

    // Restore or pick default
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && allShops.some(s => s.id === stored)) {
      setActiveShopId(stored);
    } else if (allShops.length > 0) {
      setActiveShopId(allShops[0].id);
      localStorage.setItem(STORAGE_KEY, allShops[0].id);
    }

    setLoading(false);
  }, []);

  useEffect(() => { loadShops(); }, [loadShops]);

  const switchShop = useCallback((shopId: string) => {
    setActiveShopId(shopId);
    localStorage.setItem(STORAGE_KEY, shopId);
  }, []);

  const activeShop = shops.find(s => s.id === activeShopId) || null;

  return {
    shops,
    activeShop,
    activeShopId,
    switchShop,
    loading,
    reload: loadShops,
    hasMultipleShops: shops.length > 1,
  };
}
