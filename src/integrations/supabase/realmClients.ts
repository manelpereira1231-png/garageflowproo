/**
 * Realm-isolated Supabase clients.
 *
 * GarageFlow runs two products on the same Supabase project:
 *  - ERP   (app.garageflow.pt, /dashboard, /admin, ...)
 *  - Market (market.garageflow.pt, /market/*)
 *
 * They MUST NOT share auth state. We achieve full isolation by giving
 * each realm its own Supabase client with a distinct `storageKey`.
 * That means:
 *   - separate refresh-token flow
 *   - separate `localStorage` slot (no collisions)
 *   - separate `onAuthStateChange` stream
 *   - signOut() in one realm does NOT invalidate the other
 *
 * The auto-generated `client.ts` is left UNTOUCHED. We expose a smart
 * proxy `supabase` (in `./client-proxy.ts` / re-export below) that picks
 * the active realm based on the current URL, so the ~120 existing
 * `import { supabase } from "@/integrations/supabase/client"` keep
 * working without a mass refactor — each query automatically uses the
 * JWT of the realm it is rendered in.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export type Realm = "erp" | "market";

export const ERP_STORAGE_KEY = "gf-erp-auth";
export const MARKET_STORAGE_KEY = "gf-market-auth";

function makeClient(storageKey: string, realm: Realm): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: detectRealm() === realm,
    },
  });
}

export const erpSupabase = makeClient(ERP_STORAGE_KEY, "erp");
export const marketSupabase = makeClient(MARKET_STORAGE_KEY, "market");

function hasStoredRealmSession(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.localStorage.getItem(storageKey));
}

/** Detect realm from current URL. Default = ERP. */
export function detectRealm(pathname?: string): Realm {
  const p = pathname ?? (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/");
  const query = p.includes("?") ? p.slice(p.indexOf("?")) : "";
  const realmParam = new URLSearchParams(query).get("realm");
  if (realmParam === "market") return "market";
  if (realmParam === "erp") return "erp";
  if ((p === "/market" || p.startsWith("/market?")) && hasStoredRealmSession(ERP_STORAGE_KEY) && !hasStoredRealmSession(MARKET_STORAGE_KEY)) return "erp";
  if (p === "/market/inspections" || p.startsWith("/market/inspections?") || p === "/market/wallet" || p.startsWith("/market/wallet?") || p === "/market/payouts" || p.startsWith("/market/payouts?")) return "erp";
  if (p.startsWith("/market")) return "market";
  // market.* subdomain support
  if (typeof window !== "undefined" && window.location.hostname.startsWith("market.")) return "market";
  return "erp";
}

export function getRealmClient(realm?: Realm): SupabaseClient<Database> {
  const r = realm ?? detectRealm();
  return r === "market" ? marketSupabase : erpSupabase;
}
