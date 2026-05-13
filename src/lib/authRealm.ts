import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type UserAccessProfile = {
  isAffiliate: boolean;
  isGarageUser: boolean;
  isMarketUser: boolean;
  hasGarageRole: boolean;
  hasMarketRole: boolean;
  hasShopAccess: boolean;
};

export async function getUserAccessProfile(user: User): Promise<UserAccessProfile> {
  const [rolesRes, ownerShopRes, memberShopRes, partnerRes] = await Promise.all([
    supabase.from("user_roles" as any).select("role").eq("user_id", user.id),
    supabase.from("shops").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    supabase.from("shop_users").select("shop_id").eq("user_id", user.id).limit(1).maybeSingle(),
    supabase.from("partners").select("id").eq("auth_user_id", user.id).limit(1).maybeSingle(),
  ]);

  const roles = (rolesRes.data || []).map((role: any) => role.role);
  const hasGarageRole = roles.includes("garage_owner") || roles.includes("admin") || roles.includes("super_admin");
  const hasMarketRole = roles.includes("buyer") || roles.includes("seller");
  const hasShopAccess = Boolean(ownerShopRes.data || memberShopRes.data);
  const isAffiliate = Boolean(partnerRes.data);
  const marketMetadata =
    user.user_metadata?.carity_user === true ||
    user.user_metadata?.account_type === "particular";

  const isGarageUser = hasGarageRole || hasShopAccess || isAffiliate || (!hasMarketRole && !marketMetadata);
  const isMarketUser = !isGarageUser && (hasMarketRole || marketMetadata);

  return {
    isAffiliate,
    isGarageUser,
    isMarketUser,
    hasGarageRole,
    hasMarketRole,
    hasShopAccess,
  };
}