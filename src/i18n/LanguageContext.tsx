import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { translations, type Language } from "./translations";
import { supabase } from "@/integrations/supabase/client";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function getInitialLanguage(): Language {
  const stored = localStorage.getItem('garageflow_language');
  if (stored && ['pt', 'en', 'es'].includes(stored)) return stored as Language;
  const browserLang = navigator.language.slice(0, 2);
  if (['pt', 'en', 'es'].includes(browserLang)) return browserLang as Language;
  return 'pt';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getInitialLanguage);

  useEffect(() => {
    const loadLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: shop } = await supabase.from("shops").select("language").eq("user_id", user.id).maybeSingle();
      if (shop?.language && ['pt', 'en', 'es'].includes(shop.language)) {
        setLanguageState(shop.language as Language);
        localStorage.setItem('garageflow_language', shop.language);
      }
    };
    loadLanguage();
  }, []);

  const setLanguage = useCallback(async (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('garageflow_language', lang);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("shops").update({ language: lang }).eq("user_id", user.id);
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
