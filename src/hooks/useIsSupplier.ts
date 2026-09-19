/**
 * Verifica se o utilizador atual tem registo em gsn_suppliers e devolve id + estado.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

export type SupplierState =
  | "invited" | "pending" | "pending_approval" | "approved" | "rejected" | "suspended" | "blocked";

type SupplierRow = { id: string; state: SupplierState | null; rejection_reason: string | null } | null;

// Cache por utilizador: evita repetir a RPC em cada navegação (gates + páginas).
let cacheUserId: string | null = null;
let cacheRow: SupplierRow | undefined;
let inflight: Promise<SupplierRow> | null = null;

/**
 * Limpa a identidade de fornecedor em memória. Chamado no logout e sempre que
 * o utilizador autenticado muda — nunca pode sobrar identidade da conta anterior.
 */
export function clearSupplierCache() {
  cacheUserId = null;
  cacheRow = undefined;
  inflight = null;
}

async function resolveSupplier(userId: string): Promise<SupplierRow> {
  if (cacheUserId === userId && cacheRow !== undefined) return cacheRow;
  if (cacheUserId === userId && inflight) return inflight;
  cacheUserId = userId;
  cacheRow = undefined;
  inflight = (async () => {
    let row: any = null;
    // RPC robusta: tolera registos duplicados e liga automaticamente a conta
    // a um registo de fornecedor criado pelo Admin/convite que ainda não
    // tenha owner_user_id — evita que caia no ERP da oficina.
    const { data, error } = await supabase.rpc("gsn_resolve_my_supplier" as any);
    if (!error) {
      row = Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
    } else {
      const { data: fallback } = await supabase
        .from("gsn_suppliers" as any)
        .select("id,state,rejection_reason")
        .eq("owner_user_id", userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1);
      row = (fallback as any)?.[0] ?? null;
    }
    const normalized: SupplierRow = row?.id
      ? { id: row.id, state: (row.state as SupplierState) ?? null, rejection_reason: row.rejection_reason ?? null }
      : null;
    if (cacheUserId === userId) cacheRow = normalized;
    inflight = null;
    return normalized;
  })();
  return inflight;
}

export function useIsSupplier() {
  const { user, isReady } = useAuthReady();
  const cached = user && cacheUserId === user.id ? cacheRow : undefined;
  const [isSupplier, setIsSupplier] = useState(!!cached?.id);
  const [supplierId, setSupplierId] = useState<string | null>(cached?.id ?? null);
  const [state, setState] = useState<SupplierState | null>(cached?.state ?? null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(cached?.rejection_reason ?? null);
  const [loading, setLoading] = useState(cached === undefined);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      cacheUserId = null; cacheRow = undefined; inflight = null;
      setIsSupplier(false); setSupplierId(null); setState(null); setLoading(false); return;
    }
    let cancelled = false;
    void resolveSupplier(user.id).then((row) => {
      if (cancelled) return;
      setSupplierId(row?.id ?? null);
      setState(row?.state ?? null);
      setRejectionReason(row?.rejection_reason ?? null);
      setIsSupplier(!!row?.id);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isReady, user]);


  return { isSupplier, supplierId, state, rejectionReason, loading };
}
