/**
 * useShopCountry — canonical source of the ACTIVE SHOP'S country.
 *
 * The country of a shop is fixed at registration (shops.country_code) and
 * NEVER depends on browser locale, timezone, IP, VPN or GPS. Once the shop
 * exists it can only be changed by a platform administrator.
 *
 * All operational (post-auth) code should use this hook — NOT regionConfig's
 * device-based detection, which is reserved for the public landing page
 * before a user has an account.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getCountryConfig, setCountryCode, type CountryConfig, type CountryCode } from "@/lib/regionConfig";

const ACTIVE_SHOP_KEY = "garageflow_active_shop";

let cache: { code: CountryCode; config: CountryConfig } | null = null;
const listeners = new Set<(v: { code: CountryCode; config: CountryConfig }) => void>();

async function loadShopCountry(): Promise<{ code: CountryCode; config: CountryConfig }> {
  const fallback = { code: "PT" as CountryCode, config: getCountryConfig("PT") };
  try {
    const activeShopId = localStorage.getItem(ACTIVE_SHOP_KEY);
    if (!activeShopId) return fallback;
    // Only query when there is an active session — the RPC below is safe for
    // anon but reading it without a session on the public landing produces
    // noise and is unnecessary (public landing derives country via IP/tz).
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return fallback;
    // SECURITY: use SECURITY DEFINER RPC instead of `select from shops` so the
    // `shops` table stays fully closed to the anon role.
    const { data } = await (supabase as any).rpc("get_shop_country_code", { shop_id: activeShopId });
    const code = ((typeof data === "string" ? data : null) || "PT").toUpperCase() as CountryCode;
    const config = getCountryConfig(code);
    const value = { code, config };
    cache = value;
    // CRITICAL: sync localStorage `garageflow_country` so that every legacy
    // helper (getCountryCode / getCountryConfig / formatCurrency / getTaxLabel
    // / getDefaultTimezone) — and consequently InvoiceXpress vs eNotas, EUR
    // vs BRL, IVA vs Impostos, Europe/Lisbon vs America/Sao_Paulo — resolves
    // from the ACTIVE SHOP's country, not from the browser timezone/IP.
    try {
      setCountryCode(code);
      window.dispatchEvent(new CustomEvent("garageflow:pricing-updated"));
    } catch {}
    listeners.forEach((cb) => cb(value));
    return value;
  } catch {
    return fallback;
  }
}


export function useShopCountry() {
  const [state, setState] = useState<{ code: CountryCode; config: CountryConfig }>(
    cache ?? { code: "PT", config: getCountryConfig("PT") },
  );

  useEffect(() => {
    const cb = (v: { code: CountryCode; config: CountryConfig }) => setState(v);
    listeners.add(cb);
    if (!cache) void loadShopCountry();
    else setState(cache);

    const onShopChange = () => void loadShopCountry();
    window.addEventListener("garageflow:active-shop-changed", onShopChange);
    window.addEventListener("garageflow:pricing-updated", onShopChange);

    return () => {
      listeners.delete(cb);
      window.removeEventListener("garageflow:active-shop-changed", onShopChange);
      window.removeEventListener("garageflow:pricing-updated", onShopChange);
    };
  }, []);

  return state;
}

/** Non-hook accessor for use inside async utilities. Always reloads so a
 * shop switch or fresh login is respected (never trusts stale cache). */
export async function getShopCountry(): Promise<{ code: CountryCode; config: CountryConfig }> {
  return loadShopCountry();
}

