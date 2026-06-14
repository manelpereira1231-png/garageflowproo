// Autopiloto de Marketing — IA ESPECIALIZADA em oficinas mecânicas
// Gera campanhas + posts + otimizações com few-shot examples concretos.
// 100% via Lovable AI Gateway. Super admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MODEL = "google/gemini-2.5-flash"; // Mais estável p/ JSON estruturado que o preview

// ============ KNOWLEDGE BASE ESPECIALIZADO ============
const PRODUCT_CONTEXT = `
PRODUTO: GarageFlow — SaaS de gestão para oficinas mecânicas (PT, BR, ES).
PÚBLICO ALVO: Dono de oficina auto independente (1-15 mecânicos). 35-60 anos. Pouca paciência para tecnologia complicada. Decide sozinho ou com sócio. Compra quando vê retorno em € poupados ou clientes recuperados.

PLANOS REAIS:
- Starter €19/mês — 1 utilizador, funcionalidades base
- Pro €39/mês — até 3 utilizadores, faturação + SAF-T
- Garage €99/mês — multi-oficina, equipas, inventário avançado
- Enterprise €299/mês — API, white-label
Trial: 14 dias grátis sem cartão.

FUNCIONALIDADES REAIS (proibido inventar outras):
- Clientes + viaturas (passport digital, histórico anti-fraude)
- Orçamentos com aceitação digital assinada (poupa deslocações)
- Ordens de serviço em modo workshop mobile-first
- Faturação + SAF-T PT (não certificado, divulgado claramente)
- Inventário + alertas de stock baixo
- Agendamento online público (clientes marcam sozinhos)
- Lembretes automáticos (IPO, revisão, óleo) → clientes voltam
- AI Service Advisor — sugere serviços/cross-sell
- Multi-oficina (Garage+) + equipas com permissões
- Inspeções digitais com checklists fotográficos (para o cliente)
- PWA offline
- Stripe para subscrições

DORES CONCRETAS (usar tal e qual nos angles, não reformular abstratamente):
- "Perdi outra ficha em papel"
- "Esqueci-me de avisar o cliente da revisão e foi à concorrência"
- "Demoro 3 horas todos os dias a fazer faturas"
- "Tenho peças paradas há 8 meses no armazém"
- "Não sei se ganho ou perco dinheiro neste mês"
- "Cliente disse que não autorizou o trabalho"

ANGLES VENCEDORES (referência — variar sempre):
- "Faz a tua fatura em 30 segundos"
- "O cliente assina o orçamento no telemóvel — fica sem desculpa"
- "Lembretes automáticos fizeram a oficina X recuperar 40 clientes em 3 meses"
- "Sabes quanto vale a peça que está há 1 ano na prateleira?"

TOM:
- Direto, prático, B2B PT-PT ou PT-BR. Tutear ("a tua oficina"), não vossear.
- Verbos de ação primeiro. Frases curtas.
- Nunca "revolucionário", "disruptivo", "10x", "alavancar".
- Nunca termos consumer ("amigos", "diversão", "incrível").
- Mencionar € e tempo poupado sempre que possível.

BENCHMARKS REAIS (PT, oficinas):
- CPC Google Ads: 0.40 – 1.20 €
- CTR Search: 2 – 5%
- CPL (lead qualificado): 12 – 25 €
- Conversão trial→pago: 12 – 22%
- CAC realista: 90 – 140 €
- Churn: 4 – 6% mensal
`;

// ============ HELPERS ============
function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJSON(text: string): any {
  if (!text) throw new Error("Resposta da IA vazia");
  // Remove fences markdown
  let cleaned = text.replace(/```json\s*|```\s*/gi, "").trim();
  // Tenta parse directo
  try { return JSON.parse(cleaned); } catch {}
  // Fallback: extrai primeiro { ... } válido
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error(`IA devolveu texto não-JSON: ${cleaned.slice(0, 200)}`);
  }
  return JSON.parse(cleaned.slice(first, last + 1));
}

async function callAI(systemPrompt: string, userPrompt: string, temperature = 0.7) {
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature,
      response_format: { type: "json_object" },
    }),
  });

  if (r.status === 429) throw new HttpError(429, "Rate limit da IA. Tenta daqui a 1 minuto.");
  if (r.status === 402) throw new HttpError(402, "Créditos de IA esgotados. Adiciona créditos no workspace.");
  if (!r.ok) {
    const errText = await r.text().catch(() => "");
    console.error("AI Gateway erro", r.status, errText.slice(0, 500));
    throw new HttpError(502, `IA Gateway erro ${r.status}: ${errText.slice(0, 200)}`);
  }
  const raw = await r.json();
  const txt = raw?.choices?.[0]?.message?.content ?? "";
  console.log("AI raw length:", txt.length);
  try {
    return extractJSON(txt);
  } catch (e: any) {
    console.error("Parse falhou. Conteúdo:", txt.slice(0, 800));
    throw new HttpError(502, `IA devolveu formato inválido. ${e?.message ?? ""}`);
  }
}

