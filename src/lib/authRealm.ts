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

/**
 * Determines what a user is allowed to access across ERP and Marketplace.
 *
 * IMPORTANT (Lote A — 2026-07): the two flags are NO LONGER mutually exclusive.
 * A single workshop account can hold both ERP access (via `shops`/`shop_users`
 * or `garage_owner`/`admin`/`super_admin` roles) AND Marketplace access (via
 * `buyer`/`seller` roles or `carity_seller_profiles`). This is what makes the
 * "activate Marketplace with the same account" flow possible.
 *
 * Rules:
 *  - Particulares (signed up in /market/auth) have `carity_user` metadata or
 *    only `buyer`/`seller` roles → isMarketUser=true, isGarageUser=false.
 *  - Workshops (signed up in /auth) have a shop OR garage role → isGarageUser=true.
 *    They become isMarketUser=true ONLY after they explicitly activate the
 *    Marketplace (which grants `seller`/`buyer` roles + creates a seller profile).
 *  - Affiliates are treated as ERP users (partners dashboard lives in the ERP).
 */
export async function getUserAccessProfile(user: User): Promise<UserAccessProfile> {
  const [rolesRes, ownerShopRes, memberShopRes, partnerRes] = await Promise.all([
    supabase.from("user_roles" as any).select("role").eq("user_id", user.id),
    supabase.from("shops").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    supabase.from("shop_users").select("shop_id").eq("user_id", user.id).limit(1).maybeSingle(),
    supabase.from("partners").select("id").eq("auth_user_id", user.id).limit(1).maybeSingle(),
  ]);

  const roles = (rolesRes.data || []).map((r: any) => r.role);
  const hasGarageRole = roles.includes("garage_owner") || roles.includes("admin") || roles.includes("super_admin");
  const hasMarketRole = roles.includes("buyer") || roles.includes("seller");
  const hasShopAccess = Boolean(ownerShopRes.data || memberShopRes.data);
  const isAffiliate = Boolean(partnerRes.data);

  const marketMetadata =
    user.user_metadata?.carity_user === true ||
    user.user_metadata?.account_type === "particular";

  // ERP access: has a shop, has a garage/admin role, or is an affiliate partner.
  const isGarageUser = hasGarageRole || hasShopAccess || isAffiliate;

  // Market access: has explicit market role OR was created as a particular user.
  // Workshops that activate the Marketplace get the `seller`/`buyer` roles,
  // so this becomes true for them too — SAME account, both realms.
  const isMarketUser = hasMarketRole || marketMetadata;

  // Fallback: legacy accounts with no roles/shop still land in ERP by default.
  const fallbackToGarage = !isGarageUser && !isMarketUser;

  return {
    isAffiliate,
    isGarageUser: isGarageUser || fallbackToGarage,
    isMarketUser,
    hasGarageRole,
    hasMarketRole,
    hasShopAccess,
  };
}
