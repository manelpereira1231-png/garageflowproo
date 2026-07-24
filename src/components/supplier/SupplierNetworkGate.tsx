import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useSystemFeature } from "@/hooks/useSystemFeature";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { useIsSupplier } from "@/hooks/useIsSupplier";

/**
 * Gate para todas as rotas /supplier/*.
 * - Se o flag global estiver OFF e o utilizador não for Super Admin → 404.
 * - Se o utilizador não for supplier nem super admin → 404.
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

  if (!isSuperAdmin && !enabled) return <Navigate to="/" replace />;
  if (!isSuperAdmin && !isSupplier) return <Navigate to="/" replace />;

  return <>{children}</>;
}