class HttpError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

// ============ ENTRY ============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Não autenticado" }, 401);

    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: userData } = await supa.auth.getUser(token);
    const user = userData?.user;
    if (!user) return json({ error: "Sessão inválida" }, 401);

    const { data: isSuper } = await supa.rpc("is_super_admin", { _user_id: user.id });
    if (!isSuper) return json({ error: "Acesso restrito a super admin" }, 403);

    const body = await req.json().catch(() => ({}));
    const action = body?.action ?? "generate";
    console.log("action:", action, "by:", user.id);

    if (action === "generate") return await generateCampaigns(supa, user.id, body);
    if (action === "optimize") return await optimizeCampaign(supa, user.id, body);
    if (action === "generate_posts") return await generateOrganicPosts(supa, user.id, body);
    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e: any) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error("Erro interno:", e);
    return json({ error: e?.message ?? "Erro interno" }, 500);
  }
});

// ============ GENERATE CAMPAIGNS ============
async function generateCampaigns(supa: any, userId: string, body: any) {
  const market = body?.market ?? "Portugal";
  const monthlyBudget = Number(body?.monthlyBudgetEur ?? 200);
  const numCampaigns = Math.min(6, Math.max(2, Number(body?.count ?? 3)));

  const example = `{
  "campaigns": [
    {
      "title": "Faturação sem horas perdidas",
      "strategy": "Poupar tempo administrativo",
      "angle": "Fatura em 30s — e dorme cedo",
      "target_audience": {
        "profile": "Dono de oficina 40-60 anos que ainda usa Excel ou papel para faturar",
        "painPoints": ["Demoro 3 horas por dia em faturas", "SAF-T dá-me dores de cabeça"],
        "goals": ["Fechar oficina às 19h, não às 22h"],
        "objections": ["Já tenho um sistema antigo", "Vai dar trabalho mudar"]
      },
      "channels": ["google_ads"],
      "keywords": ["software faturação oficina", "programa faturas mecanica", "saf-t oficina auto", "gestão oficina mecanica portugal"],
      "geo": ["Lisboa", "Porto", "Braga", "Setúbal"],
      "headlines": ["Faturas em 30 segundos", "SAF-T sem dores", "Software p/ oficinas", "Trial 14 dias grátis", "Sem cartão para testar"],
      "descriptions": ["Faz orçamento e factura no telemóvel. Cliente assina digital.", "SAF-T pronto em 1 clique. Compatível com contabilidade.", "Pensado para oficinas portuguesas. Tenta 14 dias grátis.", "Mais de 200 oficinas já organizaram a gestão com GarageFlow."],
      "ctas": ["Testar 14 dias grátis", "Ver demo de 2 minutos", "Falar com a equipa"],
      "ab_variants": [
        {"name":"A — tempo","headline":"Faturas em 30 segundos","description":"Sem papel, sem Excel.","cta":"Testar grátis"},
        {"name":"B — dor SAF-T","headline":"SAF-T sem complicar","description":"Exporta em 1 clique.","cta":"Ver como"},
        {"name":"C — prova","headline":"200+ oficinas confiam","description":"Trial 14 dias, sem cartão.","cta":"Começar"}
      ],
      "forecast": { "ctrPct": 3.2, "cpcEur": 0.75, "cplEur": 18, "conversionPct": 16, "cacEur": 112, "roiPct": 145, "monthlyLeads": 11, "monthlyPayingCustomers": 1.8, "notes": "Conservador. CPL baixo possível se Quality Score >7." }
    }
  ]
}`;

  const userPrompt = `${PRODUCT_CONTEXT}

TAREFA: Gera ${numCampaigns} campanhas DISTINTAS para ${market}, orçamento ${monthlyBudget}€/mês.

Cada campanha foca UMA dor diferente — nunca duplicar angle ou strategy.

REGRAS DURAS:
1. Headlines Google Ads: máx 30 chars cada.
2. Descriptions: máx 90 chars cada.
3. Forecast realista (CTR 2-5%, CPC 0.4-1.2€ ${market === "Portugal" ? "PT" : market}, CPL 12-25€, conv trial→pago 12-22%, CAC 90-140€).
4. Keywords reais que oficinas pesquisam (não inventar termos académicos).
5. Português ${market === "Brasil" ? "PT-BR" : market === "Espanha" ? "ES" : "PT-PT"}.
6. Angles concretos (€, tempo, clientes recuperados) — nunca abstrato.
7. Nunca prometer "10x", "duplicar", "revolucionar".

EXEMPLO de UMA campanha bem feita (estrutura obrigatória, copia o formato):
${example}

Devolve JSON válido com ${numCampaigns} campanhas distintas. Sem markdown, sem comentários.`;

  const parsed = await callAI(
    "És growth marketer sénior B2B SaaS especialista em oficinas mecânicas em Portugal e Brasil. Respondes APENAS com JSON válido, sem markdown nem texto fora do JSON.",
    userPrompt,
    0.75,
  );

  const campaigns = Array.isArray(parsed.campaigns) ? parsed.campaigns : [];
  if (campaigns.length === 0) throw new HttpError(502, "IA não gerou campanhas — tenta de novo.");

  const rows = campaigns.map((c: any) => ({
    generated_by: userId,
    title: String(c.title ?? "Campanha").slice(0, 200),
    strategy: String(c.strategy ?? "—").slice(0, 200),
    angle: c.angle ?? null,
    target_audience: c.target_audience ?? {},
    channels: Array.isArray(c.channels) ? c.channels : ["google_ads"],
    keywords: Array.isArray(c.keywords) ? c.keywords : [],
    geo: Array.isArray(c.geo) && c.geo.length > 0 ? c.geo : [market],
    headlines: Array.isArray(c.headlines) ? c.headlines.map((h: string) => String(h).slice(0, 30)) : [],
    descriptions: Array.isArray(c.descriptions) ? c.descriptions.map((d: string) => String(d).slice(0, 90)) : [],
    ctas: Array.isArray(c.ctas) ? c.ctas : [],
    ab_variants: c.ab_variants ?? [],
    forecast: c.forecast ?? null,
    market,
    monthly_budget_eur: monthlyBudget,
    status: "draft",
    ai_model: MODEL,
  }));

  const { data: inserted, error } = await supa.from("marketing_campaigns").insert(rows).select();
  if (error) throw new HttpError(500, `BD: ${error.message}`);
  return json({ ok: true, campaigns: inserted });
}

