import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Hardcoded super admin email — this is checked FIRST, before any DB query,
// so deleting shops/users can never lock out the super admin.
const SUPER_ADMIN_EMAIL = "manelpereira11@gmail.com";

export function useSuperAdmin() {
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // 1) Email-based check — instant, cannot be broken by DB changes
      if (user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
        setIsSuperAdmin(true);
        setLoading(false);
        return;
      }

      // 2) Fallback: DB role check for any other super_admins added later
      const { data } = await supabase
        .from("shop_users")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "super_admin")
        .maybeSingle();
      setIsSuperAdmin(!!data);
      setLoading(false);
    };
    check();
  }, []);

  return { isSuperAdmin, loading };
}
