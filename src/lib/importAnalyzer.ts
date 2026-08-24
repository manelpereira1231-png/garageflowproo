/**
 * Importação universal de Clientes e Viaturas.
 *
 * Analisa ficheiros tabulares (.csv, .xlsx, .xls, .ods, .txt, .tsv) sem exigir
 * um modelo específico: deteta a linha de cabeçalho, normaliza os nomes das
 * colunas (acentos, abreviaturas, espaços) e sugere um mapeamento para os
 * campos da aplicação. Nada é inventado — quando há dúvida, devolve uma
 * sugestão com nível de confiança para o utilizador confirmar.
 */
import * as XLSX from "xlsx";

export type FieldKey =
  | "client_name"
  | "client_phone"
  | "client_email"
  | "client_company"
  | "client_nif"
  | "client_address"
  | "client_postal_code"
  | "client_city"
  | "client_notes"
  | "vehicle_plate"
  | "vehicle_vin"
  | "vehicle_make"
  | "vehicle_model"
  | "vehicle_version"
  | "vehicle_year"
  | "vehicle_mileage"
  | "vehicle_fuel"
  | "vehicle_date"
  | "vehicle_notes";

export const FIELD_LABELS: Record<FieldKey, string> = {
  client_name: "Cliente · Nome",
  client_phone: "Cliente · Telefone",
  client_email: "Cliente · Email",
  client_company: "Cliente · Empresa",
  client_nif: "Cliente · NIF/Contribuinte",
  client_address: "Cliente · Morada",
  client_postal_code: "Cliente · Código Postal",
  client_city: "Cliente · Localidade",
  client_notes: "Cliente · Observações",
  vehicle_plate: "Viatura · Matrícula",
  vehicle_vin: "Viatura · VIN/Chassis",
  vehicle_make: "Viatura · Marca",
  vehicle_model: "Viatura · Modelo",
  vehicle_version: "Viatura · Versão",
  vehicle_year: "Viatura · Ano",
  vehicle_mileage: "Viatura · Quilómetros",
  vehicle_fuel: "Viatura · Combustível",
  vehicle_date: "Viatura · Data (matrícula/registo)",
  vehicle_notes: "Viatura · Observações",
};

export const CLIENT_FIELDS: FieldKey[] = [
  "client_name", "client_phone", "client_email", "client_company", "client_nif",
  "client_address", "client_postal_code", "client_city", "client_notes",
];
export const VEHICLE_FIELDS: FieldKey[] = [
  "vehicle_plate", "vehicle_vin", "vehicle_make", "vehicle_model", "vehicle_version",
  "vehicle_year", "vehicle_mileage", "vehicle_fuel", "vehicle_date", "vehicle_notes",
];

export const SUPPORTED_EXTENSIONS = ["csv", "xlsx", "xls", "ods", "txt", "tsv", "xlsm", "fods", "dif", "prn"];

/** Normaliza um cabeçalho: minúsculas, sem acentos, sem pontuação. */
export function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Sinónimos por campo (exatos e parciais). Ordem = prioridade. */
const SYNONYMS: Record<FieldKey, string[]> = {
  client_name: ["nome cliente", "nome do cliente", "cliente nome", "nome completo", "cliente", "nome", "client", "customer", "customer name", "titular", "proprietario", "dono", "nome proprietario", "razao social", "nombre"],
  client_phone: ["telefone", "telemovel", "telemovel cliente", "tlm", "tlf", "contacto", "contato", "telefone cliente", "phone", "mobile", "nr telefone", "numero telefone", "movel", "celular", "whatsapp"],
  client_email: ["email", "e mail", "mail", "correio eletronico", "email cliente", "endereco email"],
  client_company: ["empresa", "company", "sociedade", "firma", "nome empresa", "empresa cliente"],
  client_nif: ["nif", "nipc", "contribuinte", "n contribuinte", "numero contribuinte", "vat", "cif", "nie", "cnpj", "cpf", "tax id", "nuit"],
  client_address: ["morada", "endereco", "address", "rua", "direccion", "domicilio", "morada cliente"],
  client_postal_code: ["codigo postal", "cod postal", "cp", "postal", "zip", "zip code", "cep"],
  client_city: ["localidade", "cidade", "city", "concelho", "municipio", "povoacao"],
  client_notes: ["observacoes cliente", "notas cliente", "obs cliente"],
  vehicle_plate: ["matricula", "matricula viatura", "placa", "plate", "license plate", "registration", "matr", "mat"],
  vehicle_vin: ["vin", "chassis", "chassi", "nr chassis", "numero chassis", "bastidor", "vin chassis", "n quadro"],
  vehicle_make: ["marca", "make", "brand", "fabricante", "marca viatura", "marca veiculo"],
  vehicle_model: ["modelo", "model", "modelo viatura", "modelo veiculo"],
  vehicle_version: ["versao", "version", "variante", "acabamento", "motorizacao", "trim", "cilindrada", "derivado"],
  vehicle_year: ["ano", "year", "ano viatura", "ano modelo", "ano fabrico", "ano de fabrico"],
  vehicle_mileage: ["km", "kms", "quilometros", "kilometros", "mileage", "odometro", "quilometragem", "km atuais"],
  vehicle_fuel: ["combustivel", "fuel", "carburante", "tipo combustivel", "energia"],
  vehicle_date: ["data", "data matricula", "data registo", "data 1 matricula", "primeira matricula", "date", "data entrada"],
  vehicle_notes: ["observacoes", "obs", "notas", "notes", "comentarios", "descricao", "observacoes viatura"],
};

