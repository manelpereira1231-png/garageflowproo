import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes of the given tables filtered by supplier_id
 * and calls `onChange` whenever something changes. No page refresh needed.
 * The callback is kept in a ref so unstable functions don't re-subscribe.
 */
export function useSupplierLive(
  supplierId: string | null | undefined,
  tables: string[],
  onChange: () => void,
) {
  const cb = useRef(onChange);
  cb.current = onChange;
  const key = tables.join(",");

  useEffect(() => {
    if (!supplierId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => cb.current(), 250);
    };
    const channel = supabase.channel(`gsn-live-${key}-${supplierId}`);
    for (const table of key.split(",")) {
      channel.on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table, filter: `supplier_id=eq.${supplierId}` },
        fire,
      );
    }
    channel.subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [supplierId, key]);
}
