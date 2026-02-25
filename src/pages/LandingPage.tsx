import { Link } from "react-router-dom";
import { Wrench, BarChart3, Users, FileText, Shield, Zap, Globe, CreditCard, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  { icon: FileText, title: "Orçamentos Inteligentes", desc: "Crie orçamentos profissionais em segundos com cálculo automático de IVA e margens." },
  { icon: Wrench, title: "Gestão de Serviços", desc: "Acompanhe o ciclo completo: diagnóstico, aprovação, execução e entrega." },
  { icon: Users, title: "Base de Clientes", desc: "Ficha de cliente completa com veículos, histórico de serviços e alertas automáticos." },
  { icon: BarChart3, title: "Dashboard em Tempo Real", desc: "KPIs financeiros, métricas de performance e relatórios avançados num só lugar." },
  { icon: Shield, title: "Multi-Oficina & Equipas", desc: "Gerencie múltiplas oficinas com permissões por equipa e isolamento total de dados." },
  { icon: Zap, title: "Alertas Automáticos", desc: "Revisões, inspeções, garantias e follow-ups automáticos para nunca perder uma oportunidade." },
];

const plans = [
  {
    name: "Free", price: "0€", period: "/mês",
    features: ["10 orçamentos/mês", "1 utilizador", "Dashboard básico", "Gestão de clientes"],
    cta: "Começar Grátis", highlighted: false,
  },
  {
    name: "Pro", price: "49€", period: "/mês",
    features: ["Orçamentos ilimitados", "Até 5 utilizadores", "Alertas inteligentes", "Relatórios avançados", "Emails com branding", "30 dias grátis"],
    cta: "Experimentar Pro", highlighted: true,
  },
  {
    name: "Garage", price: "99€", period: "/mês",
    features: ["Tudo do Pro", "Utilizadores ilimitados", "Multi-oficina", "API & Webhooks", "Suporte prioritário", "White-label"],
    cta: "Contactar Vendas", highlighted: false,
  },
];

const stats = [
  { value: "500+", label: "Oficinas ativas" },
  { value: "98%", label: "Uptime garantido" },
  { value: "50k+", label: "Orçamentos criados" },
  { value: "4.9★", label: "Avaliação média" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Garage<span className="text-primary">Flow</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Preços</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/auth">
              <Button size="sm" className="gradient-primary text-primary-foreground shadow-md">
                Começar Grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-32 pb-20 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" />
            Software #1 para Oficinas Automóvel
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Gestão de oficina
            <br />
            <span className="text-primary">simples e poderosa</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Orçamentos, serviços, clientes e faturação numa única plataforma SaaS.
            Automatize a sua oficina e foque no que importa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-lg text-base px-8">
                Começar Grátis <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-base px-8">
                Ver Funcionalidades
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* Social proof */}
      <section className="py-12 border-y border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <p className="text-3xl font-bold text-primary mono">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Tudo o que a sua oficina precisa</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Do orçamento à entrega, o GarageFlow cobre todo o fluxo operacional da sua oficina.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(f => (
              <article key={f.title} className="bg-card border border-border rounded-xl p-6 hover:shadow-md hover:border-primary/20 transition-all group">
                <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-muted/30 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Planos transparentes</h2>
            <p className="text-muted-foreground text-lg">Sem custos escondidos. Upgrade ou downgrade a qualquer momento.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div
                key={plan.name}
                className={`bg-card rounded-xl p-6 border-2 transition-all ${
                  plan.highlighted
                    ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {plan.highlighted && (
                  <div className="text-xs font-bold text-primary uppercase tracking-wider mb-3">Mais Popular</div>
                )}
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <div className="mt-2 mb-6">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to="/auth">
                  <Button
                    className={`w-full ${plan.highlighted ? "gradient-primary text-primary-foreground" : ""}`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Pronto para transformar a sua oficina?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Junte-se a centenas de oficinas que já usam o GarageFlow para crescer.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gradient-primary text-primary-foreground shadow-lg text-base px-10">
              Criar Conta Grátis <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center">
              <Wrench className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">GarageFlow Pro</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Funcionalidades</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Preços</a>
            <Globe className="w-3.5 h-3.5" />
            <span>PT | EN | ES</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GarageFlow Pro. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
