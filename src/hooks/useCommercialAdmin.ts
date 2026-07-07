import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

const COMMERCIAL_ADMIN_TIMEOUT_MS = 3000;

function timeoutResult<T>(value: T, ms = COMMERCIAL_ADMIN_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

/**
 * Resolves whether the current user has the "commercial_admin" role
 * (Administrador Comercial). Super admins also implicitly count.
 */
export function useCommercialAdmin() {
  const { user, isReady } = useAuthReady();
  const [isCommercialAdmin, setIsCommercialAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      setIsCommercialAdmin(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data } = await Promise.race([
          supabase
            .from("user_roles" as any)
            .select("role")
            .eq("user_id", user.id)
            .in("role", ["commercial_admin", "super_admin", "admin"]),
          timeoutResult({ data: [] }),
        ]);
        if (!cancelled) {
          setIsCommercialAdmin(Array.isArray(data) && data.length > 0);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsCommercialAdmin(false);
          setLoading(false);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isReady, user]);

  return { isCommercialAdmin, loading };
}
