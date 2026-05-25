import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, BookOpen } from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { BLOG_POSTS } from "@/lib/seoBlogPT";
import { supabase } from "@/integrations/supabase/client";

const SITE = "https://garageflow-pt.lovable.app";

type ListItem = {
  slug: string;
  title: string;
  description: string;
  category: string;
  excerpt: string;
  publishedAt: string;
};

export default function SeoBlogIndex() {
  const [dbPosts, setDbPosts] = useState<ListItem[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("seo_blog_posts" as any)
        .select("slug,title,meta_description,excerpt,category,published_at")
        .eq("status", "published")
        .order("published_at", { ascending: false });
      setDbPosts(
        ((data as any[]) || []).map((p) => ({
          slug: p.slug,
          title: p.title,
          description: p.meta_description || p.excerpt || "",
          excerpt: p.excerpt || p.meta_description || "",
          category: p.category,
          publishedAt: p.published_at,
        }))
      );
    })();
  }, []);

  // Merge: DB posts first (newer), then static, dedupe by slug
  const staticItems: ListItem[] = BLOG_POSTS.map((p) => ({
    slug: p.slug, title: p.title, description: p.description, excerpt: p.excerpt,
    category: p.category, publishedAt: p.publishedAt,
  }));
  const seen = new Set<string>();
  const all = [...dbPosts, ...staticItems].filter((p) => {
    if (seen.has(p.slug)) return false;
    seen.add(p.slug);
    return true;
  });

  const url = `${SITE}/blog`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog GarageFlow — gestão de oficinas auto",
    url,
    blogPost: all.map((p) => ({
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      url: `${SITE}/blog/${p.slug}`,
      datePublished: p.publishedAt,
      author: { "@type": "Organization", name: "GarageFlow" },
    })),
  };

  return (
    <LandingLayout>
      <Helmet>
        <title>Blog GarageFlow — Gestão de Oficinas Auto em Portugal</title>
        <meta name="description" content="Artigos práticos sobre gestão de oficinas auto: orçamentos, faturação, clientes e produtividade. Em português, escrito para oficinas reais." />
        <link rel="canonical" href={url} />
        <meta property="og:title" content="Blog GarageFlow — gestão de oficinas auto" />
        <meta property="og:description" content="Dicas práticas para oficinas em Portugal." />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <section className="pt-20 sm:pt-24 pb-16 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-4">
            <BookOpen className="w-3.5 h-3.5" /> Blog GarageFlow
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">
            Como gerir uma oficina auto, na prática
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Artigos curtos e úteis sobre organização, faturação, clientes e produtividade — para oficinas portuguesas.
          </p>
        </header>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {all.map((p) => (
            <Link
              key={p.slug}
              to={`/blog/${p.slug}`}
              className="group block p-5 rounded-xl border border-border bg-card hover:border-primary hover:shadow-md transition-all"
            >
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">{p.category}</span>
              <h2 className="font-semibold mt-2 mb-2 group-hover:text-primary transition-colors">
                {p.title}
              </h2>
              <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>
              <span className="inline-flex items-center gap-1 text-sm text-primary mt-3 font-medium">
                Ler artigo <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </LandingLayout>
  );
}
