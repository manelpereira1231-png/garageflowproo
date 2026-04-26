import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY = "gf_cookie_consent";
const CONSENT_VERSION = 1;

export type CookieConsent = {
  version: number;
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: string;
};

export function getCookieConsent(): CookieConsent | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CookieConsent;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function applyConsentToTracking(consent: CookieConsent) {
  const gtag = (window as any).gtag;
  if (typeof gtag === "function") {
    gtag("consent", "update", {
      ad_storage: consent.marketing ? "granted" : "denied",
      ad_user_data: consent.marketing ? "granted" : "denied",
      ad_personalization: consent.marketing ? "granted" : "denied",
      analytics_storage: consent.analytics ? "granted" : "denied",
    });
  }
}

type Strings = {
  title: string;
  body: string;
  policyCookies: string;
  policyPrivacy: string;
  acceptAll: string;
  essentials: string;
  customize: string;
  closeAria: string;
  prefsTitle: string;
  necTitle: string;
  necDesc: string;
  anaTitle: string;
  anaDesc: string;
  mktTitle: string;
  mktDesc: string;
  save: string;
};

const i18n: Record<string, Strings> = {
  pt: {
    title: "A tua privacidade conta",
    body: "Usamos cookies essenciais para o funcionamento da plataforma. Com o teu consentimento, usamos também cookies analíticos e de marketing para melhorar o serviço. Consulta a",
    policyCookies: "Política de Cookies",
    policyPrivacy: "Política de Privacidade",
    acceptAll: "Aceitar tudo",
    essentials: "Apenas essenciais",
    customize: "Personalizar",
    closeAria: "Fechar (apenas essenciais)",
    prefsTitle: "Preferências de cookies",
    necTitle: "Estritamente necessários",
    necDesc: "Indispensáveis para autenticação e funcionamento da plataforma.",
    anaTitle: "Analíticos",
    anaDesc: "Ajudam-nos a perceber como o serviço é utilizado (Google Analytics).",
    mktTitle: "Marketing e publicidade",
    mktDesc: "Permitem medir conversões de campanhas (Google Ads).",
    save: "Guardar preferências",
  },
  "pt-BR": {
    title: "Sua privacidade importa",
    body: "Usamos cookies essenciais para o funcionamento da plataforma. Com seu consentimento, usamos também cookies analíticos e de marketing para melhorar o serviço. Consulte a",
    policyCookies: "Política de Cookies",
    policyPrivacy: "Política de Privacidade",
    acceptAll: "Aceitar tudo",
    essentials: "Apenas essenciais",
    customize: "Personalizar",
    closeAria: "Fechar (apenas essenciais)",
    prefsTitle: "Preferências de cookies",
    necTitle: "Estritamente necessários",
    necDesc: "Indispensáveis para autenticação e funcionamento da plataforma.",
    anaTitle: "Analíticos",
    anaDesc: "Ajudam-nos a entender como o serviço é utilizado (Google Analytics).",
    mktTitle: "Marketing e publicidade",
    mktDesc: "Permitem medir conversões de campanhas (Google Ads).",
    save: "Salvar preferências",
  },
  en: {
    title: "Your privacy matters",
    body: "We use essential cookies to keep the platform running. With your consent, we also use analytics and marketing cookies to improve the service. See our",
    policyCookies: "Cookie Policy",
    policyPrivacy: "Privacy Policy",
    acceptAll: "Accept all",
    essentials: "Essentials only",
    customize: "Customize",
    closeAria: "Close (essentials only)",
    prefsTitle: "Cookie preferences",
    necTitle: "Strictly necessary",
    necDesc: "Required for authentication and core platform features.",
    anaTitle: "Analytics",
    anaDesc: "Help us understand how the service is used (Google Analytics).",
    mktTitle: "Marketing & advertising",
    mktDesc: "Allow us to measure campaign conversions (Google Ads).",
    save: "Save preferences",
  },
  es: {
    title: "Tu privacidad importa",
    body: "Usamos cookies esenciales para el funcionamiento de la plataforma. Con tu consentimiento, también usamos cookies analíticas y de marketing para mejorar el servicio. Consulta la",
    policyCookies: "Política de Cookies",
    policyPrivacy: "Política de Privacidad",
    acceptAll: "Aceptar todo",
    essentials: "Solo esenciales",
    customize: "Personalizar",
    closeAria: "Cerrar (solo esenciales)",
    prefsTitle: "Preferencias de cookies",
    necTitle: "Estrictamente necesarias",
    necDesc: "Indispensables para la autenticación y el funcionamiento de la plataforma.",
    anaTitle: "Analíticas",
    anaDesc: "Nos ayudan a entender cómo se utiliza el servicio (Google Analytics).",
    mktTitle: "Marketing y publicidad",
    mktDesc: "Permiten medir conversiones de campañas (Google Ads).",
    save: "Guardar preferencias",
  },
  hi: {
    title: "आपकी गोपनीयता महत्वपूर्ण है",
    body: "हम प्लेटफ़ॉर्म के संचालन के लिए आवश्यक कुकीज़ का उपयोग करते हैं। आपकी सहमति से, हम सेवा को बेहतर बनाने के लिए एनालिटिक्स और मार्केटिंग कुकीज़ का भी उपयोग करते हैं। देखें",
    policyCookies: "कुकी नीति",
    policyPrivacy: "गोपनीयता नीति",
    acceptAll: "सभी स्वीकार करें",
    essentials: "केवल आवश्यक",
    customize: "अनुकूलित करें",
    closeAria: "बंद करें (केवल आवश्यक)",
    prefsTitle: "कुकी प्राथमिकताएँ",
    necTitle: "कड़ाई से आवश्यक",
    necDesc: "प्रमाणीकरण और मुख्य प्लेटफ़ॉर्म कार्यों के लिए आवश्यक।",
    anaTitle: "एनालिटिक्स",
    anaDesc: "हमें यह समझने में मदद करते हैं कि सेवा का उपयोग कैसे होता है (Google Analytics)।",
    mktTitle: "मार्केटिंग और विज्ञापन",
    mktDesc: "अभियान रूपांतरणों को मापने की अनुमति देते हैं (Google Ads)।",
    save: "प्राथमिकताएँ सहेजें",
  },
};

