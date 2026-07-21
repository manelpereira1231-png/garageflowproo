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

const DEFAULT_AUTH_STORAGE_KEY = (() => {
  try {
    return `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;
  } catch {
    return "garageflow-auth-token";
  }
})();

// ERP must keep the original Supabase storage key so existing GarageFlow
// workshop sessions continue to hydrate after deploys. Market stays isolated
// with its own key, so the two products still do not collide.
export const ERP_STORAGE_KEY = DEFAULT_AUTH_STORAGE_KEY;
const LEGACY_ERP_STORAGE_KEY = "gf-erp-auth";
export const MARKET_STORAGE_KEY = "gf-market-auth";

function migrateLegacyErpSession() {
  if (typeof window === "undefined") return;
  try {
    const current = window.localStorage.getItem(ERP_STORAGE_KEY);
    const legacy = window.localStorage.getItem(LEGACY_ERP_STORAGE_KEY);
    if (!current && legacy) window.localStorage.setItem(ERP_STORAGE_KEY, legacy);
  } catch {
    // Storage can be disabled; auth will simply behave as signed out.
  }
}

/**
 * Sanitize stored sessions BEFORE the Supabase SDK reads them.
 *
 * Root cause of "AuthApiError: Invalid Refresh Token: Refresh Token Not Found":
 * a stored session blob whose refresh_token is missing/expired/revoked. The SDK
 * would then POST /auth/v1/token?grant_type=refresh_token, get HTTP 400, and log
 * the error to console — visible to anonymous visitors.
 *
 * We remove such blobs proactively so the SDK boots as "signed out" (the correct
 * state) instead of trying to refresh a token that will never work.
 */
function sanitizeStoredSession(storageKey: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return;
    // Supabase stores either an object or a JSON-stringified session.
    const parsed = JSON.parse(raw);
    const session = parsed?.currentSession ?? parsed;
    const refreshToken: string | undefined = session?.refresh_token;
    const expiresAt: number | undefined = session?.expires_at; // seconds
    const nowSec = Math.floor(Date.now() / 1000);
    // Missing refresh token → cannot recover. Access token expired and no refresh → same.
    const invalid =
      !refreshToken ||
      typeof refreshToken !== "string" ||
      refreshToken.length < 10 ||
      (typeof expiresAt === "number" && expiresAt + 60 * 60 * 24 * 30 < nowSec); // >30d expired
    if (invalid) window.localStorage.removeItem(storageKey);
  } catch {
    // Corrupted JSON blob — remove it, don't feed garbage to the SDK.
    try { window.localStorage.removeItem(storageKey); } catch {}
  }
}

/**
 * Silence residual "Invalid Refresh Token" console noise from the Supabase SDK
 * (e.g. token revoked mid-session from another tab). We ONLY filter that exact
 * pattern; every other console.error passes through untouched. This is a display
 * concern: functional signOut/refresh events still fire via onAuthStateChange.
 */
function installAuthNoiseFilter() {
  if (typeof window === "undefined") return;
  if ((window as any).__gfAuthNoiseFilterInstalled) return;
  (window as any).__gfAuthNoiseFilterInstalled = true;
  const origError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    try {
      const msg = args.map((a) => (typeof a === "string" ? a : (a as any)?.message || "")).join(" ");
      if (/Invalid Refresh Token|Refresh Token Not Found|AuthApiError.*refresh/i.test(msg)) return;
    } catch {}
    origError(...args);
  };
  // Also swallow unhandled promise rejections from the SDK's background refresh.
  window.addEventListener("unhandledrejection", (e) => {
    const msg = (e.reason && ((e.reason as any).message || String(e.reason))) || "";
    if (/Invalid Refresh Token|Refresh Token Not Found/i.test(msg)) e.preventDefault();
  });
}

migrateLegacyErpSession();
sanitizeStoredSession(ERP_STORAGE_KEY);
sanitizeStoredSession(MARKET_STORAGE_KEY);
installAuthNoiseFilter();

const nonBlockingAuthLock = async <R,>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>,
): Promise<R> => fn();

function makeClient(storageKey: string, realm: Realm): SupabaseClient<Database> {
  const isPasswordActivationPath = typeof window !== "undefined" && window.location.pathname === "/reset-password";
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      lock: nonBlockingAuthLock,
      // Password/invite activation uses its own short-lived auth client so a
      // child-shop link can never consume, overwrite, or reuse an open mother-shop session.
      detectSessionInUrl: !isPasswordActivationPath && detectRealm() === realm,
    },
  }) as SupabaseClient<Database>;
}

const ERP_MARKET_PATHS = [
  "/market/opportunities",
  "/market/inspections",
  "/market/offers",
  "/market/wallet",
  "/market/history",
  "/market/stats",
  "/market/payouts",
];

function hasStoredRealmSession(storageKey: string): boolean {
  if (typeof window === "undefined") return false;
  try { return Boolean(window.localStorage.getItem(storageKey)); } catch { return false; }
}

/** Detect realm from current URL. Default = ERP. */
export function detectRealm(pathname?: string): Realm {
  const p = pathname ?? (typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/");
  const query = p.includes("?") ? p.slice(p.indexOf("?")) : "";
  const realmParam = new URLSearchParams(query).get("realm");
  if (realmParam === "market") return "market";
  if (realmParam === "erp") return "erp";
  if ((p === "/market" || p.startsWith("/market?")) && hasStoredRealmSession(ERP_STORAGE_KEY)) return "erp";
  if (ERP_MARKET_PATHS.some((path) => p === path || p.startsWith(`${path}?`) || p.startsWith(`${path}/`))) return "erp";
  if (p.startsWith("/market")) return "market";
  // market.* subdomain support
  if (typeof window !== "undefined" && window.location.hostname.startsWith("market.")) return "market";
  return "erp";
}

export const erpSupabase = makeClient(ERP_STORAGE_KEY, "erp");
export const marketSupabase = makeClient(MARKET_STORAGE_KEY, "market");


export function getRealmClient(realm?: Realm): SupabaseClient<Database> {
  const r = realm ?? detectRealm();
  return r === "market" ? marketSupabase : erpSupabase;
}
