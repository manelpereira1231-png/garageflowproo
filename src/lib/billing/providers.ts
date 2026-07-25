/**
 * Fiscal Billing Provider Registry (central metadata source).
 *
 * Every country routes to exactly one fiscal provider (see countryFields.ts).
 * This file is READ-ONLY metadata consumed by Settings, Landing, PDFs, help
 * dialogs and future admin panels. It does NOT implement API calls — that
 * lives in `src/lib/billing/BillingProvider.ts` (client-side dispatcher) and
 * the corresponding `supabase/functions/*-connect` edge functions.
 *
 * IMPORTANT: This is the single source of truth for user-facing provider
 * information. Never hardcode "InvoiceXpress" or "eNotas" outside this file.
 */

export type ProviderSlug =
  | "invoicexpress"
  | "moloni"
  | "enotas"
  | "nuvem_fiscal"
  | "quickbooks"
  | "xero"
  | "holded"
  | "pennylane"
  | "sevdesk"
  | "zoho_books"
  | "cleartax"
  | "generic";

export type CountrySupportLevel =
  /** Real production integration wired end-to-end (edge fn + adapter). */
  | "production"
  /** Adapter + UI scaffold ready; real API calls not yet wired. */
  | "preview"
  /** Placeholder only — no adapter, no UI beyond generic connect form. */
  | "planned";

export type BillingProviderInfo = {
  slug: ProviderSlug;
  name: string;
  url?: string;
  /** Short description shown on Settings & Landing (per country). */
  description: string;
  /** Fiscal engine / regulator name (AT, SEFAZ, HMRC, IRS, GST Council…). */
  taxEngine?: string;
  /** Documents this provider can emit (label list). */
  docTypes: { value: string; label: string }[];
  /** Placeholder for the account identifier input. */
  accountIdHint?: string;
  /** Marketing-safe bullet list (Landing / Settings). */
  highlights?: string[];
  /** Support level for GarageFlow<->provider integration. */
  supportLevel: CountrySupportLevel;
};

