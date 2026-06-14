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
  const adAccountId = Deno.env.get("META_AD_ACCOUNT_ID");

  if (!accessToken || !adAccountId) {
    return json({
      ok: false,
      mode: "api",
      not_configured: true,
      message: "Meta API ainda não configurada. Adiciona META_ACCESS_TOKEN e META_AD_ACCOUNT_ID nos secrets quando tiveres a tua Meta Business app aprovada. Por agora, usa o modo semi-automático ('meta_ads_url').",
      docs: "https://developers.facebook.com/docs/marketing-apis/",
    }, 200);
  }

  // Stub para implementação futura: criar campanha via Marketing API
  // POST https://graph.facebook.com/v21.0/{ad_account_id}/campaigns
  await supa.from("marketing_publish_log").insert({
    campaign_id: body?.campaignId ?? null,
    channel: "meta_ads",
    mode: "api",
    action: "meta_api",
    status: "pending",
    payload: body,
    user_id: userId,
  });

  return json({
    ok: false,
    mode: "api",
    message: "Meta API integração em desenvolvimento. Use modo semi-automático.",
  }, 501);
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
