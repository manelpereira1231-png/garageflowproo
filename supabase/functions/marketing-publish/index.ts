// Marketing Publish — Semi-auto (1-clique URLs + CSV) + hooks para Meta/Google API
// Modos: 'meta_ads_url' | 'google_ads_csv' | 'organic_share_url' | 'meta_api' | 'google_api'
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supa.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: isSuper } = await supa.rpc("is_super_admin", { _user_id: user.id });
    if (!isSuper) return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const action: string = body?.action ?? "";

    if (action === "meta_ads_url") return await metaAdsUrl(supa, user.id, body);
    if (action === "google_ads_csv") return await googleAdsCsv(supa, user.id, body);
    if (action === "organic_share_url") return await organicShareUrl(supa, user.id, body);
    if (action === "meta_api") return await metaApiPublish(supa, user.id, body);
    if (action === "google_api") return await googleApiPublish(supa, user.id, body);
    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

// =========== SEMI-AUTO ===========

// 1) Meta Ads Manager URL pré-preenchido (Facebook + Instagram).
//    Abre o Ads Manager com objetivo + nome de campanha; o resto é colado pelo user.
async function metaAdsUrl(supa: any, userId: string, body: any) {
  const campaignId = body?.campaignId;
  const objective = body?.objective ?? "OUTCOME_LEADS";
  if (!campaignId) return json({ error: "campaignId required" }, 400);

  const { data: c, error } = await supa
    .from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (error || !c) return json({ error: "Campanha não encontrada" }, 404);

  // Meta Ads Manager não aceita criação 100% via URL — abrimos o flow + entregamos copy/imagens.
  const adAccountHint = body?.adAccountId ? `&act=${encodeURIComponent(body.adAccountId)}` : "";
  const url = `https://www.facebook.com/adsmanager/manage/campaigns/new?nav_source=no_referrer${adAccountHint}`;

  const payload = {
    open_url: url,
    objective,
    campaign_name: c.title,
    daily_budget_eur: Math.round((c.monthly_budget_eur ?? 0) / 30),
    headlines: c.headlines ?? [],
    primary_texts: c.descriptions ?? [],
    ctas: c.ctas ?? [],
    targeting_hint: {
      geo: c.geo ?? [],
      audience: c.target_audience ?? {},
      interests: ["car repair", "auto mechanic", "small business owner"],
    },
    instructions: [
      "1. Clica em 'Criar nova campanha' no Ads Manager (link aberto)",
      "2. Escolhe objetivo 'Leads' ou 'Conversões'",
      "3. Cola o nome da campanha sugerido",
      `4. Define orçamento diário ≈ €${Math.round((c.monthly_budget_eur ?? 0) / 30)}`,
      "5. Em segmentação: aplica geo e interesses sugeridos",
      "6. Em criativo: cola os textos (headline + corpo + CTA) e usa as imagens geradas",
      "7. Publica anúncio em Facebook + Instagram simultaneamente",
    ],
  };

  await supa.from("marketing_publish_log").insert({
    campaign_id: campaignId,
    channel: "meta_ads",
    mode: "semi_auto",
    action: "meta_ads_url",
    status: "exported",
    payload,
    user_id: userId,
  });

  return json({ ok: true, ...payload });
}

