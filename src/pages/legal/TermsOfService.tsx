import LegalPage from "@/components/LegalPage";
import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const SEE_ALSO: Record<string, string> = {
  "pt": "Ver também", "pt-BR": "Veja também", "en": "See also", "es": "Ver también", "hi": "यह भी देखें",
};

export default function TermsOfService() {
  const { language } = useLanguage();
  const sa = SEE_ALSO[language] || SEE_ALSO.en;
  return (
    <LegalPage pageKey="terms">
      <hr />
      <p className="text-sm">
        {sa}: <Link to="/legal/privacy">Privacy</Link> ·{" "}
        <Link to="/legal/cookies">Cookies</Link> ·{" "}
        <Link to="/legal/market-terms">Market Terms</Link>
      </p>
    </LegalPage>
  );
}
