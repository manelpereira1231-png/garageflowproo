import type { Capability, ShopRole } from "@/hooks/useShopRole";

/**
 * Maps each ERP sidebar path to the minimum capability required to open it.
 * Used by Layout to filter sidebar items per role, by RoleProtectedRoute to
 * gate direct URL access, and by the CommandPalette to filter suggestions.
 *
 * IMPORTANT: fail-closed. Paths not present here AND not in ALWAYS_ALLOWED
 * are denied by default. Add new routes explicitly.
 */
export const PATH_REQUIRED_CAPABILITY: Record<string, Capability> = {
  "/dashboard": "dashboard.view",
  "/clients": "clients.view",
  "/vehicles": "vehicles.view",
  "/quotes/new": "quotes.create",
  "/quotes/edit": "quotes.edit",
  "/quotes": "quotes.view",
  "/services/new": "work_orders.create",
  "/services/edit": "work_orders.edit",
  "/services": "work_orders.view",
  "/workshop": "work_orders.view",
  "/inspections": "work_orders.view",
  "/agenda": "agenda.view",
  "/alerts": "alerts.view",
  "/chat": "chat.view",
  "/invoices": "invoices.view",
  "/invoices/new": "invoices.create",
  "/financial/reports": "finance.view_profits",
  "/billing": "settings.manage",
  "/stock": "stock.view",
  "/catalog": "stock.view",
  "/warranties": "work_orders.view",
  "/team": "team.view",
  "/settings/messages": "settings.manage",
  "/settings/email-templates": "settings.manage",
  "/settings/billing-integration": "settings.manage",
  "/settings": "settings.manage",
  "/developers": "api.view",
  "/marketing": "automations.view",
  "/automations": "automations.view",
  "/loyalty": "loyalty.view",
  "/referrals": "referrals.view",
  "/partners": "referrals.view",
  "/market/opportunities": "marketplace.manage",
  "/market/inspections": "marketplace.manage",
  "/market/offers": "marketplace.manage",
  "/market/wallet": "finance.view_costs",
  "/market/history": "marketplace.manage",
  "/market/stats": "marketplace.manage",
  "/market": "marketplace.view",
};

/**
 * Paths shared por todos os papéis autenticados (perfil, notificações, etc.).
 * Devem ser explícitos — nunca use este mecanismo para funcionalidades sensíveis.
 */
const ALWAYS_ALLOWED: readonly string[] = [
  "/profile",
  "/notifications",
  "/onboarding",
  "/support",
  "/accept-invite",
];

function isAlwaysAllowed(pathname: string): boolean {
  return ALWAYS_ALLOWED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function capabilityForPath(pathname: string): Capability | null {
  const match = Object.keys(PATH_REQUIRED_CAPABILITY)
    .sort((a, b) => b.length - a.length)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`));

  return match ? PATH_REQUIRED_CAPABILITY[match] : null;
}

export function canOpenPath(
  pathname: string,
  role: ShopRole,
  canCapability: (capability: Capability) => boolean,
): boolean {
  if (isAlwaysAllowed(pathname)) return Boolean(role);
  const capability = capabilityForPath(pathname);
  // Fail-closed: rotas não mapeadas exigem correspondência explícita.
  if (!capability) return false;
  return Boolean(role && canCapability(capability));
}

/** Where each role should land after login. */
export function homeForRole(role: string | null): string {
  switch (role) {
    case "technician": return "/workshop";
    case "reception": return "/agenda";
    case "commercial": return "/clients";
    default: return "/dashboard";
  }
}
