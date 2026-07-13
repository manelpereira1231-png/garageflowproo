import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "./useShopContext";

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
  | "clients.view" | "clients.create" | "clients.edit" | "clients.delete"
  | "vehicles.view" | "vehicles.create" | "vehicles.edit" | "vehicles.delete"
  | "quotes.view" | "quotes.create" | "quotes.edit" | "quotes.approve"
  | "work_orders.view" | "work_orders.create" | "work_orders.edit" | "work_orders.complete"
  | "invoices.view" | "invoices.create" | "invoices.cancel"
  | "finance.view_costs" | "finance.view_profits" | "finance.view_salaries"
  | "stock.view" | "stock.manage"
  | "purchases.view" | "purchases.manage"
  | "agenda.view" | "agenda.manage"
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
    "clients.view","clients.create","clients.edit","clients.delete",
    "vehicles.view","vehicles.create","vehicles.edit","vehicles.delete",
    "quotes.view","quotes.create","quotes.edit","quotes.approve",
    "work_orders.view","work_orders.create","work_orders.edit","work_orders.complete",
    "invoices.view","invoices.create","invoices.cancel",
    "finance.view_costs","finance.view_profits",
    "stock.view","stock.manage","purchases.view","purchases.manage",
    "agenda.view","agenda.manage","marketplace.view",
    "team.view","audit.view",
  ]),
  reception: new Set([
    "clients.view","clients.create","clients.edit",
    "vehicles.view","vehicles.create","vehicles.edit",
    "quotes.view","quotes.create","quotes.edit",
    "work_orders.view","work_orders.create",
    "agenda.view","agenda.manage",
    "invoices.view",
  ]),
  commercial: new Set([
    "clients.view","clients.create","clients.edit",
    "vehicles.view","vehicles.create",
    "quotes.view","quotes.create","quotes.edit",
    "agenda.view",
  ]),
  technician: new Set([
    "work_orders.view","work_orders.edit","work_orders.complete",
    "clients.view","vehicles.view","agenda.view",
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
  const shopId = useActiveShopId();
  const [role, setRole] = useState<ShopRole>(shopId ? cache.get(shopId) ?? null : null);
  const [loading, setLoading] = useState(!role);

  useEffect(() => {
    if (!shopId) { setRole(null); setLoading(false); return; }
    const cached = cache.get(shopId);
    if (cached) { setRole(cached); setLoading(false); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase.rpc("current_shop_role", { _shop_id: shopId });
      if (!alive) return;
      const r = (data as ShopRole) ?? null;
      cache.set(shopId, r);
      setRole(r);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [shopId]);

  return {
    role,
    loading,
    can: (cap: Capability) => can(role, cap),
    isOwner: role === "owner" || role === "super_admin",
    isAdmin: role === "admin" || role === "owner" || role === "super_admin",
  };
}
