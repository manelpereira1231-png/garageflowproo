import { useState, useEffect, useRef } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Link } from "react-router-dom";
import { Wrench, BarChart3, Users, FileText, Shield, Zap, ArrowRight, CheckCircle, Menu, X, Check, Lock, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";
import { getRegionalPricing, formatPrice } from "@/lib/regionConfig";
import { captureAdsParams, trackCtaClick, trackPricingView, trackScrollDepth } from "@/lib/gadsTracking";
import { trackLandingVisit } from "@/lib/landingTracker";
import SEOHead from "@/components/SEOHead";
import LanguageDropdown from "@/components/LanguageDropdown";
import ThemeToggle from "@/components/ThemeToggle";
import Reveal from "@/components/Reveal";
import HeroMockup from "@/components/landing/HeroMockup";
import SpreadsheetMockup from "@/components/landing/SpreadsheetMockup";
import WhatsAppMockup from "@/components/landing/WhatsAppMockup";
import { SITE_URL } from "@/lib/seoConfig";

const featureIcons = [FileText, Wrench, Users, BarChart3, Shield, Zap];
const featureKeys = ['1', '2', '3', '4', '5', '6'];

const langLabels: Record<Language, string> = { pt: 'PT', 'pt-BR': 'BR', en: 'EN', es: 'ES', hi: 'हि' };
const languages: Language[] = ['pt', 'pt-BR', 'en', 'es', 'hi'];

export default function LandingPage() {
  const { t, language, setLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  // Re-read pricing on demand so admin updates (country_settings) reflect live.
  const [pricingRev, setPricingRev] = useState(0);
  const pricing = getRegionalPricing();
  const scrollTracked = useRef<Set<number>>(new Set());

  // Capture gclid/UTM params + scroll depth tracking + live pricing updates
  useEffect(() => {
    captureAdsParams();
    trackLandingVisit();

    const handleScroll = () => {
      const scrollPercent = Math.round(
        (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100
      );
      [25, 50, 75, 90].forEach(milestone => {
        if (scrollPercent >= milestone && !scrollTracked.current.has(milestone)) {
          scrollTracked.current.add(milestone);
          trackScrollDepth(milestone);
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Live update when admin changes pricing in /admin/countries
    const onPricingUpdate = () => setPricingRev((r) => r + 1);
    window.addEventListener('garageflow:pricing-updated', onPricingUpdate);
    window.addEventListener('garageflow:country-detected', onPricingUpdate);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('garageflow:pricing-updated', onPricingUpdate);
      window.removeEventListener('garageflow:country-detected', onPricingUpdate);
    };
  }, []);
  void pricingRev; // referenced to force re-render on pricing event
  const planConfigs = [
    {
      nameKey: 'landing.planFree',
      price: formatPrice(0),
      periodKey: '',
      subtitleKey: '',
      featureKeys: ['landing.feat.quotes10', 'landing.feat.1user', 'landing.feat.basicDash', 'landing.feat.watermarkPdf'],
      lockedFeatureKeys: ['landing.feat.5users', 'landing.feat.basicAlerts', 'landing.feat.advancedReports', 'landing.feat.automations'],
      ctaKey: 'landing.ctaFree',
      highlighted: false,
    },
    {
      nameKey: 'landing.planPro',
      price: formatPrice(pricing.pro[billingCycle]),
      periodKey: billingCycle === 'monthly' ? 'landing.perMonth' : 'landing.perYear',
      subtitleKey: 'landing.trial30',
      featureKeys: ['landing.feat.unlimitedQuotes', 'landing.feat.5users', 'landing.feat.fullDash', 'landing.feat.proPdf', 'landing.feat.basicAlerts', 'landing.feat.autoEmails', 'landing.feat.export'],
      lockedFeatureKeys: ['landing.feat.automations', 'landing.feat.advancedReports', 'landing.feat.multiShop', 'landing.feat.chatbot', 'landing.feat.api'],
      ctaKey: 'landing.ctaPro',
      highlighted: true,
    },
    {
      nameKey: 'landing.planGarage',
      price: formatPrice(pricing.garage[billingCycle]),
      periodKey: billingCycle === 'monthly' ? 'landing.perMonth' : 'landing.perYear',
      subtitleKey: 'landing.trial30',
      featureKeys: ['landing.feat.unlimitedQuotes', 'landing.feat.unlimitedUsers', 'landing.feat.advancedDash', 'landing.feat.proPdf', 'landing.feat.advancedAlerts', 'landing.feat.automations', 'landing.feat.advancedReports', 'landing.feat.multiShop', 'landing.feat.chatbot', 'landing.feat.api'],
      lockedFeatureKeys: [],
      ctaKey: 'landing.ctaGarage',
      highlighted: false,
    },
  ];

  const idealForKeys = ['landing.idealFor1', 'landing.idealFor2', 'landing.idealFor3', 'landing.idealFor4', 'landing.idealFor5'];

  // Rich SEO JSON-LD: SoftwareApplication + Organization + FAQPage
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "GarageFlow",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS, Android",
      url: SITE_URL,
      description: t('landing.heroSubtitle'),
      offers: {
        "@type": "Offer",
        price: String(pricing.pro.monthly),
        priceCurrency: pricing.currency || "EUR",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "GarageFlow",
      url: SITE_URL,
      logo: `${SITE_URL}/og-image.jpg`,
      sameAs: ["https://garageflow.pt"],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [1, 2, 3, 4, 5, 6].map((i) => ({
        "@type": "Question",
        name: t(`landing.faq${i}Q`),
        acceptedAnswer: { "@type": "Answer", text: t(`landing.faq${i}A`) },
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead realm="erp" path="/" jsonLd={jsonLd} />
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Garage<span className="text-primary">Flow</span>
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t('landing.navFeatures')}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t('landing.navPricing')}</a>
            <Link to="/afiliados" className="hover:text-foreground transition-colors">{t('landing.navAffiliates')}</Link>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <LanguageDropdown />
            <ThemeToggle />
            <Link to="/auth?mode=login">
              <Button variant="ghost" size="sm">{t('landing.login')}</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="gradient-primary text-primary-foreground shadow-md">
                {t('landing.ctaDemo')}
              </Button>
            </Link>
          </div>
          <div className="sm:hidden flex items-center gap-1">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              className="p-2 rounded-lg hover:bg-muted transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden bg-background border-t border-border px-4 py-4 space-y-3 animate-fade-in">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2">{t('landing.navFeatures')}</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2">{t('landing.navPricing')}</a>
            <Link to="/afiliados" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2">{t('landing.navAffiliates')}</Link>
            <div className="py-2">
              <LanguageDropdown />
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Link to="/auth?mode=login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">{t('landing.login')}</Button>
              </Link>
              <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full gradient-primary text-primary-foreground">{t('landing.ctaDemo')}</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <header className="pt-28 sm:pt-32 pb-16 sm:pb-20 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" />
            {t('landing.badge')}
          </div>
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            {t('landing.heroTitle1')}
            <br />
            <span className="text-primary">{t('landing.heroTitle2')}</span>
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 px-4">
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
            <Link to="/auth?mode=signup" className="w-full sm:w-auto" onClick={() => trackCtaClick('hero_demo')}>
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-lg text-base px-10 h-14 text-lg font-bold w-full sm:w-auto btn-interactive">
                {t('landing.ctaDemo')} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/auth?mode=signup" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="text-base px-8 h-14 w-full sm:w-auto btn-interactive">
                {t('landing.cta')}
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">{t('landing.noCreditCard')}</p>

          {/* Hero product mockup */}
          <Reveal delay={150} className="mt-12 sm:mt-16 max-w-5xl mx-auto px-2 sm:px-0">
            <div className="relative">
              <HeroMockup />
            </div>
          </Reveal>
        </div>
      </header>

      {/* Ideal For section */}
      <Reveal>
      <section className="py-10 sm:py-14 px-4 border-b border-border">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold mb-6">{t('landing.idealForTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-xl mx-auto">
            {idealForKeys.map(key => (
              <div key={key} className="flex items-start gap-2.5">
                <Check className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span className="text-sm text-muted-foreground">{t(key)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Visual showcase: Spreadsheet + WhatsApp */}
      <section className="py-16 sm:py-24 px-4 bg-gradient-to-b from-background via-muted/20 to-background border-b border-border overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <Reveal className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold mb-3">{t('landing.featuresTitle')}</h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">{t('landing.featuresSubtitle')}</p>
          </Reveal>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center">
            <Reveal delay={100}>
              <SpreadsheetMockup />
              <div className="mt-5">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" /> {t('landing.feat1Title')}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.feat1Desc')}</p>
              </div>
            </Reveal>
            <Reveal delay={250}>
              <WhatsAppMockup />
              <div className="mt-5">
                <h3 className="text-lg sm:text-xl font-semibold mb-2 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-primary" /> WhatsApp + SMS
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{t('landing.feat3Desc')}</p>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Honest launch banner — early adopter */}
      <Reveal>
      <section aria-label="Em lançamento" className="py-10 sm:py-12 px-4 border-b border-border bg-muted/20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4">
            <Zap className="w-3 h-3" /> Em lançamento · early adopters
          </div>
          <h2 className="text-xl sm:text-2xl font-bold mb-3">Sê uma das primeiras oficinas a usar o GarageFlow</h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Estamos a arrancar. Quem entrar agora ajuda a moldar o produto e fica com{" "}
            <span className="font-semibold text-foreground">30 dias grátis no plano Pro</span>, sem cartão de crédito.
          </p>
        </div>
      </section>
      </Reveal>

      {/* Features */}
      <Reveal>
      <section id="features" className="py-16 sm:py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">{t('landing.featuresTitle')}</h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              {t('landing.featuresSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {featureKeys.map((key, i) => {
              const Icon = featureIcons[i];
              return (
                <article key={key} className="bg-card border border-border rounded-xl p-5 sm:p-6 hover:shadow-md hover:border-primary/20 transition-all group">
                  <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-3 sm:mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold mb-2">{t(`landing.feat${key}Title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`landing.feat${key}Desc`)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Built by people who know workshops — replaces fake testimonials */}
      <Reveal>
      <section aria-labelledby="principles-title" className="py-16 sm:py-20 px-4 bg-muted/20 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-12">
            <h2 id="principles-title" className="text-2xl sm:text-4xl font-bold mb-4">Construído com oficinas reais</h2>
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
              Nada de promessas vazias. Estes são os princípios que guiam cada funcionalidade.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              { icon: Zap, title: "Rápido a usar", desc: "Criar um orçamento demora menos de 1 minuto. Tudo a 2 cliques." },
              { icon: Shield, title: "Os teus dados são teus", desc: "RGPD, encriptação ponta-a-ponta, exporta tudo quando quiseres." },
              { icon: CheckCircle, title: "Honesto", desc: "Sem letras pequenas. Cancela quando quiseres. 30 dias Pro grátis sem cartão." },
            ].map(({ icon: Icon, title, desc }) => (
              <article key={title} className="bg-card border border-border rounded-xl p-5 sm:p-6">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* Excel vs GarageFlow comparison */}
      <Reveal>
      <section aria-labelledby="compare-title" className="py-16 sm:py-20 px-4 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 id="compare-title" className="text-2xl sm:text-4xl font-bold mb-3">Excel vs GarageFlow</h2>
            <p className="text-muted-foreground text-base sm:text-lg">Porque a folha de cálculo já não chega para gerir uma oficina moderna.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Tarefa diária</th>
                  <th className="text-center px-4 py-3 font-semibold">Excel / Papel</th>
                  <th className="text-center px-4 py-3 font-semibold text-primary">GarageFlow</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Enviar orçamento ao cliente", "10 min · email manual", "30 seg · WhatsApp + 1 clique"],
                  ["Saber quanto faturei este mês", "Calcular à mão", "Automático, em tempo real"],
                  ["Encontrar histórico de uma viatura", "Procurar em pastas", "Pesquisa por matrícula"],
                  ["Stock de peças sempre atualizado", "Quase nunca", "Desconta automaticamente"],
                  ["Lembrar revisões aos clientes", "Esquecido", "SMS/email automáticos"],
                  ["Aceder em qualquer dispositivo", "Não", "PC, tablet e telemóvel"],
                ].map(([task, excel, gf]) => (
                  <tr key={task} className="border-t border-border/60">
                    <td className="px-4 py-3 font-medium">{task}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground text-xs sm:text-sm">{excel}</td>
                    <td className="px-4 py-3 text-center text-foreground font-semibold text-xs sm:text-sm bg-primary/5">
                      <span className="inline-flex items-center gap-1.5"><CheckCircle className="w-4 h-4 text-success" />{gf}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
      </Reveal>

      {/* Trust bar */}
      <Reveal>
      <section aria-label="Confiança e segurança" className="py-8 sm:py-10 px-4 border-t border-border bg-muted/20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { icon: Shield, label: "RGPD", sub: "Dados na UE" },
            { icon: Lock, label: "SSL/TLS", sub: "Encriptação ponta-a-ponta" },
            { icon: CheckCircle, label: "Backups diários", sub: "Sem perda de dados" },
            { icon: Zap, label: "99,9% uptime", sub: "Sempre disponível" },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <Icon className="w-6 h-6 text-primary" />
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">{sub}</p>
            </div>
          ))}
        </div>
      </section>
      </Reveal>

      {/* Pricing */}
      <Reveal>
      <section id="pricing" className="py-16 sm:py-20 px-4 bg-muted/30 border-t border-border" onMouseEnter={() => trackPricingView()}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-14">
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">{t('landing.pricingTitle')}</h2>
            <p className="text-muted-foreground text-base sm:text-lg">{t('landing.pricingSubtitle')}</p>
          </div>

          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === 'monthly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('billing.monthly')}
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billingCycle === 'yearly' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('billing.yearly')}
              <Badge variant="secondary" className="ml-2 bg-success/10 text-success text-xs">
                {pricing.annualSavingsLabel}
              </Badge>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
            {planConfigs.map(plan => (
              <div
                key={plan.nameKey}
                className={`bg-card rounded-xl p-5 sm:p-6 border-2 transition-all ${
                  plan.highlighted
                    ? "border-primary shadow-lg shadow-primary/10 md:scale-[1.02]"
                    : "border-border hover:border-primary/30"
                }`}
              >
                {plan.highlighted && (
                  <div className="text-xs font-bold text-primary uppercase tracking-wider mb-3">{t('landing.popular')}</div>
                )}
                <h3 className="text-xl font-bold">{t(plan.nameKey)}</h3>
                <div className="mt-2 mb-2">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.periodKey && <span className="text-muted-foreground text-sm">{t(plan.periodKey)}</span>}
                </div>
                {plan.subtitleKey ? (
                  <p className="text-xs text-muted-foreground mb-5 sm:mb-6">{t(plan.subtitleKey)}</p>
                ) : (
                  <div className="mb-5 sm:mb-6" />
                )}
                <ul className="space-y-2.5 sm:space-y-3 mb-6 sm:mb-8">
                  {plan.featureKeys.map(fk => (
                    <li key={fk} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
                      {t(fk)}
                    </li>
                  ))}
                  {plan.lockedFeatureKeys.map(fk => (
                    <li key={`locked-${fk}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      {t(fk)}
                    </li>
                  ))}
                </ul>
                <Link to="/auth?mode=signup">
                  <Button
                    className={`w-full ${plan.highlighted ? "gradient-primary text-primary-foreground" : ""}`}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {t(plan.ctaKey)}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
      </Reveal>

      {/* GarageFlow Market Section */}
      <Reveal>
      <section className="py-16 sm:py-20 px-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-amber-400/20 text-amber-300 text-sm font-medium px-4 py-1.5 rounded-full mb-6">
            <Shield className="w-3.5 h-3.5" />
            Novo: GarageFlow Market
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold mb-4">
            Marketplace de carros <span className="text-amber-400">certificados</span>
          </h2>
          <p className="text-slate-300 text-base sm:text-lg max-w-2xl mx-auto mb-8">
            Todos os carros no GarageFlow Market são inspecionados por oficinas certificadas. 
            Compre com confiança ou venda mais rápido com inspeção profissional.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-10 max-w-3xl mx-auto text-left">
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <CheckCircle className="w-6 h-6 text-amber-400 mb-3" />
              <h3 className="font-semibold mb-1">Inspeção certificada</h3>
              <p className="text-sm text-slate-400">Relatório técnico completo por oficinas reais</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <Shield className="w-6 h-6 text-amber-400 mb-3" />
              <h3 className="font-semibold mb-1">Compra segura</h3>
              <p className="text-sm text-slate-400">Score de qualidade transparente em cada carro</p>
            </div>
            <div className="bg-slate-800/50 rounded-xl p-5 border border-slate-700">
              <Zap className="w-6 h-6 text-amber-400 mb-3" />
              <h3 className="font-semibold mb-1">Venda rápida</h3>
              <p className="text-sm text-slate-400">Carros certificados vendem até 3x mais rápido</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/market">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold h-14 px-10 text-base">
                Explorar carros <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/market/auth?mode=signup">
              <Button size="lg" variant="outline" className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10 h-14 px-8 text-base">
                Vender o meu carro
              </Button>
            </Link>
          </div>
        </div>
      </section>
      </Reveal>

      {/* CTA Final */}
      <Reveal>
      <section className="py-16 sm:py-20 px-4 text-center bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">{t('landing.ctaTitle')}</h2>
          <p className="text-muted-foreground text-base sm:text-lg mb-8 px-4">
            {t('landing.ctaSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center px-4">
            <Link to="/auth?mode=signup" className="w-full sm:w-auto">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-lg text-base sm:text-lg px-8 sm:px-12 h-14 font-bold w-full sm:w-auto btn-interactive">
                {t('landing.ctaDemo')} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          </div>
          <p className="text-xs text-muted-foreground mt-4">{t('landing.noCreditCard')}</p>
        </div>
      </section>
      </Reveal>

      {/* FAQ Section */}
      <Reveal>
      <section id="faq" className="py-16 sm:py-20 px-4 border-t border-border">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-bold mb-4">{t('landing.faqTitle')}</h2>
            <p className="text-muted-foreground text-base sm:text-lg">{t('landing.faqSubtitle')}</p>
          </div>
          <Accordion type="single" collapsible className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <AccordionItem key={i} value={`faq-${i}`} className="bg-card border border-border rounded-xl px-5">
                <AccordionTrigger className="text-sm sm:text-base font-medium text-left">
                  {t(`landing.faq${i}Q`)}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                  {t(`landing.faq${i}A`)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>
      </Reveal>

      {/* Sticky Mobile CTA */}
      <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-background/95 backdrop-blur-md border-t border-border p-3 z-40">
        <Link to="/auth?mode=signup">
          <Button className="w-full gradient-primary text-primary-foreground h-12 text-base font-bold btn-interactive">
            {t('landing.ctaDemo')} <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8 px-4 bg-muted/30 pb-20 sm:pb-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center">
              <Wrench className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">GarageFlow</span>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t('landing.navFeatures')}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t('landing.navPricing')}</a>
            <LanguageDropdown variant="ghost" size="sm" />
            <ThemeToggle />
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GarageFlow. {t('landing.footer')}
          </p>
        </div>
      </footer>
    </div>
  );
}