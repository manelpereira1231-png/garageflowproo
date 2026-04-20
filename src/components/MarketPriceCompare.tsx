import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { TrendingDown, TrendingUp, Minus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  listingId: string;
  make: string;
  model: string;
  year: number;
  price: number;
}

export default function MarketPriceCompare({ listingId, make, model, year, price }: Props) {
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
        <Loader2 className="h-3 w-3 animate-spin" /> A comparar com mercado...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-[11px] text-muted-foreground italic">
        Mercado ainda sem amostra suficiente para {make} {model} {year}.
      </div>
    );
  }

  const diffPct = ((price - stats.avg) / stats.avg) * 100;
  const absDiff = Math.abs(diffPct);

  let variant: "good" | "neutral" | "high" = "neutral";
  if (diffPct < -3) variant = "good";
  else if (diffPct > 5) variant = "high";

  const config = {
    good: {
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-200 dark:border-emerald-900",
      text: "text-emerald-800 dark:text-emerald-300",
      icon: TrendingDown,
      label: `${absDiff.toFixed(0)}% abaixo da média`,
      sub: "Bom preço face ao mercado",
    },
    neutral: {
      bg: "bg-slate-50 dark:bg-slate-900/20",
      border: "border-slate-200 dark:border-slate-800",
      text: "text-slate-700 dark:text-slate-300",
      icon: Minus,
      label: `Em linha com a média`,
      sub: `${absDiff.toFixed(0)}% ${diffPct >= 0 ? "acima" : "abaixo"} da média de mercado`,
    },
    high: {
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-200 dark:border-amber-900",
      text: "text-amber-800 dark:text-amber-300",
      icon: TrendingUp,
      label: `${absDiff.toFixed(0)}% acima da média`,
      sub: "Pode estar com margem de negociação",
    },
  }[variant];

  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${config.bg} ${config.border}`}>
      <Icon className={`h-4 w-4 flex-shrink-0 ${config.text}`} />
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${config.text}`}>{config.label}</p>
        <p className="text-[10px] text-muted-foreground">
          {config.sub} · base: {stats.count} anúncio{stats.count > 1 ? "s" : ""} {make} {model} {year - 1}-{year + 1} (média {formatMarketPrice(Math.round(stats.avg))})
        </p>
      </div>
    </div>
  );
}
