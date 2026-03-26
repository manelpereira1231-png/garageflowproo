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
  const browserLang = navigator.language;
  if (browserLang === 'pt-BR') return 'pt-BR';
  const shortLang = browserLang.slice(0, 2);
  if (['pt', 'en', 'es'].includes(shortLang)) return shortLang as Language;
  return 'pt';
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
    // Sync region with language choice
    if (lang === 'pt-BR') {
      setRegion('br');
    } else if (['pt', 'en', 'es'].includes(lang)) {
      setRegion('eu');
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

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
