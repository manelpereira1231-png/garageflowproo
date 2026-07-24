import { Navigate, useLocation } from "react-router-dom";
import { ReactNode } from "react";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

/**
 * Gate de aprovação — assume que SupplierNetworkGate já autorizou o utilizador
 * como supplier (ou super admin). Redireciona conforme o estado:
 *  - approved / super_admin → passa
 *  - invited/pending/pending_approval/rejected/suspended/blocked → /supplier/pending
 */
export default function SupplierApprovalGate({ children }: { children: ReactNode }) {
  const { state, loading } = useIsSupplier();
  const { isSuperAdmin, loading: superLoading } = useSuperAdmin();
  const location = useLocation();

  if (loading || superLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isSuperAdmin) return <>{children}</>;
  if (state === "approved") return <>{children}</>;
  if (location.pathname === "/supplier/pending") return <>{children}</>;
  return <Navigate to="/supplier/pending" replace />;
}
