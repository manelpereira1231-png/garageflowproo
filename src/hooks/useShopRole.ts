import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "./useShopContext";
import { useAuthReady } from "@/hooks/useAuthReady";

export type ShopRole =
  | "owner"
  | "admin"
  | "manager"
  | "reception"
  | "technician"
  | "commercial"
  | "super_admin"
  | null;

export type Capability =
  | "dashboard.view"
  | "clients.view" | "clients.create" | "clients.edit" | "clients.delete"
  | "vehicles.view" | "vehicles.create" | "vehicles.edit" | "vehicles.delete"
  | "quotes.view" | "quotes.create" | "quotes.edit" | "quotes.approve"
  | "work_orders.view" | "work_orders.create" | "work_orders.edit" | "work_orders.complete"
  | "invoices.view" | "invoices.create" | "invoices.cancel"
  | "finance.view_costs" | "finance.view_profits" | "finance.view_salaries"
  | "stock.view" | "stock.manage"
  | "purchases.view" | "purchases.manage"
  | "agenda.view" | "agenda.manage"
  | "alerts.view"
  | "chat.view"
  | "automations.view"
  | "loyalty.view"
  | "referrals.view"
  | "api.view"
  | "marketplace.view" | "marketplace.manage"
  | "team.view" | "team.manage" | "team.remove_owner"
  | "settings.manage" | "settings.transfer_ownership"
  | "audit.view";

// Mirror da matriz server-side em public.has_capability — mantém em sync.
const MATRIX: Record<Exclude<ShopRole, null>, Set<string> | "*"> = {
  owner: "*",
  super_admin: "*",
  admin: "*", // exceto transfer_ownership / remove_owner (tratados abaixo)
  manager: new Set([
    "dashboard.view",
    "clients.view","clients.create","clients.edit","clients.delete",
    "vehicles.view","vehicles.create","vehicles.edit","vehicles.delete",
    "quotes.view","quotes.create","quotes.edit","quotes.approve",
    "work_orders.view","work_orders.create","work_orders.edit","work_orders.complete",
    "invoices.view","invoices.create","invoices.cancel",
    "finance.view_costs","finance.view_profits",
    "stock.view","stock.manage","purchases.view","purchases.manage",
    "agenda.view","agenda.manage","alerts.view","chat.view","automations.view","loyalty.view","marketplace.view",
    "team.view","audit.view",
  ]),
  reception: new Set([
    "clients.view","clients.create","clients.edit",
    "vehicles.view","vehicles.create","vehicles.edit",
    "quotes.view","quotes.create","quotes.edit",
    "work_orders.view","work_orders.create",
    "agenda.view","agenda.manage",
    "invoices.view","alerts.view","chat.view",
  ]),
  commercial: new Set([
    "clients.view","clients.create","clients.edit",
    "vehicles.view","vehicles.create",
    "quotes.view","quotes.create","quotes.edit",
    "agenda.view","chat.view","loyalty.view",
  ]),
  technician: new Set([
    "work_orders.view","work_orders.edit","work_orders.complete",
    "agenda.view",
  ]),
};

export function can(role: ShopRole, cap: Capability): boolean {
  if (!role) return false;
  const entry = MATRIX[role];
  if (entry === "*") {
    if (role === "admin" && (cap === "settings.transfer_ownership" || cap === "team.remove_owner")) return false;
    return true;
  }
  return entry.has(cap);
}

const cache = new Map<string, ShopRole>();

export function useShopRole() {
  const { activeShopId: shopId } = useShopContext();
  const { isReady, user } = useAuthReady();
  const userId = user?.id ?? null;
  const cacheKey = userId && shopId ? `${userId}:${shopId}` : null;
  const [role, setRole] = useState<ShopRole>(cacheKey ? cache.get(cacheKey) ?? null : null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isReady) { setLoading(true); return; }
    if (!userId || !shopId || !cacheKey) { setRole(null); setLoading(false); return; }
    const cached = cache.get(cacheKey);
    if (cached) { setRole(cached); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("current_shop_role", { _shop_id: shopId });
      if (!alive) return;
      const r = error ? null : (data as ShopRole) ?? null;
      cache.set(cacheKey, r);
      setRole(r);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [cacheKey, isReady, shopId, userId]);

  return {
    role,
    loading,
    shopId,
    can: (cap: Capability) => can(role, cap),
    isOwner: role === "owner" || role === "super_admin",
    isAdmin: role === "admin" || role === "owner" || role === "super_admin",
  };
}
