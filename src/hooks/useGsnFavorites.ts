/**
 * Favoritos de produtos no marketplace de peças.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { toast } from "sonner";

export function useGsnFavorites() {
  const { user } = useAuthReady();
  const [ids, setIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from("gsn_favorites_products" as any).select("product_id").eq("user_id", user.id);
    setIds(new Set(((data as any[]) ?? []).map((r) => r.product_id)));
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const toggle = useCallback(async (productId: string) => {
    if (!user) return;
    if (ids.has(productId)) {
      const { error } = await supabase.from("gsn_favorites_products" as any).delete().eq("user_id", user.id).eq("product_id", productId);
      if (error) return toast.error(error.message);
      setIds(prev => { const n = new Set(prev); n.delete(productId); return n; });
    } else {
      const { error } = await supabase.from("gsn_favorites_products" as any).insert({ user_id: user.id, product_id: productId });
      if (error) return toast.error(error.message);
      setIds(prev => new Set(prev).add(productId));
    }
  }, [ids, user]);

  return { ids, isFavorite: (id: string) => ids.has(id), toggle, reload: load };
}
