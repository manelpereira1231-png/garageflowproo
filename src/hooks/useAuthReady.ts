import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuthReady() {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session ?? null);
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      // Skip events that don't change the actual user identity to avoid
      // cascading re-renders / refetches across the app (Layout, Dashboard,
      // useShopContext, etc.). TOKEN_REFRESHED fires every ~hour and was
      // causing the UI to flash like a full reload, especially in Lite Mode.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
        setSession(nextSession ?? null);
        setIsReady(true);
        return;
      }
      setSession(nextSession ?? null);
      setUser((prev) => {
        const next = nextSession?.user ?? null;
        if (prev?.id === next?.id) return prev; // keep same reference
        return next;
      });
      setIsReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { isReady, session, user };
}