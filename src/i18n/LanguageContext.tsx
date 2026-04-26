import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { translations, type Language } from "./translations";
import { supabase } from "@/integrations/supabase/client";
import { setRegion } from "@/lib/regionConfig";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): Language {
  // Respect explicit user choice first (always wins)
  const stored = (() => {
    try { return localStorage.getItem('garageflow_language'); } catch { return null; }
  })();
  if (stored && ['pt', 'pt-BR', 'en', 'es', 'hi'].includes(stored)) return stored as Language;

  // INDIA: do NOT auto-pick. Default to English provisionally; the choice
  // popup will prompt the user (EN vs Hindi). Their selection is then stored.
  try {
    const country = localStorage.getItem('garageflow_country');
    if (country === 'IN') return 'en';
    if (country) {
      if (['UK', 'US', 'AU', 'CA', 'IE', 'NZ', 'SG', 'ZA'].includes(country)) return 'en';
      if (country === 'BR') return 'pt-BR';
      if (country === 'PT') return 'pt';
      if (['ES', 'MX', 'AR', 'CL', 'CO', 'PE'].includes(country)) return 'es';
    }
  } catch {}

  const browserLang = (navigator.language || '').toLowerCase();
  if (browserLang === 'pt-br') return 'pt-BR';
  // India browser locales: provisional English (popup will ask user)
  if (browserLang === 'en-in' || browserLang.endsWith('-in') || browserLang === 'hi' || browserLang.startsWith('hi-')) return 'en';
  const shortLang = browserLang.slice(0, 2);
  if (['pt', 'en', 'es'].includes(shortLang)) return shortLang as Language;
  return 'en';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  // React to IP-based country detection that finishes AFTER first paint.
  // If the user hasn't explicitly chosen a language, switch to the country default.
  useEffect(() => {
    const onCountryDetected = (e: Event) => {
      const country = (e as CustomEvent).detail?.country as string | undefined;
      const explicit = localStorage.getItem('garageflow_language');
      if (explicit) return; // always respect user's explicit choice
      // India: do NOT auto-pick — popup will ask. Provisional EN already set.
      if (country === 'IN') return;
      if (['UK', 'US', 'AU', 'CA', 'IE', 'NZ', 'SG', 'ZA'].includes(country || '')) setLanguageState('en');
      else if (country === 'BR') setLanguageState('pt-BR');
      else if (country === 'PT') setLanguageState('pt');
      else if (['ES', 'MX', 'AR', 'CL', 'CO', 'PE'].includes(country || '')) setLanguageState('es');
    };
    window.addEventListener('garageflow:country-detected', onCountryDetected);
    return () => window.removeEventListener('garageflow:country-detected', onCountryDetected);
  }, []);

  useEffect(() => {
    const loadLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Prioritize active shop's language setting
      const activeShopId = localStorage.getItem("garageflow_active_shop");
      let shop: { language: string } | null = null;
      if (activeShopId) {
        const { data } = await supabase.from("shops").select("language").eq("id", activeShopId).maybeSingle();
        shop = data;
      }
      if (!shop) {
        const { data } = await supabase.from("shops").select("language").eq("user_id", user.id).maybeSingle();
        shop = data;
      }
      if (shop?.language && ['pt', 'pt-BR', 'en', 'es', 'hi'].includes(shop.language)) {
        setLanguageState(shop.language as Language);
        localStorage.setItem('garageflow_language', shop.language);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('garageflow_language', lang);
    // Sync legacy region ONLY when there's no detected country yet, otherwise
    // we'd overwrite India/US/UK/etc. with PT just because they speak English.
    const detectedCountry = localStorage.getItem('garageflow_country');
    if (!detectedCountry) {
      if (lang === 'pt-BR') setRegion('br');
      else if (lang === 'pt') setRegion('eu');
      // Don't force 'eu' for 'en'/'es' — let country detection decide.
    }
    // Update only the active shop's language, not all shops
    const activeShopId = localStorage.getItem("garageflow_active_shop");
    if (activeShopId) {
      await supabase.from("shops").update({ language: lang }).eq("id", activeShopId);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("shops").update({ language: lang }).eq("user_id", user.id).limit(1);
      }
    }
  }, []);

  const t = useCallback((key: string): string => {
    // Universal fallback: current lang → EN (global default) → key.
    // PT-BR also falls back to PT (close languages). PT users only see EN as fallback.
    const v = translations[language]?.[key];
    if (v) return v;
    if (language === 'pt-BR') return translations['pt']?.[key] || translations['en']?.[key] || key;
    // EN/ES/HI/PT all fall back to EN — never to PT (avoids leaking Portuguese).
    return translations['en']?.[key] || key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (context) return context;
  // Resilient fallback: never crash the app if a consumer mounts outside the
  // provider (HMR boundaries, lazy chunks, error pages). Falls back to the
  // user's stored language or PT.
  const fallbackLang: Language = (typeof window !== "undefined"
    ? (localStorage.getItem("garageflow_language") as Language | null)
    : null) || "en";
  return {
    language: fallbackLang,
    setLanguage: (lang: Language) => {
      // No reload — just persist; consumers using the fallback will re-mount
      // naturally when the real provider mounts.
      if (typeof window !== "undefined") {
        try { localStorage.setItem("garageflow_language", lang); } catch {}
      }
    },
    t: (key: string) => translations[fallbackLang]?.[key] || translations["en"]?.[key] || translations["pt"]?.[key] || key,
  };
}
