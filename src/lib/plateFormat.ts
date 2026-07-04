/**
 * License plate validation + auto-format per region.
 * Detects region from the active shop's currency/country when possible.
 */

export type PlateRegion = "PT" | "BR" | "ES" | "FR" | "DE" | "UK" | "US" | "IN" | "GENERIC";

/**
 * Portugal plate patterns (letters/digits ordering used across generations):
 *   AA-00-AA   (current, since 2020)
 *   00-AA-00   (2005–2020)
 *   00-00-AA   (1992–2005)
 *   AA-00-00   (1937–1992)
 */
const PT_PATTERNS = [
  /^[A-Z]{2}-\d{2}-[A-Z]{2}$/,
  /^\d{2}-[A-Z]{2}-\d{2}$/,
  /^\d{2}-\d{2}-[A-Z]{2}$/,
  /^[A-Z]{2}-\d{2}-\d{2}$/,
];

/** Brazil: ABC-1234 (old) or ABC1D23 (Mercosul). */
const BR_PATTERNS = [
  /^[A-Z]{3}-\d{4}$/,
  /^[A-Z]{3}\d[A-Z]\d{2}$/,
];

export function detectRegionFromCurrency(currency?: string | null, country?: string | null): PlateRegion {
  const c = (country || "").toUpperCase();
  if (["PT", "BR", "ES", "FR", "DE", "UK", "GB", "US", "IN"].includes(c)) {
    return (c === "GB" ? "UK" : c) as PlateRegion;
  }
  const cur = (currency || "").toUpperCase();
  if (cur === "BRL") return "BR";
  if (cur === "USD") return "US";
  if (cur === "GBP") return "UK";
  if (cur === "INR") return "IN";
  return "PT"; // default for EUR / unknown
}

/** Normalize user input: uppercase, keep only A-Z0-9 and hyphens. */
export function normalizePlate(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

/**
 * Auto-format while typing.
 * PT: inserts hyphens every 2 chars → AA-00-AA
 * BR: keeps single hyphen for old format only (ABC-1234). Mercosul has no hyphen.
 * Others: uppercase + strip invalid chars.
 */
export function autoFormatPlate(raw: string, region: PlateRegion): string {
  const cleaned = normalizePlate(raw).replace(/-/g, "");
  if (region === "PT") {
    // group in 3 blocks of 2
    const parts: string[] = [];
    for (let i = 0; i < cleaned.length && i < 6; i += 2) parts.push(cleaned.slice(i, i + 2));
    return parts.join("-");
  }
  if (region === "BR") {
    // If it looks Mercosul (letter in pos 4), keep unhyphenated ABC1D23.
    if (cleaned.length >= 5 && /[A-Z]/.test(cleaned[4] || "")) {
      return cleaned.slice(0, 7);
    }
    // Old format: ABC-1234
    if (cleaned.length <= 3) return cleaned;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}`;
  }
  return cleaned.slice(0, 10);
}

/** Validate a fully-typed plate against the region rules. */
export function isValidPlate(value: string, region: PlateRegion): boolean {
  const v = normalizePlate(value);
  if (!v) return false;
  switch (region) {
    case "PT": return PT_PATTERNS.some((p) => p.test(v));
    case "BR": return BR_PATTERNS.some((p) => p.test(v));
    case "ES": return /^\d{4}-?[A-Z]{3}$/.test(v);
    case "FR": return /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/.test(v);
    case "DE": return /^[A-Z]{1,3}-?[A-Z]{1,2}-?\d{1,4}$/.test(v);
    case "UK": return /^[A-Z]{2}\d{2}\s?[A-Z]{3}$/.test(v);
    case "IN": return /^[A-Z]{2}-?\d{1,2}-?[A-Z]{1,2}-?\d{1,4}$/.test(v);
    case "US":
    case "GENERIC":
    default: return /^[A-Z0-9-]{2,10}$/.test(v);
  }
}

export function plateExampleFor(region: PlateRegion): string {
  switch (region) {
    case "PT": return "AA-00-AA";
    case "BR": return "ABC-1234 ou ABC1D23";
    case "ES": return "1234-BCD";
    case "FR": return "AA-123-BB";
    case "DE": return "M-AB-1234";
    case "UK": return "AB12 CDE";
    case "IN": return "MH-12-AB-1234";
    case "US": return "ABC-1234";
    default: return "AA-00-AA";
  }
}