export type ColumnStat = {
  index: number;
  header: string;
  samples: string[];
  filled: number;
};

export type Suggestion = { field: FieldKey | null; confidence: number; reason: string };

/** Heurísticas por conteúdo, usadas quando o cabeçalho não é conclusivo. */
const PLATE_RE = /^[A-Z0-9]{2}[- ]?[A-Z0-9]{2}[- ]?[A-Z0-9]{2}$|^[0-9]{4}[- ]?[A-Z]{3}$/i;
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
const PHONE_RE = /^\+?[0-9][0-9 ().-]{6,17}$/;

function contentScore(field: FieldKey, samples: string[]): number {
  const vals = samples.filter(Boolean);
  if (!vals.length) return 0;
  const ratio = (fn: (v: string) => boolean) => vals.filter(fn).length / vals.length;
  switch (field) {
    case "client_email": return ratio((v) => EMAIL_RE.test(v));
    case "client_phone": return ratio((v) => PHONE_RE.test(v.replace(/\s+/g, " ").trim()));
    case "vehicle_vin": return ratio((v) => VIN_RE.test(v.replace(/\s/g, "")));
    case "vehicle_plate": return ratio((v) => PLATE_RE.test(v.trim()));
    case "vehicle_year": return ratio((v) => /^(19|20)\d{2}$/.test(v.trim()));
    case "client_postal_code": return ratio((v) => /^\d{4}([- ]\d{3})?$|^\d{5}(-\d{3})?$/.test(v.trim()));
    case "client_nif": return ratio((v) => /^[0-9]{9}$|^[0-9]{11,14}$/.test(v.replace(/\D/g, "")));
    case "vehicle_fuel": return ratio((v) => /gasol|diesel|gasoleo|eletric|electric|hibrid|hybrid|gpl|gnv|etanol|flex/i.test(v));
    default: return 0;
  }
}

export function suggestField(col: ColumnStat, taken: Set<FieldKey>): Suggestion {
  const h = norm(col.header);
  let best: Suggestion = { field: null, confidence: 0, reason: "Sem correspondência" };

  if (h) {
    for (const [field, list] of Object.entries(SYNONYMS) as [FieldKey, string[]][]) {
      for (let i = 0; i < list.length; i++) {
        const syn = list[i];
        let score = 0;
        if (h === syn) score = 0.98 - i * 0.005;
        else if (h.startsWith(syn + " ") || h.endsWith(" " + syn)) score = 0.85 - i * 0.005;
        else if (h.includes(syn) && syn.length >= 3) score = 0.7 - i * 0.005;
        if (score > best.confidence) best = { field, confidence: score, reason: `Cabeçalho "${col.header}" ≈ "${syn}"` };
      }
    }
  }

  // Conteúdo pode confirmar ou substituir uma sugestão fraca
  for (const field of Object.keys(SYNONYMS) as FieldKey[]) {
    const cs = contentScore(field, col.samples);
    if (cs >= 0.7) {
      const score = Math.min(0.95, 0.55 + cs * 0.4);
      if (field === best.field) best = { ...best, confidence: Math.min(0.99, best.confidence + 0.1), reason: best.reason + " + conteúdo compatível" };
      else if (score > best.confidence) best = { field, confidence: score, reason: `Conteúdo compatível com ${FIELD_LABELS[field]}` };
    }
  }

  if (best.field && taken.has(best.field)) return { field: null, confidence: 0, reason: `Campo ${FIELD_LABELS[best.field]} já atribuído a outra coluna` };
  return best;
}

export type SheetAnalysis = {
  name: string;
  headerRowIndex: number;
  headers: string[];
  columns: ColumnStat[];
  rows: string[][];
  totalRows: number;
  mapping: Record<number, FieldKey | null>;
  suggestions: Record<number, Suggestion>;
  kind: "clients" | "vehicles" | "mixed" | "unknown";
  include: boolean;
};

export type FileAnalysis = { fileName: string; sheets: SheetAnalysis[] };

