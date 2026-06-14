// AI Business Forecast — realistic MRR/ARR/customer projections.
// Uses Lovable AI Gateway (no API key needed by user). Super admin only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Inputs = {
  market: string;              // e.g. "Portugal", "Brasil"
  targetSegment: string;       // e.g. "oficinas independentes 1-5 mecânicos"
  monthlyAdSpendEur: number;   // budget de ads/mês
  cplEur: number;              // cost per lead estimated
  trialToPayConversionPct: number; // 0..100
  monthlyChurnPct: number;     // 0..100
  planMixPct: { starter: number; pro: number; garage: number; enterprise: number };
  horizonMonths: number;       // 6 or 12
  startingPayingCustomers: number; // current paying customers (0 if none)
  marketSizeWorkshops?: number; // optional TAM
};

const PLAN_EUR: Record<string, number> = {
  starter: 19, pro: 39, garage: 99, enterprise: 299,
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

    const inputs = (await req.json()) as Inputs;
    if (!inputs?.market || !inputs?.horizonMonths) return json({ error: "Missing inputs" }, 400);

    // Deterministic baseline projection (math, not AI) — gives realistic anchor.
    const baseline = projectBaseline(inputs);

    // Ask Lovable AI to enrich with qualitative analysis + sensitivity.
    const aiPrompt = buildPrompt(inputs, baseline);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "És um analista financeiro SaaS. Responde APENAS com JSON válido conforme o schema pedido. Sê realista, conservador, e fundamenta cada número em hipóteses. Sem markdown, sem prefixos.",
          },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limit excedido. Tenta daqui a pouco." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos esgotados. Adiciona créditos em Settings → Workspace → Usage." }, 402);
    if (!aiResp.ok) return json({ error: `AI Gateway erro ${aiResp.status}` }, 502);

    const aiJson = await aiResp.json();
    let aiAnalysis: any = null;
    try {
      const txt = aiJson.choices?.[0]?.message?.content ?? "{}";
      const cleaned = txt.replace(/```json\n?|```/g, "").trim();
      aiAnalysis = JSON.parse(cleaned);
    } catch {
      aiAnalysis = { summary: "Não foi possível analisar resposta da IA.", risks: [], opportunities: [] };
    }

    const forecast = { baseline, ai: aiAnalysis };

    // Persist
    await supa.from("business_forecasts").insert({
      generated_by: user.id,
      inputs,
      forecast,
      model: "google/gemini-3-flash-preview",
    });

    return json({ ok: true, forecast });
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

function projectBaseline(i: Inputs) {
  const months: any[] = [];
  let paying = i.startingPayingCustomers;
  const churn = Math.max(0, i.monthlyChurnPct / 100);
  const conv = Math.max(0, i.trialToPayConversionPct / 100);
  const mix = i.planMixPct;
  const mixSum = Math.max(1, mix.starter + mix.pro + mix.garage + mix.enterprise);
  const blendedArpu =
    (mix.starter * PLAN_EUR.starter +
      mix.pro * PLAN_EUR.pro +
      mix.garage * PLAN_EUR.garage +
      mix.enterprise * PLAN_EUR.enterprise) /
    mixSum;

  const leadsPerMonth = i.cplEur > 0 ? Math.floor(i.monthlyAdSpendEur / i.cplEur) : 0;
  const newPayingPerMonth = Math.floor(leadsPerMonth * conv);

  for (let m = 1; m <= i.horizonMonths; m++) {
    const churned = Math.round(paying * churn);
    paying = Math.max(0, paying - churned + newPayingPerMonth);
    const mrr = Math.round(paying * blendedArpu);
    months.push({
      month: m,
      newPaying: newPayingPerMonth,
      churned,
      paying,
      mrrEur: mrr,
      arrEur: mrr * 12,
    });
  }
  const final = months[months.length - 1];
  const cac = newPayingPerMonth > 0 ? Math.round(i.monthlyAdSpendEur / newPayingPerMonth) : null;
  const ltv = churn > 0 ? Math.round(blendedArpu / churn) : Math.round(blendedArpu * 36);
  return {
    blendedArpuEur: Math.round(blendedArpu),
    leadsPerMonth,
    newPayingPerMonth,
    cacEur: cac,
    ltvEur: ltv,
    ltvCacRatio: cac && cac > 0 ? +(ltv / cac).toFixed(2) : null,
    paybackMonths: cac && blendedArpu > 0 ? +(cac / blendedArpu).toFixed(1) : null,
    months,
    finalMrrEur: final?.mrrEur ?? 0,
    finalArrEur: final?.arrEur ?? 0,
    finalPayingCustomers: final?.paying ?? 0,
  };
}

function buildPrompt(i: Inputs, baseline: any) {
  return `Analisa estas projeções SaaS para uma plataforma de gestão de oficinas no mercado ${i.market}.
Inputs:
${JSON.stringify(i, null, 2)}

Baseline matemático (já calculado):
${JSON.stringify(baseline, null, 2)}

Devolve EXATAMENTE este JSON (sem markdown):
{
  "summary": "2-3 frases sobre viabilidade do plano",
  "realismScore": 0-100,
  "verdict": "conservador" | "realista" | "otimista" | "irrealista",
  "keyAssumptions": ["assunção 1", "assunção 2", ...],
  "risks": [{ "risk": "...", "severity": "low|medium|high", "mitigation": "..." }],
  "opportunities": [{ "opportunity": "...", "potentialMrrEurMonth12": number }],
  "scenarios": {
    "pessimistic": { "mrrMonth12Eur": number, "payingMonth12": number, "explanation": "..." },
    "expected": { "mrrMonth12Eur": number, "payingMonth12": number, "explanation": "..." },
    "optimistic": { "mrrMonth12Eur": number, "payingMonth12": number, "explanation": "..." }
  },
  "actionableSteps": ["passo 1", "passo 2", "passo 3"]
}`;
}
