import { useSyncExternalStore } from "react";
import { isDemoSession, subscribeDemoState } from "@/lib/salesDemo";

/**
 * Estado DEMO reativo: muda imediatamente quando a sessão passa a ser
 * de uma conta real (ou deixa de existir).
 */
export function useIsDemoSession(): boolean {
  return useSyncExternalStore(subscribeDemoState, isDemoSession, () => false);
}
