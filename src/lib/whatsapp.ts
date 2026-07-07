/**
 * WhatsApp utility for sending messages via wa.me links.
 * Uses api.whatsapp.com/send for maximum compatibility (Android, iOS, Web).
 */

export interface WhatsAppMessageParams {
  phone?: string | null;
  clientName?: string;
  type: 'quote' | 'invoice' | 'service';
  number?: string;
  plate?: string;
  model?: string;
  link?: string;
  pdfBlob?: Blob | null;
  pdfFilename?: string;
}

function cleanPhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('00')) cleaned = '+' + cleaned.slice(2);
  // If no country code, assume Portugal (+351)
  if (!cleaned.startsWith('+') && !cleaned.startsWith('351')) {
    cleaned = '351' + cleaned;
  }
  cleaned = cleaned.replace('+', '');
  return cleaned;
}

function buildMessage(p: WhatsAppMessageParams): string {
  const greeting = `Olá${p.clientName ? ` ${p.clientName}` : ''},`;
  const vehicleRef = p.plate || p.model ? ` referente ao veículo ${[p.plate, p.model].filter(Boolean).join(' - ')}` : '';

  switch (p.type) {
    case 'invoice': {
      const num = p.number ? ` ${p.number}` : '';
      let msg = `${greeting} a sua fatura${num}${vehicleRef} está disponível. Pode consultá-la através do PDF em anexo.`;
      if (p.link) msg += `\n\nLink: ${p.link}`;
      return msg;
    }
    case 'quote': {
      const num = p.number ? ` ${p.number}` : '';
      let msg = `${greeting} o seu orçamento${num}${vehicleRef} está disponível para aprovação.`;
      if (p.link) msg += `\n\nConsulte e aprove aqui: ${p.link}`;
      return msg;
    }
    case 'service': {
      const num = p.number ? ` ${p.number}` : '';
      let msg = `${greeting} a sua ordem de serviço${num}${vehicleRef} está concluída. Pode levantar o veículo na oficina.`;
      if (p.link) msg += `\n\nDetalhes: ${p.link}`;
      return msg;
    }
  }
}

export function buildWhatsAppUrl(params: WhatsAppMessageParams): string | null {
  if (!params.phone) return null;
  const phone = cleanPhone(params.phone);
  if (phone.length < 9) return null;
  const message = buildMessage(params);
  // api.whatsapp.com/send is more reliable than wa.me across iOS, Android e WhatsApp Web.
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

export async function openWhatsApp(params: WhatsAppMessageParams): Promise<boolean> {
  const url = buildWhatsAppUrl(params);
  if (!url) return false;
  const message = buildMessage(params);

  // If a PDF blob is provided and the platform supports sharing files
  // (Android Chrome, iOS Safari 16+), use Web Share API so the user can
  // pick WhatsApp and the PDF gets attached in the same flow.
  if (params.pdfBlob && typeof navigator !== 'undefined' && (navigator as any).canShare) {
    try {
      const file = new File(
        [params.pdfBlob],
        params.pdfFilename || `${params.number || 'documento'}.pdf`,
        { type: 'application/pdf' }
      );
      const shareData: any = { files: [file], text: message, title: params.number || 'Documento' };
      if ((navigator as any).canShare(shareData)) {
        await (navigator as any).share(shareData);
        return true;
      }
    } catch (err) {
      // User cancelled or share failed — fall through to link + download.
      console.warn('[whatsapp] share failed, falling back', err);
    }
  }

  // Fallback: download the PDF locally so the user can attach it manually,
  // then open WhatsApp with the pre-filled message.
  if (params.pdfBlob) {
    try {
      const objectUrl = URL.createObjectURL(params.pdfBlob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = params.pdfFilename || `${params.number || 'documento'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
    } catch (err) {
      console.warn('[whatsapp] pdf download failed', err);
    }
  }

  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = url;
    return true;
  }
  const win = window.open(url, '_blank', 'noopener,noreferrer');
  if (!win || win.closed || typeof win.closed === 'undefined') {
    window.location.href = url;
  }
  return true;
}

