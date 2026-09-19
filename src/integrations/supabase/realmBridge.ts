/**
 * Explicit realm auth actions.
 *
 * There is intentionally NO session mirroring, JWT syncing, default-client
 * writing, or cross-realm listener here. ERP and Market are independent
 * products with independent Supabase clients and storage keys.
 */
import { erpSupabase, marketSupabase, type Realm } from "./realmClients";
import { resetActiveShopOnLogout } from "@/lib/shopContextSync";
import { clearSupplierCache } from "@/hooks/useIsSupplier";

/** Sign out of a single realm WITHOUT touching the other. */
export async function signOutRealm(realm: Realm): Promise<void> {
  const client = realm === "market" ? marketSupabase : erpSupabase;
  // Limpa identidade da sessão anterior ANTES de terminar sessão: nenhuma
  // oficina/fornecedor da conta anterior pode sobreviver para a próxima.
  if (realm === "erp") {
    clearSupplierCache();
    try { await resetActiveShopOnLogout(); } catch { /* noop */ }
    try { sessionStorage.removeItem("gf_user_type_cache"); } catch { /* noop */ }
  }
  await client.auth.signOut().catch(() => {});
}