function cellToString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/** Deteta a linha de cabeçalho: primeira linha com >=2 células textuais não numéricas. */
function detectHeaderRow(matrix: string[][]): number {
  const limit = Math.min(matrix.length, 25);
  let bestIdx = -1;
  let bestScore = 0;
  for (let i = 0; i < limit; i++) {
    const row = matrix[i];
    const filled = row.filter((c) => c !== "");
    if (filled.length < 2) continue;
    const textual = filled.filter((c) => c.length <= 40 && !/^\d+([.,]\d+)?$/.test(c)).length;
    const known = filled.filter((c) => suggestField({ index: 0, header: c, samples: [], filled: 0 }, new Set()).confidence >= 0.7).length;
    const score = textual / filled.length + known * 0.6 + Math.min(filled.length, 8) * 0.02;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  }
  return bestIdx;
}

function classifySheet(mapping: Record<number, FieldKey | null>): SheetAnalysis["kind"] {
  const fields = Object.values(mapping).filter(Boolean) as FieldKey[];
  const hasClient = fields.some((f) => CLIENT_FIELDS.includes(f));
  const hasVehicle = fields.some((f) => VEHICLE_FIELDS.includes(f));
  if (hasClient && hasVehicle) return "mixed";
  if (hasClient) return "clients";
  if (hasVehicle) return "vehicles";
  return "unknown";
}

export function analyzeMatrix(name: string, matrix: string[][]): SheetAnalysis {
  const cleaned = matrix.map((r) => r.map(cellToString));
  const headerRowIndex = detectHeaderRow(cleaned);
  const headers = headerRowIndex >= 0 ? cleaned[headerRowIndex] : [];
  const body = (headerRowIndex >= 0 ? cleaned.slice(headerRowIndex + 1) : cleaned).filter((r) => r.some((c) => c !== ""));
  const width = Math.max(headers.length, ...body.map((r) => r.length), 0);

  const columns: ColumnStat[] = [];
  for (let i = 0; i < width; i++) {
    const values = body.map((r) => r[i] ?? "");
    columns.push({
      index: i,
      header: headers[i] || `Coluna ${i + 1}`,
      samples: values.filter((v) => v !== "").slice(0, 30),
      filled: values.filter((v) => v !== "").length,
    });
  }

  // Mapeia por ordem de confiança para evitar colisões
  const suggestions: Record<number, Suggestion> = {};
  const scored = columns
    .map((c) => ({ c, s: suggestField(c, new Set()) }))
    .sort((a, b) => b.s.confidence - a.s.confidence);
  const taken = new Set<FieldKey>();
  const mapping: Record<number, FieldKey | null> = {};
  for (const { c, s } of scored) {
    if (s.field && s.confidence >= 0.6 && !taken.has(s.field)) {
      taken.add(s.field);
      mapping[c.index] = s.field;
      suggestions[c.index] = s;
    } else {
      mapping[c.index] = null;
      suggestions[c.index] = s.field && taken.has(s.field)
        ? { field: null, confidence: 0, reason: `Possível ${FIELD_LABELS[s.field]} (já atribuído)` }
        : s;
    }
  }

  const kind = classifySheet(mapping);
  return {
    name,
    headerRowIndex,
    headers,
    columns,
    rows: body,
    totalRows: body.length,
    mapping,
    suggestions,
    kind,
    include: kind !== "unknown",
  };
}

