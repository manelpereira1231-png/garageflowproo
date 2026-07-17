import { formatPrice } from "@/lib/regionConfig";
import { getEffectivePrice, type PlanSlug, type CycleSlug } from "@/lib/planPromotions";
import { Badge } from "@/components/ui/badge";

interface Props {
  basePrice: number;
  country: string;
  plan: PlanSlug;
  cycle: CycleSlug;
  periodLabel?: string;
  size?: "sm" | "lg";
  className?: string;
}

/**
 * Renders a plan price with an optional promotion layer.
 *
 * - When a promotion is active: shows the base price struck-through with
 *   the promotional price highlighted plus a discount badge.
 * - When there is no active promotion: renders exactly the same layout as
 *   before (single price + optional period suffix) — same design, no
 *   regressions.
 *
 * Never fabricates a price: reads from the shared cache populated at boot,
 * which is invalidated by realtime subscriptions on `plan_promotions` and
 * `country_settings`.
 */
export default function PriceWithPromo({
  basePrice,
  country,
  plan,
  cycle,
  periodLabel,
  size = "lg",
  className = "",
}: Props) {
  const eff = getEffectivePrice(basePrice, country, plan, cycle);
  const priceClass = size === "lg" ? "text-4xl font-bold" : "text-2xl font-bold";

  if (!eff.isPromo) {
    return (
      <div className={className}>
        <span className={priceClass}>{formatPrice(basePrice)}</span>
        {basePrice > 0 && periodLabel && (
          <span className="text-muted-foreground text-sm">{periodLabel}</span>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-muted-foreground line-through text-lg">
          {formatPrice(basePrice)}
        </span>
        <Badge
          variant="secondary"
          className="bg-success/15 text-success border-success/20 text-[11px] font-semibold"
        >
          -{eff.discountPercent}%
        </Badge>
      </div>
      <div className="mt-0.5">
        <span className={priceClass}>{formatPrice(eff.effectivePrice)}</span>
        {periodLabel && <span className="text-muted-foreground text-sm">{periodLabel}</span>}
      </div>
    </div>
  );
}
