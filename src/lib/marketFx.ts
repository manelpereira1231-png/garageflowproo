/**
 * Currency conversion helpers for the Market. Fetches ECB rates via the
 * `market-fx-rates` edge function, caches in localStorage for 12h.
 */
import { supabase } from "@/integrations/supabase/client";

const CACHE_KEY = "garageflow_fx_rates_v1";
const TTL = 12 * 60 * 60 * 1000;

type FxCache = { base: string; rates: Record<string, number>; at: number };

let inflight: Promise<FxCache | null> | null = null;

function readCache(): FxCache | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FxCache;
    if (Date.now() - parsed.at > TTL) return null;
    return parsed;
  } catch { return null; }
}

export async function loadFxRates(base = "EUR"): Promise<FxCache | null> {
  const cached = readCache();
  if (cached && cached.base === base) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("market-fx-rates", {
        body: null, method: "GET" as any,
      } as any).catch(() => ({ data: null, error: new Error("invoke_failed") }));
      // Fallback: direct fetch to the deployed function (invoke can't set query params reliably)
      let payload: any = data;
      if (!payload) {
        const url = `https://ukizzadscugrooovymvv.supabase.co/functions/v1/market-fx-rates?base=${base}`;
        const res = await fetch(url);
        if (res.ok) payload = await res.json();
      }
      if (!payload?.rates) return null;
      const value: FxCache = { base: payload.base || base, rates: payload.rates, at: Date.now() };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch { /* ignore */ }
      return value;
    } catch { return null; }
    finally { inflight = null; }
  })();
  return inflight;
}

/** Convert an amount from one currency to another using cached rates. */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  fx: FxCache | null,
): number | null {
  if (!fx || !amount) return null;
  const F = from.toUpperCase(); const T = to.toUpperCase();
  if (F === T) return amount;
  const rF = F === fx.base ? 1 : fx.rates[F];
  const rT = T === fx.base ? 1 : fx.rates[T];
  if (!rF || !rT) return null;
  const inBase = amount / rF;
  return inBase * rT;
}

export function formatConverted(
  amount: number,
  currency: string,
  locale: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency", currency, maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString(locale)}`;
  }
}
