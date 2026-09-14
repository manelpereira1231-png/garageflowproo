/**
 * Destino único de um alerta.
 *
 * Regra: um alerta abre SEMPRE o registo real que lhe deu origem, usando o
 * identificador público (número do orçamento/fatura, matrícula, nome do
 * cliente) — nunca IDs internos da base de dados.
 *
 * Este ficheiro é a única fonte de verdade dos links de alertas: é usado pelo
 * Dashboard, pela página /alerts e por qualquer outra superfície.
 */

export type AlertLinkInput = {
  type?: string | null;
  title?: string | null;
  message?: string | null;
  clientName?: string | null;
  plate?: string | null;
};

const QUOTE_NUMBER = /\b(?:ORC|OR[ÇC]|ORÇAMENTO|QT)[-\s]?\d{2,}\b/i;
const INVOICE_NUMBER = /\b(?:FT|FR|FS|NC|REC)[-\s]?[A-Z0-9/]*\d{2,}\b/i;

function firstMatch(re: RegExp, text: string): string | null {
  const m = text.match(re);
  return m ? m[0].replace(/\s+/g, "-").toUpperCase() : null;
}

export function resolveAlertLink(alert: AlertLinkInput): string | null {
  const text = `${alert.title || ""} ${alert.message || ""}`;
  const type = (alert.type || "").toLowerCase();

  const quoteNumber = firstMatch(QUOTE_NUMBER, text);
  if (quoteNumber) return `/quotes?search=${encodeURIComponent(quoteNumber)}`;

  const invoiceNumber = firstMatch(INVOICE_NUMBER, text);
  if (invoiceNumber) return `/invoices?search=${encodeURIComponent(invoiceNumber)}`;

  if (type.includes("quote")) return "/quotes";
  if (type === "payment_failed" || type.includes("invoice") || type.includes("payment")) return "/invoices";
  if (type === "stock_low" || type.includes("stock")) return "/stock";
  if (type.includes("appointment") || type.includes("booking")) return "/agenda";

  if (alert.plate) return `/vehicles?search=${encodeURIComponent(alert.plate)}`;
  if (type === "inactive_client" && alert.clientName) {
    return `/clients?search=${encodeURIComponent(alert.clientName)}`;
  }
  if (alert.clientName) return `/clients?search=${encodeURIComponent(alert.clientName)}`;

  if (["revision", "oil", "inspection", "warranty", "service_due"].includes(type)) return "/vehicles";

  return null;
}
