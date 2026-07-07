import { useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import type { Session, User } from "@supabase/supabase-js";
import { erpSupabase, marketSupabase, detectRealm, type Realm } from "@/integrations/supabase/realmClients";

type AuthReadyState = {
  isReady: boolean;
  session: Session | null;
  user: User | null;
  realm: Realm;
};

const listeners = new Set<() => void>();
const authStates: Record<Realm, AuthReadyState> = {
  erp: { isReady: false, session: null, user: null, realm: "erp" },
  market: { isReady: false, session: null, user: null, realm: "market" },
};
const initializedRealms: Partial<Record<Realm, boolean>> = {};
const hydrationIds: Record<Realm, number> = { erp: 0, market: 0 };
const focusRefreshInstalled: Partial<Record<Realm, boolean>> = {};
const AUTH_HYDRATION_TIMEOUT_MS = 3000;

function emit() {
  listeners.forEach((listener) => listener());
}

function setAuthState(realm: Realm, next: Partial<AuthReadyState>) {
  authStates[realm] = { ...authStates[realm], ...next, realm };
  emit();
}

function pickClient(realm: Realm) {
  return realm === "market" ? marketSupabase : erpSupabase;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error("auth_hydration_timeout")), ms);
    promise.then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(id);
        reject(error);
      },
    );
  });
}

function installFocusRefresh(realm: Realm) {
  if (focusRefreshInstalled[realm] || typeof window === "undefined") return;
  focusRefreshInstalled[realm] = true;
  const client = pickClient(realm);
  const refreshIfStale = async () => {
    if (detectRealm() !== realm) return;
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
    if (document.visibilityState === "visible") void refreshIfStale();
  });
}

function ensureAuthReadySubscription(realm: Realm) {
  if (initializedRealms[realm]) return;
  initializedRealms[realm] = true;

  const client = pickClient(realm);
  const initialHydrationId = ++hydrationIds[realm];

  withTimeout(client.auth.getSession(), AUTH_HYDRATION_TIMEOUT_MS).then(({ data: { session } }) => {
    if (initialHydrationId !== hydrationIds[realm]) return;
    setAuthState(realm, { session: session ?? null, user: session?.user ?? null, isReady: true });
  }).catch(() => {
    if (initialHydrationId !== hydrationIds[realm]) return;
    setAuthState(realm, { session: null, user: null, isReady: true });
  });

  client.auth.onAuthStateChange((event, nextSession) => {
    hydrationIds[realm]++;
    const previousUser = authStates[realm].user;
    const nextUser = nextSession?.user ?? null;

    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      setAuthState(realm, {
        session: nextSession ?? null,
        user: nextUser ?? previousUser ?? null,
        isReady: true,
      });
      return;
    }

    setAuthState(realm, {
      session: nextSession ?? null,
      user: previousUser?.id === nextUser?.id ? previousUser : nextUser,
      isReady: true,
    });
  });

  installFocusRefresh(realm);
}

export function useAuthReady(realmOverride?: Realm) {
  const location = useLocation();
  const realm = realmOverride ?? detectRealm(`${location.pathname}${location.search}`);

  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      ensureAuthReadySubscription(realm);
      return () => listeners.delete(listener);
    },
    () => authStates[realm],
    () => authStates[realm],
  );
}
