// Edge function: detect user country via IP geolocation.
// Strategy: Cloudflare CF-IPCountry header (free, instant) → ipapi.co fallback → null.
// Returns: { country: "PT", source: "cloudflare" | "ipapi" | "fallback" }

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Set of country codes we actively support (matches country_settings)
const SUPPORTED = new Set([
  "PT","BR","IN","ES","FR","DE","UK","GB","US","IE","NL","BE","AT","LU","FI","GR","IT","MT","CY",
  "EE","LV","LT","SK","SI","HR","CH","NO","SE","DK","PL","CZ","HU","RO","BG",
  "CA","MX","AR","CL","CO","PE","UY","PY","CR",
  "AU","NZ","JP","SG","HK","MY","TH","PH","ID",
  "AE","SA","ZA",
]);

function normalize(code: string | null | undefined): string | null {
  if (!code) return null;
  let c = code.trim().toUpperCase();
  if (c === "GB") c = "UK"; // Stripe uses GB; we use UK in country_settings
  return SUPPORTED.has(c) ? c : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // 1. Cloudflare header (works automatically when fronted by CF/Lovable)
  const cf = normalize(req.headers.get("cf-ipcountry"));
  if (cf) {
    return new Response(JSON.stringify({ country: cf, source: "cloudflare" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 2. Vercel/other CDN headers
  const vercel = normalize(req.headers.get("x-vercel-ip-country"));
  if (vercel) {
    return new Response(JSON.stringify({ country: vercel, source: "vercel" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. ipapi.co fallback (free tier, no key needed)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
             req.headers.get("x-real-ip") || "";
  if (ip) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(`https://ipapi.co/${ip}/country/`, { signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) {
        const code = normalize((await r.text()).trim());
        if (code) {
          return new Response(JSON.stringify({ country: code, source: "ipapi" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    } catch { /* ignore */ }
  }

  // 4. Fallback (let client use timezone)
  return new Response(JSON.stringify({ country: null, source: "fallback" }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
