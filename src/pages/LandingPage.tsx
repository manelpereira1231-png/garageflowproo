import { Link } from "react-router-dom";
import { Wrench, BarChart3, Users, FileText, Shield, Zap, Globe, ArrowRight, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const featureIcons = [FileText, Wrench, Users, BarChart3, Shield, Zap];
const featureKeys = ['1', '2', '3', '4', '5', '6'];

const planConfigs = [
  {
    nameKey: 'landing.planFree',
    price: '0€',
    periodKey: '',
    subtitleKey: '',
    featureKeys: ['landing.feat.quotes10', 'landing.feat.1user', 'landing.feat.basicDash', 'landing.feat.watermarkPdf'],
    ctaKey: 'landing.ctaFree',
    highlighted: false,
  },
  {
    nameKey: 'landing.planPro',
    price: '49€',
    periodKey: 'landing.perMonth',
    subtitleKey: 'landing.trial30',
    featureKeys: ['landing.feat.unlimitedQuotes', 'landing.feat.5users', 'landing.feat.fullDash', 'landing.feat.proPdf', 'landing.feat.basicAlerts', 'landing.feat.autoEmails', 'landing.feat.export'],
    ctaKey: 'landing.ctaPro',
    highlighted: true,
  },
  {
    nameKey: 'landing.planGarage',
    price: '99€',
    periodKey: 'landing.perMonth',
    subtitleKey: 'landing.trial30',
    featureKeys: ['landing.feat.unlimitedQuotes', 'landing.feat.unlimitedUsers', 'landing.feat.advancedDash', 'landing.feat.proPdf', 'landing.feat.advancedAlerts', 'landing.feat.automations', 'landing.feat.advancedReports', 'landing.feat.multiShop', 'landing.feat.chatbot', 'landing.feat.api'],
    ctaKey: 'landing.ctaGarage',
    highlighted: false,
  },
];

const langLabels: Record<Language, string> = { pt: 'PT', en: 'EN', es: 'ES' };
const languages: Language[] = ['pt', 'en', 'es'];

export default function LandingPage() {
  const { t, language, setLanguage } = useLanguage();

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
            <a href="#features" className="hover:text-foreground transition-colors">{t('landing.navFeatures')}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t('landing.navPricing')}</a>
          </div>
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
              {languages.map(lang => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    language === lang
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {langLabels[lang]}
                </button>
              ))}
            </div>
            <Link to="/auth">
              <Button variant="ghost" size="sm">{t('landing.login')}</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="gradient-primary text-primary-foreground shadow-md">
                {t('landing.cta')}
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
            {t('landing.badge')}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            {t('landing.heroTitle1')}
            <br />
            <span className="text-primary">{t('landing.heroTitle2')}</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            {t('landing.heroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth?mode=signup">
              <Button size="lg" className="gradient-primary text-primary-foreground shadow-lg text-base px-10 h-14 text-lg font-bold">
                🚀 {t('landing.cta')} <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-base px-8 h-14">
                {t('landing.ctaFeatures')}
              </Button>
            </a>
          </div>
          <p className="text-xs text-muted-foreground mt-4">{t('landing.noCreditCard')}</p>
        </div>
      </header>

      {/* Stats counter */}
      <section className="py-12 px-4 border-b border-border bg-muted/20">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: '120+', labelKey: 'landing.statsShops' },
            { value: '1.500+', labelKey: 'landing.statsVehicles' },
            { value: '5.000+', labelKey: 'landing.statsQuotes' },
            { value: '99,9%', labelKey: 'landing.statsUptime' },
          ].map((stat, i) => (
            <div key={i}>
              <p className="text-3xl sm:text-4xl font-bold text-primary">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{t(stat.labelKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('landing.featuresTitle')}</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              {t('landing.featuresSubtitle')}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureKeys.map((key, i) => {
              const Icon = featureIcons[i];
              return (
                <article key={key} className="bg-card border border-border rounded-xl p-6 hover:shadow-md hover:border-primary/20 transition-all group">
                  <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{t(`landing.feat${key}Title`)}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{t(`landing.feat${key}Desc`)}</p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 bg-muted/30 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">{t('landing.pricingTitle')}</h2>
            <p className="text-muted-foreground text-lg">{t('landing.pricingSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {planConfigs.map(plan => (
              <div
                key={plan.nameKey}
                className={`bg-card rounded-xl p-6 border-2 transition-all ${
                  plan.highlighted
                    ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
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
                  <p className="text-xs text-muted-foreground mb-6">{t(plan.subtitleKey)}</p>
                ) : (
                  <div className="mb-6" />
                )}
                <ul className="space-y-3 mb-8">
                  {plan.featureKeys.map(fk => (
                    <li key={fk} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
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

      {/* CTA */}
      <section className="py-20 px-4 text-center bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">{t('landing.ctaTitle')}</h2>
          <p className="text-muted-foreground text-lg mb-8">
            {t('landing.ctaSubtitle')}
          </p>
          <Link to="/auth?mode=signup">
            <Button size="lg" className="gradient-primary text-primary-foreground shadow-lg text-lg px-12 h-14 font-bold">
              🚀 {t('landing.ctaButton')} <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground mt-4">{t('landing.noCreditCard')}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center">
              <Wrench className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">GarageFlow</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">{t('landing.navFeatures')}</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">{t('landing.navPricing')}</a>
            <div className="flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" />
              {languages.map((lang, i) => (
                <span key={lang}>
                  <button
                    onClick={() => setLanguage(lang)}
                    className={`hover:text-foreground transition-colors ${language === lang ? 'text-primary font-semibold' : ''}`}
                  >
                    {langLabels[lang]}
                  </button>
                  {i < languages.length - 1 && <span className="mx-0.5">|</span>}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} GarageFlow. {t('landing.footer')}
          </p>
        </div>
      </footer>
    </div>
  );
}
