// Gera criativos visuais (imagens) para Autopiloto de Marketing
// Usa Lovable AI Gateway /v1/images/generations (openai/gpt-image-2)
// Faz upload para storage bucket "marketing-creatives" e devolve URL assinada
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const STYLE_BASE = `Estilo OBRIGATÓRIO: fotografia realista de alta qualidade, B2B profissional moderno (SaaS enterprise),
iluminação natural, paleta industrial sóbria (charcoal, âmbar, cinza escuro). Nada de cartoon, ilustração,
estética genérica de stock, gradientes neon, ou pessoas a posar artificialmente. Foco em oficinas auto modernas
e organizadas. Câmara: lente 35mm, profundidade de campo subtil. Sem texto sobreposto na imagem (o texto é adicionado depois no copy).`;

const CREATIVE_TEMPLATES: Record<string, string> = {
  dashboard_overlay: `Plano fechado de um tablet ou laptop apoiado numa bancada de oficina mecânica real, mostrando um dashboard limpo de software de gestão (gráficos de barras, lista de ordens de serviço, contadores). Fundo desfocado com ferramentas e elevador hidráulico. ${STYLE_BASE}`,

  mechanic_tablet: `Mecânico profissional (uniforme escuro, fato de macaco prático) a segurar um tablet robusto numa oficina iluminada, a consultar informação técnica. Carro em elevador hidráulico ao fundo. Expressão concentrada, profissional, sem sorriso forçado. ${STYLE_BASE}`,

  modern_shop: `Vista panorâmica de uma oficina mecânica moderna e organizada: piso impecável, ferramentas arrumadas em painéis, dois elevadores hidráulicos com carros recentes, ecrãs de gestão visíveis na receção. Luz natural. ${STYLE_BASE}`,

  growth_chart: `Plano fechado de um ecrã de computador numa secretária de gestor de oficina, mostrando gráficos de crescimento mensal de receita e KPIs (MRR, clientes, tempo médio de serviço) num dashboard limpo. Caneca de café e bloco de notas ao lado. ${STYLE_BASE}`,

  before_after: `Composição split-screen lado a lado: lado esquerdo mostra uma oficina caótica com papéis espalhados, ferramentas desorganizadas, fichas em papel; lado direito mostra a mesma oficina limpa, organizada, com tablet e ecrã digital. Mesma perspetiva, mesma iluminação. ${STYLE_BASE}`,

  team_meeting: `Pequena equipa de 3 mecânicos e um gestor reunidos à volta de um tablet numa zona de receção de oficina, a rever o planeamento do dia. Expressões profissionais, ambiente focado. ${STYLE_BASE}`,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supa.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isSuper } = await supa.rpc("is_super_admin", { _user_id: user.id });
    if (!isSuper) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const creativeType: string = body?.creativeType ?? "modern_shop";
    const campaignId: string | null = body?.campaignId ?? null;
    const customPrompt: string | undefined = body?.customPrompt;
    const sizeIn: string = body?.size ?? "1536x1024";
    const qualityIn: string = body?.quality ?? "high";
    const tier: string = body?.tier ?? "premium"; // "fast" | "premium"

    const ALLOWED_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536"]);
    const size = ALLOWED_SIZES.has(sizeIn) ? sizeIn : "1536x1024";
    const quality = ["low", "medium", "high"].includes(qualityIn) ? qualityIn : "high";
    const model = tier === "fast" ? "openai/gpt-image-1-mini" : "openai/gpt-image-2";

    const basePrompt = CREATIVE_TEMPLATES[creativeType] ?? CREATIVE_TEMPLATES.modern_shop;
    const finalPrompt = customPrompt
      ? `${customPrompt}\n\n${STYLE_BASE}`
      : basePrompt;

    // Inserir registo "generating"
    const { data: created, error: insErr } = await supa.from("marketing_creatives").insert({
      generated_by: user.id,
      campaign_id: campaignId,
      creative_type: creativeType,
      prompt: finalPrompt,
      status: "generating",
      ai_model: model,
    }).select().single();

    if (insErr || !created) return json({ error: insErr?.message ?? "DB error" }, 500);

    // Chamar AI Gateway — non-streaming (esperamos imagem final)
    const imgResp = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({ model, prompt: finalPrompt, quality, size, n: 1 }),
    });

    if (!imgResp.ok) {
      const errText = await imgResp.text();
      await supa.from("marketing_creatives").update({
        status: "failed",
        error: `${imgResp.status} ${errText.slice(0, 500)}`,
      }).eq("id", created.id);

      if (imgResp.status === 429) return json({ error: "Rate limit. Tenta daqui a pouco." }, 429);
      if (imgResp.status === 402) return json({ error: "Créditos esgotados. Adiciona créditos no workspace." }, 402);
      return json({ error: `AI Gateway erro ${imgResp.status}: ${errText.slice(0,200)}` }, 502);
    }

    const imgJson = await imgResp.json();
    const b64 = imgJson?.data?.[0]?.b64_json;
    if (!b64) {
      await supa.from("marketing_creatives").update({ status: "failed", error: "Sem b64_json" }).eq("id", created.id);
      return json({ error: "IA não devolveu imagem" }, 502);
    }

    // Decode base64 → bytes → upload
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const storagePath = `${user.id}/${created.id}.png`;
    const { error: upErr } = await supa.storage
      .from("marketing-creatives")
      .upload(storagePath, bytes, { contentType: "image/png", upsert: true });

    if (upErr) {
      await supa.from("marketing_creatives").update({ status: "failed", error: upErr.message }).eq("id", created.id);
      return json({ error: `Upload falhou: ${upErr.message}` }, 500);
    }

    // URL assinada (1 ano) — bucket é privado
    const { data: signed } = await supa.storage
      .from("marketing-creatives")
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    await supa.from("marketing_creatives").update({
      status: "ready",
      storage_path: storagePath,
      image_url: signed?.signedUrl ?? null,
    }).eq("id", created.id);

    return json({
      ok: true,
      creative: {
        ...created,
        status: "ready",
        storage_path: storagePath,
        image_url: signed?.signedUrl ?? null,
      },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
