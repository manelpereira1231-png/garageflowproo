import type { ReactNode } from "react";
import { useShopRole, type Capability } from "@/hooks/useShopRole";

interface CanProps {
  cap: Capability;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * UX-only gate. Backend enforcement lives in RLS + has_capability().
 * Never rely on <Can> alone for security.
 */
export function Can({ cap, children, fallback = null }: CanProps) {
  const { can, loading } = useShopRole();
  if (loading) return null;
  return <>{can(cap) ? children : fallback}</>;
}
