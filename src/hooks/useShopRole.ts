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
  | "clients.view" | "clients.create" | "clients.edit" | "clients.delete" | "clients.export"
  | "vehicles.view" | "vehicles.create" | "vehicles.edit" | "vehicles.delete" | "vehicles.export"
  | "quotes.view" | "quotes.create" | "quotes.edit" | "quotes.approve" | "quotes.delete"
  | "quotes.send_email" | "quotes.send_whatsapp" | "quotes.print" | "quotes.export"
  | "work_orders.view" | "work_orders.create" | "work_orders.edit" | "work_orders.complete"
  | "work_orders.delete" | "work_orders.export" | "work_orders.print"
  | "work_orders.send_email" | "work_orders.send_whatsapp"
  | "invoices.view" | "invoices.create" | "invoices.cancel"
  | "invoices.send_email" | "invoices.send_whatsapp" | "invoices.print" | "invoices.export"
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
    "clients.view","clients.create","clients.edit","clients.delete","clients.export",
    "vehicles.view","vehicles.create","vehicles.edit","vehicles.delete","vehicles.export",
    "quotes.view","quotes.create","quotes.edit","quotes.approve","quotes.delete",
    "quotes.send_email","quotes.send_whatsapp","quotes.print","quotes.export",
    "work_orders.view","work_orders.create","work_orders.edit","work_orders.complete",
    "work_orders.delete","work_orders.export","work_orders.print","work_orders.send_email","work_orders.send_whatsapp",
    "invoices.view","invoices.create","invoices.cancel",
    "invoices.send_email","invoices.send_whatsapp","invoices.print","invoices.export",
    "finance.view_costs","finance.view_profits",
    "stock.view","stock.manage","purchases.view","purchases.manage",
    "agenda.view","agenda.manage","alerts.view","chat.view","automations.view","loyalty.view","marketplace.view",
    "team.view","audit.view",
  ]),
  reception: new Set([
    "dashboard.view",
    "clients.view","clients.create","clients.edit",
    "vehicles.view","vehicles.create","vehicles.edit",
    "quotes.view","quotes.create","quotes.edit",
    "quotes.send_email","quotes.send_whatsapp","quotes.print",
    "work_orders.view","work_orders.create","work_orders.edit","work_orders.print","work_orders.send_email","work_orders.send_whatsapp",
    "agenda.view","agenda.manage",
    "invoices.view","invoices.print","invoices.send_email","invoices.send_whatsapp",
    "alerts.view","chat.view",
  ]),
  commercial: new Set([
    "dashboard.view",
    "clients.view","clients.create","clients.edit","clients.export",
    "vehicles.view","vehicles.create",
    "quotes.view","quotes.create","quotes.edit",
    "quotes.send_email","quotes.send_whatsapp","quotes.print",
    "agenda.view","chat.view","loyalty.view","marketplace.view",
  ]),
  technician: new Set([
    "dashboard.view",
    "work_orders.view","work_orders.edit","work_orders.complete","work_orders.print",
    "vehicles.view",
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
  const { activeShopId: shopId, loading: shopLoading } = useShopContext();
  const { isReady, user } = useAuthReady();
  const userId = user?.id ?? null;
  const cacheKey = userId && shopId ? `${userId}:${shopId}` : null;
  const [role, setRole] = useState<ShopRole>(cacheKey ? cache.get(cacheKey) ?? null : null);
  const [roleKey, setRoleKey] = useState<string | null>(cacheKey ?? null);
  const [loading, setLoading] = useState(true);
  const hasCachedRole = Boolean(cacheKey && cache.has(cacheKey));
  const resolvedRole = hasCachedRole ? cache.get(cacheKey!) ?? null : roleKey === cacheKey ? role : null;
  const isRoleLookupPending = Boolean(isReady && !shopLoading && userId && shopId && (!hasCachedRole && (loading || roleKey !== cacheKey)));
  const effectiveLoading = loading || isRoleLookupPending;

  useEffect(() => {
    if (!isReady || shopLoading) { setLoading(true); return; }
    if (!userId || !shopId || !cacheKey) { setRoleKey(null); setRole(null); setLoading(false); return; }
    const cached = cache.get(cacheKey);
    if (cached) { setRoleKey(cacheKey); setRole(cached); setLoading(false); return; }
    let alive = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("current_shop_role", { _shop_id: shopId });
      if (!alive) return;
      const r = error ? null : (data as ShopRole) ?? null;
      if (r) cache.set(cacheKey, r);
      setRoleKey(cacheKey);
      setRole(r);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [cacheKey, isReady, shopId, shopLoading, userId]);

  // Realtime: quando o owner/admin altera a nossa role em shop_users,
  // invalidamos o cache e refazemos fetch para aplicar imediatamente
  // sidebar/rotas/capabilities sem exigir novo login.
  useEffect(() => {
    if (!userId || !shopId || !cacheKey) return;
    const channel = supabase
      .channel(`shop-users:${userId}:${shopId}`)
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "shop_users", filter: `user_id=eq.${userId}` },
        async (payload: any) => {
          const row = payload?.new || payload?.old;
          if (!row || row.shop_id !== shopId) return;
          cache.delete(cacheKey);
          const { data, error } = await supabase.rpc("current_shop_role", { _shop_id: shopId });
          const r = error ? null : (data as ShopRole) ?? null;
          if (r) cache.set(cacheKey, r);
          setRole(r);
          setRoleKey(cacheKey);
          // Se a role foi removida ou alterada de forma que a rota atual deixa de ser válida,
          // a próxima navegação através do RoleProtectedRoute já a redireciona automaticamente.
          if (payload?.eventType === "DELETE") {
            // Utilizador removido da oficina — reload garante limpeza total do estado
            window.location.replace("/auth");
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [cacheKey, userId, shopId]);

  return {
    role: resolvedRole,
    loading: effectiveLoading,
    shopId,
    can: (cap: Capability) => can(resolvedRole, cap),
    isOwner: resolvedRole === "owner" || resolvedRole === "super_admin",
    isAdmin: resolvedRole === "admin" || resolvedRole === "owner" || resolvedRole === "super_admin",
  };
}
