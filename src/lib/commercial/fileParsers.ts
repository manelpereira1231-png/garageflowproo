/**
 * Client-side importers for the commercial CRM.
 *
 * Extracts a normalised list of workshop leads from user-uploaded files.
 * Never sent to the server for parsing — we do it in the browser so nothing
 * touches storage until the operator confirms.
 */
import * as XLSX from "xlsx";

export type ParsedLead = {
  name?: string;
  owner_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  district?: string;
  country?: string;
  website?: string;
  notes?: string;
  raw?: Record<string, any>;
};

const FIELD_ALIASES: Record<keyof ParsedLead, string[]> = {
  name: ["nome oficina", "oficina", "empresa", "workshop", "company", "razao social", "razão social", "nome", "name"],
  owner_name: ["responsavel", "responsável", "contacto", "contato", "gerente", "manager", "owner", "titular"],
  email: ["email", "e-mail", "mail"],
  phone: ["telefone", "telemovel", "telemóvel", "phone", "tel", "celular", "whatsapp"],
  address: ["morada", "endereco", "endereço", "address", "rua"],
  city: ["cidade", "localidade", "city", "municipio", "município"],
  district: ["distrito", "estado", "provincia", "província", "region", "região", "regiao"],
  country: ["pais", "país", "country"],
  website: ["site", "website", "url", "web"],
  notes: ["notas", "observacoes", "observações", "notes", "obs"],
  raw: [],
};

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /(https?:\/\/[^\s]+|www\.[^\s]+)/i;

function mapRow(row: Record<string, any>): ParsedLead {
  const out: ParsedLead = { raw: row };
  const keyMap: Record<string, string> = {};
  Object.keys(row).forEach((k) => (keyMap[norm(k)] = k));

  (Object.keys(FIELD_ALIASES) as (keyof ParsedLead)[]).forEach((field) => {
    if (field === "raw") return;
    for (const alias of FIELD_ALIASES[field]) {
      const hit = keyMap[norm(alias)];
      if (hit && row[hit] != null && String(row[hit]).trim() !== "") {
        (out as any)[field] = String(row[hit]).trim();
        break;
      }
    }
  });

  // Heuristic fallback: se nenhum alias bateu, procura em qualquer célula.
  const values = Object.values(row).map((v) => (v == null ? "" : String(v).trim())).filter(Boolean);
  if (!out.email) {
    const hit = values.find((v) => EMAIL_RE.test(v));
    if (hit) out.email = hit.match(EMAIL_RE)![0];
  }
  if (!out.phone) {
    const hit = values.find((v) => PHONE_RE.test(v) && !EMAIL_RE.test(v));
    if (hit) out.phone = hit.match(PHONE_RE)![0].replace(/\s+/g, " ").trim();
  }
  if (!out.website) {
    const hit = values.find((v) => URL_RE.test(v));
    if (hit) out.website = hit.match(URL_RE)![0];
  }
  if (!out.name) {
    // Primeiro valor textual que não é email/telefone/url.
    const hit = values.find(
      (v) => v.length >= 2 && !EMAIL_RE.test(v) && !URL_RE.test(v) && !/^\+?\d[\d\s().-]{4,}$/.test(v),
    );
    if (hit) out.name = hit.slice(0, 160);
  }
  return out;
}

/** XLSX / XLS / CSV via SheetJS. */
export async function parseSpreadsheet(file: File): Promise<ParsedLead[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];

  // Primeira tentativa: com cabeçalhos.
  let rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" });
  let mapped = rows.map(mapRow).filter((r) => r.name || r.email || r.phone);
  if (mapped.length > 0) return mapped;

  // Fallback: sem cabeçalhos — trata cada linha como valores brutos.
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  mapped = raw
    .map((arr) => {
      const obj: Record<string, any> = {};
      arr.forEach((v, i) => (obj[`col_${i}`] = v));
      return mapRow(obj);
    })
    .filter((r) => r.name || r.email || r.phone);
  return mapped;
}

/** Extract raw text from a .docx via mammoth, then heuristic parse. */
export async function parseDocx(file: File): Promise<ParsedLead[]> {
  const mammoth = await import("mammoth/mammoth.browser");
  const buf = await file.arrayBuffer();
  const { value } = await (mammoth as any).extractRawText({ arrayBuffer: buf });
  return parseFreeText(value || "");
}

/** Extract text from a PDF via pdfjs (loaded from a CDN to avoid worker bundle issues). */
export async function parsePdf(file: File): Promise<ParsedLead[]> {
  // Lazy-load pdfjs from a CDN so we don't add ~1 MB to the main bundle.
  const pdfUrl = "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.min.mjs";
  // @ts-ignore -- dynamic remote ESM import, no local types
  const pdfjs: any = await import(/* @vite-ignore */ pdfUrl);
  pdfjs.GlobalWorkerOptions.workerSrc =
    "https://esm.sh/pdfjs-dist@4.7.76/build/pdf.worker.min.mjs";
  const buf = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buf }).promise;
  let text = "";
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((it: any) => it.str).join(" ") + "\n";
  }
  return parseFreeText(text);
}

/**
 * Heuristic parser for unstructured PDF/DOCX text. Splits into blocks
 * separated by blank lines and extracts email / phone / URL / lines that
 * look like a workshop name.
 */
export function parseFreeText(text: string): ParsedLead[] {
  const emailRe = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const phoneRe = /(\+?\d[\d\s().-]{7,}\d)/g;
  const urlRe = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter((b) => b.length > 4);

  const out: ParsedLead[] = [];
  for (const block of blocks) {
    const email = block.match(emailRe)?.[0];
    const phone = block.match(phoneRe)?.[0]?.replace(/\s+/g, " ").trim();
    const website = block.match(urlRe)?.[0];
    if (!email && !phone) continue;

    const firstLine = block.split(/\n/)[0].trim();
    out.push({
      name: firstLine.slice(0, 120),
      email,
      phone,
      website,
      notes: block,
    });
  }
  return out;
}

export async function parseFile(file: File): Promise<ParsedLead[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return parseSpreadsheet(file);
  }
  if (name.endsWith(".docx")) return parseDocx(file);
  if (name.endsWith(".pdf")) return parsePdf(file);
  throw new Error("Formato não suportado. Use XLSX, XLS, CSV, PDF ou DOCX.");
}
