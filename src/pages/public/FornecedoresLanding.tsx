import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Store, TrendingUp, Truck, ShieldCheck, Zap, Globe2 } from "lucide-react";
import { useSystemFeature } from "@/hooks/useSystemFeature";

export default function FornecedoresLanding() {
  const { enabled } = useSystemFeature("supplier_network_enabled");

  const benefits = [
    { icon: TrendingUp, title: "Acesso a milhares de oficinas", desc: "Distribuição direta para a rede GarageFlow em Portugal e Europa." },
    { icon: Zap, title: "Onboarding rápido", desc: "Ative a sua loja em poucos dias, sem custos iniciais." },
    { icon: Truck, title: "Integrado com transportadoras", desc: "Etiquetas e tracking automáticos com CTT, DPD e outros." },
    { icon: ShieldCheck, title: "Pagamentos seguros", desc: "Stripe Connect com transferências automáticas." },
    { icon: Globe2, title: "Faturação integrada", desc: "Suporte para Moloni, InvoiceXpress e SAF-T." },
    { icon: Store, title: "Página pública dedicada", desc: "Perfil próprio com catálogo, avaliações e localização." },
  ];

  const faq = [
    { q: "Quanto custa aderir?", a: "A adesão é gratuita. Cobramos apenas uma comissão sobre vendas concluídas." },
    { q: "Quem pode candidatar-se?", a: "Empresas legalmente constituídas com NIF válido e stock de peças automóveis." },
    { q: "Quanto tempo demora a aprovação?", a: "Tipicamente 2 a 5 dias úteis após submissão completa." },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Fornecedor de Peças Automóveis | GarageFlow</title>
        <meta name="description" content="Venda peças automóveis diretamente para oficinas através da rede Supplier Network do GarageFlow." />
        <link rel="canonical" href="https://garageflow.pt/fornecedores" />
        <meta property="og:title" content="Fornecedor de Peças Automóveis | GarageFlow" />
        <meta property="og:description" content="Junte-se à maior rede B2B de peças automóveis integrada num ERP de oficinas." />
        <meta property="og:url" content="https://garageflow.pt/fornecedores" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org", "@type": "FAQPage",
          mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
        })}</script>
      </Helmet>

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-6xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full mb-6">
            <Store className="w-3.5 h-3.5" /> GarageFlow Supplier Network
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Venda peças automóveis diretamente para oficinas
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Junte-se à maior rede B2B de peças integrada num ERP de oficinas.
            Sem custos iniciais, sem mensalidades.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" asChild>
              <Link to="/fornecedores/candidatura">Quero vender no GarageFlow</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#beneficios">Saber mais</a>
            </Button>
          </div>
          {!enabled && (
            <p className="mt-6 text-xs text-muted-foreground">
              Neste momento aceitamos candidaturas apenas por convite.
            </p>
          )}
        </div>
      </section>

      {/* Benefits */}
      <section id="beneficios" className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">Porquê aderir à rede?</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {benefits.map((b) => {
            const Icon = b.icon;
            return (
              <Card key={b.title}>
                <CardContent className="p-6">
                  <Icon className="w-6 h-6 text-primary mb-3" />
                  <h3 className="font-semibold mb-1">{b.title}</h3>
                  <p className="text-sm text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border bg-muted/30">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl font-bold text-center mb-8">Perguntas frequentes</h2>
          <div className="space-y-4">
            {faq.map((f) => (
              <Card key={f.q}>
                <CardContent className="p-5">
                  <h3 className="font-medium mb-1">{f.q}</h3>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="text-center mt-10">
            <Button size="lg" asChild><Link to="/fornecedores/candidatura">Submeter candidatura</Link></Button>
          </div>
        </div>
      </section>
    </div>
  );
}
