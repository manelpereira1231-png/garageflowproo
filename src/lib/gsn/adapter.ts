/**
 * Interface comum para adaptadores do GSN.
 * Preparado para pagamentos (Stripe Connect), faturação (Moloni/InvoiceXpress/Jasmin/Primavera/PHC),
 * transportadoras (CTT/DPD/GLS/MRW/UPS/DHL/Correos) e distribuidores (TecDoc/LKQ/Bosch/...).
 *
 * Nenhum destes adaptadores está ligado à rede — todos lançam NotImplementedError.
 */
export class NotImplementedError extends Error {
  constructor(public adapter: string, public method: string) {
    super(`${adapter}.${method} ainda não está disponível`);
    this.name = "NotImplementedError";
  }
}

export interface AdapterMeta { id: string; name: string; kind: "payments" | "invoicing" | "carrier" | "distributor" | "erp"; }

export interface SupplierIntegrationAdapter {
  readonly meta: AdapterMeta;
  ping(): Promise<{ ok: boolean; note?: string }>;
}
