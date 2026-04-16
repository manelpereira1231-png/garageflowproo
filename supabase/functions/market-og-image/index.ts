// Generates a dynamic Open Graph image (1200x630 PNG via SVG → no extra deps)
// Path: /functions/v1/market-og-image?listing=<id>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function escapeXml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const listingId = url.searchParams.get("listing");
    if (!listingId) return new Response("missing listing", { status: 400, headers: corsHeaders });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: listing } = await admin
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos, status")
      .eq("id", listingId)
      .maybeSingle();

    if (!listing) return new Response("not found", { status: 404, headers: corsHeaders });

    const { data: report } = await admin
      .from("carity_inspection_reports")
      .select("overall_score, recommendation")
      .eq("listing_id", listingId)
      .maybeSingle();

    const photos = Array.isArray(listing.photos) ? listing.photos as string[] : [];
    const photo = photos[0] || "";

    const title = `${listing.make} ${listing.model}`;
    const subtitle = `${listing.year} · ${Number(listing.mileage).toLocaleString("pt-PT")} km · ${listing.fuel}`;
    const price = `${Number(listing.price).toLocaleString("pt-PT")} €`;
    const score = report ? (Number(report.overall_score) / 10).toFixed(1) : null;

    // SVG fallback (browsers/scrapers like Facebook accept SVG OG as image)
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="overlay" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000" stop-opacity="0.85"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  ${photo ? `<image href="${escapeXml(photo)}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>` : ""}
  <rect width="1200" height="630" fill="url(#overlay)"/>

  <!-- Top brand -->
  <g transform="translate(60, 60)">
    <rect x="0" y="0" width="56" height="56" rx="14" fill="#fbbf24"/>
    <text x="20" y="38" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="800" fill="#0f172a">G</text>
    <text x="80" y="34" font-family="Inter, system-ui, sans-serif" font-size="26" font-weight="800" fill="#fff">GarageFlow</text>
    <text x="80" y="62" font-family="Inter, system-ui, sans-serif" font-size="16" font-weight="600" fill="#fbbf24">MARKET · Inspeção certificada</text>
  </g>

  ${score ? `
  <g transform="translate(940, 60)">
    <rect x="0" y="0" width="200" height="80" rx="14" fill="#10b981" fill-opacity="0.95"/>
    <text x="100" y="36" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="#ecfdf5" text-anchor="middle">CLASSIFICAÇÃO</text>
    <text x="100" y="68" font-family="Inter, system-ui, sans-serif" font-size="32" font-weight="800" fill="#fff" text-anchor="middle">${score}/10</text>
  </g>` : ""}

  <!-- Bottom -->
  <g transform="translate(60, 460)">
    <text x="0" y="0" font-family="Inter, system-ui, sans-serif" font-size="56" font-weight="800" fill="#fff">${escapeXml(title)}</text>
    <text x="0" y="44" font-family="Inter, system-ui, sans-serif" font-size="24" font-weight="500" fill="#cbd5e1">${escapeXml(subtitle)}</text>
    <text x="0" y="120" font-family="Inter, system-ui, sans-serif" font-size="64" font-weight="800" fill="#fbbf24">${escapeXml(price)}</text>
  </g>

  <!-- Trust badges -->
  <g transform="translate(720, 540)">
    <rect x="0" y="0" width="190" height="40" rx="20" fill="#fff" fill-opacity="0.15"/>
    <text x="95" y="26" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">PAGAMENTO PROTEGIDO</text>

    <rect x="200" y="0" width="190" height="40" rx="20" fill="#fff" fill-opacity="0.15"/>
    <text x="295" y="26" font-family="Inter, system-ui, sans-serif" font-size="14" font-weight="700" fill="#fff" text-anchor="middle">CONTRATO DIGITAL</text>
  </g>
</svg>`;

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600, s-maxage=86400",
      },
    });
  } catch (e) {
    return new Response(`error: ${e instanceof Error ? e.message : "unknown"}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
