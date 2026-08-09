/**
 * License plate validation + auto-format per region.
 * Detects region from the active shop's currency/country when possible.
 */

export type PlateRegion = "PT" | "BR" | "ES" | "FR" | "DE" | "UK" | "US" | "IN" | "GENERIC";

/**
 * Portugal plate patterns (letters/digits ordering used across generations),
 * expressed WITHOUT separators — validation runs on the canonical form so
 * "00AA00", "00-AA-00" and "00 aa 00" are equally accepted:
 *   AA-00-AA   (current, since 2020)
 *   00-AA-00   (2005–2020)
 *   00-00-AA   (1992–2005)
 *   AA-00-00   (1937–1992)
 */
const PT_PATTERNS = [
  /^[A-Z]{2}\d{2}[A-Z]{2}$/,
  /^\d{2}[A-Z]{2}\d{2}$/,
  /^\d{2}\d{2}[A-Z]{2}$/,
  /^[A-Z]{2}\d{2}\d{2}$/,
];

/** Brazil (canonical): ABC1234 (old) or ABC1D23 (Mercosul). */
const BR_PATTERNS = [
  /^[A-Z]{3}\d{4}$/,
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

/** Normalize user input: uppercase, keep only A-Z0-9, hyphens and spaces. */
export function normalizePlate(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9 -]/g, "").replace(/\s+/g, " ");
}

/**
 * Canonical form used ONLY for comparisons/search: uppercase alphanumerics,
 * no separators. "00-AA-00", "00aa00" and "00 AA 00" all collapse to "00AA00".
 * Never persisted — the stored plate keeps its human-readable separators.
 */
export function canonicalPlate(raw: string): string {
  return (raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Auto-format while typing.
 * PT: inserts hyphens every 2 chars → AA-00-AA / 00-AA-00 / 00-00-AA
 * BR: ABC-1234 (old) or ABC1D23 (Mercosul, no separator).
 * ES: 1234 ABC (modern format, single space).
 * Others: uppercase + strip invalid chars.
 *
 * Never truncates: characters beyond the canonical length are kept at the end
 * so the user's input is never silently destroyed.
 */
export function autoFormatPlate(raw: string, region: PlateRegion): string {
  const cleaned = canonicalPlate(raw);
  if (!cleaned) return "";
  if (region === "PT") {
    const parts: string[] = [];
    for (let i = 0; i < cleaned.length && i < 6; i += 2) parts.push(cleaned.slice(i, i + 2));
    return parts.join("-") + cleaned.slice(6);
  }
  if (region === "BR") {
    // Mercosul has a letter in position 4 (ABC1D23) → no separator.
    if (cleaned.length >= 5 && /[A-Z]/.test(cleaned[4] || "")) {
      return cleaned.slice(0, 7) + cleaned.slice(7);
    }
    if (cleaned.length <= 3) return cleaned;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}` + cleaned.slice(7);
  }
  if (region === "ES") {
    if (cleaned.length <= 4) return cleaned;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)}` + cleaned.slice(7);
  }
  return cleaned.slice(0, 10);
}

/** Validate a fully-typed plate against the region rules (separator-agnostic). */
export function isValidPlate(value: string, region: PlateRegion): boolean {
  const v = canonicalPlate(value);
  if (!v) return false;
  switch (region) {
    case "PT": return PT_PATTERNS.some((p) => p.test(v));
    case "BR": return BR_PATTERNS.some((p) => p.test(v));
    case "ES": return /^\d{4}[A-Z]{3}$/.test(v);
    case "FR": return /^[A-Z]{2}\d{3}[A-Z]{2}$/.test(v);
    case "DE": return /^[A-Z]{2,5}\d{1,4}$/.test(v);
    case "UK": return /^[A-Z]{2}\d{2}[A-Z]{3}$/.test(v);
    case "IN": return /^[A-Z]{2}\d{1,2}[A-Z]{1,2}\d{1,4}$/.test(v);
    case "US":
    case "GENERIC":
    default: return /^[A-Z0-9]{2,10}$/.test(v);
  }
}

export function plateExampleFor(region: PlateRegion): string {
  switch (region) {
    case "PT": return "AA-00-AA";
    case "BR": return "ABC-1234 ou ABC1D23";
    case "ES": return "1234 ABC";
    case "FR": return "AA-123-BB";
    case "DE": return "M-AB-1234";
    case "UK": return "AB12 CDE";
    case "IN": return "MH-12-AB-1234";
    case "US": return "ABC-1234";
    default: return "AA-00-AA";
  }
}
