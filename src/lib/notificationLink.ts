type NotificationLinkInput = {
  link: string | null;
  data?: {
    event?: string;
    quote_id?: string;
    quote_number?: string;
  } | null;
};

export function resolveNotificationLink(notification: NotificationLinkInput): string | null {
  const quoteNumber = notification.data?.quote_number?.trim();
  const isQuoteNotification =
    notification.data?.event === "quote_approved" ||
    notification.data?.event === "quote_rejected" ||
    Boolean(notification.data?.quote_id) ||
    notification.link?.startsWith("/quotes/edit/");

  if (isQuoteNotification) {
    return quoteNumber ? `/quotes?search=${encodeURIComponent(quoteNumber)}` : "/quotes";
  }

  return notification.link;
}