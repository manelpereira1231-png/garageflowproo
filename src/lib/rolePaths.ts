import type { Capability, ShopRole } from "@/hooks/useShopRole";

/**
 * Maps each ERP sidebar path to the minimum capability required to open it.
 * Used by Layout to filter sidebar items per role.
 * Missing entries default to "always allowed" (public/shared pages).
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
  "/market/opportunities": "marketplace.manage",
  "/market/inspections": "marketplace.manage",
  "/market/offers": "marketplace.manage",
  "/market/wallet": "finance.view_costs",
  "/market/history": "marketplace.manage",
  "/market/stats": "marketplace.manage",
  "/market": "marketplace.view",
};

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
  const capability = capabilityForPath(pathname);
  if (!capability) return true;
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
