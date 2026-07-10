// Translate a listing's title + description into a target language using
// Lovable AI Gateway. Cached in `carity_listing_translations`.
// POST { listing_id, target_language }  -> { title, description, source_language, cached }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPPORTED = new Set(["pt", "pt-BR", "en", "es", "fr", "de", "it", "hi"]);
const MODEL = "google/gemini-2.5-flash-lite";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { listing_id, target_language } = await req.json().catch(() => ({}));
    if (!listing_id || !target_language || !SUPPORTED.has(String(target_language))) {
      return new Response(JSON.stringify({ error: "invalid_params" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const target = String(target_language);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "missing_lovable_api_key" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE);

    // 1) Cache lookup
    const { data: cached } = await admin
      .from("carity_listing_translations")
      .select("title, description, source_language, updated_at")
      .eq("listing_id", listing_id).eq("language", target).maybeSingle();
    if (cached?.title || cached?.description) {
      return new Response(JSON.stringify({ ...cached, cached: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Fetch source
    const { data: listing, error } = await admin
      .from("carity_listings")
      .select("title, description, country_code")
      .eq("id", listing_id).maybeSingle();
    if (error || !listing) {
      return new Response(JSON.stringify({ error: "listing_not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const source = (listing.title || "") + "\n---\n" + (listing.description || "");
    if (!source.trim()) {
      return new Response(JSON.stringify({ title: listing.title, description: listing.description, cached: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Call Lovable AI Gateway
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Lovable-API-Key": LOVABLE_API_KEY,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: "You translate car marketplace listings. Keep numbers, units, model/trim names, and technical terms intact. Output STRICT JSON only: {\"title\": string, \"description\": string, \"source_language\": string (ISO code)}. No markdown, no commentary." },
          { role: "user", content: `Translate to ${target}. Original listing:\n\nTITLE: ${listing.title || ""}\n\nDESCRIPTION:\n${listing.description || ""}` },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!aiRes.ok) {
      const body = await aiRes.text();
      return new Response(JSON.stringify({ error: "ai_gateway_error", status: aiRes.status, details: body }), {
        status: aiRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiJson = await aiRes.json();
    const raw = aiJson?.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const out = {
      title: parsed.title || listing.title,
      description: parsed.description || listing.description,
      source_language: parsed.source_language || null,
    };

    // 4) Cache
    await admin.from("carity_listing_translations").upsert({
      listing_id, language: target,
      title: out.title, description: out.description, source_language: out.source_language,
    }, { onConflict: "listing_id,language" });

    return new Response(JSON.stringify({ ...out, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
