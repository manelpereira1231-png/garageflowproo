import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthReady } from "@/hooks/useAuthReady";
import {
  ACTIVE_SHOP_STORAGE_KEY,
  SHOP_CONTEXT_EVENT,
  broadcastShopContextChange as sharedBroadcast,
  setActiveShopAndSync,
  type ShopContextChangeDetail,
} from "@/lib/shopContextSync";

interface Shop {
  id: string;
  name: string;
  logo_url: string | null;
  currency: string;
  language: string;
}

const STORAGE_KEY = ACTIVE_SHOP_STORAGE_KEY;
const SHOP_CONTEXT_TIMEOUT_MS = 3000;

/**
 * Cross-hook-instance broadcast is implemented in `@/lib/shopContextSync`.
 * We re-export the primitive here to keep existing imports working while the
 * codebase migrates to the centralized helper.
 */
const SHOP_EVT = SHOP_CONTEXT_EVENT;
export const broadcastShopContextChange = sharedBroadcast;

function timeoutResult<T>(value: T, ms = SHOP_CONTEXT_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}


export function useShopContext() {
  const { isReady, user } = useAuthReady();
  const [shops, setShops] = useState<Shop[]>([]);
  const [activeShopId, setActiveShopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Keep the latest shops/activeShopId available inside effects without
  // re-subscribing to Realtime on every state change.
  const shopsRef = useRef<Shop[]>([]);
  const activeShopIdRef = useRef<string | null>(null);
  shopsRef.current = shops;
  activeShopIdRef.current = activeShopId;

  const loadShops = useCallback(async () => {
    if (!isReady) {
      setLoading(true);
      return;
    }

    if (!user) {
      setShops([]);
      setActiveShopId(null);
      setLoading(false);
      return;
    }

    try {
      // Canonical group scope: if this account is the Oficina Mãe
      // (`group_owner_id = auth.uid()`), load every child shop in the group so
      // switching to a child does not get reverted by the next context reload.
      // Child accounts never match this filter, so they remain isolated.
      const { data: groupShops } = await Promise.race([
        supabase
          .from("shops")
          .select("id, name, logo_url, currency, language")
          .eq("group_owner_id", user.id),
        timeoutResult({ data: [] }),
      ]);

      // Direct ownership still matters for legacy/single-shop accounts and for
      // independent child-shop login (`shops.user_id = child_user_id`).
      const { data: directOwnedShops } = await Promise.race([
        supabase
          .from("shops")
          .select("id, name, logo_url, currency, language")
          .eq("user_id", user.id),
        timeoutResult({ data: [] }),
      ]);

      // Get shops where user is a team member
      const { data: memberEntries } = await Promise.race([
        supabase
          .from("shop_users")
          .select("shop_id")
          .eq("user_id", user.id),
        timeoutResult({ data: [] }),
      ]);

      const ownedById = new Map<string, Shop>();
      for (const s of [...(groupShops || []), ...(directOwnedShops || [])] as Shop[]) {
        ownedById.set(s.id, s);
      }
      const ownedShops = Array.from(ownedById.values());

      const memberShopIds = (memberEntries || [])
        .map(e => e.shop_id)
        .filter(id => !ownedById.has(id));

      let memberShops: Shop[] = [];
      if (memberShopIds.length > 0) {
        const { data } = await Promise.race([
          supabase
            .from("shops")
            .select("id, name, logo_url, currency, language")
            .in("id", memberShopIds),
          timeoutResult({ data: [] }),
        ]);
        memberShops = data || [];
      }

      // Filter out ghost owned shops (empty name) when the user already
      // belongs to at least one real member shop. This preserves the
      // classic "one-owner, one-shop" flow while blocking privilege escalation
      // for invited members whose signup trigger created an empty shop.
      const realOwnedShops = memberShops.length > 0
        ? (ownedShops || []).filter((s) => (s.name || "").trim().length > 0)
        : (ownedShops || []);

      // Prefer owned/group shops first for the Oficina Mãe; prefer member shops
      // first only for pure team users with no direct/group ownership.
      const allShops = realOwnedShops.length > 0
        ? [...realOwnedShops, ...memberShops]
        : [...memberShops, ...realOwnedShops];
      setShops(allShops);

      // Restore or pick default; if the stored active id no longer exists
      // (e.g. shop was deleted), fall back to the primary shop.
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && allShops.some(s => s.id === stored)) {
        setActiveShopId(stored);
      } else if (allShops.length > 0) {
        setActiveShopId(allShops[0].id);
        localStorage.setItem(STORAGE_KEY, allShops[0].id);
      } else {
        // No shops at all → clear context and let the caller redirect.
        setActiveShopId(null);
        localStorage.removeItem(STORAGE_KEY);
      }
    } finally {
      setLoading(false);
    }
  }, [isReady, user]);

  useEffect(() => { loadShops(); }, [loadShops]);

  // ─────────────────────────────────────────────────────────────────────
  // Realtime + cross-instance sync: whenever any shop the user can see is
  // deleted (INSERT/UPDATE/DELETE on `shops` or `shop_users`), refresh the
  // context immediately — no window.location.reload, no setTimeout.
  // ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;

    const handleShopDeleted = (deletedId: string) => {
      // Optimistically drop the deleted shop from local state.
      const remaining = shopsRef.current.filter((s) => s.id !== deletedId);
      setShops(remaining);

      const wasActive = activeShopIdRef.current === deletedId;
      if (wasActive) {
        if (remaining.length > 0) {
          // Pick the primary/first remaining shop.
          const next = remaining[0].id;
          setActiveShopId(next);
          localStorage.setItem(STORAGE_KEY, next);
        } else {
          setActiveShopId(null);
          localStorage.removeItem(STORAGE_KEY);
        }
      }

      // Purge every cached query — shop-scoped hooks will refetch against
      // the (new or absent) active shop.
      try { queryClient.clear(); } catch { /* noop */ }

      // Kick a full reload of shops list so RLS-affected memberships settle.
      void loadShops();

      // If the user now has zero shops, route them to onboarding.
      if (remaining.length === 0) {
        try { navigate("/onboarding", { replace: true }); } catch { /* noop */ }
      }
    };

    const channel = supabase
      .channel(`shop-context-${user.id}`)
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "shops" },
        (payload) => {
          const oldId = (payload.old as any)?.id as string | undefined;
          if (!oldId) return;
          // Only react if this user actually saw the shop.
          if (shopsRef.current.some((s) => s.id === oldId)) {
            handleShopDeleted(oldId);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shops" },
        () => { void loadShops(); },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shop_users", filter: `user_id=eq.${user.id}` },
        () => { void loadShops(); },
      )
      .subscribe();

    // Cross-instance sync via window event (fires from ShopSwitcher on the
    // same tab, before the Realtime round-trip completes).
    const onLocalChange = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { deletedShopId?: string }
        | undefined;
      if (detail?.deletedShopId) {
        handleShopDeleted(detail.deletedShopId);
      } else {
        void loadShops();
      }
    };
    window.addEventListener(SHOP_EVT, onLocalChange);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener(SHOP_EVT, onLocalChange);
    };
  }, [user, loadShops, queryClient, navigate]);

  const switchShop = useCallback((shopId: string) => {
    // Optimistic local update — this instance flips immediately.
    setActiveShopId(shopId);
    // Delegate persistence + cross-instance broadcast to the single official
    // primitive so we never diverge from create/delete/onboarding flows.
    void setActiveShopAndSync(shopId, { reason: "switch" });
  }, []);


  const activeShop = shops.find(s => s.id === activeShopId) || null;

  return {
    shops,
    activeShop,
    activeShopId,
    switchShop,
    loading,
    reload: loadShops,
    hasMultipleShops: shops.length > 1,
  };
}
