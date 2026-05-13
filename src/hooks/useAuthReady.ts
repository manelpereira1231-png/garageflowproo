import { useSyncExternalStore } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { erpSupabase, marketSupabase, detectRealm, type Realm } from "@/integrations/supabase/realmClients";
import { installRealmAuthListeners, mirrorActiveRealmSession } from "@/integrations/supabase/realmBridge";

type AuthReadyState = {
  isReady: boolean;
  session: Session | null;
  user: User | null;
  realm: Realm;
};

const listeners = new Set<() => void>();
let authState: AuthReadyState = {
  isReady: false,
  session: null,
  user: null,
  realm: detectRealm(),
};
let initialized = false;
let hydrationId = 0;

function emit() {
  listeners.forEach((listener) => listener());
}

function setAuthState(next: Partial<AuthReadyState>) {
  authState = { ...authState, ...next };
  emit();
}

function pickClient(realm: Realm) {
  return realm === "market" ? marketSupabase : erpSupabase;
}

function ensureAuthReadySubscription() {
  if (initialized) return;
  initialized = true;

  installRealmAuthListeners();

  const realm = detectRealm();
  authState = { ...authState, realm };

  const client = pickClient(realm);
  const initialHydrationId = ++hydrationId;

  client.auth.getSession().then(({ data: { session } }) => {
    if (initialHydrationId !== hydrationId) return;
    setAuthState({ session: session ?? null, user: session?.user ?? null, isReady: true });
    void mirrorActiveRealmSession(realm);
  });

  // Subscribe to the active realm's auth events. Other realm's events are
  // intentionally ignored here — they belong to a different product surface.
  client.auth.onAuthStateChange((event, nextSession) => {
    hydrationId++;
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      const nextUser = nextSession?.user ?? authState.user ?? null;
      setAuthState({ session: nextSession ?? null, user: nextUser, isReady: true });
      void mirrorActiveRealmSession(realm);
      return;
    }

    const nextUser = nextSession?.user ?? null;
    setAuthState({
      session: nextSession ?? null,
      user: authState.user?.id === nextUser?.id ? authState.user : nextUser,
      isReady: true,
    });
    void mirrorActiveRealmSession(realm);
  });

  // Stay-logged-in hardening: refresh active realm session on focus / online.
  if (typeof window !== "undefined") {
    const refreshIfStale = async () => {
      try {
        const { data } = await client.auth.getSession();
        const session = data.session;
        if (!session) return;
        const expiresAt = (session.expires_at ?? 0) * 1000;
        if (expiresAt - Date.now() < 5 * 60 * 1000) {
          await client.auth.refreshSession();
        }
      } catch {
        // Silent — autoRefreshToken will retry; never log the user out on transient errors.
      }
    };
    window.addEventListener("focus", refreshIfStale);
    window.addEventListener("online", refreshIfStale);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshIfStale();
    });
  }
}

export function useAuthReady() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      ensureAuthReadySubscription();
      return () => listeners.delete(listener);
    },
    () => authState,
    () => authState,
  );
}
