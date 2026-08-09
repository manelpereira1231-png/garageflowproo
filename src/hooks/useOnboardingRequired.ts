import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

/**
 * FONTE DE VERDADE ÚNICA do estado de onboarding.
 *
 * Persistido no backend em `shops.onboarding_completed_at`:
 *   - NULL      → onboarding pendente (conta nova ou interrompida)
 *   - timestamp → onboarding concluído, /onboarding passa a redirecionar
 *
 * Regras:
 *   - Só o DONO de uma oficina (shops.user_id = auth.uid()) pode precisar de
 *     onboarding. Utilizadores convidados (membros via shop_users), admins e
 *     super admins NUNCA são enviados para o wizard.
 *   - Nada é decidido a partir de localStorage.
 *   - Enquanto a sessão/consulta estão a carregar, `loading = true` — os
 *     consumidores devem mostrar loader em vez de redirecionar.
 */
export function useOnboardingRequired() {
  const { isReady, user } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [required, setRequired] = useState(false);
  const [ownsShop, setOwnsShop] = useState(false);

  const check = useCallback(async () => {
    if (!isReady) return;
    if (!user) {
      setRequired(false);
      setOwnsShop(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("shops")
      .select("id, onboarding_completed_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) {
      // Falha de rede/RLS: nunca forçar o wizard por engano.
      setRequired(false);
      setOwnsShop(false);
      setLoading(false);
      return;
    }

    const shop = (data || [])[0] as any;
    setOwnsShop(Boolean(shop));
    setRequired(Boolean(shop) && !shop.onboarding_completed_at);
    setLoading(false);
  }, [isReady, user]);

  useEffect(() => { void check(); }, [check]);

  return { loading, required, ownsShop, refresh: check };
}
