/**
 * Importador de catálogo dos fornecedores (CSV).
 *
 * Leitura robusta: BOM UTF-8, delimitador automático (, ; tab |), campos entre
 * aspas com quebras de linha e aspas duplicadas, cabeçalhos PT/EN, números com
 * vírgula decimal e símbolo de moeda. Nada é inventado: cada linha que falha é
 * devolvida com o número real da linha no ficheiro.
 */

export type ParsedProductRow = {
  line: number;
  title: string;
  sku: string | null;
  ean: string | null;
  category: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  image: string | null;
  price: number;
  discount_price: number | null;
  vat: number;
  stock: number;
  status: "draft" | "active" | "archived";
  condition: "new" | "refurbished" | "used";
};

export type ParseResult = {
  rows: ParsedProductRow[];
  errors: { line: number; message: string }[];
  headers: string[];
  unmapped: string[];
  delimiter: string;
  totalDataLines: number;
};

/* ─── leitura do ficheiro com deteção de codificação ─────────────────── */

export async function readCsvText(file: File): Promise<string> {
  const buf = new Uint8Array(await file.arrayBuffer());
  // UTF-8 BOM
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(buf.subarray(3));
  }
  // UTF-16 BOM
  if (buf[0] === 0xff && buf[1] === 0xfe) return new TextDecoder("utf-16le").decode(buf.subarray(2));
  if (buf[0] === 0xfe && buf[1] === 0xff) return new TextDecoder("utf-16be").decode(buf.subarray(2));

  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  // U+FFFD indica bytes inválidos em UTF-8 → provavelmente Latin-1/Windows-1252.
  if (utf8.includes("\uFFFD")) {
    try {
      return new TextDecoder("windows-1252").decode(buf);
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/* ─── parser CSV (RFC 4180 tolerante) ────────────────────────────────── */

export function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < firstLine.length; i++) {
      const ch = firstLine[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Devolve as linhas do CSV como matriz de células (mantém linhas vazias fora). */
export function parseCsvRows(text: string, delimiter: string): { cells: string[]; line: number }[] {
  const out: { cells: string[]; line: number }[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;
  let started = false;

  const pushField = () => {
    cells.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (cells.some((c) => c.trim() !== "")) out.push({ cells, line: rowStartLine });
    cells = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!started && ch !== "\n" && ch !== "\r") {
      started = true;
      rowStartLine = line;
    }
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === delimiter) {
      pushField();
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      pushRow();
      line++;
      continue;
    }
    field += ch;
  }
  if (field !== "" || cells.length) pushRow();
  return out;
}

/* ─── mapeamento de colunas ──────────────────────────────────────────── */

const norm = (s: string) =>
  s
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ALIASES: Record<keyof Omit<ParsedProductRow, "line">, string[]> = {
  title: ["titulo", "title", "nome", "designacao", "descricao curta", "produto", "artigo"],
  sku: ["sku", "referencia", "ref", "codigo", "cod", "reference"],
  ean: ["ean", "ean13", "codigo de barras", "barcode", "gtin"],
  category: ["categoria", "category", "familia"],
  brand: ["marca", "brand", "fabricante", "manufacturer"],
  model: ["modelo", "model"],
  description: ["descricao", "description", "detalhe", "observacoes"],
  image: ["imagem", "imagem url", "image", "image url", "foto", "url imagem", "imagem link"],
  price: ["preco", "preco eur", "preco com iva", "price", "pvp", "valor"],
  discount_price: ["preco promo", "preco promocional", "promo", "preco campanha", "discount price", "sale price"],
  vat: ["iva", "iva %", "taxa iva", "vat", "tax"],
  stock: ["stock", "quantidade", "qtd", "existencias", "qty", "quantity"],
  status: ["estado do anuncio", "estado", "status", "publicado", "estado anuncio"],
  condition: ["condicao", "condition", "estado do produto", "estado artigo"],
};

function buildIndex(headers: string[]) {
  const normalized = headers.map(norm);
  const index: Partial<Record<keyof ParsedProductRow, number>> = {};
  (Object.keys(ALIASES) as (keyof typeof ALIASES)[]).forEach((field) => {
    const aliases = ALIASES[field].map(norm);
    // 1) igualdade exata
    let pos = normalized.findIndex((h) => aliases.includes(h));
    // 2) começa por / contém o alias (ex.: "preco eur" vs "preco (eur)")
    if (pos === -1) pos = normalized.findIndex((h) => aliases.some((a) => h === a || h.startsWith(a + " ")));
    if (pos >= 0) index[field] = pos;
  });
  // "preço" nunca pode roubar a coluna do "preço promo"
  if (index.price != null && index.price === index.discount_price) delete index.discount_price;
  return index;
}

export function parseNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[€$£\s]/g, "").replace(/%/g, "");
  if (!s) return null;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // o último separador é o decimal
    s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function mapStatus(raw: string | undefined): ParsedProductRow["status"] {
  const v = norm(raw ?? "");
  if (!v) return "draft";
  if (["ativo", "activo", "active", "publicado", "published", "sim", "1", "true", "visivel"].includes(v)) return "active";
  if (["arquivado", "archived", "despublicado", "inativo", "inactivo", "0", "false", "nao"].includes(v)) return "archived";
  return "draft";
}

function mapCondition(raw: string | undefined): ParsedProductRow["condition"] {
  const v = norm(raw ?? "");
  if (["usado", "used", "segunda mao"].includes(v)) return "used";
  if (["recondicionado", "refurbished", "remanufaturado", "reman"].includes(v)) return "refurbished";
  return "new";
}

export function parseProductCsv(text: string): ParseResult {
  const clean = text.replace(/^\uFEFF/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const raw = parseCsvRows(clean, delimiter);

  if (!raw.length) {
    return { rows: [], errors: [{ line: 1, message: "Ficheiro vazio" }], headers: [], unmapped: [], delimiter, totalDataLines: 0 };
  }

  const headers = raw[0].cells.map((h) => h.replace(/^\uFEFF/, "").trim());
  const index = buildIndex(headers);
  const errors: { line: number; message: string }[] = [];

  if (index.title == null) {
    errors.push({
      line: 1,
      message: `Não foi encontrada a coluna do título. Colunas lidas: ${headers.join(" | ") || "(nenhuma)"}`,
    });
    return { rows: [], errors, headers, unmapped: headers, delimiter, totalDataLines: raw.length - 1 };
  }

  const usedCols = new Set(Object.values(index));
  const unmapped = headers.filter((_, i) => !usedCols.has(i));

  const rows: ParsedProductRow[] = [];
  for (let r = 1; r < raw.length; r++) {
    const { cells, line } = raw[r];
    const get = (f: keyof ParsedProductRow) => {
      const i = index[f];
      return i == null ? undefined : (cells[i] ?? "").trim();
    };

    const title = (get("title") || "").trim();
    if (!title) {
      errors.push({ line, message: "Título em falta — linha ignorada" });
      continue;
    }

    const priceRaw = get("price");
    const price = parseNumber(priceRaw);
    if (priceRaw && price == null) {
      errors.push({ line, message: `Preço inválido ("${priceRaw}")` });
      continue;
    }
    const stockRaw = get("stock");
    const stock = parseNumber(stockRaw);
    if (stockRaw && stock == null) {
      errors.push({ line, message: `Stock inválido ("${stockRaw}")` });
      continue;
    }
    const vat = parseNumber(get("vat"));
    const discount = parseNumber(get("discount_price"));

    rows.push({
      line,
      title: title.slice(0, 250),
      sku: get("sku") || null,
      ean: get("ean") || null,
      category: get("category") || null,
      brand: get("brand") || null,
      model: get("model") || null,
      description: get("description") || null,
      image: get("image") || null,
      price: price ?? 0,
      discount_price: discount != null && discount > 0 ? discount : null,
      vat: vat != null ? vat : 23,
      stock: stock != null ? Math.max(0, Math.round(stock)) : 0,
      status: mapStatus(get("status")),
      condition: mapCondition(get("condition")),
    });
  }

  return { rows, errors, headers, unmapped, delimiter, totalDataLines: raw.length - 1 };
}

/** Linha pronta para gsn_products (o supplier_id é sempre o do utilizador autenticado). */
export function toProductPayload(row: ParsedProductRow, supplierId: string) {
  return {
    supplier_id: supplierId,
    title: row.title,
    sku: row.sku,
    ean: row.ean,
    category: row.category,
    brand: row.brand,
    model: row.model,
    description: row.description,
    image: row.image,
    price: row.price,
    discount_price: row.discount_price,
    vat: row.vat,
    stock: row.stock,
    status: row.status,
    condition: row.condition,
  };
}
