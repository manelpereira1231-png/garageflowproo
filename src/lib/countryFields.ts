/**
 * Country fiscal fields registry.
 *
 * Central declarative source of which tax/legal identifiers and address
 * fields each country requires at shop registration time and inside the UI.
 * The UI (registration form, shop settings display, PDFs) reads from here
 * so we don't scatter `if (country === 'PT')` branches across the codebase.
 *
 * NOTE: This registry is read-only metadata. It does NOT alter the existing
 * schema — every field maps to columns already present in `shops`. Only
 * their LABELS and validation change per country.
 */

export type FieldKey =
  | "taxId"          // NIF / CPF-CNPJ / VAT / Tax ID / SIREN / CIF
  | "postalCode"     // Código Postal / CEP / ZIP / Postcode
  | "state"          // Distrito / Estado / State / Land
  | "city"           // Cidade / Município / City
  | "address";       // Morada / Endereço / Address

export type FieldDef = {
  key: FieldKey;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** RegExp source string — validated on the client, non-blocking (soft check). */
  pattern?: string;
  helperText?: string;
};

export type CountryFiscalConfig = {
  code: string;
  fields: FieldDef[];
  /** Fiscal document provider slug (see BillingProvider). */
  billingProvider:
    | "invoicexpress"
    | "nuvem_fiscal"
    | "quickbooks"
    | "xero"
    | "holded"
    | "pennylane"
    | "sevdesk"
    | "zoho_books"
    | "cleartax"
    | "generic";
};

const PT: CountryFiscalConfig = {
  code: "PT",
  billingProvider: "invoicexpress",
  fields: [
    { key: "taxId", label: "NIF", placeholder: "123456789", required: true, pattern: "^\\d{9}$" },
    { key: "postalCode", label: "Código Postal", placeholder: "0000-000", required: true, pattern: "^\\d{4}-\\d{3}$" },
    { key: "city", label: "Localidade", required: true },
    { key: "address", label: "Morada", required: true },
  ],
};

const BR: CountryFiscalConfig = {
  code: "BR",
  billingProvider: "nuvem_fiscal",
  fields: [
    { key: "taxId", label: "CPF / CNPJ", placeholder: "00.000.000/0000-00", required: true },
    { key: "postalCode", label: "CEP", placeholder: "00000-000", required: true, pattern: "^\\d{5}-?\\d{3}$" },
    { key: "state", label: "Estado", required: true },
    { key: "city", label: "Município", required: true },
    { key: "address", label: "Endereço", required: true },
  ],
};

const ES: CountryFiscalConfig = {
  code: "ES",
  billingProvider: "holded",
  fields: [
    { key: "taxId", label: "CIF / NIF", required: true },
    { key: "postalCode", label: "Código Postal", required: true, pattern: "^\\d{5}$" },
    { key: "city", label: "Localidad", required: true },
    { key: "address", label: "Dirección", required: true },
  ],
};

const FR: CountryFiscalConfig = {
  code: "FR",
  billingProvider: "pennylane",
  fields: [
    { key: "taxId", label: "SIREN / SIRET", required: true },
    { key: "postalCode", label: "Code Postal", required: true, pattern: "^\\d{5}$" },
    { key: "city", label: "Ville", required: true },
    { key: "address", label: "Adresse", required: true },
  ],
};

const DE: CountryFiscalConfig = {
  code: "DE",
  billingProvider: "sevdesk",
  fields: [
    { key: "taxId", label: "USt-IdNr.", required: true, helperText: "VAT Number" },
    { key: "postalCode", label: "PLZ", required: true, pattern: "^\\d{5}$" },
    { key: "city", label: "Stadt", required: true },
    { key: "address", label: "Adresse", required: true },
  ],
};

const UK: CountryFiscalConfig = {
  code: "UK",
  billingProvider: "xero",
  fields: [
    { key: "taxId", label: "VAT Number", required: false },
    { key: "postalCode", label: "Postcode", required: true },
    { key: "city", label: "City", required: true },
    { key: "address", label: "Address", required: true },
  ],
};

const US: CountryFiscalConfig = {
  code: "US",
  billingProvider: "quickbooks",
  fields: [
    { key: "taxId", label: "Tax ID (EIN)", required: false },
    { key: "postalCode", label: "ZIP Code", required: true, pattern: "^\\d{5}(-\\d{4})?$" },
    { key: "state", label: "State", required: true },
    { key: "city", label: "City", required: true },
    { key: "address", label: "Address", required: true },
  ],
};

const IN: CountryFiscalConfig = {
  code: "IN",
  billingProvider: "cleartax",
  fields: [
    { key: "taxId", label: "GSTIN", required: false },
    { key: "postalCode", label: "PIN Code", required: true, pattern: "^\\d{6}$" },
    { key: "state", label: "State", required: true },
    { key: "city", label: "City", required: true },
    { key: "address", label: "Address", required: true },
  ],
};

const REGISTRY: Record<string, CountryFiscalConfig> = { PT, BR, ES, FR, DE, UK, US, IN };

export function getCountryFiscalConfig(code?: string): CountryFiscalConfig {
  if (!code) return PT;
  return REGISTRY[code.toUpperCase()] || PT;
}

export function getTaxIdLabel(code?: string): string {
  const f = getCountryFiscalConfig(code).fields.find((x) => x.key === "taxId");
  return f?.label ?? "Tax ID";
}
