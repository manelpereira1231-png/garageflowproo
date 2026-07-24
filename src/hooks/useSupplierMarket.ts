/**
 * Hook central para o GarageFlow Supplier Network (marketplace de peças).
 * Consolida a feature flag `supplier_network_enabled` com o contexto de oficina activa.
 */
import { useSystemFeature } from "@/hooks/useSystemFeature";
import { useShopContext } from "@/hooks/useShopContext";
import { useAuthReady } from "@/hooks/useAuthReady";

export function useSupplierMarket() {
  const { enabled, loaded } = useSystemFeature("supplier_network_enabled");
  const { activeShopId } = useShopContext();
  const { user, isReady } = useAuthReady();
  return {
    enabled,
    loaded,
    activeShopId,
    userId: user?.id ?? null,
    ready: isReady && loaded,
  };
}
