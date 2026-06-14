// Autopiloto de Marketing — gera campanhas completas + targeting + forecast + A/B
// 100% IA via Lovable AI Gateway. Super admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Conhecimento real e fixo do produto GarageFlow — a IA NÃO pode inventar features
const PRODUCT_CONTEXT = `
PRODUTO: GarageFlow — SaaS de gestão para oficinas mecânicas (PT/BR/ES).
PÚBLICO: Oficinas auto independentes (1-15 mecânicos), gestores e proprietários.
PLANOS REAIS: Starter €19/mês · Pro €39/mês · Garage €99/mês · Enterprise €299/mês. Trial 14 dias grátis.

FUNCIONALIDADES REAIS (NÃO INVENTAR OUTRAS):
- Gestão de clientes e viaturas (passport digital com histórico anti-fraude)
- Orçamentos com aceitação digital assinada
- Ordens de serviço com workshop mode mobile-first
- Faturação e SAF-T (PT, não certificado)
- Inventário e gestão de stock + alertas de stock baixo
- Agendamento online (portal público de marcações)
- Lembretes inteligentes (revisões, IPO, mudança de óleo)
- AI Service Advisor — assistente IA para diagnóstico e cross-sell
- Multi-oficina (plano Garage+) e equipas com permissões
- Inspeções digitais com checklists fotográficos
- PWA com modo offline
- Integração Stripe para subscrições
- Painel financeiro e analytics
- Carity / Market integrado (venda de viaturas usadas com escrow)

DORES REAIS DOS CLIENTES (usar nos angles):
- Caos com papel/Excel — perdem orçamentos e fichas de cliente
- Esquecem revisões → perdem clientes recorrentes
- Demoram horas a fazer faturas e SAF-T manualmente
- Não controlam o stock — peças paradas valem dinheiro
- Não sabem quanto ganham realmente por hora de oficina
- Dificuldade em provar trabalho feito ao cliente desconfiado

TOM: Prático, direto, B2B PT-PT/PT-BR profissional. Sem hype, sem "revolucionário". Foco em poupar tempo, ganhar dinheiro e organizar oficina.

PROIBIDO mencionar:
- Funcionalidades não listadas acima
- Promessas exageradas (ex: "10x mais clientes", "duplique o lucro")
- IA mágica ou "blockchain"
- Termos consumer ("amigos", "diversão")
`;

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
    const action = body?.action ?? "generate";

    if (action === "generate") {
      return await generateCampaigns(supa, user.id, body);
    }
    if (action === "optimize") {
      return await optimizeCampaign(supa, user.id, body);
    }
    if (action === "generate_posts") {
      return await generateOrganicPosts(supa, user.id, body);
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e: any) {
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

// ============ GENERATE CAMPAIGNS ============
async function generateCampaigns(supa: any, userId: string, body: any) {
  const market = body?.market ?? "Portugal";
  const monthlyBudget = Number(body?.monthlyBudgetEur ?? 500);
  const numCampaigns = Math.min(6, Math.max(3, Number(body?.count ?? 3)));

  const prompt = `${PRODUCT_CONTEXT}

TAREFA: Gera ${numCampaigns} campanhas de marketing COMPLETAMENTE distintas para ${market}, orçamento ${monthlyBudget}€/mês.

Cada campanha deve ter:
- strategy: tema-mãe (ex: "Eficiência operacional", "Poupar horas com faturação", "Crescer com cliente recorrente", "Stock sob controlo", "Modernização digital", "Conformidade fiscal sem dor")
- angle: gancho de marketing único (1 frase)
- target_audience: { profile, painPoints[], goals[], objections[] }
- channels: array com pelo menos um de ["google_ads","meta_ads"]
- keywords: 8-15 keywords reais que oficinas pesquisariam (PT-PT/PT-BR conforme mercado)
- geo: lista de cidades/regiões alvo
- headlines: 5 headlines (máx 30 caracteres cada, formato Google Ads RSA)
- descriptions: 4 descrições (máx 90 caracteres cada)
- ctas: 3 CTAs distintos
- ab_variants: 3 variações estruturadas { name, headline, description, cta } para A/B testing
- forecast: { ctrPct, cpcEur, cplEur, conversionPct, cacEur, roiPct, monthlyLeads, monthlyPayingCustomers, notes } — baseado em benchmarks REAIS SaaS B2B oficinas ${market} (CTR 2-5%, CPC PT 0.4-1.2€, CPL 12-25€, conv trial→pago 12-22%)

REGRAS CRÍTICAS:
- NUNCA inventar funcionalidades fora da lista acima
- Headlines/descrições em PT-PT (se Portugal) ou PT-BR (se Brasil) ou ES (se Espanha)
- Forecast realista e conservador (ver memória de previsões)
- Cada campanha com strategy/angle DISTINTOS — nunca duplicar

Devolve EXATAMENTE este JSON (sem markdown, sem prefixos):
{
  "campaigns": [
    {
      "title": "...",
      "strategy": "...",
      "angle": "...",
      "target_audience": { ... },
      "channels": [...],
      "keywords": [...],
      "geo": [...],
      "headlines": [...],
      "descriptions": [...],
      "ctas": [...],
      "ab_variants": [...],
      "forecast": { ... }
    }
  ]
}`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "És growth marketer sénior B2B SaaS. Respondes APENAS com JSON válido. Sem markdown." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (r.status === 429) return json({ error: "Rate limit. Tenta daqui a pouco." }, 429);
  if (r.status === 402) return json({ error: "Créditos esgotados." }, 402);
  if (!r.ok) return json({ error: `AI Gateway erro ${r.status}` }, 502);

  const raw = await r.json();
  let parsed: any;
  try {
    const txt = raw.choices?.[0]?.message?.content ?? "{}";
    parsed = JSON.parse(txt.replace(/```json\n?|```/g, "").trim());
  } catch {
    return json({ error: "IA devolveu JSON inválido" }, 502);
  }

  const campaigns = Array.isArray(parsed.campaigns) ? parsed.campaigns : [];
  if (campaigns.length === 0) return json({ error: "IA não gerou campanhas" }, 502);

  const rows = campaigns.map((c: any) => ({
    generated_by: userId,
    title: String(c.title ?? "Campanha sem título").slice(0, 200),
    strategy: String(c.strategy ?? "—").slice(0, 200),
    angle: c.angle ?? null,
    target_audience: c.target_audience ?? {},
    channels: Array.isArray(c.channels) ? c.channels : [],
    keywords: Array.isArray(c.keywords) ? c.keywords : [],
    geo: Array.isArray(c.geo) && c.geo.length > 0 ? c.geo : [market],
    headlines: Array.isArray(c.headlines) ? c.headlines : [],
    descriptions: Array.isArray(c.descriptions) ? c.descriptions : [],
    ctas: Array.isArray(c.ctas) ? c.ctas : [],
    ab_variants: c.ab_variants ?? [],
    forecast: c.forecast ?? null,
    market,
    monthly_budget_eur: monthlyBudget,
    status: "draft",
    ai_model: "google/gemini-3-flash-preview",
  }));

  const { data: inserted, error } = await supa.from("marketing_campaigns").insert(rows).select();
  if (error) return json({ error: error.message }, 500);

  return json({ ok: true, campaigns: inserted });
}

// ============ OPTIMIZE EXISTING CAMPAIGN ============
async function optimizeCampaign(supa: any, userId: string, body: any) {
  const campaignId = body?.campaignId;
  if (!campaignId) return json({ error: "campaignId required" }, 400);

  const { data: campaign, error: cErr } = await supa
    .from("marketing_campaigns").select("*").eq("id", campaignId).single();
  if (cErr || !campaign) return json({ error: "Campanha não encontrada" }, 404);

  const { count: iterCount } = await supa
    .from("marketing_optimizations").select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);
  const iteration = (iterCount ?? 0) + 1;

  const prompt = `${PRODUCT_CONTEXT}

TAREFA: Otimiza a campanha abaixo. Analisa pontos fracos no copy/targeting/forecast e propõe uma versão melhorada.

CAMPANHA ATUAL:
${JSON.stringify(campaign, null, 2)}

ITERAÇÃO: #${iteration}

Devolve EXATAMENTE este JSON (sem markdown):
{
  "reasoning": "racional curto (2-3 frases) do que mudou e porquê",
  "changes": {
    "headlines": [...nova lista],
    "descriptions": [...],
    "ctas": [...],
    "keywords": [...se mudou],
    "ab_variants": [...3 novas variantes]
  },
  "simulated_metrics": {
    "ctrPct": number, "cpcEur": number, "cplEur": number,
    "conversionPct": number, "cacEur": number, "roiPct": number,
    "expectedUpliftPct": number, "notes": "..."
  }
}`;

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "És growth optimizer sénior. Respondes APENAS com JSON válido." },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
    }),
  });

  if (r.status === 429) return json({ error: "Rate limit" }, 429);
  if (r.status === 402) return json({ error: "Créditos esgotados" }, 402);
  if (!r.ok) return json({ error: `AI Gateway erro ${r.status}` }, 502);

  const raw = await r.json();
  let parsed: any;
  try {
    const txt = raw.choices?.[0]?.message?.content ?? "{}";
    parsed = JSON.parse(txt.replace(/```json\n?|```/g, "").trim());
  } catch {
    return json({ error: "IA devolveu JSON inválido" }, 502);
  }

  // Registar otimização no histórico
  await supa.from("marketing_optimizations").insert({
    campaign_id: campaignId,
    performed_by: userId,
    iteration,
    changes: parsed.changes ?? {},
    reasoning: parsed.reasoning ?? null,
    simulated_metrics: parsed.simulated_metrics ?? null,
  });

  // Aplicar mudanças à campanha
  const updatePayload: any = {};
  if (Array.isArray(parsed.changes?.headlines)) updatePayload.headlines = parsed.changes.headlines;
  if (Array.isArray(parsed.changes?.descriptions)) updatePayload.descriptions = parsed.changes.descriptions;
  if (Array.isArray(parsed.changes?.ctas)) updatePayload.ctas = parsed.changes.ctas;
  if (Array.isArray(parsed.changes?.keywords)) updatePayload.keywords = parsed.changes.keywords;
  if (Array.isArray(parsed.changes?.ab_variants)) updatePayload.ab_variants = parsed.changes.ab_variants;
  if (parsed.simulated_metrics) updatePayload.forecast = parsed.simulated_metrics;

  if (Object.keys(updatePayload).length > 0) {
    await supa.from("marketing_campaigns").update(updatePayload).eq("id", campaignId);
  }

  return json({ ok: true, iteration, reasoning: parsed.reasoning, simulated_metrics: parsed.simulated_metrics });
}

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
