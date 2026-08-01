// Server-side subscription guard.
//
// A shop whose subscription is expired / canceled / past due must NOT be able
// to use paid features, even by calling the Edge Functions directly with a
// valid JWT (hiding buttons in the frontend is not enforcement).
//
// Usage inside a function that already resolved `shop_id`:
//
//   const denied = await assertActivePlan(shopId);
//   if (denied) return denied;              // 402 Response
//
// Internal/service-role calls should skip the check by not calling it.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BLOCKED_STATUSES = new Set([
  "canceled",
  "cancelled",
  "past_due",
  "expired",
  "trial_expired",
  "incomplete",
]);

export interface PlanCheckResult {
  active: boolean;
  reason?: string;
  plan?: string;
  status?: string;
}

export async function checkActivePlan(shopId: string): Promise<PlanCheckResult> {
  if (!shopId) return { active: false, reason: "missing_shop" };

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: sub, error } = await admin
    .from("subscriptions")
    .select("plan, status, trial_end, current_period_end, stripe_subscription_id")
    .eq("shop_id", shopId)
    .maybeSingle();

  if (error) return { active: false, reason: "subscription_lookup_failed" };
  if (!sub) return { active: false, reason: "no_subscription" };

  if (BLOCKED_STATUSES.has(sub.status)) {
    return { active: false, reason: "subscription_inactive", plan: sub.plan, status: sub.status };
  }

  // Trial that already ended without a Stripe subscription taking over.
  if (
    sub.status === "trialing" &&
    sub.trial_end &&
    new Date(sub.trial_end).getTime() < Date.now() &&
    !sub.stripe_subscription_id
  ) {
    return { active: false, reason: "trial_expired", plan: sub.plan, status: sub.status };
  }

  // Admin-granted plan whose period already ended.
  if (
    !sub.stripe_subscription_id &&
    sub.current_period_end &&
    new Date(sub.current_period_end).getTime() < Date.now()
  ) {
    return { active: false, reason: "period_ended", plan: sub.plan, status: sub.status };
  }

  return { active: true, plan: sub.plan, status: sub.status };
}

/**
 * Returns a 402 Response when the shop cannot use paid features, or null when
 * the plan is active.
 */
export async function assertActivePlan(
  shopId: string,
  corsHeaders: Record<string, string> = {},
): Promise<Response | null> {
  const result = await checkActivePlan(shopId);
  if (result.active) return null;

  return new Response(
    JSON.stringify({
      error: "subscription_required",
      reason: result.reason,
      status: result.status ?? null,
    }),
    { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
