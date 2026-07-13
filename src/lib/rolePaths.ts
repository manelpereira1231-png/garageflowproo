import type { Capability } from "@/hooks/useShopRole";

/**
 * Maps each ERP sidebar path to the minimum capability required to open it.
 * Used by Layout to filter sidebar items per role.
 * Missing entries default to "always allowed" (public/shared pages).
 */
export const PATH_REQUIRED_CAPABILITY: Record<string, Capability> = {
  "/clients": "clients.view",
  "/vehicles": "vehicles.view",
  "/quotes": "quotes.view",
  "/services": "work_orders.view",
  "/workshop": "work_orders.view",
  "/agenda": "agenda.view",
  "/invoices": "invoices.view",
  "/financial/reports": "finance.view_profits",
  "/billing": "settings.manage",
  "/stock": "stock.view",
  "/catalog": "stock.view",
  "/warranties": "work_orders.view",
  "/team": "team.view",
  "/settings": "settings.manage",
  "/developers": "settings.manage",
  "/marketing": "marketplace.view",
  "/automations": "settings.manage",
  "/loyalty": "clients.view",
  "/referrals": "clients.view",
  "/market": "marketplace.view",
  "/market/opportunities": "marketplace.view",
  "/market/inspections": "marketplace.view",
  "/market/offers": "marketplace.view",
  "/market/wallet": "finance.view_costs",
  "/market/history": "marketplace.view",
  "/market/stats": "marketplace.view",
};

/** Where each role should land after login. */
export function homeForRole(role: string | null): string {
  switch (role) {
    case "technician": return "/workshop";
    case "reception": return "/agenda";
    case "commercial": return "/clients";
    default: return "/dashboard";
  }
}
