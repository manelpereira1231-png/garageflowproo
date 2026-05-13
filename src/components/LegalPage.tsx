import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Globe } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { legalContent, type LegalPageKey } from "@/i18n/legalContent";
import SEOHead from "@/components/SEOHead";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { Language } from "@/i18n/translations";

const LANG_LABELS: Record<Language, string> = {
  "pt": "Português (PT)",
  "pt-BR": "Português (BR)",
  "en": "English",
  "es": "Español",
  "hi": "हिन्दी",
};

const BACK_LABEL: Record<Language, string> = {
  "pt": "Voltar",
  "pt-BR": "Voltar",
  "en": "Back",
  "es": "Volver",
  "hi": "वापस",
};

interface LegalPageProps {
  pageKey: LegalPageKey;
  realm?: "erp" | "market";
  backTo?: string;
  brandLabel?: string;
  children?: React.ReactNode;
}

/**
 * Shared shell for the 5 prose-only legal pages (Privacy, Terms, Cookies, DPA, MarketTerms).
 * - Pulls translated title/lastUpdated/body from legalContent.ts
 * - Renders body via dangerouslySetInnerHTML (HTML is author-controlled, AI-translated)
 * - Includes SEOHead with hreflang for all 10 locales
 * - Provides language switcher in the header
 */
export default function LegalPage({
  pageKey,
  realm = "erp",
  backTo = "/",
  brandLabel = "GarageFlow",
  children,
}: LegalPageProps) {
  const { language, setLanguage } = useLanguage();
  const content = legalContent[language]?.[pageKey] ?? legalContent.en[pageKey];

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        realm={realm}
        title={`${content.title} — ${brandLabel}`}
        description={content.title}
      />
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <Link
            to={backTo}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {BACK_LABEL[language]}
          </Link>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">{LANG_LABELS[language]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(LANG_LABELS) as Language[]).map((lang) => (
                  <DropdownMenuItem
                    key={lang}
                    onSelect={() => setLanguage(lang)}
                    className={lang === language ? "font-semibold" : ""}
                  >
                    {LANG_LABELS[lang]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link to={backTo} className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" /> {brandLabel}
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 prose prose-slate dark:prose-invert">
        <h1>{content.title}</h1>
        <p className="text-sm text-muted-foreground">{content.lastUpdated}</p>
        {language !== "pt" && (
          <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-3 not-prose mb-4">
            {language === "en"
              ? "This translation is provided for convenience. The original Portuguese (PT-PT) version prevails in case of legal interpretation conflict."
              : language === "es"
              ? "Esta traducción se proporciona por conveniencia. La versión original en portugués (PT-PT) prevalece en caso de conflicto de interpretación legal."
              : language === "pt-BR"
              ? "Esta tradução é fornecida por conveniência. A versão original em português (PT-PT) prevalece em caso de conflito de interpretação legal."
              : "यह अनुवाद सुविधा के लिए प्रदान किया गया है। कानूनी व्याख्या में विरोध की स्थिति में मूल पुर्तगाली (PT-PT) संस्करण मान्य होगा।"}
          </p>
        )}
        <div dangerouslySetInnerHTML={{ __html: content.body }} />
        {children}
      </main>
    </div>
  );
}
