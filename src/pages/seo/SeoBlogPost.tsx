import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, ArrowLeft, Clock } from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { Button } from "@/components/ui/button";
import { BLOG_BY_SLUG } from "@/lib/seoBlogPT";

const SITE = "https://garageflow-pt.lovable.app";

export default function SeoBlogPost() {
  const { slug } = useParams();
  const post = BLOG_BY_SLUG[(slug || "").toLowerCase()];
  if (!post) return <Navigate to="/blog" replace />;

  const url = `${SITE}/blog/${post.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
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
        { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 2, name: post.title, item: url },
      ],
    },
  ];

  return (
    <LandingLayout>
      <Helmet>
        <title>{post.title} | GarageFlow</title>
        <meta name="description" content={post.description} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:url" content={url} />
        <meta property="article:published_time" content={post.publishedAt} />
        <meta property="article:section" content={post.category} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <article className="pt-20 sm:pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao blog
        </Link>
        <span className="text-xs font-semibold text-primary uppercase tracking-wide">{post.category}</span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 mb-3">{post.title}</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-8">
          <Clock className="w-3.5 h-3.5" /> {post.readingMinutes} min de leitura
        </div>
        <p className="text-lg text-muted-foreground mb-8">{post.excerpt}</p>

        {post.sections.map((s) => (
          <section key={s.h2} className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold mb-3">{s.h2}</h2>
            <div className="text-muted-foreground space-y-3">
              {s.body.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        <div className="rounded-2xl p-6 sm:p-8 bg-primary/5 border border-primary/20 text-center my-10">
          <h3 className="text-xl font-bold mb-2">Comece hoje. Sem cartão.</h3>
          <p className="text-sm text-muted-foreground mb-4">30 dias grátis. Tudo o que precisa para gerir a sua oficina.</p>
          <Link to="/auth?mode=signup">
            <Button size="lg">
              Testar grátis 30 dias <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        {post.related.length > 0 && (
          <section className="mt-10">
            <h3 className="text-base font-bold mb-3">Continuar a ler</h3>
            <ul className="space-y-2">
              {post.related.map((r) => (
                <li key={r.to}>
                  <Link to={r.to} className="text-sm text-primary hover:underline">
                    {r.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </LandingLayout>
  );
}
