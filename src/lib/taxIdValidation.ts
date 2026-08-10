/**
 * Validação de identificadores fiscais por país.
 *
 * Usada pelo formulário de clientes (e por qualquer sítio que precise de
 * validar o campo `taxId` definido em `countryFields.ts`).
 *
 * Regras:
 *  - PT: NIF com 9 dígitos (mantém o comportamento já existente).
 *  - BR: CPF (11 dígitos) OU CNPJ (14 dígitos) — validados por dígito de
 *        controlo próprio de cada um. Não são tratados como a mesma coisa.
 *  - ES: NIF (8 dígitos + letra), NIE (X/Y/Z + 7 dígitos + letra) ou
 *        CIF (letra + 7 dígitos + dígito/letra de controlo).
 *  - Restantes países: sem validação de checksum (apenas o pattern, se existir).
 */

const digits = (v: string) => (v || "").replace(/\D/g, "");
const clean = (v: string) => (v || "").replace(/[\s.\-/]/g, "").toUpperCase();

/** Portugal — NIF: 9 dígitos. */
export function isValidPtNif(value: string): boolean {
  return /^\d{9}$/.test(digits(value)) && digits(value).length === 9;
}

/** Brasil — CPF: 11 dígitos com 2 dígitos verificadores. */
export function isValidCpf(value: string): boolean {
  const d = digits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

/** Brasil — CNPJ: 14 dígitos com 2 dígitos verificadores. */
export function isValidCnpj(value: string): boolean {
  const d = digits(value);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (len: number) => {
    const weights = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13]);
}

/** Brasil — aceita CPF ou CNPJ (decidido pelo número de dígitos). */
export function isValidCpfCnpj(value: string): boolean {
  const d = digits(value);
  if (d.length === 11) return isValidCpf(value);
  if (d.length === 14) return isValidCnpj(value);
  return false;
}

const ES_DNI_LETTERS = "TRWAGMYFPDXBNJZSQVHLCKE";

/** Espanha — NIF/NIE/CIF. */
export function isValidEsTaxId(value: string): boolean {
  const v = clean(value);

  // NIF (pessoa singular): 8 dígitos + letra de controlo
  if (/^\d{8}[A-Z]$/.test(v)) {
    return ES_DNI_LETTERS[Number(v.slice(0, 8)) % 23] === v[8];
  }

  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const prefix = { X: "0", Y: "1", Z: "2" }[v[0] as "X" | "Y" | "Z"];
    return ES_DNI_LETTERS[Number(prefix + v.slice(1, 8)) % 23] === v[8];
  }

  // CIF (entidades): letra + 7 dígitos + dígito ou letra de controlo
  if (/^[ABCDEFGHJNPQRSUVW]\d{7}[0-9A-J]$/.test(v)) {
    const body = v.slice(1, 8);
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const n = Number(body[i]);
      if (i % 2 === 0) {
        const dbl = n * 2;
        sum += Math.floor(dbl / 10) + (dbl % 10);
      } else {
        sum += n;
      }
    }
    const control = (10 - (sum % 10)) % 10;
    const ctrl = v[8];
    return ctrl === String(control) || ctrl === "JABCDEFGHI"[control];
  }

  return false;
}

/**
 * Valida o identificador fiscal para um país.
 * Vazio = válido (o campo é opcional em clientes).
 * Países sem regra específica caem no `pattern` (se fornecido) ou passam.
 */
export function isValidTaxId(value: string, countryCode?: string, pattern?: string): boolean {
  const raw = (value || "").trim();
  if (!raw) return true;
  switch ((countryCode || "PT").toUpperCase()) {
    case "PT":
      return isValidPtNif(raw);
    case "BR":
      return isValidCpfCnpj(raw);
    case "ES":
      return isValidEsTaxId(raw);
    default:
      return pattern ? new RegExp(pattern).test(raw) : true;
  }
}

/** Texto de ajuda com o formato esperado, por país. */
export function taxIdHint(countryCode?: string): string | undefined {
  switch ((countryCode || "PT").toUpperCase()) {
    case "PT":
      return "NIF com 9 dígitos — ex.: 123456789";
    case "BR":
      return "CPF (000.000.000-00) ou CNPJ (00.000.000/0000-00) válido";
    case "ES":
      return "NIF (12345678Z), NIE (X1234567L) ou CIF (A12345674)";
    default:
      return undefined;
  }
}
