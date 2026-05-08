import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthReadyState = {
  isReady: boolean;
  session: Session | null;
  user: User | null;
};

const listeners = new Set<() => void>();
let authState: AuthReadyState = { isReady: false, session: null, user: null };
let initialized = false;

function emit() {
  listeners.forEach((listener) => listener());
}

function setAuthState(next: Partial<AuthReadyState>) {
  authState = { ...authState, ...next };
  emit();
}

function ensureAuthReadySubscription() {
  if (initialized) return;
  initialized = true;

  supabase.auth.getSession().then(({ data: { session } }) => {
    setAuthState({ session: session ?? null, user: session?.user ?? null, isReady: true });
  });

  supabase.auth.onAuthStateChange((event, nextSession) => {
    if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
      setAuthState({ session: nextSession ?? null, isReady: true });
      return;
    }

    const nextUser = nextSession?.user ?? null;
    setAuthState({
      session: nextSession ?? null,
      user: authState.user?.id === nextUser?.id ? authState.user : nextUser,
      isReady: true,
    });
  });

  // Stay-logged-in hardening: proactively refresh the session when the user
  // returns to the tab or regains connectivity. Prevents silent logouts after
  // long idle periods (mobile PWAs especially).
  if (typeof window !== "undefined") {
    const refreshIfStale = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) return;
        const expiresAt = (session.expires_at ?? 0) * 1000;
        // Refresh if token expires within the next 5 minutes
        if (expiresAt - Date.now() < 5 * 60 * 1000) {
          await supabase.auth.refreshSession();
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
  const [snapshot, setSnapshot] = useState<AuthReadyState>(authState);

  useEffect(() => {
    ensureAuthReadySubscription();
    const update = () => setSnapshot(authState);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);

  return snapshot;
}