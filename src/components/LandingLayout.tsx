import { useState } from "react";
import { Link } from "react-router-dom";
import { Wrench, Globe, ArrowRight, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import type { Language } from "@/i18n/translations";

const langLabels: Record<Language, string> = { pt: 'PT', 'pt-BR': 'BR', en: 'EN', es: 'ES' };
const languages: Language[] = ['pt', 'pt-BR', 'en', 'es'];

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Nav — identical to LandingPage */}
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 sm:h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Wrench className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold tracking-tight">
              Garage<span className="text-primary">Flow</span>
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link to="/#features" className="hover:text-foreground transition-colors">{t('landing.navFeatures')}</Link>
            <Link to="/#pricing" className="hover:text-foreground transition-colors">{t('landing.navPricing')}</Link>
            <Link to="/afiliados" className="hover:text-foreground transition-colors">{t('landing.navAffiliates')}</Link>
          </div>
          <div className="hidden sm:flex items-center gap-3">
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
            <Link to="/auth?mode=login">
              <Button variant="ghost" size="sm">{t('landing.login')}</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button size="sm" className="gradient-primary text-primary-foreground shadow-md">
                {t('landing.cta')}
              </Button>
            </Link>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="sm:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden bg-background border-t border-border px-4 py-4 space-y-3 animate-fade-in">
            <Link to="/#features" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2">{t('landing.navFeatures')}</Link>
            <Link to="/#pricing" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2">{t('landing.navPricing')}</Link>
            <Link to="/afiliados" onClick={() => setMobileMenuOpen(false)} className="block text-sm font-medium text-muted-foreground hover:text-foreground py-2">{t('landing.navAffiliates')}</Link>
            <div className="flex items-center gap-1 py-2">
              {languages.map(lang => (
                <button
                  key={lang}
                  onClick={() => { setLanguage(lang); setMobileMenuOpen(false); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                    language === lang ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {langLabels[lang]}
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <Link to="/auth?mode=login" onClick={() => setMobileMenuOpen(false)}>
                <Button variant="outline" className="w-full">{t('landing.login')}</Button>
              </Link>
              <Link to="/auth?mode=signup" onClick={() => setMobileMenuOpen(false)}>
                <Button className="w-full gradient-primary text-primary-foreground">{t('landing.cta')}</Button>
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Content with top padding for fixed nav */}
      <main className="pt-14 sm:pt-16">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 sm:py-8 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-primary flex items-center justify-center">
              <Wrench className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">GarageFlow</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6 text-sm text-muted-foreground">
            <Link to="/#features" className="hover:text-foreground transition-colors">{t('landing.navFeatures')}</Link>
            <Link to="/#pricing" className="hover:text-foreground transition-colors">{t('landing.navPricing')}</Link>
            <Link to="/afiliados" className="hover:text-foreground transition-colors">{t('landing.navAffiliates')}</Link>
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