// ============ OPTIMIZE ============
async function optimizeCampaign(supa: any, userId: string, body: any) {
  const campaignId = body?.campaignId;
  if (!campaignId) throw new HttpError(400, "campaignId obrigatório");

  const { data: campaign, error: cErr } = await supa
    .from("marketing_campaigns").select("*").eq("id", campaignId).single();
  if (cErr || !campaign) throw new HttpError(404, "Campanha não encontrada");

  const { count: iterCount } = await supa
    .from("marketing_optimizations").select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  const iteration = (iterCount ?? 0) + 1;

  const userPrompt = `${PRODUCT_CONTEXT}

TAREFA: Iteração #${iteration} desta campanha. Analisa pontos fracos (copy genérico, headlines fracas, keywords óbvias, forecast otimista) e propõe melhorias CONCRETAS.

CAMPANHA ATUAL:
${JSON.stringify({
  title: campaign.title, strategy: campaign.strategy, angle: campaign.angle,
  headlines: campaign.headlines, descriptions: campaign.descriptions,
  keywords: campaign.keywords, ctas: campaign.ctas, forecast: campaign.forecast,
}, null, 2)}

Regras:
- Headlines ≤ 30 chars, Descriptions ≤ 90 chars.
- Cada iteração deve mudar substancialmente — não cosmético.
- Forecast realista (não inflar ROI).

Devolve JSON puro:
{
  "reasoning": "1-2 frases concretas do que mudou e porquê",
  "changes": {
    "headlines": ["..."],
    "descriptions": ["..."],
    "ctas": ["..."],
    "keywords": ["..."],
    "ab_variants": [{"name":"...","headline":"...","description":"...","cta":"..."}]
  },
  "simulated_metrics": {
    "ctrPct": 0, "cpcEur": 0, "cplEur": 0, "conversionPct": 0,
    "cacEur": 0, "roiPct": 0, "expectedUpliftPct": 0, "notes": "..."
  }
}`;

  const parsed = await callAI(
    "És growth optimizer sénior. Mudanças concretas, mensuráveis. JSON puro sem markdown.",
    userPrompt,
    0.6,
  );

  await supa.from("marketing_optimizations").insert({
    campaign_id: campaignId,
    performed_by: userId,
    iteration,
    changes: parsed.changes ?? {},
    reasoning: parsed.reasoning ?? null,
    simulated_metrics: parsed.simulated_metrics ?? null,
  });

  const updatePayload: any = {};
  if (Array.isArray(parsed.changes?.headlines)) updatePayload.headlines = parsed.changes.headlines.map((h: string) => String(h).slice(0, 30));
  if (Array.isArray(parsed.changes?.descriptions)) updatePayload.descriptions = parsed.changes.descriptions.map((d: string) => String(d).slice(0, 90));
  if (Array.isArray(parsed.changes?.ctas)) updatePayload.ctas = parsed.changes.ctas;
  if (Array.isArray(parsed.changes?.keywords)) updatePayload.keywords = parsed.changes.keywords;
  if (Array.isArray(parsed.changes?.ab_variants)) updatePayload.ab_variants = parsed.changes.ab_variants;
  if (parsed.simulated_metrics) updatePayload.forecast = parsed.simulated_metrics;

  if (Object.keys(updatePayload).length > 0) {
    await supa.from("marketing_campaigns").update(updatePayload).eq("id", campaignId);
  }

  return json({ ok: true, iteration, reasoning: parsed.reasoning, simulated_metrics: parsed.simulated_metrics });
}

