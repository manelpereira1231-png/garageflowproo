// FX rates via Frankfurter (ECB, no API key). Cached in-memory for 12h.
// Response: { base: "EUR", rates: { USD: 1.08, ... }, updated_at }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

type Cache = { at: number; base: string; rates: Record<string, number> };
let cache: Cache | null = null;
const TTL = 12 * 60 * 60 * 1000;

async function loadRates(base: string): Promise<Cache> {
  const url = `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`frankfurter ${res.status}`);
  const json = await res.json();
  const rates: Record<string, number> = json?.rates || {};
  rates[base] = 1;
  return { at: Date.now(), base, rates };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const base = (url.searchParams.get("base") || "EUR").toUpperCase();
    if (!cache || cache.base !== base || Date.now() - cache.at > TTL) {
      cache = await loadRates(base);
    }
    return new Response(
      JSON.stringify({ base: cache.base, rates: cache.rates, updated_at: new Date(cache.at).toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=43200" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
