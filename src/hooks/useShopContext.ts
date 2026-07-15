import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

interface Shop {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
  language: string;
}

const STORAGE_KEY = "garageflow_active_shop";
const SHOP_CONTEXT_TIMEOUT_MS = 3000;

function timeoutResult<T>(value: T, ms = SHOP_CONTEXT_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

export function useShopContext() {
  const { isReady, user } = useAuthReady();
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadShops = useCallback(async () => {
    if (!isReady) {
      setLoading(true);
      return;
    }

    if (!user) {
      setShops([]);
      setActiveShopId(null);
      setLoading(false);
      return;
    }

    try {
      // Get shops where user is owner (select `name` so we can detect empty
      // ghost shops auto-created by the handle_new_user trigger for invited
      // team members — those must NOT become the active shop, otherwise
      // the invited user becomes "owner" of an empty phantom and the RBAC
      // grants them full access.)
      const { data: ownedShops } = await Promise.race([
        supabase
          .from("shops")
          .select("id, name, logo_url, currency, language")
          .eq("user_id", user.id),
        timeoutResult({ data: [] }),
      ]);

      // Get shops where user is a team member
      const { data: memberEntries } = await Promise.race([
        supabase
          .from("shop_users")
          .select("shop_id")
          .eq("user_id", user.id),
        timeoutResult({ data: [] }),
      ]);

      const memberShopIds = (memberEntries || [])
        .map(e => e.shop_id)
        .filter(id => !(ownedShops || []).some(s => s.id === id));

      let memberShops: Shop[] = [];
      if (memberShopIds.length > 0) {
        const { data } = await Promise.race([
          supabase
            .from("shops")
            .select("id, name, logo_url, currency, language")
            .in("id", memberShopIds),
          timeoutResult({ data: [] }),
        ]);
        memberShops = data || [];
      }

      // Filter out ghost owned shops (empty name) when the user already
      // belongs to at least one real member shop. This preserves the
      // classic "one-owner, one-shop" flow while blocking privilege escalation
      // for invited members whose signup trigger created an empty shop.
      const realOwnedShops = memberShops.length > 0
        ? (ownedShops || []).filter((s) => (s.name || "").trim().length > 0)
        : (ownedShops || []);

      // Prefer member shops first: for an invited technician/reception, their
      // "real" workplace should be the default active shop.
      const allShops = memberShops.length > 0
        ? [...memberShops, ...realOwnedShops]
        : [...realOwnedShops, ...memberShops];
      setShops(allShops);

      // Restore or pick default
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && allShops.some(s => s.id === stored)) {
        setActiveShopId(stored);
      } else if (allShops.length > 0) {
        setActiveShopId(allShops[0].id);
        localStorage.setItem(STORAGE_KEY, allShops[0].id);
      }
    } finally {
      setLoading(false);
    }
  }, [isReady, user]);

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
