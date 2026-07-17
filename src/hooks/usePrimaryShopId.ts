import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

/**
 * The "Oficina Mãe" (primary shop) of the group is the OLDEST shop in the
 * authenticated account's group (`group_owner_id = auth.uid()`). All other
 * shops of the same group are "Oficinas Filhas" and must NOT show group-level
 * admin surfaces (Billing, Plano, Stripe, Subscrição, Pagamentos, Licenciamento).
 *
 * Returns null while loading, or when the user does not own any shop (e.g. is
 * only a team member of another owner's shop — a strictly-child context).
 */
export function usePrimaryShopId(): { primaryShopId: string | null; loading: boolean } {
  const { isReady, user } = useAuthReady();
  const [primaryShopId, setPrimaryShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) { setLoading(true); return; }
    if (!user) { setPrimaryShopId(null); setLoading(false); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("shops")
          .select("id, name, created_at")
        .eq("group_owner_id", user.id)
        .order("created_at", { ascending: true })
          .limit(10);
      if (!alive) return;
      const primary = (data || []).find((s: any) => (s.name || "").trim().length > 0);
      setPrimaryShopId(primary?.id ?? null);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [isReady, user]);

  return { primaryShopId, loading };
}
