type NotificationLinkInput = {
  link: string | null;
  data?: {
    event?: string;
    quote_id?: string;
    quote_number?: string;
  } | null;
};

export function resolveNotificationLink(notification: NotificationLinkInput): string | null {
  const quoteId = notification.data?.quote_id?.trim();
  const isQuoteNotification =
    notification.data?.event === "quote_approved" ||
    notification.data?.event === "quote_rejected" ||
    Boolean(notification.data?.quote_id) ||
    notification.link?.startsWith("/quotes/edit/");

  if (isQuoteNotification) {
    if (quoteId) return `/quotes/edit/${encodeURIComponent(quoteId)}`;
    return notification.link?.startsWith("/quotes/edit/") ? notification.link : "/quotes";
  }

  return notification.link;
}