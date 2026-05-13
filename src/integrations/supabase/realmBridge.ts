/**
 * Realm session bridge.
 *
 * Goal: keep the existing ~120 files that use the default
 * `supabase` client (from `client.ts`) working WITHOUT a mass refactor,
 * while still giving ERP and Market truly isolated, persistent
 * auth sessions in their own `localStorage` slots.
 *
 * Strategy: realm clients (`erpSupabase`, `marketSupabase`) own the
 * persistent session for each product. Whenever a realm becomes
 * "active" (login, hydration on mount, or page navigation into that
 * realm), we MIRROR its session into the default client so DB queries
 * issued via `supabase.from(...)` carry the right JWT for RLS.
 *
 * Sign-out from one realm clears that realm + the default mirror,
 * but never touches the other realm — fully independent lifecycles.
 */
import { supabase as defaultClient } from "./client";
import {
  erpSupabase,
  marketSupabase,
  detectRealm,
  type Realm,
} from "./realmClients";

let mirroredRealm: Realm | null = null;
let mirroredAccessToken: string | null = null;

function realmClient(realm: Realm) {
  return realm === "market" ? marketSupabase : erpSupabase;
}

/**
 * Copy the active realm's session into the default client so existing
 * `import { supabase } from "@/integrations/supabase/client"` query
 * code is authorized as the active realm user.
 */
export async function mirrorActiveRealmSession(realm?: Realm): Promise<void> {
  const r = realm ?? detectRealm();
  const client = realmClient(r);
  const { data } = await client.auth.getSession();
  const session = data.session;

  if (!session) {
    if (mirroredRealm === r) {
      await defaultClient.auth.signOut().catch(() => {});
      mirroredRealm = null;
      mirroredAccessToken = null;
    }
    return;
  }

  if (mirroredRealm === r && mirroredAccessToken === session.access_token) {
    return; // already mirrored, no-op
  }

  await defaultClient.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  mirroredRealm = r;
  mirroredAccessToken = session.access_token;
}

/** Sign out of a single realm WITHOUT touching the other. */
export async function signOutRealm(realm: Realm): Promise<void> {
  const client = realmClient(realm);
  await client.auth.signOut().catch(() => {});

  // If the default client is currently mirroring this realm, clear it.
  if (mirroredRealm === realm) {
    await defaultClient.auth.signOut().catch(() => {});
    mirroredRealm = null;
    mirroredAccessToken = null;
  }

  // Re-mirror the other realm if it has an active session (handles users
  // who happen to be signed in to both products in the same browser).
  const other: Realm = realm === "erp" ? "market" : "erp";
  await mirrorActiveRealmSession(other).catch(() => {});
}

/** Wire realm clients so any auth event re-mirrors into the default client. */
let listenersInstalled = false;
export function installRealmAuthListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  erpSupabase.auth.onAuthStateChange((_event, session) => {
    if (detectRealm() === "erp") {
      // fire-and-forget — never await inside an auth state change handler
      void mirrorActiveRealmSession("erp");
    }
    void session; // keep ref to satisfy linter
  });
  marketSupabase.auth.onAuthStateChange((_event, session) => {
    if (detectRealm() === "market") {
      void mirrorActiveRealmSession("market");
    }
    void session;
  });
}
