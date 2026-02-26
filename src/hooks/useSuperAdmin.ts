import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Hardcoded super admin email — checked FIRST, before any DB query,
// so deleting shops/users can never lock out the super admin.
const SUPER_ADMIN_EMAIL = "manelpereira11@gmail.com";

export function useSuperAdmin() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error || !user) {
          if (!cancelled) {
            setIsSuperAdmin(false);
            setLoading(false);
          }
          return;
        }

        // 1) Email-based check — instant, cannot be broken by DB changes
        if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
          if (!cancelled) {
            setIsSuperAdmin(true);
            setLoading(false);
          }
          return;
        }

        // 2) Fallback: DB role check for any other super_admins added later
        try {
          const { data } = await supabase
            .from("shop_users")
            .select("role")
            .eq("user_id", user.id)
            .eq("role", "super_admin")
            .maybeSingle();
          if (!cancelled) setIsSuperAdmin(!!data);
        } catch {
          // DB error — not super admin via DB, that's OK
          if (!cancelled) setIsSuperAdmin(false);
        }

        if (!cancelled) setLoading(false);
      } catch {
        // Total failure — still resolve loading to avoid infinite spinner
        if (!cancelled) {
          setIsSuperAdmin(false);
          setLoading(false);
        }
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

  return { isSuperAdmin, loading };
}
