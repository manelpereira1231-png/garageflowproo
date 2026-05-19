import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AdminStripeSyncResult {
  synced: number;
  failed: number;
  checked: number;
}

export function useAdminStripeAutoSync(onSynced: () => void | Promise<void>, intervalMs = 45_000) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const runningRef = useRef(false);
  const onSyncedRef = useRef(onSynced);

  useEffect(() => {
    onSyncedRef.current = onSynced;
  }, [onSynced]);

  const syncNow = useCallback(async () => {
    if (runningRef.current) return null;
    runningRef.current = true;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke<AdminStripeSyncResult>("admin-sync-stripe");
      if (error) throw error;
      setSyncError(null);
      setLastSyncedAt(new Date());
      await onSyncedRef.current();
      return data ?? null;
    } catch (error: any) {
      setSyncError(error?.message || "Falha ao sincronizar Stripe");
      return null;
    } finally {
      runningRef.current = false;
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void syncNow();

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") void syncNow();
    };

    const timer = window.setInterval(refreshIfVisible, intervalMs);
    window.addEventListener("focus", refreshIfVisible);
    window.addEventListener("online", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshIfVisible);
      window.removeEventListener("online", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [intervalMs, syncNow]);

  return { syncNow, syncing, syncError, lastSyncedAt };
}