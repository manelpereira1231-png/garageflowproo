/**
 * WhatsApp utility for sending messages via wa.me links
 */

export interface WhatsAppMessageParams {
  phone?: string | null;
  clientName?: string;
  type: 'quote' | 'invoice' | 'service';
  number?: string;
  plate?: string;
  link?: string;
}

function cleanPhone(phone: string): string {
  // Remove all non-numeric chars except leading +
  let cleaned = phone.replace(/[^0-9+]/g, '');
  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  // If no country code, assume Portugal (+351)
  if (!cleaned.startsWith('+') && !cleaned.startsWith('351')) {
    cleaned = '351' + cleaned;
  }
  // Remove the + for wa.me format
  cleaned = cleaned.replace('+', '');
  return cleaned;
}

const typeLabels: Record<string, { pt: string; en: string }> = {
  quote: { pt: 'orçamento', en: 'quote' },
  invoice: { pt: 'fatura', en: 'invoice' },
  service: { pt: 'ordem de serviço', en: 'work order' },
};

export function buildWhatsAppUrl(params: WhatsAppMessageParams): string | null {
  if (!params.phone) return null;

  const phone = cleanPhone(params.phone);
  const label = typeLabels[params.type]?.pt || params.type;

  let message = `Olá${params.clientName ? ` ${params.clientName}` : ''}, o seu ${label}`;
  if (params.number) message += ` ${params.number}`;
  if (params.plate) message += ` para o veículo ${params.plate}`;
  message += ` está disponível.`;
  if (params.link) message += ` Veja aqui: ${params.link}`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(params: WhatsAppMessageParams): boolean {
  const url = buildWhatsAppUrl(params);
  if (!url) return false;
  window.open(url, '_blank', 'noopener');
  return true;
}