export async function analyzeFile(file: File): Promise<FileAnalysis> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Formato ".${ext}" não suportado. Utilize um ficheiro tabular: ${SUPPORTED_EXTENSIONS.map((e) => "." + e).join(", ")}.`
    );
  }
  const buffer = await file.arrayBuffer();
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { type: "array", cellDates: true, raw: false });
  } catch (e) {
    throw new Error("Não foi possível ler o ficheiro. Verifique se está corrompido ou protegido por palavra-passe.");
  }
  if (!wb.SheetNames?.length) throw new Error("O ficheiro não contém folhas de dados legíveis.");

  const sheets = wb.SheetNames.map((sheetName) => {
    const matrix = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName], { header: 1, blankrows: false, defval: "", raw: false });
    return analyzeMatrix(sheetName, matrix as unknown as string[][]);
  }).filter((s) => s.totalRows > 0 || s.headers.length > 0);

  if (!sheets.length) throw new Error("O ficheiro está vazio ou não contém dados tabulares.");
  return { fileName: file.name, sheets };
}

/* ---------------- Extração de registos ---------------- */

export type ParsedRecord = {
  sheet: string;
  rowNumber: number;
  client: Record<string, string>;
  vehicle: Record<string, string>;
  errors: string[];
  warnings: string[];
};

export function normalizePlate(v: string): string {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function cleanPhone(v: string): string {
  const t = v.replace(/[^\d+]/g, "");
  return t.length >= 6 ? t : "";
}

function parseYear(v: string): string {
  const m = v.match(/(19|20)\d{2}/);
  return m ? m[0] : "";
}

function parseInt0(v: string): string {
  const d = v.replace(/[^\d]/g, "");
  return d ? String(parseInt(d, 10)) : "";
}

function normalizeFuel(v: string): string {
  const n = norm(v);
  if (!n) return "";
  if (/gasoleo|diesel/.test(n)) return "Diesel";
  if (/eletric|electric|ev/.test(n)) return "Elétrico";
  if (/hibrid|hybrid/.test(n)) return "Híbrido";
  if (/gpl|lpg/.test(n)) return "GPL";
  if (/gasol|petrol|benzin/.test(n)) return "Gasolina";
  return v.trim();
}

export function extractRecords(sheets: SheetAnalysis[]): ParsedRecord[] {
  const out: ParsedRecord[] = [];
  for (const sheet of sheets) {
    if (!sheet.include) continue;
    const entries = Object.entries(sheet.mapping).filter(([, f]) => !!f) as [string, FieldKey][];
    if (!entries.length) continue;

    sheet.rows.forEach((row, idx) => {
      const rowNumber = (sheet.headerRowIndex >= 0 ? sheet.headerRowIndex + 2 : 1) + idx;
      const client: Record<string, string> = {};
      const vehicle: Record<string, string> = {};
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const [colIdx, field] of entries) {
        const raw = (row[Number(colIdx)] ?? "").trim();
        if (!raw) continue;
        switch (field) {
          case "client_name": client.name = raw; break;
          case "client_phone": {
            const p = cleanPhone(raw);
            if (p) client.phone = p; else warnings.push(`Telefone "${raw}" ignorado (formato inválido)`);
            break;
          }
          case "client_email": {
            if (EMAIL_RE.test(raw)) client.email = raw.toLowerCase();
            else warnings.push(`Email "${raw}" ignorado (formato inválido)`);
            break;
          }
          case "client_company": client.company = raw; break;
          case "client_nif": client.nif = raw.replace(/\s/g, ""); break;
          case "client_address": client.address = raw; break;
          case "client_postal_code": client.postal_code = raw; break;
          case "client_city": client.city = raw; break;
          case "client_notes": client.notes = [client.notes, raw].filter(Boolean).join(" | "); break;
          case "vehicle_plate": vehicle.plate = raw.toUpperCase().trim(); break;
          case "vehicle_vin": {
            const vin = raw.replace(/\s/g, "").toUpperCase();
            if (VIN_RE.test(vin)) vehicle.vin = vin;
            else warnings.push(`VIN "${raw}" ignorado (não tem 17 caracteres válidos)`);
            break;
          }
          case "vehicle_make": vehicle.make = raw; break;
          case "vehicle_model": vehicle.model = raw; break;
          case "vehicle_version": vehicle.version = raw; break;
          case "vehicle_year": {
            const y = parseYear(raw);
            if (y) vehicle.year = y; else warnings.push(`Ano "${raw}" ignorado`);
            break;
          }
          case "vehicle_mileage": {
            const km = parseInt0(raw);
            if (km) vehicle.mileage = km;
            break;
          }
          case "vehicle_fuel": vehicle.fuel = normalizeFuel(raw); break;
          case "vehicle_date": vehicle.notes = [vehicle.notes, `Data: ${raw}`].filter(Boolean).join(" | ");
            if (!vehicle.year) { const y = parseYear(raw); if (y) vehicle.year = y; }
            break;
          case "vehicle_notes": vehicle.notes = [vehicle.notes, raw].filter(Boolean).join(" | "); break;
        }
      }

      const hasClient = Object.keys(client).length > 0;
      const hasVehicle = Object.keys(vehicle).length > 0;
      if (!hasClient && !hasVehicle) return; // linha vazia

      if (hasVehicle && !vehicle.plate) {
        errors.push("Viatura sem matrícula — campo obrigatório para criar o veículo");
      }
      if (!client.name) {
        if (client.company) { client.name = client.company; warnings.push("Nome em falta — usada a empresa como nome do cliente"); }
        else if (hasVehicle) errors.push("Cliente sem nome — indique o nome ou remova a linha");
        else errors.push("Linha sem nome de cliente");
      }
      if (hasVehicle && !vehicle.make) errors.push("Viatura sem marca — campo obrigatório");
      if (hasVehicle && !vehicle.model) errors.push("Viatura sem modelo — campo obrigatório");
      if (!client.phone && !client.email) warnings.push("Cliente sem telefone nem email");

      out.push({ sheet: sheet.name, rowNumber, client, vehicle, errors, warnings });
    });
  }
  return out;
}
