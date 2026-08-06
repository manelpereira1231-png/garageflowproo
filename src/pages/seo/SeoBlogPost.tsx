import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, ArrowLeft, Clock, Loader2, Calendar, User } from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { Button } from "@/components/ui/button";
import MarkdownArticle from "@/components/MarkdownArticle";
import { BLOG_BY_SLUG, BLOG_POSTS } from "@/lib/seoBlogPT";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://garageflow.pt";

type DbPost = {
  id?: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  category: string;
  author?: string | null;
  og_image?: string | null;
  meta_title: string | null;
  meta_description: string | null;
  reading_minutes: number;
  published_at: string;
  views_count?: number;
};

type NavPost = { slug: string; title: string };

/** Extrai perguntas frequentes (headings terminados em "?") para FAQ Schema. */
function extractFaqs(md: string): { q: string; a: string }[] {
  const lines = (md || "").split("\n");
  const faqs: { q: string; a: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{2,4}\s+(.+\?)\s*$/);
    if (!m) continue;
    const answer: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,6}\s/.test(lines[j])) break;
      if (lines[j].trim()) answer.push(lines[j].trim());
      else if (answer.length) break;
    }
    if (answer.length) faqs.push({ q: m[1], a: answer.join(" ").replace(/[*_`>#-]/g, "").trim() });
  }
  return faqs.slice(0, 10);
}

function formatDate(iso?: string) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return "";
  }
}

export default function SeoBlogPost() {
  const { slug } = useParams();
  const slugLower = (slug || "").toLowerCase();
  const staticPost = BLOG_BY_SLUG[slugLower];
  const [dbPost, setDbPost] = useState<DbPost | null>(null);
  const [loading, setLoading] = useState(!staticPost);
  const [siblings, setSiblings] = useState<NavPost[]>([]);

  useEffect(() => {
    (async () => {
      const { data: list } = await supabase
        .from("seo_blog_posts" as any)
        .select("slug,title,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      if (list) setSiblings((list as any[]).map((x) => ({ slug: x.slug, title: x.title })));
    })();
  }, []);

  useEffect(() => {
    if (staticPost) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts" as any)
        .select(
          "id,slug,title,excerpt,content,category,author,og_image,meta_title,meta_description,reading_minutes,published_at,views_count"
        )
        .eq("slug", slugLower)
        .eq("status", "published")
        .maybeSingle();
      if (data) {
        setDbPost(data as any);
        await supabase
          .from("seo_blog_posts" as any)
          .update({ views_count: ((data as any).views_count || 0) + 1 } as any)
          .eq("id", (data as any).id);
      }
      setLoading(false);
    })();
  }, [slugLower, staticPost]);

  const faqs = useMemo(() => (dbPost ? extractFaqs(dbPost.content) : []), [dbPost]);

  const { prev, next } = useMemo(() => {
    const idx = siblings.findIndex((s) => s.slug === slugLower);
    if (idx === -1) return { prev: null as NavPost | null, next: null as NavPost | null };
    return { prev: siblings[idx + 1] || null, next: siblings[idx - 1] || null };
  }, [siblings, slugLower]);

  if (loading) {
    return (
      <LandingLayout>
        <div className="pt-32 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </LandingLayout>
    );
  }
  if (!staticPost && !dbPost) return <Navigate to="/blog" replace />;

  const url = `${SITE}/blog/${slugLower}`;

  if (staticPost) {
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: staticPost.title,
        description: staticPost.description,
        datePublished: staticPost.publishedAt,
        author: { "@type": "Organization", name: "GarageFlow" },
        publisher: {
          "@type": "Organization",
          name: "GarageFlow",
          logo: { "@type": "ImageObject", url: `${SITE}/og-image.jpg` },
        },
        mainEntityOfPage: url,
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Início", item: SITE },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
          { "@type": "ListItem", position: 3, name: staticPost.title, item: url },
        ],
      },
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
          <meta property="og:image" content={`${SITE}/og-image.jpg`} />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content={staticPost.title} />
          <meta name="twitter:description" content={staticPost.description} />
          <meta property="article:published_time" content={staticPost.publishedAt} />
          <meta property="article:section" content={staticPost.category} />
          <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
        </Helmet>
        <main>
          <article className="pt-20 sm:pt-24 pb-16 max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8">
            <Breadcrumbs title={staticPost.title} />
            <header>
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                {staticPost.category}
              </span>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mt-2 mb-4 leading-tight">
                {staticPost.title}
              </h1>
              <Meta date={staticPost.publishedAt} minutes={staticPost.readingMinutes} />
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mt-6 mb-10">
                {staticPost.excerpt}
              </p>
            </header>
            <div className="gf-article prose prose-lg dark:prose-invert max-w-none prose-p:leading-[1.8]">
              {staticPost.sections.map((s) => (
                <section key={s.h2}>
                  <h2>{s.h2}</h2>
                  {s.body.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </section>
              ))}
            </div>
            <Cta category={staticPost.category} />
            {staticPost.related.length > 0 && (
              <section className="mt-10">
                <h2 className="text-base font-bold mb-3">Artigos relacionados</h2>
                <ul className="space-y-2">
                  {staticPost.related.map((r) => (
                    <li key={r.to}>
                      <Link to={r.to} className="text-sm text-primary hover:underline">
                        {r.label} →
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <PrevNext
              prev={staticPrev(slugLower)}
              next={staticNext(slugLower)}
            />
          </article>
        </main>
      </LandingLayout>
    );
  }

  // ---------- DB post ----------
  const p = dbPost!;
  const desc = p.meta_description || p.excerpt || "";
  const image = p.og_image || `${SITE}/og-image.jpg`;
  const related = siblings.filter((s) => s.slug !== slugLower).slice(0, 4);

  const jsonLd: Record<string, any>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: p.title,
      description: desc,
      image: [image],
      datePublished: p.published_at,
      dateModified: p.published_at,
      author: p.author
        ? { "@type": "Person", name: p.author }
        : { "@type": "Organization", name: "GarageFlow" },
      publisher: {
        "@type": "Organization",
        name: "GarageFlow",
        logo: { "@type": "ImageObject", url: `${SITE}/og-image.jpg` },
      },
      mainEntityOfPage: url,
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: SITE },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 3, name: p.title, item: url },
      ],
    },
  ];
  if (faqs.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }

  return (
    <LandingLayout>
      <Helmet>
        <title>{p.meta_title || `${p.title} | GarageFlow`}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={p.title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={image} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={p.title} />
        <meta name="twitter:description" content={desc} />
        <meta name="twitter:image" content={image} />
        <meta property="article:published_time" content={p.published_at} />
        <meta property="article:section" content={p.category} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main>
        <article className="pt-20 sm:pt-24 pb-16 max-w-[800px] mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs title={p.title} />

          <header>
            <span className="text-xs font-semibold text-primary uppercase tracking-wide">
              {p.category}
            </span>
            <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight mt-2 mb-4 leading-tight">
              {p.title}
            </h1>
            <Meta date={p.published_at} minutes={p.reading_minutes} author={p.author} />
            {p.excerpt && (
              <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed mt-6">
                {p.excerpt}
              </p>
            )}
            {p.og_image && (
              <figure className="mt-8">
                <img
                  src={p.og_image}
                  alt={p.title}
                  loading="lazy"
                  decoding="async"
                  className="w-full rounded-xl border border-border"
                />
              </figure>
            )}
          </header>

          <div className="mt-10">
            <MarkdownArticle content={p.content} />
          </div>

          <Cta category={p.category} />

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-bold mb-4">Artigos relacionados</h2>
              <ul className="grid sm:grid-cols-2 gap-3">
                {related.map((r) => (
                  <li key={r.slug}>
                    <Link
                      to={`/blog/${r.slug}`}
                      className="block p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium"
                    >
                      {r.title} →
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <PrevNext prev={prev} next={next} />
        </article>
      </main>
    </LandingLayout>
  );
}

function staticPrev(slug: string): NavPost | null {
  const i = BLOG_POSTS.findIndex((p) => p.slug === slug);
  const p = i > 0 ? BLOG_POSTS[i - 1] : null;
  return p ? { slug: p.slug, title: p.title } : null;
}
function staticNext(slug: string): NavPost | null {
  const i = BLOG_POSTS.findIndex((p) => p.slug === slug);
  const p = i >= 0 && i < BLOG_POSTS.length - 1 ? BLOG_POSTS[i + 1] : null;
  return p ? { slug: p.slug, title: p.title } : null;
}

function Breadcrumbs({ title }: { title: string }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <li>
          <Link to="/" className="hover:text-primary">
            Início
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li>
          <Link to="/blog" className="hover:text-primary">
            Blog
          </Link>
        </li>
        <li aria-hidden="true">/</li>
        <li className="truncate max-w-[16rem] text-foreground/80" aria-current="page">
          {title}
        </li>
      </ol>
    </nav>
  );
}

function Meta({
  date,
  minutes,
  author,
}: {
  date?: string;
  minutes?: number;
  author?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      {author && (
        <span className="inline-flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> {author}
        </span>
      )}
      {date && (
        <time dateTime={date} className="inline-flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5" /> {formatDate(date)}
        </time>
      )}
      {minutes ? (
        <span className="inline-flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> {minutes} min de leitura
        </span>
      ) : null}
    </div>
  );
}

function PrevNext({ prev, next }: { prev: NavPost | null; next: NavPost | null }) {
  if (!prev && !next) return null;
  return (
    <footer className="mt-12 pt-8 border-t border-border grid sm:grid-cols-2 gap-4">
      {prev ? (
        <Link
          to={`/blog/${prev.slug}`}
          className="group p-4 rounded-lg border border-border hover:border-primary transition-colors"
        >
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            <ArrowLeft className="w-3 h-3" /> Artigo anterior
          </span>
          <p className="text-sm font-medium mt-1 group-hover:text-primary">{prev.title}</p>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={`/blog/${next.slug}`}
          className="group p-4 rounded-lg border border-border hover:border-primary transition-colors sm:text-right"
        >
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
            Próximo artigo <ArrowRight className="w-3 h-3" />
          </span>
          <p className="text-sm font-medium mt-1 group-hover:text-primary">{next.title}</p>
        </Link>
      ) : null}
    </footer>
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
    <div className="rounded-2xl p-6 sm:p-8 bg-primary/5 border border-primary/20 text-center my-12">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <p className="text-sm text-muted-foreground mb-4">{subtitle}</p>
      <Link to={href}>
        <Button size="lg">
          {label} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </Link>
    </div>
  );
}
