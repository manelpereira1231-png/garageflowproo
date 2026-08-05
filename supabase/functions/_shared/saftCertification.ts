/**
 * SAF-T PT — Camada de CONFIGURAÇÃO LEGAL (certificação AT).
 *
 * Este módulo é a ÚNICA fonte de verdade para tudo o que depende de
 * certificação pela Autoridade Tributária. A lógica técnica de geração do
 * XML (export-saft) não conhece nenhum valor legal: pede-os aqui.
 *
 * Regra de ouro: NUNCA inventar valores legais. Enquanto a configuração não
 * existir, devolvemos os placeholders neutros previstos ("0") e sinalizamos
 * o estado como não certificado, para que o XML seja honesto.
 *
 * Quando a GarageFlow for certificada, basta preencher no painel de admin:
 *   - saft_certification_settings (nº certificado, produtor, chave, flags)
 *   - document_series (série + código de validação AT → ATCUD)
 * e ligar `is_certified` / `signing_enabled`. Sem alterar código.
 */

export interface SaftCertificationConfig {
  is_certified: boolean;
  software_certificate_number: string | null;
  product_id: string;
  product_version: string;
  producer_company_name: string | null;
  producer_tax_id: string | null;
  saft_version: string;
  tax_accounting_basis: string;
  signing_enabled: boolean;
  signing_key_secret_name: string;
  signing_key_version: string;
  header_comment_override: string | null;
}

export const DEFAULT_CERT_CONFIG: SaftCertificationConfig = {
  is_certified: false,
  software_certificate_number: null,
  product_id: "GarageFlow",
  product_version: "1.0",
  producer_company_name: null,
  producer_tax_id: null,
  saft_version: "1.04_01",
  tax_accounting_basis: "F",
  signing_enabled: false,
  signing_key_secret_name: "SAFT_SIGNING_PRIVATE_KEY",
  signing_key_version: "1",
  header_comment_override: null,
};

export interface DocumentSeries {
  id: string;
  doc_type: string;
  series_code: string;
  at_validation_code: string | null;
  initial_sequence: number;
  is_active: boolean;
}

export async function loadCertificationConfig(admin: any): Promise<SaftCertificationConfig> {
  try {
    const { data } = await admin
      .from("saft_certification_settings")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (!data) return { ...DEFAULT_CERT_CONFIG };
    return { ...DEFAULT_CERT_CONFIG, ...data } as SaftCertificationConfig;
  } catch {
    return { ...DEFAULT_CERT_CONFIG };
  }
}

export async function loadSeries(admin: any, shopId: string): Promise<Map<string, DocumentSeries>> {
  const map = new Map<string, DocumentSeries>();
  try {
    const { data } = await admin
      .from("document_series")
      .select("id, doc_type, series_code, at_validation_code, initial_sequence, is_active")
      .eq("shop_id", shopId)
      .eq("is_active", true);
    (data || []).forEach((s: DocumentSeries) => {
      if (!map.has(s.doc_type)) map.set(s.doc_type, s);
    });
  } catch { /* sem séries configuradas */ }
  return map;
}

/**
 * ATCUD = <CódigoValidaçãoSérie>-<NºSequencialDoDocumento>
 * Sem código de validação atribuído pela AT, o valor legal é "0".
 */
export function buildAtcud(series: DocumentSeries | undefined, docNumber: string): string {
  if (!series?.at_validation_code) return "0";
  const seq = extractSequence(docNumber);
  return `${series.at_validation_code}-${seq}`;
}

export function extractSequence(docNumber: string): string {
  const m = String(docNumber || "").match(/(\d+)\s*$/);
  return m ? String(Number(m[1])) : "0";
}

/**
 * String a assinar, conforme Portaria 363/2010:
 *   DataDoc;DataHoraSistema;NumeroDoc;TotalIlíquido;HashAnterior
 */
export function buildSourceString(
  docDate: string,
  systemEntryDate: string,
  docNumber: string,
  grossTotal: number,
  previousHash: string,
): string {
  return `${docDate};${systemEntryDate};${docNumber};${grossTotal.toFixed(2)};${previousHash}`;
}

async function importPkcs8(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const raw = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return await crypto.subtle.importKey(
    "pkcs8",
    raw.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" },
    false,
    ["sign"],
  );
}

export interface SignatureResult {
  hash: string;
  hash_control: string;
  atcud: string;
  algorithm: "RSA-SHA1" | "none";
  source_string: string;
  previous_hash: string;
}

/**
 * Assina (ou devolve placeholders) um documento e persiste a cadeia.
 * Idempotente: se já existir assinatura para o documento, reutiliza-a —
 * a cadeia nunca é recalculada, como exige a AT.
 */
