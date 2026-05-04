import { useLocation, useNavigate } from "react-router-dom";
import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

const labels: Record<string, string> = {
  pt: "Suporte",
  "pt-BR": "Suporte",
  en: "Help",
  es: "Soporte",
  hi: "सहायता",
};

/**
 * Floating Support Action Button — visible across both ERP and Market.
 * Hidden on /support itself and on auth/checkout pages where it would obstruct.
 */
export default function SupportFab() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = useLanguage();

  const hidden =
    location.pathname.startsWith("/admin") ||
    location.pathname.startsWith("/support") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/quote/") ||
    location.pathname.startsWith("/portal/");

  if (hidden) return null;

  const isMarket = location.pathname.startsWith("/market") || location.pathname.startsWith("/carity");
  const context = isMarket ? "market" : "erp";
  const label = labels[language] || labels.en;

  return (
    <Button
      onClick={() => navigate(`/support?context=${context}`)}
      size="sm"
      className="fixed bottom-20 sm:bottom-4 right-4 z-40 shadow-lg rounded-full h-12 px-4 gap-2 gradient-primary text-primary-foreground hover:opacity-95"
      aria-label={label}
    >
      <HelpCircle className="w-5 h-5" />
      <span className="hidden sm:inline font-medium">{label}</span>
    </Button>
  );
}
