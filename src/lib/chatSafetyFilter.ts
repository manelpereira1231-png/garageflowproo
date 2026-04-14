/**
 * GarageFlow Market — Anti-Intermediation Filter
 * Detects and blocks contact information, links, and evasion patterns in chat messages.
 */

// Phone patterns (international + PT/BR/ES)
const PHONE_PATTERNS = [
  /\+?\d[\d\s\-().]{7,14}\d/g,                    // Generic phone
  /\b9\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g,          // PT mobile 9XX XXX XXX
  /\b2\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\b/g,          // PT landline 2XX XXX XXX
  /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g,             // US format
  /nove[\s]*([\doO]{2,})/gi,                        // "nove um dois..." spelled out
];

// Email patterns
const EMAIL_PATTERNS = [
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
  /[a-zA-Z0-9._%+-]+\s*@\s*[a-zA-Z0-9.-]+\s*\.\s*[a-zA-Z]{2,}/gi, // spaced
  /[a-zA-Z0-9._%+-]+\s*\[\s*at\s*\]\s*[a-zA-Z0-9.-]+/gi,          // [at] obfuscation
  /[a-zA-Z0-9._%+-]+\s*\(\s*arroba\s*\)\s*[a-zA-Z0-9.-]+/gi,      // (arroba)
];

// URL/link patterns
const URL_PATTERNS = [
  /https?:\/\/[^\s]+/gi,
  /www\.[^\s]+/gi,
  /[a-zA-Z0-9-]+\.(com|pt|net|org|io|me|co|app|dev|info|biz|eu|br|es|uk|fr|de)\b/gi,
];

// Social media / messenger patterns
const SOCIAL_PATTERNS = [
  /\b(whatsapp|whats\s*app|wpp|zap|telegram|tele\s*gram|signal|messenger|facebook|instagram|insta|snapchat|tiktok|twitter|linkedin)\b/gi,
  /\b(wa\.me|t\.me|fb\.com|m\.me)\b/gi,
];

// Evasion language patterns (PT/EN/ES)
const EVASION_PATTERNS = [
  /\b(liga[r-]?me|ligue[- ]?me|chame[- ]?me|contacte[- ]?me\s*(fora|diretamente|por\s*fora))\b/gi,
  /\b(falar?\s*(fora|por\s*fora|diretamente|pessoalmente))\b/gi,
  /\b(envie?[- ]?(me)?\s*(o\s*)?(seu|teu)\s*(número|telefone|contacto|email|whatsapp))\b/gi,
  /\b(dê[- ]?(me)?\s*(o\s*)?(seu|teu)\s*(número|telefone|contacto|email))\b/gi,
  /\b(passe[- ]?(me)?\s*(o\s*)?(seu|teu)\s*(número|telefone|contacto|email|whatsapp))\b/gi,
  /\b(mand[ae]\s*(mensagem|msg)\s*(no|pelo|por)\s*(whatsapp|telegram|privado))\b/gi,
  /\b(sem\s*comiss[ãa]o|evitar\s*comiss[ãa]o|fugir\s*(da|à)\s*comiss[ãa]o)\b/gi,
  /\b(negociar?\s*(fora|diretamente|por\s*fora|pessoalmente))\b/gi,
  /\b(call\s*me|text\s*me|dm\s*me|contact\s*me\s*(directly|outside|privately))\b/gi,
  /\b(my\s*(number|phone|email|whatsapp)\s*is)\b/gi,
];

// Number obfuscation patterns (letters instead of digits)
const OBFUSCATION_PATTERNS = [
  /\b(zero|um|dois|tres|três|quatro|cinco|seis|sete|oito|nove)\b.*\b(zero|um|dois|tres|três|quatro|cinco|seis|sete|oito|nove)\b.*\b(zero|um|dois|tres|três|quatro|cinco|seis|sete|oito|nove)\b/gi,
  /\b(one|two|three|four|five|six|seven|eight|nine)\b.*\b(one|two|three|four|five|six|seven|eight|nine)\b.*\b(one|two|three|four|five|six|seven|eight|nine)\b/gi,
];

export type ViolationType = "phone" | "email" | "url" | "social" | "evasion" | "obfuscation";

export interface FilterResult {
  safe: boolean;
  violations: ViolationType[];
  sanitized: string;
  warningMessage: string;
}

export function filterMessage(message: string): FilterResult {
  const violations: ViolationType[] = [];
  let sanitized = message;

  // Check each pattern group
  for (const pattern of PHONE_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      violations.push("phone");
      break;
    }
  }

  for (const pattern of EMAIL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      violations.push("email");
      break;
    }
  }

  for (const pattern of URL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      violations.push("url");
      break;
    }
  }

  for (const pattern of SOCIAL_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      violations.push("social");
      break;
    }
  }

  for (const pattern of EVASION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      violations.push("evasion");
      break;
    }
  }

  for (const pattern of OBFUSCATION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(message)) {
      violations.push("obfuscation");
      break;
    }
  }

  const safe = violations.length === 0;

  // Generate warning
  let warningMessage = "";
  if (!safe) {
    if (violations.includes("phone") || violations.includes("email")) {
      warningMessage = "⚠️ Partilhar contactos pessoais viola os termos de utilização. Toda a comunicação deve ser feita pela plataforma para sua segurança.";
    } else if (violations.includes("url") || violations.includes("social")) {
      warningMessage = "⚠️ Links e referências a redes sociais não são permitidos. Use o chat da plataforma para comunicar com segurança.";
    } else if (violations.includes("evasion")) {
      warningMessage = "⚠️ Tentativas de negociação fora da plataforma não são permitidas. A plataforma protege ambas as partes na transação.";
    } else {
      warningMessage = "⚠️ Esta mensagem foi bloqueada por conter conteúdo não permitido.";
    }
  }

  return { safe, violations, sanitized, warningMessage };
}

/**
 * Severity level based on violation count.
 * Used for progressive penalties.
 */
export function getViolationSeverity(totalAttempts: number): "warning" | "restriction" | "suspension" {
  if (totalAttempts <= 1) return "warning";
  if (totalAttempts <= 3) return "restriction";
  return "suspension";
}