export const PROVIDERS: Record<ProviderSlug, BillingProviderInfo> = {
  invoicexpress: {
    slug: "invoicexpress",
    name: "InvoiceXpress",
    url: "https://invoicexpress.com/",
    description:
      "Software de faturação certificado pela Autoridade Tributária (PT nº 192). O GarageFlow envia os dados da fatura → o InvoiceXpress emite o documento legal com ATCUD, QR Code, hash e SAF-T oficial sob a conta AT da tua oficina.",
    taxEngine: "Autoridade Tributária (AT)",
    docTypes: [
      { value: "invoice", label: "Fatura" },
      { value: "invoice_receipt", label: "Fatura-Recibo" },
      { value: "credit_note", label: "Nota de Crédito" },
    ],
    accountIdHint: "minhaoficina",
    highlights: [
      "Emissão a 1 clique a partir da ordem de serviço",
      "ATCUD, QR Code, hash e série sequencial",
      "SAF-T PT oficial descarregado do painel InvoiceXpress",
      "Anulação legal por Nota de Crédito automática",
    ],
    supportLevel: "production",
  },
  moloni: {
    slug: "moloni",
    name: "Moloni",
    url: "https://www.moloni.pt",
    description:
      "Software de faturação certificado pela AT em Portugal. Alternativa ao InvoiceXpress para oficinas que já usam Moloni.",
    taxEngine: "Autoridade Tributária (AT)",
    docTypes: [
      { value: "invoice", label: "Fatura" },
      { value: "credit_note", label: "Nota de Crédito" },
    ],
    supportLevel: "production",
  },
  enotas: {
    slug: "enotas",
    name: "eNotas",
    url: "https://enotas.com.br",
    description:
      "Emissão fiscal automática no Brasil. O GarageFlow integra com a conta eNotas da oficina — a oficina continua proprietária da emissão fiscal. O eNotas gera NF-e, NFS-e, NFC-e ou CT-e quando aplicável e o GarageFlow sincroniza número, série, chave, PDF, XML e status.",
    taxEngine: "SEFAZ / Prefeituras (via eNotas)",
    docTypes: [
      { value: "nfse", label: "NFS-e (Serviço)" },
      { value: "nfe", label: "NF-e (Produto)" },
      { value: "nfce", label: "NFC-e (Consumidor)" },
    ],
    accountIdHint: "CNPJ ou empresa_id eNotas",
    highlights: [
      "Emissão de NF-e, NFS-e e NFC-e a partir da ordem de serviço",
      "Sincronização automática de chave, número, PDF e XML",
      "A conta eNotas continua a pertencer à oficina",
      "Credenciais encriptadas AES-GCM no GarageFlow",
    ],
    supportLevel: "production",
  },
  nuvem_fiscal: {
    slug: "nuvem_fiscal",
    name: "Nuvem Fiscal",
    url: "https://www.nuvemfiscal.com.br",
    description:
      "API brasileira para emissão de NF-e, NFS-e e NFC-e. Alternativa ao eNotas.",
    taxEngine: "SEFAZ / Prefeituras",
    docTypes: [
      { value: "nfse", label: "NFS-e (Serviço)" },
      { value: "nfe", label: "NF-e (Produto)" },
      { value: "nfce", label: "NFC-e (Consumidor)" },
    ],
    supportLevel: "planned",
  },
  quickbooks: {
    slug: "quickbooks",
    name: "QuickBooks",
    url: "https://quickbooks.intuit.com",
    description:
      "Small-business accounting and invoicing platform used across the United States, Canada and the UK.",
    taxEngine: "IRS / state tax",
    docTypes: [
      { value: "invoice", label: "Invoice" },
      { value: "sales_receipt", label: "Sales Receipt" },
    ],
    supportLevel: "planned",
  },
  xero: {
    slug: "xero",
    name: "Xero",
    url: "https://www.xero.com",
    description:
      "Cloud accounting used in the UK, Ireland, Australia and New Zealand. Handles VAT-compliant invoices.",
    taxEngine: "HMRC (UK) / ATO (AU)",
    docTypes: [
      { value: "ACCREC", label: "Invoice" },
      { value: "ACCRECCREDIT", label: "Credit Note" },
    ],
    supportLevel: "planned",
  },
  holded: {
    slug: "holded",
    name: "Holded",
    url: "https://www.holded.com",
    description:
      "Plataforma de facturación electrónica utilizada en España. Emisión de facturas conformes a AEAT.",
    taxEngine: "AEAT (Agencia Tributaria)",
    docTypes: [
      { value: "invoice", label: "Factura" },
      { value: "salesreceipt", label: "Ticket" },
    ],
    supportLevel: "planned",
  },
  pennylane: {
    slug: "pennylane",
    name: "Pennylane",
    url: "https://www.pennylane.com",
    description:
      "Plateforme de facturation et comptabilité utilisée en France. Émission conforme aux exigences DGFiP.",
    taxEngine: "DGFiP",
    docTypes: [
      { value: "invoice", label: "Facture" },
      { value: "credit_note", label: "Avoir" },
    ],
    supportLevel: "planned",
  },
  sevdesk: {
    slug: "sevdesk",
    name: "sevDesk",
    url: "https://sevdesk.com",
    description:
      "Rechnungs- und Buchhaltungs-Software für Deutschland. GoBD-konforme Belege.",
    taxEngine: "Finanzamt",
    docTypes: [
      { value: "invoice", label: "Rechnung" },
      { value: "credit_note", label: "Gutschrift" },
    ],
    supportLevel: "planned",
  },
  zoho_books: {
    slug: "zoho_books",
    name: "Zoho Books",
    url: "https://www.zoho.com/books/",
    description:
      "Cloud accounting used globally. Multi-currency and GST/VAT compliant invoices.",
    docTypes: [{ value: "invoice", label: "Invoice" }],
    supportLevel: "planned",
  },
  cleartax: {
    slug: "cleartax",
    name: "ClearTax",
    url: "https://cleartax.in",
    description:
      "GST-compliant invoicing and e-invoicing for India. Handles IRN generation and GSTN sync.",
    taxEngine: "GST Council / GSTN",
    docTypes: [
      { value: "tax_invoice", label: "Tax Invoice (GST)" },
      { value: "bill_of_supply", label: "Bill of Supply" },
    ],
    supportLevel: "planned",
  },
  generic: {
    slug: "generic",
    name: "Fiscal Provider",
    description:
      "Generic connector for regions without a dedicated adapter yet. Ask support to add your local provider.",
    docTypes: [{ value: "invoice", label: "Invoice" }],
    supportLevel: "planned",
  },
};

export function getProviderInfo(slug: ProviderSlug | string | undefined): BillingProviderInfo {
  if (!slug) return PROVIDERS.generic;
  return PROVIDERS[slug as ProviderSlug] ?? PROVIDERS.generic;
}

/** Convenience: provider info for the given ISO country code. */
export function getProviderForCountry(
  countryCode: string | undefined,
  billingProviderSlug: string,
): BillingProviderInfo {
  void countryCode;
  return getProviderInfo(billingProviderSlug);
}
