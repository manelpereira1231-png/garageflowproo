type NotificationLinkInput = {
  link: string | null;
  data?: {
    event?: string;
    quote_id?: string;
    quote_number?: string;
  } | null;
};

/**
 * Notificações de orçamento abrem SEMPRE a listagem de Orçamentos com a
 * pesquisa pré-preenchida pelo número real do orçamento (ex.: ORC-0042).
 * Nunca abrem a edição de serviço/orçamento.
 */
export function resolveNotificationLink(notification: NotificationLinkInput): string | null {
  const quoteNumber = notification.data?.quote_number?.trim();
  const isQuoteNotification =
    notification.data?.event === "quote_approved" ||
    notification.data?.event === "quote_rejected" ||
    Boolean(notification.data?.quote_id) ||
    Boolean(quoteNumber) ||
    notification.link?.startsWith("/quotes");

  if (isQuoteNotification) {
    if (quoteNumber) return `/quotes?search=${encodeURIComponent(quoteNumber)}`;
    // Links antigos já no formato correto são preservados; caso contrário
    // abre a listagem geral (nunca a edição).
    if (notification.link?.startsWith("/quotes?search=")) return notification.link;
    return "/quotes";
  }

  return notification.link;
}