export default function CookieConsentBanner() {
  const { language } = useLanguage();
  const s = i18n[language] || i18n.en;
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    const gtag = (window as any).gtag;
    if (typeof gtag === "function") {
      const existing = getCookieConsent();
      if (!existing) {
        gtag("consent", "default", {
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          analytics_storage: "denied",
          wait_for_update: 500,
        });
      } else {
        applyConsentToTracking(existing);
      }
    }
    const existing = getCookieConsent();
    if (!existing) {
      const t = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const persist = (consent: CookieConsent) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
      applyConsentToTracking(consent);
    } catch {}
  };

  const acceptAll = () => {
    persist({ version: CONSENT_VERSION, necessary: true, analytics: true, marketing: true, timestamp: new Date().toISOString() });
    setOpen(false);
  };
  const rejectAll = () => {
    persist({ version: CONSENT_VERSION, necessary: true, analytics: false, marketing: false, timestamp: new Date().toISOString() });
    setOpen(false);
  };
  const saveCustom = () => {
    persist({ version: CONSENT_VERSION, necessary: true, analytics, marketing, timestamp: new Date().toISOString() });
    setOpen(false);
    setShowSettings(false);
  };

  if (!open) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-[100] p-3 sm:p-4 pointer-events-none">
      <Card className="max-w-3xl mx-auto pointer-events-auto shadow-2xl border-2">
        {!showSettings ? (
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-primary/10 p-2 flex-shrink-0">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm">{s.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {s.body}{" "}
                  <Link to="/legal/cookies" className="underline">{s.policyCookies}</Link>
                  {" · "}
                  <Link to="/legal/privacy" className="underline">{s.policyPrivacy}</Link>.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" onClick={acceptAll}>{s.acceptAll}</Button>
                  <Button size="sm" variant="outline" onClick={rejectAll}>{s.essentials}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>{s.customize}</Button>
                </div>
              </div>
              <button onClick={rejectAll} aria-label={s.closeAria} className="text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">{s.prefsTitle}</h3>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3 p-3 rounded border">
                <div>
                  <div className="font-medium">{s.necTitle}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.necDesc}</p>
                </div>
                <Switch checked disabled />
              </div>
              <div className="flex items-start justify-between gap-3 p-3 rounded border">
                <div>
                  <div className="font-medium">{s.anaTitle}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.anaDesc}</p>
                </div>
                <Switch checked={analytics} onCheckedChange={setAnalytics} />
              </div>
              <div className="flex items-start justify-between gap-3 p-3 rounded border">
                <div>
                  <div className="font-medium">{s.mktTitle}</div>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.mktDesc}</p>
                </div>
                <Switch checked={marketing} onCheckedChange={setMarketing} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" onClick={saveCustom}>{s.save}</Button>
              <Button size="sm" variant="outline" onClick={acceptAll}>{s.acceptAll}</Button>
              <Button size="sm" variant="ghost" onClick={rejectAll}>{s.essentials}</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
