/**
 * Explicit realm auth actions.
 *
 * There is intentionally NO session mirroring, JWT syncing, default-client
 * writing, or cross-realm listener here. ERP and Market are independent
 * products with independent Supabase clients and storage keys.
 */
import { erpSupabase, marketSupabase, type Realm } from "./realmClients";

function realmClient(realm: Realm) {
  return realm === "market" ? marketSupabase : erpSupabase;
}

/** Sign out of a single realm WITHOUT touching the other. */
export async function signOutRealm(realm: Realm): Promise<void> {
  const client = realmClient(realm);
  await client.auth.signOut().catch(() => {});
}