// 2) Google Ads — CSV pronto para Google Ads Editor (import bulk)
async function googleAdsCsv(supa: any, userId: string, body: any) {
  const campaignId = body?.campaignId;
  if (!campaignId) return json({ error: "campaignId required" }, 400);

  const { data: c, error } = await supa
    .from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (error || !c) return json({ error: "Campanha não encontrada" }, 404);

  const headlines: string[] = (c.headlines ?? []).slice(0, 15);
  const descriptions: string[] = (c.descriptions ?? []).slice(0, 4);
  const keywords: string[] = (c.keywords ?? []).slice(0, 50);
  const dailyBudget = Math.round((c.monthly_budget_eur ?? 0) / 30);

  // CSV Google Ads Editor — formato simplificado (campanha + grupo + RSA + keywords)
  const rows: string[][] = [];
  rows.push(["Campaign", "Campaign Type", "Budget", "Budget type", "Status"]);
  rows.push([c.title, "Search", String(dailyBudget), "Daily", "Paused"]);
  rows.push([]);
  rows.push(["Campaign", "Ad group", "Max CPC", "Status"]);
  rows.push([c.title, "AdGroup-Principal", "1.00", "Enabled"]);
  rows.push([]);
  rows.push(["Campaign", "Ad group", "Keyword", "Match type", "Status"]);
  for (const k of keywords) {
    rows.push([c.title, "AdGroup-Principal", k, "Phrase", "Enabled"]);
  }
  rows.push([]);
  const rsaRow: any[] = [c.title, "AdGroup-Principal", "Responsive search ad"];
  for (let i = 0; i < 15; i++) rsaRow.push(headlines[i] ?? "");
  for (let i = 0; i < 4; i++) rsaRow.push(descriptions[i] ?? "");
  rsaRow.push("https://garageflow-pt.lovable.app", "Enabled");
  const rsaHeader = ["Campaign", "Ad group", "Ad type"];
  for (let i = 1; i <= 15; i++) rsaHeader.push(`Headline ${i}`);
  for (let i = 1; i <= 4; i++) rsaHeader.push(`Description ${i}`);
  rsaHeader.push("Final URL", "Status");
  rows.push(rsaHeader);
  rows.push(rsaRow);

  const csv = rows.map((r) =>
    r.map((cell) => {
      const v = String(cell ?? "");
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(",")
  ).join("\n");

  await supa.from("marketing_publish_log").insert({
    campaign_id: campaignId,
    channel: "google_ads",
    mode: "semi_auto",
    action: "google_ads_csv",
    status: "exported",
    payload: { filename: `${c.title.replace(/[^a-z0-9]/gi, "_")}.csv`, keywords_count: keywords.length },
    user_id: userId,
  });

  return json({
    ok: true,
    filename: `${c.title.replace(/[^a-z0-9]/gi, "_")}.csv`,
    csv,
    instructions: [
      "1. Descarrega o CSV",
      "2. Abre Google Ads Editor (desktop)",
      "3. Account → Import → From File → seleciona este CSV",
      "4. Revê campanha (Paused por defeito) e clica Post",
      "5. Liga conversões via Google Tag (já implementadas no site)",
    ],
  });
}

// 3) Posts orgânicos — share URL Facebook + Instagram (IG não permite via URL, devolvemos copy+imagem)
async function organicShareUrl(supa: any, userId: string, body: any) {
  const postId = body?.postId;
  if (!postId) return json({ error: "postId required" }, 400);

  const { data: p, error } = await supa
    .from("marketing_posts").select("*").eq("id", postId).maybeSingle();
  if (error || !p) return json({ error: "Post não encontrado" }, 404);

  const fullText = [
    p.title ? `${p.title}\n` : "",
    p.body,
    "",
    p.cta ?? "",
    "",
    (p.hashtags ?? []).join(" "),
  ].filter(Boolean).join("\n").trim();

  let openUrl: string | null = null;
  let instructions: string[] = [];

  if (p.channel === "facebook") {
    openUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://garageflow-pt.lovable.app")}&quote=${encodeURIComponent(fullText)}`;
    instructions = [
      "1. O Facebook abre com o texto pré-preenchido",
      "2. Adiciona a imagem (clica em Foto/Vídeo)",
      "3. Publica na página GarageFlow",
    ];
  } else {
    // Instagram não permite share via URL pública. Devolvemos copy + imagem para colar.
    instructions = [
      "1. Copia o texto e hashtags (botão Copiar abaixo)",
      "2. Descarrega a imagem gerada",
      "3. Abre Instagram → Novo Post → cola texto e seleciona imagem",
      "4. Publica no feed ou story conforme o tipo",
    ];
  }

  await supa.from("marketing_publish_log").insert({
    campaign_id: p.campaign_id,
    post_id: postId,
    channel: p.channel,
    mode: "semi_auto",
    action: "organic_share_url",
    status: "exported",
    payload: { open_url: openUrl },
    user_id: userId,
  });

  return json({
    ok: true,
    open_url: openUrl,
    copy_text: fullText,
    image_url: p.image_url,
    channel: p.channel,
    post_type: p.post_type,
    instructions,
  });
}

// =========== API MODE (futuro: requer OAuth Meta + Google Ads aprovados) ===========

async function metaApiPublish(supa: any, userId: string, body: any) {
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  let adAccountId = Deno.env.get("META_AD_ACCOUNT_ID") ?? "";
  const pageId = Deno.env.get("META_PAGE_ID");
  const instagramId = Deno.env.get("META_INSTAGRAM_ID"); // opcional

  if (!accessToken || !adAccountId || !pageId) {
    return json({
      ok: false,
      mode: "api",
      not_configured: true,
      required_secrets: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID", "META_PAGE_ID"],
      message:
        "Para publicar automaticamente no Facebook/Instagram preciso de 3 chaves da Meta. Adiciona-as nos Secrets do projeto.",
      how_to:
        "1) Vai a business.facebook.com → System Users → cria um System User e gera um access token com permissões ads_management + pages_show_list + pages_read_engagement. " +
        "2) Copia o ID da conta de anúncios (Ad Account → Settings → numérico). " +
        "3) Copia o ID da Página de Facebook (Página → About → Page ID).",
      docs: "https://developers.facebook.com/docs/marketing-api/get-started",
    }, 200);
  }

  const campaignId = body?.campaignId;
  if (!campaignId) return json({ error: "campaignId required" }, 400);

  const { data: c, error } = await supa
    .from("marketing_campaigns").select("*").eq("id", campaignId).maybeSingle();
  if (error || !c) return json({ error: "Campanha não encontrada" }, 404);

  // Normaliza ad account id (Meta exige prefixo act_)
  if (!adAccountId.startsWith("act_")) adAccountId = `act_${adAccountId}`;

  const GRAPH = "https://graph.facebook.com/v21.0";
  const objective = body?.objective ?? "OUTCOME_LEADS";
  const dailyBudgetCents = Math.max(100, Math.round((Number(c.monthly_budget_eur ?? 200) / 30) * 100));
  const landing = body?.landingUrl ?? "https://garageflow-pt.lovable.app";
  const headline = (c.headlines?.[0] ?? c.title ?? "GarageFlow").slice(0, 40);
  const primaryText = (c.descriptions?.[0] ?? c.angle ?? "Software para oficinas").slice(0, 240);
  const message = primaryText;

  const log = async (status: string, payload: any) => {
    await supa.from("marketing_publish_log").insert({
      campaign_id: campaignId, channel: "meta_ads", mode: "api",
      action: "meta_api", status, payload, user_id: userId,
    });
  };

  // ===== 0) Gera imagem (AI) e faz upload para storage privada → signed URL longa =====
  let pictureUrl = "https://garageflow-pt.lovable.app/og-image.jpg";
  try {
    if (c.image_url) {
      pictureUrl = c.image_url;
    } else {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (LOVABLE_API_KEY) {
        const imgPrompt = `Anúncio profissional para software de gestão de oficinas auto "GarageFlow". ${c.title}. ${primaryText}. Visual moderno, escuro industrial (charcoal #0F172A + âmbar #F59E0B), mockup dashboard tablet+telemóvel numa oficina real, mecânico a usar app, iluminação cinemática, sem texto sobreposto, formato 1200x628 estilo Facebook/Instagram Ads, fotorrealista premium.`;
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3.1-flash-image-preview",
            prompt: imgPrompt,
            modalities: ["image", "text"],
            messages: [{ role: "user", content: imgPrompt }],
          }),
        });
        if (aiRes.ok) {
          const aiJson = await aiRes.json();
          const b64 = aiJson?.data?.[0]?.b64_json;
          if (b64) {
            const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
            const path = `meta-ads/${campaignId}-${Date.now()}.png`;
            const up = await supa.storage.from("marketing-creatives").upload(path, bytes, {
              contentType: "image/png", upsert: true,
            });
            if (!up.error) {
              const signed = await supa.storage.from("marketing-creatives")
                .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 ano
              if (signed.data?.signedUrl) {
                pictureUrl = signed.data.signedUrl;
                await supa.from("marketing_campaigns")
                  .update({ image_url: pictureUrl }).eq("id", campaignId);
              }
            }
          }
        }
      }
    }
  } catch (_e) { /* fallback para og-image */ }

  try {
    // 1) Campaign (PAUSED — utilizador revê antes de ativar)
    const camp = await post(`${adAccountId}/campaigns`, {
      name: c.title,
      objective,
      status: "PAUSED",
      special_ad_categories: "[]",
      buying_type: "AUCTION",
    });

    // 2) Ad Set — daily budget, targeting básico (geo + idades 25-60)
    const countryCodes = (c.geo ?? ["PT"]).map((g: string) => g.slice(0, 2).toUpperCase()).slice(0, 25);
    const targeting = {
      geo_locations: { countries: countryCodes.length ? countryCodes : ["PT"] },
      age_min: 25, age_max: 60,
      publisher_platforms: instagramId ? ["facebook", "instagram"] : ["facebook"],
    };
    const adset = await post(`${adAccountId}/adsets`, {
      name: `${c.title} — AdSet`,
      campaign_id: camp.id,
      daily_budget: dailyBudgetCents,
      billing_event: "IMPRESSIONS",
      optimization_goal: "LEAD_GENERATION",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      status: "PAUSED",
      start_time: Math.floor(Date.now() / 1000) + 60,
    });

    // 3) Ad Creative (link ad com imagem gerada por IA)
    const objectStorySpec: any = {
      page_id: pageId,
      link_data: {
        link: landing,
        message,
        name: headline,
        description: (c.descriptions?.[1] ?? "").slice(0, 200),
        picture: pictureUrl,
        call_to_action: { type: "LEARN_MORE", value: { link: landing } },
      },
    };
    if (instagramId) objectStorySpec.instagram_actor_id = instagramId;

    const creative = await post(`${adAccountId}/adcreatives`, {
      name: `${c.title} — Creative`,
      object_story_spec: objectStorySpec,
    });


    // 4) Ad
    const ad = await post(`${adAccountId}/ads`, {
      name: `${c.title} — Ad`,
      adset_id: adset.id,
      creative: { creative_id: creative.id },
      status: "PAUSED",
    });

    const manageUrl = `https://business.facebook.com/adsmanager/manage/campaigns?act=${adAccountId.replace("act_", "")}&selected_campaign_ids=${camp.id}`;

    await log("published", {
      campaign_id: camp.id, adset_id: adset.id, creative_id: creative.id, ad_id: ad.id,
      manage_url: manageUrl,
    });

    return json({
      ok: true,
      mode: "api",
      meta_campaign_id: camp.id,
      meta_adset_id: adset.id,
      meta_ad_id: ad.id,
      manage_url: manageUrl,
      status_note: "Campanha criada em modo PAUSED — abre no Ads Manager para rever e ativar.",
    });
  } catch (e: any) {
    await log("failed", { error: e?.message });
    return json({ ok: false, mode: "api", error: e?.message ?? "Falha na Meta API" }, 502);
  }
}

async function googleApiPublish(supa: any, userId: string, body: any) {
  const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
  const refreshToken = Deno.env.get("GOOGLE_ADS_REFRESH_TOKEN");

  if (!devToken || !refreshToken) {
    return json({
      ok: false,
      mode: "api",
      not_configured: true,
      message: "Google Ads API ainda não configurada. Adiciona GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_CUSTOMER_ID nos secrets quando tiveres developer token aprovado. Por agora, usa o CSV.",
      docs: "https://developers.google.com/google-ads/api/docs/start",
    }, 200);
  }

  await supa.from("marketing_publish_log").insert({
    campaign_id: body?.campaignId ?? null,
    channel: "google_ads",
    mode: "api",
    action: "google_api",
    status: "pending",
    payload: body,
    user_id: userId,
  });

  return json({
    ok: false,
    mode: "api",
    message: "Google Ads API integração em desenvolvimento. Use CSV export.",
  }, 501);
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
