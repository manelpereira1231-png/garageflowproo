/**
 * Shop Context Sync — single official primitive for changing the active shop.
 *
 * ANY place in the app that mutates the "active shop" (create, delete, switch,
 * onboarding finish, impersonation, fallback assignment) MUST go through
 * `setActiveShopAndSync()` instead of writing `localStorage` by hand.
 *
 * Why:
 *   - Guarantees the write, the cross-instance broadcast, and (optionally) an
 *     awaited context reload happen in the correct order — every time.
 *   - Eliminates the race condition class where navigation fires before
 *     `useShopContext` has re-hydrated, causing `RoleProtectedRoute` to bounce
 *     the user to /onboarding until an F5.
 *   - One place to instrument, one place to fix regressions.
 *
 * Rules for callers:
 *   - `switch`  → user picks another shop from the ShopSwitcher.
 *   - `created` → a new (child) shop was just inserted.
 *   - `deleted` → a shop was deleted; caller must pass `deletedShopId`.
 *   - `onboarding-complete` → wizard finished.
 *   - `impersonate` → super_admin acting as a shop.
 *   - `fallback` → hook auto-picked the user's primary shop.
 *
 * Callers that navigate immediately after a mutation SHOULD `await`
 * `setActiveShopAndSync(...)` — the returned promise resolves after the
 * broadcast fires and a microtask flush, giving every live `useShopContext`
 * instance a chance to schedule its `loadShops()` before the next route
 * mounts. Fresh route mounts always re-hydrate from `localStorage`, so the
 * primitive is safe for both live and fresh consumers.
 */

export const ACTIVE_SHOP_STORAGE_KEY = "garageflow_active_shop";
export const SHOP_CONTEXT_EVENT = "garageflow:shop-context-changed";

export type ShopContextChangeReason =
  | "switch"
  | "created"
  | "deleted"
  | "onboarding-complete"
  | "impersonate"
  | "fallback"
  | "login"
  | "logout"
  | "invite-accepted"
  | "plan-change";

export interface ShopContextChangeDetail {
  deletedShopId?: string;
  reason?: ShopContextChangeReason | string;
}

/**
 * Fire the cross-instance shop-context change event. Every live
 * `useShopContext` picks it up and calls `loadShops()` on the same tick.
 */
export function broadcastShopContextChange(detail?: ShopContextChangeDetail): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(SHOP_CONTEXT_EVENT, { detail }));
  } catch {
    /* SSR / no window */
  }
}

/**
 * Read the currently active shop id from storage (source of truth for
 * bootstrap paths that run before `useShopContext` mounts).
 */
export function getActiveShopId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(ACTIVE_SHOP_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Official primitive: switch the active shop and synchronize every live
 * `useShopContext` instance BEFORE the caller navigates.
 *
 * Awaiting the returned promise guarantees that:
 *   1. `localStorage` is written.
 *   2. The broadcast event has fired.
 *   3. Two microtask ticks have flushed, so React scheduled the listener
 *      callbacks (which each call `loadShops()`).
 *
 * The destination route will always re-hydrate its own `useShopContext` from
 * `localStorage` on mount, so this contract works for both live and fresh
 * consumers.
 */
export async function setActiveShopAndSync(
  shopId: string,
  options: { reason?: ShopContextChangeReason | string } = {},
): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(ACTIVE_SHOP_STORAGE_KEY, shopId);
    } catch {
      /* storage unavailable */
    }
  }
  broadcastShopContextChange({ reason: options.reason ?? "switch" });
  // Two microtask flushes so every listener that schedules an async
  // `loadShops()` has a chance to start before the caller navigates.
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Official primitive: signal that a shop was deleted.
 *
 * We DO NOT touch `localStorage` here — `useShopContext.handleShopDeleted`
 * decides whether the deleted shop was the active one and, if so, picks a
 * remaining shop or clears storage. That keeps the "delete non-active shop"
 * case from wiping the active id.
 *
 * Two microtask flushes so every listener that schedules `loadShops()` gets
 * a chance to run before the caller navigates.
 */
export async function clearActiveShopAndSync(
  options: { deletedShopId?: string; reason?: ShopContextChangeReason | string } = {},
): Promise<void> {
  broadcastShopContextChange({
    deletedShopId: options.deletedShopId,
    reason: options.reason ?? "deleted",
  });
  await Promise.resolve();
  await Promise.resolve();
}

/**
 * Full sign-out helper — used only by explicit logout flows. Wipes the
 * active-shop pointer AND broadcasts so every live consumer clears state.
 */
export async function resetActiveShopOnLogout(): Promise<void> {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(ACTIVE_SHOP_STORAGE_KEY);
    } catch {
      /* storage unavailable */
    }
  }
  broadcastShopContextChange({ reason: "logout" });
  await Promise.resolve();
  await Promise.resolve();
}

