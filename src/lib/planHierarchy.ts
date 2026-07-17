import type { Plan } from "@/hooks/useSubscription";

/**
 * Single source of truth for the plan hierarchy used across all pricing UIs.
 * Higher number = higher tier. "Sem plano" (no active subscription) is treated
 * as -1 so every real plan is an "upgrade" from it.
 *
 * The map is populated at runtime from `plans.sort_order` via
 * `registerPlanRanks()` (called by `usePlansCatalog` when the catalog loads).
 * Any plan created in the Admin — Start, Pro, Garage, Enterprise, Business,
 * or any future slug — automatically has a rank without touching code.
 *
 * Legacy fallbacks are kept ONLY for the initial render before the catalog
 * is fetched. They are overwritten as soon as the DB responds.
 */

// Mutable runtime registry. Not `Record<Plan, ...>` because Plan may now be
// any string slug from the DB (the type alias is legacy).
const rankRegistry: Record<string, number> = {
  free: 0,   // "Start"
  pro: 1,
  garage: 2,
};

/**
 * Called by usePlansCatalog whenever the plans catalog is (re)loaded.
 * Passes a fresh map of slug -> sort_order taken from the `plans` table.
 */
export function registerPlanRanks(map: Record<string, number>): void {
  // Merge, don't replace: keep legacy fallbacks for plans that haven't
  // arrived yet in this snapshot (defensive; the DB should be authoritative).
  for (const [slug, rank] of Object.entries(map)) {
    rankRegistry[slug] = rank;
  }
}

export function getPlanRank(slug: string | null | undefined): number {
  if (!slug) return -1;
  const r = rankRegistry[slug];
  return typeof r === "number" ? r : -1;
}

/**
 * @deprecated Use `getPlanRank(slug)` instead. Kept for back-compat with the
 * legacy `Record<Plan, number>` shape; readers will still find the 3 legacy
 * slugs but new slugs must be looked up via `getPlanRank`.
 */
export const PLAN_RANK: Record<Plan, number> = rankRegistry as Record<Plan, number>;

export type PlanButtonAction = 'subscribe' | 'current' | 'upgrade' | 'downgrade';

export interface PlanButtonState {
  action: PlanButtonAction;
  labelKey: 'billing.subscribe' | 'billing.currentPlan' | 'billing.upgrade' | 'billing.downgrade';
  disabled: boolean;
}

/**
 * Centralised logic that decides what the CTA on each plan card should read
 * and whether it must be disabled. Every pricing card must use this function
 * — never re-derive the state with local ifs.
 *
 * Rules:
 * - No active subscription → every card shows "Subscrever".
 * - Same plan as the active one → "Plano Atual" (disabled).
 * - Displayed plan ranked above active plan → "Upgrade".
 * - Displayed plan ranked below active plan → "Downgrade".
 */
export function getPlanButtonState(params: {
  displayedPlan: Plan;
  activePlan: Plan | null | undefined;
  hasActiveSubscription: boolean;
}): PlanButtonState {
  const { displayedPlan, activePlan, hasActiveSubscription } = params;

  if (!hasActiveSubscription || !activePlan) {
    return { action: 'subscribe', labelKey: 'billing.subscribe', disabled: false };
  }

  const displayedRank = getPlanRank(displayedPlan);
  const activeRank = getPlanRank(activePlan);

  if (displayedRank === activeRank) {
    return { action: 'current', labelKey: 'billing.currentPlan', disabled: true };
  }
  if (displayedRank > activeRank) {
    return { action: 'upgrade', labelKey: 'billing.upgrade', disabled: false };
  }
  return { action: 'downgrade', labelKey: 'billing.downgrade', disabled: false };
}
