import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function slugify(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const auth = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );

    // Verify caller is super admin
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: admin } = await supabase.rpc("is_super_admin", { _user_id: u.user.id });
    if (!admin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { topic, intent = "solucao", category = "Gestão", save = true } = await req.json();
    if (!topic || typeof topic !== "string") throw new Error("topic obrigatório");

    const isMarket = String(category).toLowerCase() === "market";
    const productContext = isMarket
      ? `GarageFlow Market — marketplace de viaturas usadas em Portugal, com inspeções por oficinas certificadas e pagamento seguro em escrow (Stripe Connect). NUNCA misturar com o ERP de oficinas.`
      : `GarageFlow — ERP/CRM para oficinas auto em Portugal (orçamentos, faturação, clientes, viaturas, agenda). NUNCA misturar com o Market de viaturas.`;
    const ctaUrl = isMarket ? "/market/auth?mode=signup" : "/auth?mode=signup";
    const ctaLabel = isMarket ? "Entrar no GarageFlow Market" : "Testar grátis 30 dias";

    const systemPrompt = `És redator SEO sénior. Contexto do produto: ${productContext}
Escreve sempre em português de Portugal (PT-PT), linguagem natural, prática e focada em ${isMarket ? "compradores e vendedores de viaturas" : "oficinas reais"}.
NUNCA inventes estatísticas, percentagens, testemunhos, casos ou números. Se não souberes, fala em termos qualitativos.
NUNCA faças keyword stuffing. NUNCA prometas resultados específicos.
NUNCA cruzes ERP com Market: se o artigo é ${isMarket ? "Market, NÃO promovas o ERP" : "ERP, NÃO promovas o Market"}.
Termina sempre com CTA "${ctaLabel}" apontando para ${ctaUrl}.`;


    const userPrompt = `Tema/keyword: "${topic}"
Intenção: ${intent} (problema | solucao | comparativo | educativo)
Categoria: ${category}
Mercado: Portugal

Gera um artigo SEO completo em PT-PT com a seguinte estrutura em markdown:
- H1 otimizado para SEO
- Introdução curta (2-3 frases) que apresenta o problema real da oficina
- ## O problema (1-2 parágrafos)
- ## A solução prática (passos concretos)
- ## Exemplo do dia-a-dia (cenário realista, sem números inventados)
- ## Benefícios (lista bullet)
- ## Como o GarageFlow ajuda (links internos)
- ## Perguntas frequentes (3 a 5 perguntas com resposta curta)
- CTA final

Devolve via a ferramenta "publish_article".`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "publish_article",
            description: "Devolve o artigo SEO estruturado",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string", description: "Título H1 (max 70 chars)" },
                slug: { type: "string", description: "URL slug em minúsculas com hífens" },
                meta_title: { type: "string", description: "Meta title <60 chars" },
                meta_description: { type: "string", description: "Meta description <160 chars" },
                excerpt: { type: "string", description: "Resumo 1-2 frases" },
                keyword: { type: "string" },
                content_markdown: { type: "string", description: "Artigo completo em markdown" },
                reading_minutes: { type: "number" },
              },
              required: ["title", "slug", "meta_title", "meta_description", "excerpt", "content_markdown", "reading_minutes"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "publish_article" } },
      }),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit. Tente novamente." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "Créditos IA esgotados." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      console.error("AI error", aiRes.status, t);
      throw new Error("Falha na geração IA");
    }

    const data = await aiRes.json();
    const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("Sem output IA");
    const article = JSON.parse(args);
    article.slug = slugify(article.slug || article.title);

    if (!save) {
      return new Response(JSON.stringify({ article }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Ensure unique slug
    let finalSlug = article.slug;
    for (let i = 1; i < 50; i++) {
      const { data: exists } = await supabase.from("seo_blog_posts").select("id").eq("slug", finalSlug).maybeSingle();
      if (!exists) break;
      finalSlug = `${article.slug}-${i}`;
    }

    const { data: inserted, error } = await supabase.from("seo_blog_posts").insert({
      title: article.title,
      slug: finalSlug,
      excerpt: article.excerpt,
      content: article.content_markdown,
      category,
      keyword: article.keyword || topic,
      meta_title: article.meta_title,
      meta_description: article.meta_description,
      reading_minutes: Math.max(2, Math.round(article.reading_minutes || 5)),
      status: "draft",
      source: "ai",
    }).select().single();
    if (error) throw error;

    return new Response(JSON.stringify({ post: inserted }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("seo-generate-article error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
