import { useState } from "react";
import { useRealtimeTables } from "@/hooks/useRealtimeTable";

/**
 * Returns a counter that increases whenever any of `tables` changes for the
 * active shop (any user of the same shop). Add it to a fetch effect's deps so
 * owners, technicians and staff always see the same live data.
 */
export function useLiveTick(tables: string[], shopId: string | null | undefined): number {
  const [tick, setTick] = useState(0);
  useRealtimeTables(tables, {
    shopId: shopId ?? null,
    enabled: !!shopId,
    onChange: () => setTick((t) => t + 1),
  });
  return tick;
}
