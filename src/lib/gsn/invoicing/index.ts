import { NotImplementedError, SupplierIntegrationAdapter } from "@/lib/gsn/adapter";

class Base implements SupplierIntegrationAdapter {
  constructor(public readonly meta: { id: string; name: string; kind: "invoicing" }) {}
  async ping() { return { ok: false, note: "stub" }; }
  async createInvoice(_orderId: string): Promise<{ id: string; pdf_url: string }> {
    throw new NotImplementedError(this.meta.name, "createInvoice");
  }
}

export const moloni = new Base({ id: "moloni", name: "Moloni", kind: "invoicing" });
export const invoiceXpress = new Base({ id: "invoicexpress", name: "InvoiceXpress", kind: "invoicing" });
export const jasmin = new Base({ id: "jasmin", name: "Jasmin", kind: "invoicing" });
export const primavera = new Base({ id: "primavera", name: "Primavera", kind: "invoicing" });
export const phc = new Base({ id: "phc", name: "PHC", kind: "invoicing" });

export const invoicingAdapters = [moloni, invoiceXpress, jasmin, primavera, phc];
