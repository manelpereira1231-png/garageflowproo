import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMarketT } from "@/i18n/marketTranslations";

/**
 * Banner global que aparece no topo do Market quando o utilizador autenticado
 * tem pelo menos uma compra com status "pending" (pagamento não concluído).
 */
export default function MarketPendingPaymentBanner() {
  const t = useMarketT();
  const [pendingCount, setPendingCount] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from("market_escrow")
        .select("id", { count: "exact", head: true })
        .eq("buyer_id", user.id)
        .eq("status", "pending");

      if (!cancelled) setPendingCount(count || 0);
    };

    check();
    const onFocus = () => check();
    window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  if (dismissed || pendingCount === 0) return null;

  return (
    <div className="bg-amber-500 text-slate-900 px-4 py-2.5 border-b border-amber-600">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium min-w-0">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span className="truncate">
            {pendingCount === 1
              ? t("banner.pendingOne")
              : t("banner.pendingMany", { n: pendingCount })}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            to="/market/purchases"
            className="inline-flex items-center gap-1 bg-slate-900 text-amber-400 px-3 py-1 rounded text-xs font-semibold hover:bg-slate-800"
          >
            {t("banner.finish")} <ArrowRight className="h-3 w-3" />
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:bg-amber-600/40 rounded"
            aria-label={t("banner.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
