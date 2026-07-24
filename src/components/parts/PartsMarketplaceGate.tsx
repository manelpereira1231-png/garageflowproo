import { Navigate } from "react-router-dom";
import { ReactNode } from "react";
import { useSystemFeature } from "@/hooks/useSystemFeature";
import { useAuthReady } from "@/hooks/useAuthReady";

/**
 * Gate para todas as rotas /parts/* (marketplace B2B para oficinas compradoras).
 * - Se o flag global estiver OFF → volta para o dashboard.
 * - Requer utilizador autenticado; não valida papel (aberto a qualquer oficina autenticada).
 */
export default function PartsMarketplaceGate({ children }: { children: ReactNode }) {
  const { enabled, loaded } = useSystemFeature("supplier_network_enabled");
  const { user, isReady } = useAuthReady();

  if (!loaded || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!enabled) return <Navigate to="/" replace />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}
