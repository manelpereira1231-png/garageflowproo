/**
 * Verifica se o utilizador atual tem papel `supplier` e devolve o supplier_id.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export function useIsSupplier() {
  const { user, isReady } = useAuthReady();
  const [isSupplier, setIsSupplier] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) { setIsSupplier(false); setSupplierId(null); setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("gsn_suppliers" as any)
        .select("id")
        .eq("owner_user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (cancelled) return;
      const sid = (data as any)?.id ?? null;
      setSupplierId(sid);
      setIsSupplier(!!sid);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isReady, user]);

  return { isSupplier, supplierId, loading };
}
