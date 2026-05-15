/**
 * Canonical hook to read the current authenticated user.
 *
 * IMPORTANT: Use this instead of `await supabase.auth.getUser()` inside
 * components/hooks. `useAuthReady` already maintains a hot session cache
 * via a single `onAuthStateChange` subscription per realm — calling
 * `getUser()` again triggers a redundant network round-trip to /auth/user
 * on every mount and is the #1 cause of waterfall flicker.
 *
 * For one-shot async code (event handlers, mutations) where you don't
 * have access to a hook, prefer `getCurrentUser()` below — it reads from
 * the same in-memory session store with NO network call.
 */
import { useAuthReady } from "@/hooks/useAuthReady";
import { getRealmClient } from "@/integrations/supabase/realmClients";

export function useAuthUser() {
  const { user, session, isReady, realm } = useAuthReady();
  return { user, session, isReady, realm };
}

/**
 * Sync read of the current user from the active realm's in-memory session.
 * No network call. Returns null if not signed in or session not yet hydrated.
 */
export async function getCurrentUser() {
  const client = getRealmClient();
  // getSession() reads from local storage / memory — no network round-trip,
  // unlike getUser() which always hits /auth/user.
  const { data } = await client.auth.getSession();
  return data.session?.user ?? null;
}
