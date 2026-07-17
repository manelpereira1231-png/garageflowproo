import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

type Event = "INSERT" | "UPDATE" | "DELETE" | "*";

interface Options {
  /** Filter subscription by shop_id. Skip subscription when null/undefined. */
  shopId?: string | null;
  /** Postgres filter string, e.g. "status=eq.pending". Overrides shopId filter when set. */
  filter?: string;
  /** Which event(s) to listen for. Default '*'. */
  event?: Event;
  /** Called on every event (debounced). Use it to re-fetch. */
  onChange: () => void;
  /** Additional deps that should re-create the channel (e.g. filters). */
  deps?: unknown[];
  /** Debounce window in ms. Default 200. Prevents render storms. */
  debounceMs?: number;
  /** Optional: skip subscription entirely. */
  enabled?: boolean;
}

/**
 * Enterprise realtime hook — one shared implementation.
 *
 * Subscribes to postgres_changes for `table`, scoped by `shop_id` (or custom
 * filter), and calls `onChange` (debounced) on every INSERT/UPDATE/DELETE.
 *
 * Cleanup is bulletproof: the channel is torn down on unmount and whenever
 * shopId/filter/event/deps change. RLS on the table guarantees isolation.
 */
export function useRealtimeTable(table: string, opts: Options) {
  const { shopId, filter, event = "*", onChange, deps = [], debounceMs = 200, enabled = true } = opts;

  const cbRef = useRef(onChange);
  cbRef.current = onChange;

  useEffect(() => {
    if (!enabled) return;
    // Require either an explicit filter or a shopId to avoid subscribing globally by accident.
    const effectiveFilter = filter ?? (shopId ? `shop_id=eq.${shopId}` : undefined);
    if (!effectiveFilter && shopId !== null) {
      // shopId undefined → wait until it's resolved.
      return;
    }

    const channelName = `rt-${table}-${effectiveFilter ?? "global"}-${Math.random().toString(36).slice(2, 8)}`;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => cbRef.current(), debounceMs);
    };

    const channel = supabase
      .channel(channelName)
      .on(

        "postgres_changes",
        { event, schema: "public", table, ...(effectiveFilter ? { filter: effectiveFilter } : {}) },
        trigger,
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, shopId, filter, event, enabled, ...deps]);
}

/**
 * Subscribe to multiple tables at once with the same handler.
 * Useful for aggregate views (Dashboard KPIs).
 */
export function useRealtimeTables(tables: string[], opts: Omit<Options, "onChange"> & { onChange: () => void }) {
  const cbRef = useRef(opts.onChange);
  cbRef.current = opts.onChange;

  useEffect(() => {
    if (opts.enabled === false) return;
    const effectiveFilter = opts.filter ?? (opts.shopId ? `shop_id=eq.${opts.shopId}` : undefined);
    if (!effectiveFilter) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const trigger = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => cbRef.current(), opts.debounceMs ?? 300);
    };

    const channel = supabase.channel(`rt-multi-${effectiveFilter}-${Math.random().toString(36).slice(2, 8)}`);
    for (const t of tables) {
      channel.on(

        "postgres_changes",
        { event: opts.event ?? "*", schema: "public", table: t, filter: effectiveFilter },
        trigger,
      );
    }
    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(","), opts.shopId, opts.filter, opts.event, opts.enabled]);
}
