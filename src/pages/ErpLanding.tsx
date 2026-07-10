import { Link } from "react-router-dom";
import { ArrowRight, Wrench, Users, FileText, BarChart3, Calendar, Package, Shield, Check, MessageCircle, Zap, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import SEOHead from "@/components/SEOHead";
import HeroMockup from "@/components/landing/HeroMockup";
import Reveal from "@/components/Reveal";
import LegalFooter from "@/components/LegalFooter";
import ThemeToggle from "@/components/ThemeToggle";
import { useEffect } from "react";
import { captureAdsParams, trackCtaClick } from "@/lib/gadsTracking";
import { trackLandingVisit } from "@/lib/landingTracker";
import { SITE_URL } from "@/lib/seoConfig";

const FEATURES = [
  { icon: Users, title: "Clientes & Veículos", desc: "Base completa de clientes, viaturas e histórico de intervenções sempre acessível." },
  { icon: FileText, title: "Orçamentos & Faturas", desc: "Orçamentos digitais com aceitação online, faturas sequenciais e exportação SAF-T." },
  { icon: Wrench, title: "Ordens de Serviço", desc: "Do orçamento à conclusão: acompanhe cada reparação em tempo real com fotos e checklists." },
  { icon: Calendar, title: "Agenda & Marcações", desc: "Portal público de marcações, lembretes automáticos e agenda multi-mecânico." },
  { icon: Package, title: "Stocks & Fornecedores", desc: "Peças, movimentos, alertas de rutura e ligação direta a fornecedores." },
  { icon: BarChart3, title: "Relatórios & KPIs", desc: "Faturação, produtividade, margens e retenção de clientes em painéis claros." },
  { icon: MessageCircle, title: "WhatsApp Integrado", desc: "Comunique com o cliente diretamente da OS, sem sair do sistema." },
  { icon: Building2, title: "Multi-Oficina & Equipas", desc: "Gestão centralizada de várias oficinas e permissões por função." },
];

const BENEFITS = [
  "Reduza a dependência de folhas de Excel e cadernos",
  "Aceite orçamentos com um clique via link partilhado",
  "Emita faturas em segundos, com IVA correto por país",
  "Acompanhe cada carro na oficina em tempo real",
  "Envie lembretes de revisão automaticamente",
  "Tenha relatórios prontos para o contabilista",
];

export default function ErpLanding() {
  useEffect(() => {
    captureAdsParams();
    trackLandingVisit();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        realm="erp"
        title="GarageFlow ERP — Software de Gestão para Oficinas Automóveis"
        description="Software completo para oficinas: orçamentos, ordens de serviço, faturação, stocks, agenda e WhatsApp. Testa grátis 30 dias, sem cartão."
        path="/erp"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "GarageFlow ERP",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web",
          description: "ERP completo para oficinas automóveis: orçamentos, OS, faturação, agenda, stocks e relatórios.",
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", url: `${SITE_URL}/erp` },
        }}
        breadcrumbs={[
          { name: "GarageFlow", url: `${SITE_URL}/` },
          { name: "ERP", url: `${SITE_URL}/erp` },
        ]}
      />

      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/85 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <div className="leading-tight">
              <div className="font-bold text-sm sm:text-base">GarageFlow <span className="text-primary">ERP</span></div>
              <div className="text-[10px] text-muted-foreground hidden sm:block">Software de Gestão para Oficinas</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth?mode=login" className="hidden sm:block">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/demo">
              <Button variant="outline" size="sm" className="hidden sm:inline-flex">Pedir Demo</Button>
            </Link>
            <Link to="/auth?mode=signup" onClick={() => trackCtaClick("erp_nav_signup")}>
              <Button size="sm" className="gradient-primary text-primary-foreground">Criar Conta</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent" />
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" /> Para oficinas automóveis
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            O ERP que a sua oficina<br />
            <span className="text-primary">merecia há anos.</span>
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Orçamentos, ordens de serviço, faturação, agenda e stocks — tudo num único sistema pensado para oficinas portuguesas.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth?mode=signup" onClick={() => trackCtaClick("erp_hero_signup")}>
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-lg text-base px-10 h-14 font-bold w-full sm:w-auto">
                Começar grátis 30 dias <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/demo" onClick={() => trackCtaClick("erp_hero_demo")}>
              <Button size="lg" variant="outline" className="text-base px-8 h-14 w-full sm:w-auto">
                Pedir demonstração
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">Sem cartão de crédito · Cancela quando quiseres</p>

          <Reveal delay={150} className="mt-12 sm:mt-16 max-w-5xl mx-auto">
            <HeroMockup />
          </Reveal>
        </div>
      </header>

      {/* Features grid */}
      <section className="py-16 sm:py-24 px-4 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Badge variant="outline" className="mb-3">Funcionalidades</Badge>
            <h2 className="text-2xl sm:text-4xl font-bold mb-3">Tudo o que a sua oficina precisa</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">Do primeiro contacto com o cliente à fatura final — num único sistema.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="p-5 rounded-2xl border border-border bg-card hover:border-primary/40 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 sm:py-20 px-4 bg-muted/30 border-y border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Porque as oficinas escolhem o GarageFlow</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {BENEFITS.map((b) => (
              <div key={b} className="flex items-start gap-2.5 p-3">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm sm:text-base">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center bg-gradient-to-br from-primary/10 via-primary/5 to-background">
        <div className="max-w-3xl mx-auto">
          <Shield className="w-12 h-12 mx-auto text-primary mb-4" />
          <h2 className="text-2xl sm:text-4xl font-bold mb-4">Comece a gerir a sua oficina de forma profissional</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            30 dias grátis, sem cartão, sem compromisso. Configure em minutos, importe clientes num CSV e emita a primeira fatura ainda hoje.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth?mode=signup" onClick={() => trackCtaClick("erp_bottom_signup")}>
              <Button size="lg" className="gradient-primary text-primary-foreground text-base px-10 h-14 font-bold">
                Criar conta grátis <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="text-base px-8 h-14">Falar com a equipa</Button>
            </Link>
          </div>
        </div>
      </section>

      <LegalFooter />
    </div>
  );
}
