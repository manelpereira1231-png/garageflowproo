import { useEffect, useState } from "react";
import { useAuthReady } from "@/hooks/useAuthReady";

// Hardcoded super admin email — checked FIRST, before any DB query,
// so deleting shops/users can never lock out the super admin.
const SUPER_ADMIN_EMAIL = "manelpereira11@gmail.com";
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

  useEffect(() => {
    if (!isReady) return;

    if (!user) {
      setIsSuperAdmin(false);
      setLoading(false);
      return;
    }

    // Super admin global is NOT derived from shop_users; that table is shop-scoped.
    setIsSuperAdmin(user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
    setLoading(false);
  }, [isReady, user]);

  return { isSuperAdmin, loading };
}
