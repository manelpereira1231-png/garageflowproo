import { useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, ArrowLeft, Clock, Loader2 } from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { Button } from "@/components/ui/button";
import { BLOG_BY_SLUG } from "@/lib/seoBlogPT";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://garageflow.pt";

type DbPost = {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  meta_title: string;
  meta_description: string;
  reading_minutes: number;
  published_at: string;
};

// Minimal markdown → safe HTML (headings, paragraphs, lists, bold, italic, links).
function renderMarkdown(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let html = esc(md);
  html = html.replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold mt-6 mb-2">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="text-xl sm:text-2xl font-bold mt-8 mb-3">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-8 mb-3">$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-primary underline">$1</a>');
  // lists
  html = html.replace(/(?:^|\n)((?:- .+\n?)+)/g, (_, block) => {
    const items = block.trim().split(/\n/).map((l: string) => `<li>${l.replace(/^- /, "")}</li>`).join("");
    return `\n<ul class="list-disc pl-6 space-y-1 my-3">${items}</ul>`;
  });
  // paragraphs
  html = html.split(/\n{2,}/).map((blk) => {
    if (/^<(h\d|ul|ol|blockquote|pre)/.test(blk.trim())) return blk;
    return `<p class="my-3">${blk.replace(/\n/g, "<br/>")}</p>`;
  }).join("\n");
  return html;
}

export default function SeoBlogPost() {
  const { slug } = useParams();
  const slugLower = (slug || "").toLowerCase();
  const staticPost = BLOG_BY_SLUG[slugLower];
  const [dbPost, setDbPost] = useState<DbPost | null>(null);
  const [loading, setLoading] = useState(!staticPost);

  useEffect(() => {
    if (staticPost) return;
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts" as any)
        .select("slug,title,excerpt,content,category,meta_title,meta_description,reading_minutes,published_at,id")
        .eq("slug", slugLower)
        .eq("status", "published")
        .maybeSingle();
      if (data) {
        setDbPost(data as any);
        // increment views (best effort)
        await supabase.rpc as any;
        await supabase.from("seo_blog_posts" as any)
          .update({ views_count: ((data as any).views_count || 0) + 1 } as any)
          .eq("id", (data as any).id);
      }
      setLoading(false);
    })();
  }, [slugLower, staticPost]);

  if (loading) {
    return <LandingLayout><div className="pt-32 flex justify-center"><Loader2 className="w-6 h-6 animate-spin" /></div></LandingLayout>;
  }
  if (!staticPost && !dbPost) return <Navigate to="/blog" replace />;

  const url = `${SITE}/blog/${slugLower}`;

  if (staticPost) {
    const jsonLd = [
      {
        "@context": "https://schema.org", "@type": "Article",
        headline: staticPost.title, description: staticPost.description,
        datePublished: staticPost.publishedAt,
        author: { "@type": "Organization", name: "GarageFlow" },
        publisher: { "@type": "Organization", name: "GarageFlow", logo: { "@type": "ImageObject", url: `${SITE}/og-image.jpg` } },
        mainEntityOfPage: url,
      },
      { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 2, name: staticPost.title, item: url },
      ]},
    ];
    return (
      <LandingLayout>
        <Helmet>
          <title>{staticPost.title} | GarageFlow</title>
          <meta name="description" content={staticPost.description} />
          <link rel="canonical" href={url} />
          <meta property="og:type" content="article" />
          <meta property="og:title" content={staticPost.title} />
          <meta property="og:description" content={staticPost.description} />
          <meta property="og:url" content={url} />
          <meta property="article:published_time" content={staticPost.publishedAt} />
          <meta property="article:section" content={staticPost.category} />
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        </Helmet>
        <article className="pt-20 sm:pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao blog
          </Link>
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">{staticPost.category}</span>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 mb-3">{staticPost.title}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
            <Clock className="w-3.5 h-3.5" /> {staticPost.readingMinutes} min de leitura
          </div>
          <p className="text-lg text-muted-foreground mb-8">{staticPost.excerpt}</p>
          {staticPost.sections.map((s) => (
            <section key={s.h2} className="mb-8">
              <h2 className="text-xl sm:text-2xl font-bold mb-3">{s.h2}</h2>
              <div className="text-muted-foreground space-y-3">
                {s.body.map((p, i) => (<p key={i}>{p}</p>))}
              </div>
            </section>
          ))}
          <Cta category={staticPost.category} />

          {staticPost.related.length > 0 && (
            <section className="mt-10">
              <h3 className="text-base font-bold mb-3">Continuar a ler</h3>
              <ul className="space-y-2">
                {staticPost.related.map((r) => (
                  <li key={r.to}><Link to={r.to} className="text-sm text-primary hover:underline">{r.label} →</Link></li>
                ))}
              </ul>
            </section>
          )}
        </article>
      </LandingLayout>
    );
  }

  // DB post
  const p = dbPost!;
  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Article",
      headline: p.title, description: p.meta_description || p.excerpt,
      datePublished: p.published_at,
      author: { "@type": "Organization", name: "GarageFlow" },
      publisher: { "@type": "Organization", name: "GarageFlow", logo: { "@type": "ImageObject", url: `${SITE}/og-image.jpg` } },
      mainEntityOfPage: url,
    },
    { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
      { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE}/blog` },
      { "@type": "ListItem", position: 2, name: p.title, item: url },
    ]},
  ];

  return (
    <LandingLayout>
      <Helmet>
        <title>{p.meta_title || `${p.title} | GarageFlow`}</title>
        <meta name="description" content={p.meta_description || p.excerpt} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={p.title} />
        <meta property="og:description" content={p.meta_description || p.excerpt} />
        <meta property="og:url" content={url} />
        <meta property="article:published_time" content={p.published_at} />
        <meta property="article:section" content={p.category} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <article className="pt-20 sm:pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao blog
        </Link>
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">{p.category}</span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 mb-3">{p.title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Clock className="w-3.5 h-3.5" /> {p.reading_minutes} min de leitura
        </div>
        {p.excerpt && <p className="text-lg text-muted-foreground mb-8">{p.excerpt}</p>}
        <div className="prose prose-sm max-w-none text-foreground" dangerouslySetInnerHTML={{ __html: renderMarkdown(p.content) }} />
        <Cta category={p.category} />
      </article>
    </LandingLayout>
  );
}

function Cta({ category }: { category?: string }) {
  const isMarket = (category || "").toLowerCase() === "market";
  const href = isMarket ? "/market/auth?mode=signup" : "/auth?mode=signup";
  const title = isMarket ? "Vende o teu carro no GarageFlow Market" : "Comece hoje. Sem cartão.";
  const subtitle = isMarket
    ? "Anúncios verificados, pagamento seguro em escrow e inspeção opcional."
    : "30 dias grátis. Tudo o que precisa para gerir a sua oficina.";
  const label = isMarket ? "Entrar no Market" : "Testar grátis 30 dias";
  return (
    <div className="rounded-2xl p-6 sm:p-8 bg-primary/5 border border-primary/20 text-center my-10">
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
      <Link to={href}>
        <Button size="lg">{label} <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </Link>
    </div>
  );
}

