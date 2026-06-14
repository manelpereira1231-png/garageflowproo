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

type ProductScope = "erp" | "market" | "combined";

type Inputs = {
  market: string;
  targetSegment?: string;
  monthlyAdSpendEur: number;
  horizonMonths: number;
  startingPayingCustomers?: number;
  productScope?: ProductScope;          // default "erp"
  adSpendSplitErpPct?: number;          // combined mode: % do budget para ERP (resto Market). default 50
  // ERP overrides
  cplEur?: number;
  trialToPayConversionPct?: number;
  monthlyChurnPct?: number;
  planMixPct?: { starter: number; pro: number; garage: number; enterprise: number };
  // Market overrides
  marketAvgVehiclePriceEur?: number;    // ticket médio carro usado
  marketTakeRatePct?: number;           // comissão %
  marketListingToSalePct?: number;      // % anúncios que vendem por mês
  marketCplEur?: number;                // custo por listing/buyer captado
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

    const raw = (await req.json()) as Inputs;
    if (!raw?.market || !raw?.horizonMonths || !raw?.monthlyAdSpendEur) {
      return json({ error: "Missing market / horizonMonths / monthlyAdSpendEur" }, 400);
    }

    // STEP 1 — Ask AI for realistic benchmarks for this market+segment if any param missing.
    let assumptions = {
      cplEur: raw.cplEur,
      trialToPayConversionPct: raw.trialToPayConversionPct,
      monthlyChurnPct: raw.monthlyChurnPct,
      planMixPct: raw.planMixPct,
      benchmarkNotes: [] as string[],
    };
    const needsBenchmarks =
      raw.cplEur == null || raw.trialToPayConversionPct == null ||
      raw.monthlyChurnPct == null || raw.planMixPct == null;

    if (needsBenchmarks) {
      const benchPrompt = `Mercado: ${raw.market}. Segmento: ${raw.targetSegment ?? "oficinas auto independentes 1-5 mecânicos"}.
Produto: SaaS B2B de gestão de oficinas (planos €19/€39/€99/€299/mês). Mercado offline, ciclo de decisão LENTO, baixa confiança em software novo, adoção irregular (entram em "spikes" via parcerias, não linearmente).

Estima benchmarks CONSERVADORES E REALISTAS (não otimistas) para Google/Meta Ads em 2025-2026, refletindo a fricção real deste mercado.

Regras de realismo OBRIGATÓRIAS:
- CPL é por lead QUALIFICADO (não clique). PT: 12-20€, BR: 6-12€, US: 35-80€, DE/UK: 20-40€, ES: 10-18€.
- Conversão trial→pago em oficinas tradicionais: 12-20% (não 25-30%). Adoção lenta, muitos pedem demo e desaparecem.
- Churn mensal SaaS PME oficinas: 4-7% (alto nos primeiros 3 meses por má adoção). Usa 5-6% como base.
- Plan mix REAL (oficinas pequenas escolhem barato): starter 65-80%, pro 15-25%, garage 4-10%, enterprise 0-2%. NUNCA inflar para mix premium.
- ARPU resultante deve ficar 25-35€ (não 40€+).

Devolve EXATAMENTE este JSON (sem markdown):
{
  "cplEur": <number>,
  "trialToPayConversionPct": <number>,
  "monthlyChurnPct": <number>,
  "planMixPct": { "starter": <%>, "pro": <%>, "garage": <%>, "enterprise": <%> },
  "benchmarkNotes": ["fonte/raciocínio 1", "fonte/raciocínio 2", "fonte/raciocínio 3"]
}`;
      const benchResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: "És analista de mercado SaaS sénior. Respondes APENAS com JSON válido. Sem markdown. Conservador, baseado em dados reais de oficinas auto." },
            { role: "user", content: benchPrompt },
          ],
          temperature: 0.2,
        }),
      });
      if (benchResp.status === 429) return json({ error: "Rate limit. Tenta daqui a pouco." }, 429);
      if (benchResp.status === 402) return json({ error: "Créditos esgotados. Adiciona em Settings → Workspace → Usage." }, 402);
      if (!benchResp.ok) return json({ error: `AI Gateway erro ${benchResp.status}` }, 502);
      const benchJson = await benchResp.json();
      try {
        const txt = benchJson.choices?.[0]?.message?.content ?? "{}";
        const parsed = JSON.parse(txt.replace(/```json\n?|```/g, "").trim());
        // Hard clamps to enforce realism even if AI drifts optimistic
        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
        const cpl = clamp(Number(parsed.cplEur), marketCplFloor(raw.market), marketCplCeil(raw.market));
        const conv = clamp(Number(parsed.trialToPayConversionPct), 10, 22);
        const churn = clamp(Number(parsed.monthlyChurnPct), 4, 7);
        const mix = normalizeMix(parsed.planMixPct);
        assumptions = {
          cplEur: raw.cplEur ?? cpl,
          trialToPayConversionPct: raw.trialToPayConversionPct ?? conv,
          monthlyChurnPct: raw.monthlyChurnPct ?? churn,
          planMixPct: raw.planMixPct ?? mix,
          benchmarkNotes: parsed.benchmarkNotes ?? [],
        };
      } catch {
        return json({ error: "AI devolveu benchmarks inválidos. Tenta de novo." }, 502);
      }
    }

    const fullInputs = {
      market: raw.market,
      targetSegment: raw.targetSegment ?? "Oficinas auto independentes",
      monthlyAdSpendEur: raw.monthlyAdSpendEur,
      horizonMonths: raw.horizonMonths,
      startingPayingCustomers: raw.startingPayingCustomers ?? 0,
      cplEur: assumptions.cplEur!,
      trialToPayConversionPct: assumptions.trialToPayConversionPct!,
      monthlyChurnPct: assumptions.monthlyChurnPct!,
      planMixPct: assumptions.planMixPct!,
    };

    const baseline = projectBaseline(fullInputs);

    // STEP 2 — Qualitative analysis with full context
    const aiPrompt = buildPrompt(fullInputs, baseline);
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "És analista financeiro SaaS. Respondes APENAS com JSON válido conforme schema. Sem markdown." },
          { role: "user", content: aiPrompt },
        ],
        temperature: 0.4,
      }),
    });

    if (aiResp.status === 429) return json({ error: "Rate limit excedido. Tenta daqui a pouco." }, 429);
    if (aiResp.status === 402) return json({ error: "Créditos esgotados." }, 402);
    if (!aiResp.ok) return json({ error: `AI Gateway erro ${aiResp.status}` }, 502);

    const aiJson = await aiResp.json();
    let aiAnalysis: any = null;
    try {
      const txt = aiJson.choices?.[0]?.message?.content ?? "{}";
      aiAnalysis = JSON.parse(txt.replace(/```json\n?|```/g, "").trim());
    } catch {
      aiAnalysis = { summary: "Não foi possível analisar resposta da IA.", risks: [], opportunities: [] };
    }

    const forecast = {
      baseline,
      ai: aiAnalysis,
      assumptions: {
        ...assumptions,
        source: needsBenchmarks ? "ai-inferred" : "user-provided",
      },
      resolvedInputs: fullInputs,
    };

    await supa.from("business_forecasts").insert({
      generated_by: user.id,
      inputs: raw,
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

function marketCplFloor(m: string) {
  const k = m.toUpperCase();
  if (k.includes("BR")) return 6;
  if (k.includes("US")) return 35;
  if (k.includes("DE") || k.includes("UK") || k.includes("GB")) return 20;
  if (k.includes("ES")) return 10;
  return 12; // PT default
}
function marketCplCeil(m: string) {
  const k = m.toUpperCase();
  if (k.includes("BR")) return 12;
  if (k.includes("US")) return 80;
  if (k.includes("DE") || k.includes("UK") || k.includes("GB")) return 40;
  if (k.includes("ES")) return 18;
  return 20; // PT default
}
function normalizeMix(m: any) {
  const s = Math.max(0, Number(m?.starter ?? 70));
  const p = Math.max(0, Number(m?.pro ?? 20));
  const g = Math.max(0, Number(m?.garage ?? 8));
  const e = Math.max(0, Number(m?.enterprise ?? 2));
  const total = s + p + g + e || 1;
  return {
    starter: +(s * 100 / total).toFixed(1),
    pro: +(p * 100 / total).toFixed(1),
    garage: +(g * 100 / total).toFixed(1),
    enterprise: +(e * 100 / total).toFixed(1),
  };
}

// Non-linear adoption curve for offline B2B (oficinas):
// months 1-3: ~25% capacity (descoberta, ceticismo)
// months 4-6: ~55% (boca a boca + retargeting começa)
// months 7-12: ~85%
// months 13+: 100% (canal estabilizado) com spike +15% por parceria a cada ~6 meses
function rampMultiplier(month: number) {
  if (month <= 3) return 0.25;
  if (month <= 6) return 0.55;
  if (month <= 12) return 0.85;
  const base = 1.0;
  const spike = (month % 6 === 0) ? 0.15 : 0;
  return base + spike;
}

function projectBaseline(i: Inputs) {
  const months: any[] = [];
  let paying = i.startingPayingCustomers ?? 0;
  const baseChurn = Math.max(0, (i.monthlyChurnPct ?? 5) / 100);
  const conv = Math.max(0, (i.trialToPayConversionPct ?? 15) / 100);
  const mix = i.planMixPct!;
  const mixSum = Math.max(1, mix.starter + mix.pro + mix.garage + mix.enterprise);
  const blendedArpu =
    (mix.starter * PLAN_EUR.starter +
      mix.pro * PLAN_EUR.pro +
      mix.garage * PLAN_EUR.garage +
      mix.enterprise * PLAN_EUR.enterprise) /
    mixSum;

  // Lead qualification: nem todos os leads pagos viram trial real (form fills, no-shows, fora de ICP)
  const LEAD_QUALIFICATION_RATE = 0.6;
  const grossLeads = (i.cplEur ?? 0) > 0 ? Math.floor(i.monthlyAdSpendEur / (i.cplEur as number)) : 0;
  const qualifiedLeadsPerMonth = Math.floor(grossLeads * LEAD_QUALIFICATION_RATE);
  const theoreticalNewPaying = Math.floor(qualifiedLeadsPerMonth * conv);

  let totalNewPaying = 0;
  for (let m = 1; m <= i.horizonMonths; m++) {
    // Churn agravado nos 3 primeiros meses de cada novo lote (proxy: churn global +50% nos meses 1-3)
    const churnRate = m <= 3 ? baseChurn * 1.5 : baseChurn;
    // Ramp non-linear + jitter determinístico (pseudo-aleatório por mês, oficinas entram em "spikes")
    const ramp = rampMultiplier(m);
    const jitter = 0.85 + ((Math.sin(m * 1.7) + 1) / 2) * 0.3; // 0.85..1.15
    const newPaying = Math.max(0, Math.round(theoreticalNewPaying * ramp * jitter));
    const churned = Math.round(paying * churnRate);
    paying = Math.max(0, paying - churned + newPaying);
    totalNewPaying += newPaying;
    const mrr = Math.round(paying * blendedArpu);
    months.push({
      month: m,
      newPaying,
      churned,
      paying,
      mrrEur: mrr,
      arrEur: mrr * 12,
    });
  }
  const final = months[months.length - 1];
  const avgNewPaying = totalNewPaying / i.horizonMonths;
  const cac = avgNewPaying > 0 ? Math.round(i.monthlyAdSpendEur / avgNewPaying) : null;
  // Payback realista: contabiliza churn (ARPU efetivo após churn no 1º mês)
  const effectiveArpu = blendedArpu * (1 - baseChurn);
  const ltv = baseChurn > 0 ? Math.round(blendedArpu / baseChurn) : Math.round(blendedArpu * 36);
  return {
    blendedArpuEur: Math.round(blendedArpu),
    grossLeadsPerMonth: grossLeads,
    qualifiedLeadsPerMonth,
    leadQualificationRate: LEAD_QUALIFICATION_RATE,
    theoreticalNewPayingPerMonth: theoreticalNewPaying,
    avgNewPayingPerMonth: +avgNewPaying.toFixed(1),
    cacEur: cac,
    ltvEur: ltv,
    ltvCacRatio: cac && cac > 0 ? +(ltv / cac).toFixed(2) : null,
    paybackMonths: cac && effectiveArpu > 0 ? +(cac / effectiveArpu).toFixed(1) : null,
    months,
    finalMrrEur: final?.mrrEur ?? 0,
    finalArrEur: final?.arrEur ?? 0,
    finalPayingCustomers: final?.paying ?? 0,
    realismAdjustments: {
      leadQualificationApplied: "60% dos leads tornam-se trials reais (no-shows/fora-ICP descartados)",
      adoptionCurve: "Ramp não-linear: 25% (m1-3) → 55% (m4-6) → 85% (m7-12) → 100% (m13+) com spikes +15% a cada 6m",
      earlyChurnPenalty: "Churn +50% nos meses 1-3 (má adoção inicial típica de oficinas)",
      paybackBasis: "CAC ÷ ARPU líquido de churn (não bruto)",
    },
  };
}

function buildPrompt(i: Inputs, baseline: any) {
  return `Analisa projeções SaaS para gestão de oficinas no mercado ${i.market}.
Inputs: ${JSON.stringify(i)}
Baseline (já com ajustes de realismo aplicados — ramp não-linear, qualificação de leads 60%, churn agravado nos 3 primeiros meses, payback líquido de churn): ${JSON.stringify(baseline)}

REGRAS DE REALISMO (obriga-te a cumprir):
- Oficinas auto são mercado offline, ciclo de decisão LENTO. Crescimento NUNCA é linear: existem "spikes" via parcerias e meses flat.
- O cenário "expected" deve ficar PRÓXIMO do baseline calculado (±15%). NÃO inflacionar.
- O "pessimistic" deve ser 40-60% abaixo do baseline (canal mau, churn alto, leads frios).
- O "optimistic" deve ser 30-50% acima do baseline — não 3x. Só com parceria forte (associações, fornecedores de peças) é possível mais.
- Se baseline mostrar <30 clientes em 24m com 200€/mês, isso É realista para PT/BR. Não o classifiques como pessimista.
- realismScore: 80-95 se baseline respeita estas regras; baixa só se inputs forem absurdos.

Devolve EXATAMENTE este JSON (sem markdown):
{
  "summary": "2-3 frases honestas sobre viabilidade",
  "realismScore": 0-100,
  "verdict": "conservador" | "realista" | "otimista" | "irrealista",
  "keyAssumptions": ["..."],
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
