import { describe, it, expect } from "vitest";
import { claimInvoiceDelivery, releaseInvoiceDelivery } from "@/lib/invoiceDelivery";

describe("invoiceDelivery guard", () => {
  it("permite o primeiro envio e bloqueia o duplicado", () => {
    expect(claimInvoiceDelivery("inv-1", "email", "issued")).toBe(true);
    expect(claimInvoiceDelivery("inv-1", "email", "issued")).toBe(false);
  });
  it("não bloqueia canais/variantes diferentes", () => {
    claimInvoiceDelivery("inv-2", "email", "issued");
    expect(claimInvoiceDelivery("inv-2", "whatsapp", "issued")).toBe(true);
    expect(claimInvoiceDelivery("inv-2", "email", "paid")).toBe(true);
  });
  it("permite reenvio depois de release (falha de envio)", () => {
    claimInvoiceDelivery("inv-3", "email", "issued");
    releaseInvoiceDelivery("inv-3", "email", "issued");
    expect(claimInvoiceDelivery("inv-3", "email", "issued")).toBe(true);
  });
});
