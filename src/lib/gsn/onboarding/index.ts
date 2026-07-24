/**
 * Contratos futuros para o onboarding de fornecedores.
 * Interfaces apenas — implementações vazias, sem alterar UI atual.
 */

export interface StripeConnectOnboardingAdapter {
  createAccountLink(supplierId: string): Promise<{ url: string }>;
  refreshStatus(supplierId: string): Promise<{ chargesEnabled: boolean; payoutsEnabled: boolean }>;
}

export interface SupplierSubscriptionAdapter {
  listPlans(): Promise<Array<{ id: string; name: string; monthlyPriceCents: number }>>;
  subscribe(supplierId: string, planId: string): Promise<{ checkoutUrl: string }>;
  cancel(supplierId: string): Promise<void>;
}

export interface SupplierPayoutAdapter {
  scheduleWeeklyPayouts(supplierId: string): Promise<void>;
  triggerManualPayout(supplierId: string, amountCents: number): Promise<{ payoutId: string }>;
}

export interface PublicApiKeyIssuer {
  issue(supplierId: string, scope: "read" | "write"): Promise<{ key: string; hash: string }>;
  revoke(keyHash: string): Promise<void>;
}

const NI = () => { throw new Error("not_implemented"); };
export const stubStripeConnect: StripeConnectOnboardingAdapter = { createAccountLink: NI, refreshStatus: NI };
export const stubSupplierSubscription: SupplierSubscriptionAdapter = { listPlans: NI, subscribe: NI, cancel: NI };
export const stubSupplierPayout: SupplierPayoutAdapter = { scheduleWeeklyPayouts: NI, triggerManualPayout: NI };
export const stubPublicApiIssuer: PublicApiKeyIssuer = { issue: NI, revoke: NI };
