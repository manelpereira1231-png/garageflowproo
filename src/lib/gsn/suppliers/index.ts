import { NotImplementedError, SupplierIntegrationAdapter } from "@/lib/gsn/adapter";

class Distributor implements SupplierIntegrationAdapter {
  constructor(public readonly meta: { id: string; name: string; kind: "distributor" }) {}
  async ping() { return { ok: false, note: "stub" }; }
  async importCatalog(_supplierId: string): Promise<{ imported: number }> {
    throw new NotImplementedError(this.meta.name, "importCatalog");
  }
}

export const tecdoc = new Distributor({ id: "tecdoc", name: "TecDoc", kind: "distributor" });
export const lkq = new Distributor({ id: "lkq", name: "LKQ", kind: "distributor" });
export const bosch = new Distributor({ id: "bosch", name: "Bosch", kind: "distributor" });
export const distrigo = new Distributor({ id: "distrigo", name: "Distrigo", kind: "distributor" });
export const adParts = new Distributor({ id: "ad_parts", name: "AD Parts", kind: "distributor" });
export const eurorepar = new Distributor({ id: "eurorepar", name: "Eurorepar", kind: "distributor" });
export const autoPartner = new Distributor({ id: "auto_partner", name: "Auto Partner", kind: "distributor" });
export const restGeneric = new Distributor({ id: "rest_generic", name: "REST genérico", kind: "distributor" });
export const soapGeneric = new Distributor({ id: "soap_generic", name: "SOAP genérico", kind: "distributor" });
export const distributorAdapters = [tecdoc, lkq, bosch, distrigo, adParts, eurorepar, autoPartner, restGeneric, soapGeneric];
