import { ReactNode } from "react";
import { useShopRole, type Capability } from "@/hooks/useShopRole";

interface CanProps {
  /** Capability required to render children. */
  capability: Capability;
  /** Optional list — user must satisfy ALL of them. */
  all?: Capability[];
  /** Optional list — user must satisfy AT LEAST ONE. */
  any?: Capability[];
  /** Fallback UI when the check fails (defaults to null). */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Client-side capability gate for buttons, tabs, sections, PDF exports,
 * WhatsApp/email actions, etc.
 *
 * IMPORTANT: This is UX only. The backend RLS policies (has_capability())
 * are the actual security enforcement — Can just prevents the user from
 * seeing controls they cannot use.
 *
 * Usage:
 *   <Can capability="invoices.cancel">
 *     <Button variant="destructive">Cancelar</Button>
 *   </Can>
 *
 *   <Can any={["quotes.send_email","quotes.send_whatsapp"]}>
 *     <ShareMenu />
 *   </Can>
 */
export function Can({ capability, all, any, fallback = null, children }: CanProps) {
  const { can, loading } = useShopRole();
  if (loading) return null;

  const primaryOk = can(capability);
  const allOk = !all || all.every((c) => can(c));
  const anyOk = !any || any.some((c) => can(c));

  if (primaryOk && allOk && anyOk) return <>{children}</>;
  return <>{fallback}</>;
}

/**
 * Hook variant for imperative usage (e.g. inside handlers,
 * or to disable-instead-of-hide).
 */
export function useCan(capability: Capability): boolean {
  const { can, loading } = useShopRole();
  if (loading) return false;
  return can(capability);
}
