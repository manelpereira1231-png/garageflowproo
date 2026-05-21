import { useParams, Link, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, ArrowRight, Wrench } from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { Button } from "@/components/ui/button";
import { SEO_PAGE_BY_SLUG, type SeoPageContent } from "@/lib/seoPagesPT";

const SITE = "https://garageflow-pt.lovable.app";

interface Props {
  /** Forçar uma página específica (em vez de usar :slug do URL) */
  page?: SeoPageContent;
}

export default function SeoLandingPage({ page: forcedPage }: Props) {
  const { slug } = useParams();
  const page = forcedPage ?? (slug ? SEO_PAGE_BY_SLUG[slug] : undefined);

  if (!page) {
    return <Navigate to="/" replace />;
  }

  const url = `${SITE}/${page.slug}`;
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <LandingLayout>
      <Helmet>
        <title>{page.title}</title>
        <meta name="description" content={page.description} />
        <meta name="keywords" content={page.keywords} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={page.title} />
        <meta property="og:description" content={page.description} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE}/og-image.jpg`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={page.title} />
        <meta name="twitter:description" content={page.description} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <article className="pt-20 sm:pt-24 pb-16">
        {/* HERO */}
        <header className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
            <Wrench className="w-3.5 h-3.5" /> GarageFlow
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-5">
            {page.h1}
          </h1>
          <div className="text-base sm:text-lg text-muted-foreground space-y-3 max-w-3xl mx-auto">
            {page.intro.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="w-full sm:w-auto">
                {page.ctaLabel ?? "Testar grátis 30 dias"} <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/#pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                Ver preços
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Sem cartão de crédito · Acesso a todas as funcionalidades
          </p>
        </header>

        {/* SOLUTION */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-5">A solução com o GarageFlow</h2>
          <div className="text-muted-foreground space-y-3 text-base sm:text-lg">
            {page.solution.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>

        {/* BENEFITS */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            Porquê o GarageFlow
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {page.benefits.map((b) => (
              <div key={b.title} className="p-5 rounded-xl border border-border bg-card">
                <CheckCircle2 className="w-5 h-5 text-primary mb-3" />
                <h3 className="font-semibold mb-1.5">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* FEATURES */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">
            Funcionalidades reais
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {page.features.map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-border bg-background">
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA MID */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <div className="rounded-2xl p-8 sm:p-10 bg-primary/5 border border-primary/20 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">
              Pronto para experimentar?
            </h2>
            <p className="text-muted-foreground mb-6">
              30 dias grátis. Sem cartão. Cancela quando quiser.
            </p>
            <Link to="/auth?mode=signup">
              <Button size="lg">
                Criar conta grátis <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </section>

        {/* FAQ */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">Perguntas frequentes</h2>
          <div className="space-y-4">
            {page.faqs.map((f) => (
              <details
                key={f.q}
                className="group border border-border rounded-lg p-4 bg-card"
              >
                <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
                  {f.q}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* RELATED */}
        {page.related.length > 0 && (
          <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
            <h2 className="text-xl font-bold mb-4">Continuar a ler</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {page.related.map((r) => (
                <li key={r.to}>
                  <Link
                    to={r.to}
                    className="block p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium"
                  >
                    {r.label} →
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* FOOTER CTA */}
        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16 text-center">
          <Link to="/auth?mode=signup">
            <Button size="lg" className="w-full sm:w-auto">
              Começar teste grátis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </section>
      </article>
    </LandingLayout>
  );
}
