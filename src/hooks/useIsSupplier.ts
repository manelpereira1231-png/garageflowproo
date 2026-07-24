/**
 * Verifica se o utilizador atual tem registo em gsn_suppliers e devolve id + estado.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export type SupplierState =
  | "invited" | "pending" | "pending_approval" | "approved" | "rejected" | "suspended" | "blocked";

export function useIsSupplier() {
  const { user, isReady } = useAuthReady();
  const [isSupplier, setIsSupplier] = useState(false);
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [state, setState] = useState<SupplierState | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      setIsSupplier(false); setSupplierId(null); setState(null); setLoading(false); return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("gsn_suppliers" as any)
        .select("id,state,rejection_reason")
        .eq("owner_user_id", user.id)
        .is("deleted_at", null)
        .maybeSingle();
      if (cancelled) return;
      const row: any = data ?? null;
      setSupplierId(row?.id ?? null);
      setState((row?.state as SupplierState) ?? null);
      setRejectionReason(row?.rejection_reason ?? null);
      setIsSupplier(!!row?.id);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isReady, user]);

  return { isSupplier, supplierId, state, rejectionReason, loading };
}