export async function signDocument(
  admin: any,
  cfg: SaftCertificationConfig,
  privateKey: CryptoKey | null,
  params: {
    shopId: string;
    docType: string; // FT, NC, ND, FR, ORC…
    docId: string;
    docNumber: string;
    docDate: string;            // YYYY-MM-DD
    systemEntryDate: string;    // YYYY-MM-DDTHH:mm:ss
    grossTotal: number;
    series?: DocumentSeries;
  },
): Promise<SignatureResult> {
  const atcud = buildAtcud(params.series, params.docNumber);

  // 1) Assinatura já existente → reutilizar (imutabilidade da cadeia)
  const { data: existing } = await admin
    .from("document_signatures")
    .select("hash, hash_control, atcud, algorithm, source_string, previous_hash")
    .eq("shop_id", params.shopId)
    .eq("doc_type", params.docType)
    .eq("doc_id", params.docId)
    .maybeSingle();
  if (existing?.hash) {
    return {
      hash: existing.hash,
      hash_control: existing.hash_control || "0",
      atcud: existing.atcud || atcud,
      algorithm: (existing.algorithm as any) || "none",
      source_string: existing.source_string || "",
      previous_hash: existing.previous_hash || "",
    };
  }

  // 2) Sem chave/assinatura ativa → placeholders legais neutros ("0")
  if (!cfg.signing_enabled || !privateKey) {
    return {
      hash: "0", hash_control: "0", atcud,
      algorithm: "none", source_string: "", previous_hash: "",
    };
  }

  // 3) Hash anterior da mesma série/tipo
  const { data: prev } = await admin
    .from("document_signatures")
    .select("hash")
    .eq("shop_id", params.shopId)
    .eq("doc_type", params.docType)
    .order("system_entry_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousHash = prev?.hash && prev.hash !== "0" ? prev.hash : "";

  const sourceString = buildSourceString(
    params.docDate, params.systemEntryDate, params.docNumber, params.grossTotal, previousHash,
  );
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(sourceString),
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  // HashControl: versão da chave privada usada (ex.: "1")
  const hashControl = cfg.signing_key_version || "1";

  await admin.from("document_signatures").insert({
    shop_id: params.shopId,
    doc_type: params.docType,
    doc_id: params.docId,
    doc_number: params.docNumber,
    series_id: params.series?.id ?? null,
    sequence_number: Number(extractSequence(params.docNumber)) || null,
    atcud,
    doc_date: params.docDate,
    system_entry_date: params.systemEntryDate,
    gross_total: params.grossTotal,
    source_string: sourceString,
    previous_hash: previousHash,
    hash,
    hash_control: hashControl,
    key_version: cfg.signing_key_version,
    algorithm: "RSA-SHA1",
  });

  return {
    hash, hash_control: hashControl, atcud,
    algorithm: "RSA-SHA1", source_string: sourceString, previous_hash: previousHash,
  };
}

/** Carrega a chave privada do secret configurado (nunca da BD). */
export async function loadSigningKey(cfg: SaftCertificationConfig): Promise<CryptoKey | null> {
  if (!cfg.signing_enabled) return null;
  const pem = Deno.env.get(cfg.signing_key_secret_name || "SAFT_SIGNING_PRIVATE_KEY");
  if (!pem) return null;
  try {
    return await importPkcs8(pem);
  } catch (e) {
    console.error("SAF-T signing key inválida:", e);
    return null;
  }
}

/**
 * Estado legal consolidado + HeaderComment honesto.
 * Enquanto faltar certificação, o aviso mantém-se — nunca é escondido.
 */
export function buildHeaderComment(
  cfg: SaftCertificationConfig,
  opts: { hasSeries: boolean; signing: boolean },
): string {
  if (cfg.header_comment_override) return cfg.header_comment_override;
  const missing: string[] = [];
  if (!cfg.is_certified || !cfg.software_certificate_number) missing.push("SoftwareCertificateNumber");
  if (!opts.hasSeries) missing.push("ATCUD (séries não registadas na AT)");
  if (!opts.signing) missing.push("Hash/HashControl (assinatura digital inativa)");
  if (missing.length === 0) return "";
  return `Exportação fiscal operacional — software não certificado pela AT. Em falta: ${missing.join("; ")}. Requer validação por software certificado antes de submissão oficial.`;
}

export function certificateNumberField(cfg: SaftCertificationConfig): string {
  return cfg.is_certified && cfg.software_certificate_number
    ? String(cfg.software_certificate_number)
    : "0";
}
