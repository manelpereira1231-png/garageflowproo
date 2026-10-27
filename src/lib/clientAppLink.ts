import { Capacitor } from "@capacitor/core";

const KEY = "garageflow_clientes_portal_token";
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** Extract a portal token from a pasted link or raw token. Returns null when it is not a portal link. */
export function extractPortalToken(input: string): string | null {
  const text = (input || "").trim();
  if (!text) return null;
  const portalMatch = text.match(/\/portal\/([^/?#\s]+)/i);
  const candidate = portalMatch ? decodeURIComponent(portalMatch[1]) : text;
  const m = candidate.match(UUID_RE);
  if (!m || (portalMatch === null && m[0].length !== candidate.length)) return null;
  return m[0].toLowerCase();
}

async function secure() {
  const mod = await import("@aparajita/capacitor-secure-storage");
  return mod.SecureStorage;
}

export async function loadStoredToken(): Promise<string | null> {
  try {
    if (Capacitor.isNativePlatform()) {
      const v = await (await secure()).get(KEY);
      return typeof v === "string" ? v : null;
    }
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function saveToken(token: string): Promise<void> {
  if (Capacitor.isNativePlatform()) await (await secure()).set(KEY, token);
  else localStorage.setItem(KEY, token);
}

export async function clearToken(): Promise<void> {
  try {
    if (Capacitor.isNativePlatform()) await (await secure()).remove(KEY);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
}
