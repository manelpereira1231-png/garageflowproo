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
 *   - O dono da primeira oficina pode precisar de onboarding. Uma conta nova,
 *     ainda sem oficina ou convite, também precisa para poder criar a primeira.
 *   - Utilizadores convidados, admins de plataforma e fornecedores nunca são
 *     enviados para o wizard.
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
    if (shop) {
      setOwnsShop(true);
      setRequired(!shop.onboarding_completed_at);
      setLoading(false);
      return;
    }

    // No directly-owned shop: distinguish a genuinely new ERP account from
    // invited members/platform-only users. This prevents both redirect loops
    // and accidental workshop creation for invited users.
    const [membershipResult, rolesResult] = await Promise.all([
      supabase.from("shop_users").select("id").eq("user_id", user.id).limit(1),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    if (membershipResult.error || rolesResult.error) {
      // Failure to establish eligibility must never force workshop creation.
      setOwnsShop(false);
      setRequired(false);
      setLoading(false);
      return;
    }

    const excludedRoles = new Set([
      "admin", "regional_admin", "super_admin", "commercial_admin", "supplier",
    ]);
    const hasMembership = (membershipResult.data || []).length > 0;
    const hasExcludedRole = (rolesResult.data || []).some(({ role }) => excludedRoles.has(role));
    setOwnsShop(false);
    setRequired(!hasMembership && !hasExcludedRole);
    setLoading(false);
  }, [isReady, user]);

  useEffect(() => { void check(); }, [check]);

  return { loading, required, ownsShop, refresh: check };
}
