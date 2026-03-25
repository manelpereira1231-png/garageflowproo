import { useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "garageflow_active_shop";
const listeners = new Set<() => void>();

// Notify all subscribers when shop changes
function emitChange() {
  listeners.forEach(l => l());
}

// Patch localStorage.setItem to detect shop switches
const originalSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = (key: string, value: string) => {
  originalSetItem(key, value);
  if (key === STORAGE_KEY) {
    emitChange();
  }
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return localStorage.getItem(STORAGE_KEY);
}

/**
 * Reactive hook that returns the active shop ID.
 * Re-renders the component whenever the shop is switched.
 */
export function useActiveShopId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot);
}
