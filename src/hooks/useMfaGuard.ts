/**
 * useMfaGuard — determines whether the signed-in account is a group/billing
 * owner (owns at least one shop via `shops.group_owner_id = auth.uid()`), and
 * whether it already has a verified TOTP factor.
 *
 * It NEVER blocks access: it only tells the UI to show the guided enrollment
 * dialog. Business logic, RLS and permissions are untouched.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import { useIsDemoSession } from "@/hooks/useIsDemoSession";


export function useMfaGuard() {
  const { isReady, user } = useAuthReady();
  const isDemo = useIsDemoSession();
  const [isOwner, setIsOwner] = useState(false);
  const [hasTotp, setHasTotp] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const verified = (data?.totp ?? []).some((f: any) => f.status === "verified");
      setHasTotp(verified);
    } catch {
      setHasTotp(null);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !user) { setIsOwner(false); setHasTotp(null); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("shops")
        .select("id")
        .eq("group_owner_id", user.id)
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      setIsOwner(Boolean(data));
      if (data) await refresh();
    })();
    return () => { alive = false; };
  }, [isReady, user, refresh]);

  return {
    /** Owner of the group / billing account → MFA is required for them. */
    /**
     * Owner of the group / billing account → MFA is required for them.
     * Contas de demonstração são temporárias (TTL) e não têm dados reais: o
     * diálogo de MFA abria por cima do ecrã inicial da /demo e roubava o
     * primeiro clique. Fora da demo o comportamento é exatamente o mesmo.
     */
    mfaRequired: isOwner && !isDemo,

    /** null = unknown/not checked yet. */
    hasTotp,
    refresh,
  };
}
