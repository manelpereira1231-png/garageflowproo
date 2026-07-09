/**
 * BillingProvider — abstract fiscal-document provider interface.
 *
 * Every country routes to exactly one provider (see countryFields.ts).
 * The rest of the app should call `getBillingProvider(country).emitInvoice(...)`
 * rather than importing InvoiceXpress (or any other API) directly.
 *
 * IMPORTANT: Portugal (InvoiceXpress) is delegated to the EXISTING edge
 * function `invoicexpress-emit`. This file DOES NOT change PT behaviour —
 * it only wraps the current call site behind a stable interface so other
 * countries can be added without touching PT.
 */

import { supabase } from "@/integrations/supabase/client";
import { getCountryFiscalConfig } from "@/lib/countryFields";

export type DocumentType =
  | "quote"
  | "invoice"
  | "invoice_receipt"
  | "credit_note";

export type BillingClient = {
  name: string;
  taxId?: string;
  email?: string;
  address?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
};

export type BillingLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  category?: "part" | "labor" | "service" | "other";
};

export type EmitDocumentInput = {
  type: DocumentType;
  client: BillingClient;
  lines: BillingLine[];
  reference?: string;
  notes?: string;
};

export type EmitDocumentResult = {
  ok: boolean;
  providerId?: string;
  documentNumber?: string;
  pdfUrl?: string;
  error?: string;
};

export interface BillingProvider {
  readonly slug: string;
  readonly countryCode: string;
  emitDocument(input: EmitDocumentInput): Promise<EmitDocumentResult>;
  getDocumentPdfUrl(providerId: string): Promise<string | null>;
  isConfigured(): Promise<boolean>;
}

// ─── PT: InvoiceXpress (delegates to existing edge function) ─────────────
class InvoiceXpressProvider implements BillingProvider {
  slug = "invoicexpress";
  countryCode = "PT";

  async emitDocument(input: EmitDocumentInput): Promise<EmitDocumentResult> {
    try {
      const { data, error } = await supabase.functions.invoke("invoicexpress-emit", {
        body: input,
      });
      if (error) return { ok: false, error: error.message };
      return {
        ok: true,
        providerId: data?.id,
        documentNumber: data?.number,
        pdfUrl: data?.pdf_url,
      };
    } catch (e: unknown) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async getDocumentPdfUrl(providerId: string): Promise<string | null> {
    try {
      const { data } = await supabase.functions.invoke("invoicexpress-emit", {
        body: { action: "get_pdf", id: providerId },
      });
      return data?.pdf_url ?? null;
    } catch {
      return null;
    }
  }

  async isConfigured(): Promise<boolean> {
    // Feature is enabled when the shop has InvoiceXpress credentials configured;
    // the edge function itself performs the real check.
    return true;
  }
}

// ─── Stub for countries whose provider adapter isn't implemented yet ─────
class NotYetSupportedProvider implements BillingProvider {
  constructor(public slug: string, public countryCode: string) {}
  async emitDocument(): Promise<EmitDocumentResult> {
    return {
      ok: false,
      error: `Fiscal provider "${this.slug}" for ${this.countryCode} is not yet available. Documents are generated as internal PDFs only.`,
    };
  }
  async getDocumentPdfUrl(): Promise<string | null> {
    return null;
  }
  async isConfigured(): Promise<boolean> {
    return false;
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────
export function getBillingProvider(countryCode: string): BillingProvider {
  const cfg = getCountryFiscalConfig(countryCode);
  switch (cfg.billingProvider) {
    case "invoicexpress":
      return new InvoiceXpressProvider();
    default:
      return new NotYetSupportedProvider(cfg.billingProvider, cfg.code);
  }
}
