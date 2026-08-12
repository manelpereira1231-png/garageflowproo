import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Técnicos registados da oficina (membros de equipa ativos).
 * Fonte única para todos os seletores de técnico do ERP — evita nomes
 * escritos manualmente à mão que não correspondem a ninguém registado.
 */
export function useShopTechnicians(shopId?: string | null) {
  const [technicians, setTechnicians] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!shopId) { setTechnicians([]); return; }
    setLoading(true);
    (async () => {
      try {
        const { data: members } = await supabase
          .from("shop_users")
          .select("id, user_id, role, shop_user_profiles(name, active)")
          .eq("shop_id", shopId);
        if (!members?.length) { if (!cancelled) setTechnicians([]); return; }
        const { data: emailData } = await supabase.rpc("get_shop_member_emails", { _shop_id: shopId });
        const emailMap = new Map((emailData || []).map((e: any) => [e.user_id, e.email]));
        const names = members
          .filter((m: any) => (m.shop_user_profiles?.active ?? true))
          .map((m: any) => (m.shop_user_profiles?.name || emailMap.get(m.user_id) || "").trim())
          .filter(Boolean);
        if (!cancelled) setTechnicians(Array.from(new Set(names)).sort((a, b) => a.localeCompare(b)));
      } catch {
        if (!cancelled) setTechnicians([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  return { technicians, loading };
}
