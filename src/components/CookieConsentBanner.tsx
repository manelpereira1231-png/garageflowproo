import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Cookie, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";

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
  // Google Consent Mode v2 — gating Ads/Analytics until user opts in.
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

export default function CookieConsentBanner() {
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [marketing, setMarketing] = useState(true);

  useEffect(() => {
    // Set default denied state immediately on mount (Consent Mode v2)
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

    // Show banner if no decision yet
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
    } catch {
      // ignore storage errors (private mode)
    }
  };

  const acceptAll = () => {
    const consent: CookieConsent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: new Date().toISOString(),
    };
    persist(consent);
    setOpen(false);
  };

  const rejectAll = () => {
    const consent: CookieConsent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: new Date().toISOString(),
    };
    persist(consent);
    setOpen(false);
  };

  const saveCustom = () => {
    const consent: CookieConsent = {
      version: CONSENT_VERSION,
      necessary: true,
      analytics,
      marketing,
      timestamp: new Date().toISOString(),
    };
    persist(consent);
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
                <h3 className="font-semibold text-sm">A tua privacidade conta</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Usamos cookies essenciais para o funcionamento da plataforma. Com o teu
                  consentimento, usamos também cookies analíticos e de marketing para melhorar
                  o serviço. Consulta a{" "}
                  <Link to="/legal/cookies" className="underline">Política de Cookies</Link> e a{" "}
                  <Link to="/legal/privacy" className="underline">Política de Privacidade</Link>.
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" onClick={acceptAll}>Aceitar tudo</Button>
                  <Button size="sm" variant="outline" onClick={rejectAll}>Apenas essenciais</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowSettings(true)}>
                    Personalizar
                  </Button>
                </div>
              </div>
              <button
                onClick={rejectAll}
                aria-label="Fechar (apenas essenciais)"
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Preferências de cookies</h3>
              <button onClick={() => setShowSettings(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3 p-3 rounded border">
                <div>
                  <div className="font-medium">Estritamente necessários</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Indispensáveis para autenticação e funcionamento da plataforma.
                  </p>
                </div>
                <Switch checked disabled />
              </div>

              <div className="flex items-start justify-between gap-3 p-3 rounded border">
                <div>
                  <div className="font-medium">Analíticos</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ajudam-nos a perceber como o serviço é utilizado (Google Analytics).
                  </p>
                </div>
                <Switch checked={analytics} onCheckedChange={setAnalytics} />
              </div>

              <div className="flex items-start justify-between gap-3 p-3 rounded border">
                <div>
                  <div className="font-medium">Marketing e publicidade</div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Permitem medir conversões de campanhas (Google Ads).
                  </p>
                </div>
                <Switch checked={marketing} onCheckedChange={setMarketing} />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-4">
              <Button size="sm" onClick={saveCustom}>Guardar preferências</Button>
              <Button size="sm" variant="outline" onClick={acceptAll}>Aceitar tudo</Button>
              <Button size="sm" variant="ghost" onClick={rejectAll}>Apenas essenciais</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
