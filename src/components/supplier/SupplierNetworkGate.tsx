import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useSystemFeature } from "@/hooks/useSystemFeature";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useIsSupplier } from "@/hooks/useIsSupplier";

/**
 * Gate para todas as rotas /supplier/*.
 *
 * REGRA: uma conta de fornecedor NUNCA é expulsa deste universo — mesmo que o
 * flag global esteja desligado — caso contrário criava-se um ciclo infinito
 * (/supplier → / → /dashboard → SupplierAwayFromErp → /supplier → …).
 * O flag global só impede que NÃO-fornecedores entrem aqui.
 */
export default function SupplierNetworkGate({ children }: { children: ReactNode }) {
  const { enabled, loaded } = useSystemFeature("supplier_network_enabled");
  const { isSuperAdmin, loading: superLoading } = useSuperAdmin();
  const { isSupplier, loading: supLoading } = useIsSupplier();

  if (!loaded || superLoading || supLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSupplier || isSuperAdmin) return <>{children}</>;
  if (!enabled) return <Navigate to="/dashboard" replace />;
  return <Navigate to="/dashboard" replace />;
}
