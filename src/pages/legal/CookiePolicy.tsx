import LegalPage from "@/components/LegalPage";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { legalContent } from "@/i18n/legalContent";

const SEE_ALSO: Record<string, string> = {
  "pt": "Ver também", "pt-BR": "Veja também", "en": "See also", "es": "Ver también", "hi": "यह भी देखें",
};

export default function CookiePolicy() {
  const { language } = useLanguage();
  const sa = SEE_ALSO[language] || SEE_ALSO.en;
  const buttonLabel = legalContent[language]?.cookies.manageButton
    ?? legalContent.en.cookies.manageButton
    ?? "Manage cookie preferences";

  const reopenBanner = () => {
    localStorage.removeItem("gf_cookie_consent");
    window.location.reload();
  };

  return (
    <LegalPage pageKey="cookies">
      <Button onClick={reopenBanner} variant="outline" className="not-prose mt-2">
        {buttonLabel}
      </Button>
      <hr />
      <p className="text-sm">
        {sa}: <Link to="/legal/privacy">Privacy</Link> ·{" "}
        <Link to="/legal/terms">Terms</Link>
      </p>
    </LegalPage>
  );
}
