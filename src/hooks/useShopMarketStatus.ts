import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ShopMarketStatus = {
  /** True once we have a definitive answer (success OR shop-not-found). */
  ready: boolean;
  /** Shop is enrolled in the Marketplace (is_carity_partner = true). */
  isPartner: boolean;
  /** Enrollment is active and not suspended by admin (carity_active != false). */
  isActive: boolean;
  /** Convenience: partner AND active — safe to render Market pages. */
  isMarketEnabled: boolean;
  /** Minimal shop info needed by enrollment screens. */
  shop: {
    id: string;
    name: string | null;
    phone: string | null;
    address: string | null;
    email: string | null;
    nif: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  refresh: () => Promise<void>;
};

/**
 * Single source of truth for a shop's Marketplace activation state.
 *
 * - Fetches the shop row once and exposes `isPartner` / `isActive`.
 * - Subscribes to realtime updates on that row so the ERP sidebar, the
 *   inspections page, and any other consumer flip from "Ativar Market"
 *   to the full Market navigation the instant the admin or the
 *   `enroll_shop_in_market` RPC toggles the flags — no page refresh
 *   required.
 * - Refreshes when the tab regains focus, so a user that enrolled in
 *   another tab never sees a stale "Ativar Market" prompt.
 */
export function useShopMarketStatus(shopId: string | null | undefined): ShopMarketStatus {
  const [ready, setReady] = useState(false);
  const [shop, setShop] = useState<ShopMarketStatus["shop"]>(null);
  const [isPartner, setIsPartner] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const load = useCallback(async () => {
    if (!shopId) {
      setShop(null);
      setIsPartner(false);
      setIsActive(false);
      setReady(true);
      return;
    }
    const { data } = await supabase
      .from("shops")
      .select("id, name, phone, address, email, nif, latitude, longitude, is_carity_partner, carity_active")
      .eq("id", shopId)
      .maybeSingle();

    if (data) {
      setShop({
        id: data.id,
        name: data.name ?? null,
        phone: (data as any).phone ?? null,
        address: (data as any).address ?? null,
        email: (data as any).email ?? null,
        nif: (data as any).nif ?? null,
        latitude: (data as any).latitude ?? null,
        longitude: (data as any).longitude ?? null,
      });
      setIsPartner((data as any).is_carity_partner === true);
      // carity_active defaults to true; only an explicit `false` deactivates.
      setIsActive((data as any).carity_active !== false);
    } else {
      setShop(null);
      setIsPartner(false);
      setIsActive(false);
    }
    setReady(true);
  }, [shopId]);

  useEffect(() => {
    setReady(false);
    let cancelled = false;
    load().catch(() => {
      if (!cancelled) setReady(true);
    });
    return () => { cancelled = true; };
  }, [load]);

  // Realtime: any update to this shop row (e.g. admin toggling carity_active,
  // or the enroll RPC flipping is_carity_partner) instantly refreshes state
  // everywhere the hook is consumed.
  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel(`shop-market-status-${shopId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "shops", filter: `id=eq.${shopId}` },
        () => { load(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId, load]);

  // Refresh when the tab regains focus — covers the cross-tab enrollment case.
  useEffect(() => {
    const onFocus = () => { load(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  return {
    ready,
    isPartner,
    isActive,
    isMarketEnabled: isPartner && isActive,
    shop,
    refresh: load,
  };
}
