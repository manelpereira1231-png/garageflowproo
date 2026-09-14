/**
 * Destino direto de uma notificação.
 *
 * Regra do GarageFlow: sempre que existe um objeto concreto associado
 * (orçamento, fatura, marcação, serviço, peça), a notificação abre ESSE
 * objeto — nunca a página geral correspondente.
 */
type NotificationData = {
  event?: string;
  quote_id?: string;
  quote_number?: string;
  invoice_id?: string;
  invoice_number?: string;
  appointment_id?: string;
  work_order_id?: string;
  work_order_number?: string;
  service_number?: string;
  part_id?: string;
  part_reference?: string;
  part_name?: string;
  client_id?: string;
} | null;

type NotificationLinkInput = {
  link: string | null;
  type?: string | null;
  title?: string | null;
  data?: NotificationData;
};

const q = (v: string) => encodeURIComponent(v.trim());

export function resolveNotificationLink(notification: NotificationLinkInput): string | null {
  const d = notification.data || {};

  // Orçamentos — abrir o orçamento exato pelo número real (ORC-0042).
  const quoteNumber = d.quote_number?.trim();
  const isQuote =
    d.event === "quote_approved" ||
    d.event === "quote_rejected" ||
    Boolean(d.quote_id) ||
    Boolean(quoteNumber) ||
    notification.link?.startsWith("/quotes");
  if (isQuote) {
    if (quoteNumber) return `/quotes?search=${q(quoteNumber)}`;
    if (notification.link?.startsWith("/quotes?search=")) return notification.link;
    return "/quotes";
  }

  // Faturação / pagamentos — abrir a fatura exata.
  if (d.invoice_number) return `/invoices?search=${q(d.invoice_number)}`;

  // Marcações — abrir a marcação exata (a Agenda salta para a data certa).
  if (d.appointment_id) return `/agenda?appointment=${d.appointment_id}`;

  // Serviços — abrir a ordem de serviço exata.
  const woNumber = d.work_order_number || d.service_number;
  if (woNumber) return `/services?search=${q(woNumber)}`;

  // Stock — abrir a peça exata.
  const partKey = d.part_reference || d.part_name;
  if (partKey) return `/stock?search=${q(partKey)}`;

  return notification.link;
}

/**
 * Eventos técnicos nunca devem aparecer ao utilizador — pertencem ao
 * histórico/atividade do sistema, não às Notificações.
 */
const TECHNICAL_PATTERNS = [
  "api ", "webhook", "sync", "sincroniza", "status updated", "request successful",
  "login", "logout", "sessão iniciada", "cron", "job ", "queue", "debug", "trace",
];

export function isUserFacingNotification(n: { type?: string | null; title?: string | null; message?: string | null }): boolean {
  const txt = `${n.type || ""} ${n.title || ""} ${n.message || ""}`.toLowerCase();
  return !TECHNICAL_PATTERNS.some((p) => txt.includes(p));
}
