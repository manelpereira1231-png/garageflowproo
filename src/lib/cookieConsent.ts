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

export function createCookieConsent(analytics: boolean, marketing: boolean): CookieConsent {
  return {
    version: CONSENT_VERSION,
    necessary: true,
    analytics,
    marketing,
    timestamp: new Date().toISOString(),
  };
}

export function saveCookieConsent(consent: CookieConsent) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  applyConsentToTracking(consent);
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