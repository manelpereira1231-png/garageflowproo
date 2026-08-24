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
 * Support button rendered inline in the app header (next to the theme
 * toggle, beside the search bar) — for both ERP and Market layouts.
 *
 * It deliberately is NOT a fixed/floating element: a floating FAB overlapped
 * the table pagination arrows on list pages (e.g. Services). Placing it in
 * the sticky topbar keeps it always accessible on desktop and mobile,
 * without covering any content and without creating a new fixed element.
 */
export default function SupportFab({ className = "" }: { className?: string }) {
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
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => navigate(`/support?context=${context}`)}
      className={`h-9 w-9 ${className}`}
      aria-label={label}
      title={label}
    >
      <HelpCircle className="h-4 w-4" />
    </Button>
  );
}