import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reads the global `market_enabled` flag from `system_feature_flags` with
 * realtime updates. This is the single source of truth used to hide the
 * Marketplace across the ERP sidebar, the MarketLayout, and the public
 * Marketplace entry route. RLS on `system_feature_flags` allows anon SELECT
 * of enabled/disabled state, so this works for logged-out visitors too.
 *
 * Defaults to `true` while loading to avoid flashing the marketplace off for
 * everyone on a slow query — when disabled, the redirect kicks in as soon as
 * the row arrives (typically <200ms).
 */
export function useGlobalMarketEnabled() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("system_feature_flags")
        .select("enabled, rollout_percent")
        .eq("key", "market_enabled")
        .maybeSingle();
      if (cancelled) return;
      // Treat rollout_percent=0 as disabled as well.
      const isOn = data ? Boolean(data.enabled) && (data.rollout_percent ?? 100) > 0 : true;
      setEnabled(isOn);
      setReady(true);
    };
    load();

    const ch = supabase
      .channel("global-market-flag")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_feature_flags", filter: "key=eq.market_enabled" },
        () => load()
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(ch);
    };
  }, []);

  return { enabled, ready };
}
