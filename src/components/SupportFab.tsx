import { useLocation, useNavigate } from "react-router-dom";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Floating Support Action Button — visible across both ERP and Market.
 * Hidden on /support itself and on auth/checkout pages where it would obstruct.
 */
export default function SupportFab() {
  const location = useLocation();
  const navigate = useNavigate();

  const hidden =
    location.pathname.startsWith("/support") ||
    location.pathname.startsWith("/reset-password") ||
    location.pathname.startsWith("/quote/") ||
    location.pathname.startsWith("/portal/");

  if (hidden) return null;

  const isMarket = location.pathname.startsWith("/market") || location.pathname.startsWith("/carity");
  const context = isMarket ? "market" : "erp";

  return (
    <Button
      onClick={() => navigate(`/support?context=${context}`)}
      size="sm"
      className="fixed bottom-4 right-4 z-40 shadow-lg rounded-full h-12 px-4 gap-2"
      aria-label="Contactar suporte"
    >
      <LifeBuoy className="w-5 h-5" />
      <span className="hidden sm:inline">Suporte</span>
    </Button>
  );
}
