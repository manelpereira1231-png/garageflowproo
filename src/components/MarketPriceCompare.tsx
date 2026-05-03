import { useEffect, useState } from "react";
import { TrendingDown, TrendingUp, Minus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatMarketPrice } from "@/lib/marketPrice";
import { useMarketT } from "@/i18n/marketTranslations";

interface Props {
  listingId: string;
  make: string;
  model: string;
  year: number;
  price: number;
}

export default function MarketPriceCompare({ listingId, make, model, year, price }: Props) {
  const t = useMarketT();
  const [stats, setStats] = useState<{ avg: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const yearMin = year - 1;
      const yearMax = year + 1;
      const { data } = await supabase
        .from("carity_listings")
        .select("price")
        .eq("status", "published")
        .ilike("make", make)
        .ilike("model", model)
        .gte("year", yearMin)
        .lte("year", yearMax)
        .neq("id", listingId);

      if (!active) return;
      if (data && data.length >= 2) {
        const prices = data.map((r: any) => Number(r.price)).filter((p) => p > 0);
        if (prices.length >= 2) {
          const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
          setStats({ avg, count: prices.length });
        }
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [listingId, make, model, year]);

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> {t("pc.comparing")}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-[11px] text-muted-foreground italic">
        {t("pc.notEnough", { make, model, year })}
      </div>
    );
  }

  const diffPct = ((price - stats.avg) / stats.avg) * 100;
  const absDiff = Math.abs(diffPct);
  const pct = absDiff.toFixed(0);

  let variant: "good" | "neutral" | "high" = "neutral";
  if (diffPct < -3) variant = "good";
  else if (diffPct > 5) variant = "high";

  const config = {
    good: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-900",
      text: "text-emerald-800 dark:text-emerald-300",
      icon: TrendingDown,
      label: t("pc.below", { pct }),
      sub: t("pc.belowSub"),
    },
    neutral: {
      bg: "bg-slate-50 dark:bg-slate-900/20",
      border: "border-slate-200 dark:border-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      icon: Minus,
      label: t("pc.inline"),
      sub: t("pc.inlineSub", { pct, dir: diffPct >= 0 ? t("pc.dirAbove") : t("pc.dirBelow") }),
    },
    high: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900",
      text: "text-amber-800 dark:text-amber-300",
      icon: TrendingUp,
      label: t("pc.above", { pct }),
      sub: t("pc.aboveSub"),
    },
  }[variant];

  const Icon = config.icon;
  const n = stats.count > 1 ? t("pc.listings") : t("pc.listing");

  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${config.bg} ${config.border}`}>
      <Icon className={`h-4 w-4 flex-shrink-0 ${config.text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${config.text}`}>{config.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {config.sub} · {t("pc.basis", {
            count: stats.count,
            n,
            make,
            model,
            y1: year - 1,
            y2: year + 1,
            avg: formatMarketPrice(Math.round(stats.avg)),
          })}
        </p>
      </div>
    </div>
  );
}
