import { NotImplementedError, SupplierIntegrationAdapter } from "@/lib/gsn/adapter";

class Carrier implements SupplierIntegrationAdapter {
  constructor(public readonly meta: { id: string; name: string; kind: "carrier" }) {}
  async ping() { return { ok: false, note: "stub" }; }
  async createShipment(_orderId: string, _payload: Record<string, unknown>): Promise<{ tracking_code: string; tracking_url: string }> {
    throw new NotImplementedError(this.meta.name, "createShipment");
  }
  async track(_code: string): Promise<{ status: string }> { throw new NotImplementedError(this.meta.name, "track"); }
}

export const ctt = new Carrier({ id: "ctt", name: "CTT", kind: "carrier" });
export const dpd = new Carrier({ id: "dpd", name: "DPD", kind: "carrier" });
export const mrw = new Carrier({ id: "mrw", name: "MRW", kind: "carrier" });
export const gls = new Carrier({ id: "gls", name: "GLS", kind: "carrier" });
export const ups = new Carrier({ id: "ups", name: "UPS", kind: "carrier" });
export const dhl = new Carrier({ id: "dhl", name: "DHL", kind: "carrier" });
export const correos = new Carrier({ id: "correos", name: "Correos Express", kind: "carrier" });
export const carrierAdapters = [ctt, dpd, mrw, gls, ups, dhl, correos];
