import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY = "garageflow_lang_choice_in";

/**
 * One-time language picker shown to users detected in India (country === "IN").
 * Offers English vs Hindi. The choice is persisted and never asked again
 * (unless the user manually clears storage). Users can still change language
 * from the header dropdown at any time.
 */
export default function IndiaLanguagePrompt() {
  const { setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const evaluate = () => {
      try {
        const country = localStorage.getItem("garageflow_country");
        const alreadyChosen = localStorage.getItem(STORAGE_KEY);
        const hasExplicitLang = localStorage.getItem("garageflow_language");
        if (country === "IN" && !alreadyChosen && !hasExplicitLang) {
          setOpen(true);
        }
      } catch {
        // ignore
      }
    };

    // Evaluate immediately (in case country was detected before mount)
    evaluate();

    // And react to deferred IP detection
    const onDetected = () => evaluate();
    window.addEventListener("garageflow:country-detected", onDetected);
    return () => window.removeEventListener("garageflow:country-detected", onDetected);
  }, []);

  const choose = (lang: "en" | "hi") => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {}
    setLanguage(lang);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { /* block close until choice */ if (!v) return; }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">Choose your language</DialogTitle>
          <DialogDescription className="text-center">
            अपनी भाषा चुनें / Select your preferred language
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 py-4">
          <Button
            size="lg"
            variant="outline"
            className="h-16 text-lg justify-start gap-4 px-6"
            onClick={() => choose("en")}
          >
            <span className="text-2xl">🇬🇧</span>
            <span className="flex-1 text-left">English</span>
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="h-16 text-lg justify-start gap-4 px-6"
            onClick={() => choose("hi")}
          >
            <span className="text-2xl">🇮🇳</span>
            <span className="flex-1 text-left">हिन्दी (Hindi)</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          You can change this anytime from the header.
        </p>
      </DialogContent>
    </Dialog>
  );
}
