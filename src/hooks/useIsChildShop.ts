import { usePrimaryShopId } from "@/hooks/usePrimaryShopId";
import { useShopContext } from "@/hooks/useShopContext";

/**
 * Returns true when the currently active shop is a "Oficina Filha" —
 * i.e. it belongs to a group whose primary (mother) shop is a different one.
 *
 * Commercial surfaces (Billing, Stripe, planos, preços, upgrade CTAs, trial
 * banners, subscription state) must be hidden whenever this returns true.
 * The subscription is a group-level concern owned exclusively by the Oficina
 * Mãe. Child shops only consume the features the mother's plan unlocks.
 *
 * While the primary shop id is still loading we return `false` (unknown) to
 * avoid hiding UI for the mother during hydration; callers that need a strict
 * check can additionally gate on `loading`.
 */
export function useIsChildShop(): { isChildShop: boolean; loading: boolean } {
  const { primaryShopId, loading } = usePrimaryShopId();
  const { activeShopId } = useShopContext();
  const isChildShop = Boolean(
    !loading && activeShopId && primaryShopId && primaryShopId !== activeShopId,
  );
  return { isChildShop, loading };
}
