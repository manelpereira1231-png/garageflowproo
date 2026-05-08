import { useCallback, useEffect, useState } from "react";

// Light personalization for the sidebar.
// - favorites: ordered list of pinned paths (only these can be reordered)
// - hidden: paths the user chose to hide (only HIDEABLE_PATHS allowed)
// - mutedNotif: paths whose badge / toast is silenced
// Stored per shop in localStorage. Core modules can never be hidden.

export const HIDEABLE_PATHS = [
  "/market/inspections",
  "/market/wallet",
  "/loyalty",
  "/marketing",
  "/automations",
  "/developers",
  "/chat",
  "/referrals",
] as const;

export const NOTIFIABLE_PATHS = [
  "/alerts",
  "/market/inspections",
  "/chat",
] as const;

export function isHideable(path: string) {
  return (HIDEABLE_PATHS as readonly string[]).includes(path);
}

export function isNotifiable(path: string) {
  return (NOTIFIABLE_PATHS as readonly string[]).includes(path);
}

type Prefs = {
  favorites: string[];
  hidden: string[];
  mutedNotif: string[];
};

const DEFAULT_PREFS: Prefs = { favorites: [], hidden: [], mutedNotif: [] };

function storageKey(shopId: string | null) {
  return `garageflow_sidebar_prefs_${shopId || "global"}`;
}

function readPrefs(shopId: string | null): Prefs {
  try {
    const raw = localStorage.getItem(storageKey(shopId));
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw);
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      mutedNotif: Array.isArray(parsed.mutedNotif) ? parsed.mutedNotif : [],
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function useSidebarPrefs(shopId: string | null) {
  const [prefs, setPrefs] = useState<Prefs>(() => readPrefs(shopId));

  useEffect(() => { setPrefs(readPrefs(shopId)); }, [shopId]);

  const persist = useCallback((next: Prefs) => {
    setPrefs(next);
    try { localStorage.setItem(storageKey(shopId), JSON.stringify(next)); } catch { /* ignore */ }
  }, [shopId]);

  const toggleFavorite = useCallback((path: string) => {
    const next = prefs.favorites.includes(path)
      ? { ...prefs, favorites: prefs.favorites.filter(p => p !== path) }
      : { ...prefs, favorites: [...prefs.favorites, path] };
    persist(next);
  }, [prefs, persist]);

  const moveFavorite = useCallback((path: string, dir: -1 | 1) => {
    const idx = prefs.favorites.indexOf(path);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= prefs.favorites.length) return;
    const next = [...prefs.favorites];
    [next[idx], next[target]] = [next[target], next[idx]];
    persist({ ...prefs, favorites: next });
  }, [prefs, persist]);

  const toggleHidden = useCallback((path: string) => {
    if (!isHideable(path)) return; // never allow hiding core modules
    const next = prefs.hidden.includes(path)
      ? { ...prefs, hidden: prefs.hidden.filter(p => p !== path) }
      : { ...prefs, hidden: [...prefs.hidden, path] };
    persist(next);
  }, [prefs, persist]);

  const toggleNotif = useCallback((path: string) => {
    if (!isNotifiable(path)) return;
    const next = prefs.mutedNotif.includes(path)
      ? { ...prefs, mutedNotif: prefs.mutedNotif.filter(p => p !== path) }
      : { ...prefs, mutedNotif: [...prefs.mutedNotif, path] };
    persist(next);
  }, [prefs, persist]);

  return {
    favorites: prefs.favorites,
    hidden: prefs.hidden,
    mutedNotif: prefs.mutedNotif,
    isFavorite: (p: string) => prefs.favorites.includes(p),
    isHidden: (p: string) => prefs.hidden.includes(p),
    isMuted: (p: string) => prefs.mutedNotif.includes(p),
    toggleFavorite,
    moveFavorite,
    toggleHidden,
    toggleNotif,
  };
}
