import type { Plan } from "@/hooks/useSubscription";

/**
 * Single source of truth for the plan hierarchy used across all pricing UIs.
 * Higher number = higher tier. "Sem plano" (no active subscription) is treated
 * as -1 so every real plan is an "upgrade" from it.
 *
 * Displayed hierarchy: No plan → Start (free) → Pro → Garage.
 */
export const PLAN_RANK: Record<Plan, number> = {
  free: 0,   // "Start"
  pro: 1,
  garage: 2,
};

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

  const displayedRank = PLAN_RANK[displayedPlan];
  const activeRank = PLAN_RANK[activePlan];

  if (displayedRank === activeRank) {
    return { action: 'current', labelKey: 'billing.currentPlan', disabled: true };
  }
  if (displayedRank > activeRank) {
    return { action: 'upgrade', labelKey: 'billing.upgrade', disabled: false };
  }
  return { action: 'downgrade', labelKey: 'billing.downgrade', disabled: false };
}
