import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";

// Hardcoded super admin email — checked FIRST, before any DB query,
// so deleting shops/users can never lock out the super admin.
const SUPER_ADMIN_EMAIL = "manelpereira11@gmail.com";
const ADMIN_CHECK_TIMEOUT_MS = 3000;

function timeoutResult<T>(value: T, ms = ADMIN_CHECK_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

/**
 * Reads from useAuthReady (single shared subscription) instead of calling
 * supabase.auth.getUser() on every mount. This eliminates a redundant
 * /auth/user round-trip per page navigation that previously caused
 * perceived "flicker" and slow first paint.
 */
export function useSuperAdmin() {
  const { user, isReady } = useAuthReady();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const dbCheckedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      dbCheckedFor.current = null;
      return;
    }

    // Email-based check — instant, cannot be broken by DB changes
    if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      setIsSuperAdmin(true);
      setLoading(false);
      return;
    }

    // Avoid re-querying for the same user across re-mounts
    if (dbCheckedFor.current === user.id) return;
    dbCheckedFor.current = user.id;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await Promise.race([
          supabase
            .from("shop_users")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "super_admin")
            .maybeSingle(),
          timeoutResult({ data: null }),
        ]);
        if (!cancelled) {
          setIsSuperAdmin(!!data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isReady, user]);

  return { isSuperAdmin, loading };
}
