import { NotImplementedError, SupplierIntegrationAdapter } from "@/lib/gsn/adapter";

export class StripeConnectAdapter implements SupplierIntegrationAdapter {
  readonly meta = { id: "stripe_connect", name: "Stripe Connect", kind: "payments" as const };
  async ping() { return { ok: false, note: "stub" }; }
  async createAccountLink(_supplierId: string): Promise<{ url: string }> { throw new NotImplementedError("StripeConnect", "createAccountLink"); }
  async createPaymentIntent(_orderId: string): Promise<{ id: string; client_secret: string }> { throw new NotImplementedError("StripeConnect", "createPaymentIntent"); }
  async capture(_intentId: string): Promise<void> { throw new NotImplementedError("StripeConnect", "capture"); }
  async refund(_intentId: string, _amount?: number): Promise<void> { throw new NotImplementedError("StripeConnect", "refund"); }
}
export const stripeConnect = new StripeConnectAdapter();
