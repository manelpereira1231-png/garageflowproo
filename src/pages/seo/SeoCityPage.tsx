import { useParams, useLocation, Navigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, CheckCircle2, MapPin, Wrench } from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { Button } from "@/components/ui/button";
import { SEO_CITY_BY_SLUG } from "@/lib/seoPagesPT";
import { detectIntent, INTENT_COPY } from "@/lib/seoCityCopy";

const SITE = "https://garageflow.pt";


export default function SeoCityPage() {
  const { cidade } = useParams();
  const { pathname } = useLocation();
  const slug = (cidade || "").toLowerCase();
  const city = SEO_CITY_BY_SLUG[slug];
  if (!city) return <Navigate to="/" replace />;

  const intent = detectIntent(pathname);
  const copy = INTENT_COPY[intent];
  const path = `${copy.prefix}/${city.slug}`;
  const url = `${SITE}/${path}`;

  const benefits = [
    { title: "Pensado em Portugal", desc: "Suporte em português e adaptado à realidade das oficinas portuguesas." },
    { title: "Funciona em qualquer dispositivo", desc: "Telemóvel, tablet ou PC — basta abrir o browser." },
    { title: "Sem instalação", desc: "Crie conta e está a usar em menos de 5 minutos." },
    { title: "Tudo ligado", desc: "Clientes, viaturas, orçamentos e faturas no mesmo sítio." },
  ];
  const features = [
    { title: "Orçamentos digitais", desc: "Envie por email ou WhatsApp e o cliente aprova online." },
    { title: "Ordens de serviço", desc: "Acompanhe cada reparação com fotos e materiais." },
    { title: "Histórico por viatura", desc: "Veja tudo o que foi feito a cada carro." },
    { title: "Faturação simples", desc: "Faturas e recibos prontos a entregar." },
    { title: "Agendamentos online", desc: "Os clientes marcam diretamente no link da oficina." },
    { title: "App no telemóvel", desc: "Mecânico atualiza o estado da reparação na hora." },
  ];
  const faqs = [
    copy.uniqueFaq(city.name),
    { q: "Preciso de internet rápida?", a: "Não. Funciona bem em ligações normais." },
    { q: "Posso experimentar antes de pagar?", a: "Sim. 30 dias grátis com acesso a tudo, sem cartão de crédito." },
    { q: `Onde está sediado o GarageFlow?`, a: `O GarageFlow é uma marca portuguesa, com suporte em PT-PT e dados em servidores europeus.` },
  ];
  const related = [
    { label: `Oficinas em ${city.name}`, to: `/oficinas/${city.slug}` },
    { label: `Gestão de oficinas em ${city.name}`, to: `/gestao-oficinas/${city.slug}` },
    { label: `ERP para oficinas em ${city.name}`, to: `/erp-automovel/${city.slug}` },
    { label: `Software para oficinas em ${city.name}`, to: `/software-oficinas/${city.slug}` },
  ].filter((r) => r.to !== `/${path}`);

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: `GarageFlow — ${city.name}`,
      description: `Software de gestão para oficinas automóveis em ${city.name} (${city.region}).`,
      url,
      areaServed: { "@type": "City", name: city.name },
      address: { "@type": "PostalAddress", addressLocality: city.name, addressRegion: city.region, addressCountry: "PT" },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Início", item: SITE },
        { "@type": "ListItem", position: 2, name: city.name, item: url },
      ],
    },
  ];

  return (
    <LandingLayout>
      <Helmet>
        <title>{copy.title(city.name)}</title>
        <meta name="description" content={copy.description(city.name, city.region)} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={copy.title(city.name)} />
        <meta property="og:description" content={copy.description(city.name, city.region)} />
        <meta property="og:url" content={url} />
        <meta property="og:image" content={`${SITE}/og-image.jpg`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <article className="pt-20 sm:pt-24 pb-16">
        <header className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5">
            <MapPin className="w-3.5 h-3.5" /> {city.name} · {city.region}
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-5">{copy.h1(city.name)}</h1>
          <div className="text-base sm:text-lg text-muted-foreground space-y-3 max-w-3xl mx-auto">
            {copy.intro(city.name, city.region).map((p, i) => <p key={i}>{p}</p>)}
          </div>
          <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="w-full sm:w-auto">
                Testar grátis 30 dias <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link to="/#pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">Ver preços</Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Sem cartão de crédito · Suporte em português
          </p>
        </header>

        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-5 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" /> A solução para oficinas em {city.name}
          </h2>
          <div className="text-muted-foreground space-y-3 text-base sm:text-lg">
            {copy.solution(city.name, city.region).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Porquê o GarageFlow em {city.name}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b) => (
              <div key={b.title} className="p-5 rounded-xl border border-border bg-card">
                <CheckCircle2 className="w-5 h-5 text-primary mb-3" />
                <h3 className="font-semibold mb-1.5">{b.title}</h3>
                <p className="text-sm text-muted-foreground">{b.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-8 text-center">Funcionalidades</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="p-5 rounded-xl border border-border bg-background">
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">Perguntas frequentes</h2>
          <div className="space-y-4">
            {faqs.map((f) => (
              <details key={f.q} className="group border border-border rounded-lg p-4 bg-card">
                <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
                  {f.q}
                  <span className="text-muted-foreground group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 mt-16">
          <h2 className="text-xl font-bold mb-4">Continuar a explorar</h2>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {related.map((r) => (
              <li key={r.to}>
                <Link to={r.to} className="block p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium">
                  {r.label} →
                </Link>
              </li>
            ))}
          </ul>
        </section>

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
