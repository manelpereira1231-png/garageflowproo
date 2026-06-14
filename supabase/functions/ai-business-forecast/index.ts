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
  market: string;
  targetSegment?: string;
  monthlyAdSpendEur: number;
  horizonMonths: number;
  startingPayingCustomers?: number;
  // Optional manual overrides (auto mode infers everything else)
  cplEur?: number;
  trialToPayConversionPct?: number;
  monthlyChurnPct?: number;
  planMixPct?: { starter: number; pro: number; garage: number; enterprise: number };
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
...
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
