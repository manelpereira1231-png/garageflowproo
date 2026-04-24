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
  const stored = localStorage.getItem('garageflow_language');
  if (stored && ['pt', 'pt-BR', 'en', 'es'].includes(stored)) return stored as Language;

  // Country override: if we already detected the user's country, use its default language
  try {
    const country = localStorage.getItem('garageflow_country');
    if (country) {
      // India / UK / US / global → English by default
      if (['IN', 'UK', 'US', 'AU', 'CA', 'IE', 'NZ', 'SG', 'ZA'].includes(country)) return 'en';
      if (country === 'BR') return 'pt-BR';
      if (country === 'PT') return 'pt';
      if (country === 'ES' || country === 'MX' || country === 'AR' || country === 'CL' || country === 'CO' || country === 'PE') return 'es';
    }
  } catch {}

  const browserLang = (navigator.language || '').toLowerCase();
  if (browserLang === 'pt-br') return 'pt-BR';
  // India: Hindi or English-India → use English (Hindi not yet supported)
  if (browserLang === 'en-in' || browserLang.startsWith('hi')) return 'en';
  const shortLang = browserLang.slice(0, 2);
  if (['pt', 'en', 'es'].includes(shortLang)) return shortLang as Language;
  return 'en'; // safer global default than 'pt'
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

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
      if (shop?.language && ['pt', 'pt-BR', 'en', 'es'].includes(shop.language)) {
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
    return translations[language]?.[key] || translations['pt']?.[key] || key;
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
    : null) || "pt";
  return {
    language: fallbackLang,
    setLanguage: () => {
      if (typeof window !== "undefined") {
        localStorage.setItem("garageflow_language", fallbackLang);
        window.location.reload();
      }
    },
    t: (key: string) => translations[fallbackLang]?.[key] || translations["pt"]?.[key] || key,
  };
}
