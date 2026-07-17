// Marketing AI Insights — analyzes real shop data and generates ready-to-send campaign suggestions.
// Uses Lovable AI Gateway (Gemini Flash) for copy generation. All numbers come from real DB queries.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Insight = {
  id: string;
  segment: string;
  count: number;
  headline: string;
  reason: string;
  channel: "email" | "sms" | "whatsapp" | "push";
  subject: string;
  content: string;
  priority: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

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

    const { shop_id } = (await req.json().catch(() => ({}))) as { shop_id?: string };
    if (!shop_id) return json({ error: "Missing shop_id" }, 400);

    // Verify caller has access to shop
    const { data: membership } = await supa
      .from("shop_users")
      .select("shop_id")
      .eq("shop_id", shop_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) {
      const { data: ownedShop } = await supa
        .from("shops")
        .select("id")
        .eq("id", shop_id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (!ownedShop) return json({ error: "Forbidden" }, 403);
    }

    const now = new Date();
    const nineMonthsAgo = new Date(now); nineMonthsAgo.setMonth(now.getMonth() - 9);
    const thirtyDaysAhead = new Date(now); thirtyDaysAhead.setDate(now.getDate() + 30);
    const sevenDaysAgo = new Date(now); sevenDaysAgo.setDate(now.getDate() - 7);

    // --- Real data queries (parallel) ---
    const [
      shopRes,
      clientsRes,
      recentWoRes,
      warrantiesRes,
      pendingQuotesRes,
      topSpendersRes,
    ] = await Promise.all([
      supa.from("shops").select("name").eq("id", shop_id).maybeSingle(),
      supa.from("clients").select("id, created_at").eq("shop_id", shop_id).is("deleted_at", null),
      supa.from("work_orders")
        .select("client_id, completed_at, total")
        .eq("shop_id", shop_id)
        .not("completed_at", "is", null)
        .gte("completed_at", nineMonthsAgo.toISOString()),
      supa.from("warranties")
        .select("id, client_id")
        .eq("shop_id", shop_id)
        .eq("status", "active")
        .gte("end_date", now.toISOString().slice(0, 10))
        .lte("end_date", thirtyDaysAhead.toISOString().slice(0, 10)),
      supa.from("quotes")
        .select("id")
        .eq("shop_id", shop_id)
        .in("status", ["draft", "sent"])
        .lte("created_at", sevenDaysAgo.toISOString()),
      supa.from("work_orders")
        .select("client_id, total")
        .eq("shop_id", shop_id)
        .eq("status", "completed"),
    ]);

    const shopName = shopRes.data?.name ?? "a sua oficina";
    const totalClients = (clientsRes.data ?? []).length;
    const activeClientIds = new Set((recentWoRes.data ?? []).map((r: any) => r.client_id));
    const inactiveCount = Math.max(0, totalClients - activeClientIds.size);
    const warrantiesEndingCount = (warrantiesRes.data ?? []).length;
    const pendingQuotesCount = (pendingQuotesRes.data ?? []).length;

    // Top spenders
    const spendMap = new Map<string, number>();
    for (const r of (topSpendersRes.data ?? []) as any[]) {
      spendMap.set(r.client_id, (spendMap.get(r.client_id) ?? 0) + Number(r.total || 0));
    }
    const vipCount = Array.from(spendMap.values()).filter(v => v >= 500).length;

    // Assemble raw segments (only include those with count > 0)
    const rawSegments = [
      { id: "inactive_9mo",       segment: "inactive",         count: inactiveCount,        theme: "Clientes sem visitar há mais de 9 meses. Reativar com oferta." },
      { id: "warranty_ending",    segment: "warranty_ending",  count: warrantiesEndingCount, theme: "Clientes com garantia a terminar nos próximos 30 dias." },
      { id: "pending_quotes",     segment: "pending_quotes",   count: pendingQuotesCount,   theme: "Orçamentos pendentes há mais de 7 dias sem resposta." },
      { id: "vip_high_value",     segment: "vip",              count: vipCount,             theme: "Clientes VIP (gastam mais de 500€). Fidelizar." },
    ].filter(s => s.count > 0);

    if (rawSegments.length === 0) {
      return json({ insights: [], generated_at: new Date().toISOString() });
    }

    // --- AI copy generation (single call, JSON output) ---
    const prompt = `És um especialista em marketing para oficinas automóveis em Portugal.
A oficina chama-se "${shopName}".
Para CADA segmento abaixo, gera uma sugestão de campanha em português europeu, prática e curta.

Segmentos reais:
${rawSegments.map(s => `- ${s.id}: ${s.count} clientes. ${s.theme}`).join("\n")}

Regras:
- Assunto máximo 60 caracteres, sem clickbait.
- Conteúdo 2-4 frases, tom profissional e caloroso.
- Podes usar {{client_name}}, {{vehicle_plate}}, {{shop_name}} como placeholders.
- Escolhe o canal ideal por segmento: "email", "sms", "whatsapp" ou "push".
- Prioridade 1 (mais urgente) a 5.

Devolve APENAS JSON válido com este schema exato:
{"insights":[{"id":"...","channel":"email|sms|whatsapp|push","subject":"...","content":"...","headline":"...","reason":"...","priority":1}]}
- "headline": frase curta para o card ("Detetámos X clientes ...").
- "reason": porquê agir agora (1 frase).`;

    let aiInsights: Array<{
      id: string; channel: string; subject: string; content: string;
      headline: string; reason: string; priority: number;
    }> = [];

    try {
      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3.5-flash",
          messages: [
            { role: "system", content: "Devolve sempre JSON válido, sem markdown, sem texto extra." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
        }),
      });

      if (aiRes.status === 429) return json({ error: "rate_limited", message: "IA temporariamente indisponível. Tenta novamente em breve." }, 429);
      if (aiRes.status === 402) return json({ error: "credits_exhausted", message: "Créditos de IA esgotados. Adiciona créditos no workspace." }, 402);
      if (!aiRes.ok) {
        const errBody = await aiRes.text();
        console.error("AI gateway error", aiRes.status, errBody);
        throw new Error(`AI ${aiRes.status}`);
      }

      const aiJson = await aiRes.json();
      const rawText = aiJson?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(rawText);
      aiInsights = Array.isArray(parsed?.insights) ? parsed.insights : [];
    } catch (e) {
      console.error("AI copy generation failed, using fallback", e);
      aiInsights = [];
    }

    // Merge counts (source of truth) with AI copy (fallback if AI failed)
    const insights: Insight[] = rawSegments.map(s => {
      const ai = aiInsights.find(a => a.id === s.id);
      const validChannel = (["email","sms","whatsapp","push"] as const).includes(ai?.channel as any)
        ? (ai!.channel as Insight["channel"])
        : "email";
      return {
        id: s.id,
        segment: s.segment,
        count: s.count,
        channel: validChannel,
        headline: ai?.headline ?? `Detetámos ${s.count} clientes neste segmento`,
        reason: ai?.reason ?? s.theme,
        subject: ai?.subject ?? "Uma mensagem de {{shop_name}}",
        content: ai?.content ?? `Olá {{client_name}},\n\n${s.theme}\n\nA equipa {{shop_name}}.`,
        priority: typeof ai?.priority === "number" ? ai.priority : 3,
      };
    }).sort((a, b) => a.priority - b.priority);

    return json({ insights, generated_at: new Date().toISOString() });
  } catch (e: any) {
    console.error("marketing-ai-insights error", e);
    return json({ error: e?.message ?? "unknown_error" }, 500);
  }
});