// ============ POSTS ORGÂNICOS ============
async function generateOrganicPosts(supa: any, userId: string, body: any) {
  const market = body?.market ?? "Portugal";
  const weeks = Math.min(Math.max(Number(body?.weeks ?? 4), 1), 12);
  const postsPerWeek = Math.min(Math.max(Number(body?.postsPerWeek ?? 3), 1), 7);
  const channels: string[] = Array.isArray(body?.channels) && body.channels.length > 0
    ? body.channels : ["facebook", "instagram"];
  const campaignId = body?.campaignId ?? null;
  const startDate = body?.startDate ? new Date(body.startDate) : new Date();
  const total = weeks * postsPerWeek;

  const userPrompt = `${PRODUCT_CONTEXT}

Gera ${total} posts orgânicos (${postsPerWeek}/semana × ${weeks} semanas) para ${channels.join(", ")} no mercado ${market}.

MIX:
- 40% educativos (dica prática para dono de oficina)
- 30% prova social / story de oficina real
- 20% UMA funcionalidade GarageFlow em ação
- 10% promo (trial 14 dias)

Regras:
- Body 80-220 chars Instagram, até 400 Facebook.
- 5-8 hashtags PT relevantes (#oficinaauto #mecanica #gestaooficina).
- CTA claro e específico.
- image_prompt: descrição EN curta para gerador de imagem (fotorrealista, oficina real, sem texto).
- Variar formato: feed, story, reel, carousel.
- Nunca inventar features.

Devolve JSON puro:
{
  "posts": [
    {
      "channel": "facebook" | "instagram" | "instagram_story",
      "post_type": "feed" | "story" | "reel" | "carousel",
      "title": "...",
      "body": "...",
      "hashtags": ["..."],
      "cta": "...",
      "image_prompt": "...",
      "day_offset": 0,
      "category": "educational" | "social_proof" | "feature" | "promo"
    }
  ]
}`;

  const parsed = await callAI(
    "És social media manager B2B SaaS sénior especialista em oficinas mecânicas. JSON puro.",
    userPrompt,
    0.85,
  );

  const posts = Array.isArray(parsed.posts) ? parsed.posts : [];
  if (posts.length === 0) throw new HttpError(502, "IA não gerou posts");

  const stepDays = Math.max(1, Math.floor(7 / postsPerWeek));
  const rows = posts.map((p: any, idx: number) => {
    const offset = typeof p.day_offset === "number" ? p.day_offset : idx * stepDays;
    const scheduled = new Date(startDate.getTime() + offset * 86400000);
    scheduled.setHours(10, 0, 0, 0);
    return {
      campaign_id: campaignId,
      channel: channels.includes(p.channel) ? p.channel : channels[0],
      post_type: ["feed", "story", "reel", "carousel"].includes(p.post_type) ? p.post_type : "feed",
      title: p.title ?? null,
      body: String(p.body ?? "").slice(0, 2000),
      hashtags: Array.isArray(p.hashtags) ? p.hashtags : [],
      cta: p.cta ?? null,
      image_prompt: p.image_prompt ?? null,
      scheduled_for: scheduled.toISOString(),
      status: "draft",
      metadata: { category: p.category ?? "educational", generated_by: userId },
    };
  });

  const { data: inserted, error } = await supa.from("marketing_posts").insert(rows).select();
  if (error) throw new HttpError(500, `BD: ${error.message}`);
  return json({ ok: true, count: inserted?.length ?? 0, posts: inserted });
}
