import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AiQuota {
  plan: string;
  used: number;
  limit: number;      // -1 = unlimited, 0 = plan has no AI
  remaining: number;  // -1 = unlimited
  unlimited: boolean;
  loading: boolean;
  error: string | null;
}

const empty: AiQuota = {
  plan: "",
  used: 0,
  limit: 0,
  remaining: 0,
  unlimited: false,
  loading: true,
  error: null,
};

/**
 * Lê o consumo mensal de créditos IA da oficina e o limite do seu plano.
 * Fonte única de verdade: RPC `get_ai_usage` no backend.
 * Atualiza em tempo real quando qualquer chamada IA é registada.
 */
export function useAiQuota(shopId: string | null | undefined) {
  const [quota, setQuota] = useState<AiQuota>(empty);

  const refresh = useCallback(async () => {
    if (!shopId) {
      setQuota({ ...empty, loading: false });
      return;
    }
    const { data, error } = await supabase.rpc("get_ai_usage", { _shop_id: shopId });
    if (error) {
      setQuota({ ...empty, loading: false, error: error.message });
      return;
    }
    const d = (data as any) || {};
    setQuota({
      plan: d.plan ?? "",
      used: Number(d.used ?? 0),
      limit: Number(d.limit ?? 0),
      remaining: Number(d.remaining ?? 0),
      unlimited: Boolean(d.unlimited),
      loading: false,
      error: d.error ?? null,
    });
  }, [shopId]);

  useEffect(() => {
    refresh();
    if (!shopId) return;
    // Realtime: recount when ledger changes for this shop
    const channel = supabase
      .channel(`ai-usage-${shopId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ai_usage_ledger", filter: `shop_id=eq.${shopId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId, refresh]);

  return { ...quota, refresh };
}
