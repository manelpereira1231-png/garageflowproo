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

function buildMessage(p: WhatsAppMessageParams, opts?: { includeLink?: boolean }): string {
  const includeLink = opts?.includeLink !== false; // default true (for email); WhatsApp forces false
  const greeting = `Olá${p.clientName ? ` ${p.clientName}` : ''},`;
  const vehicleRef = p.plate || p.model ? ` referente ao veículo ${[p.plate, p.model].filter(Boolean).join(' - ')}` : '';

  switch (p.type) {
    case 'invoice': {
      const num = p.number ? ` ${p.number}` : '';
      let msg = `${greeting}\n\nSegue em anexo a fatura${num}${vehicleRef}.`;
      if (includeLink && p.link) msg += `\n\n📄 Consultar/descarregar PDF:\n${p.link}`;
      msg += `\n\nObrigado pela preferência.`;
      return msg;
    }
    case 'quote': {
      const num = p.number ? ` ${p.number}` : '';
      let msg = `${greeting}\n\nSegue em anexo o orçamento${num}${vehicleRef} para aprovação.`;
      if (includeLink && p.link) msg += `\n\n📄 Consultar e aprovar:\n${p.link}`;
      return msg;
    }
    case 'service': {
      const num = p.number ? ` ${p.number}` : '';
      let msg = `${greeting}\n\nA sua ordem de serviço${num}${vehicleRef} está concluída. Pode levantar o veículo na oficina.`;
      if (includeLink && p.link) msg += `\n\n📄 Detalhes:\n${p.link}`;
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

function openUrlInNewTab(url: string) {
  // Anchor click preserves the user-gesture better than window.open() after
  // an async PDF generation, so desktop popup blockers usually let it through.
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener,noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadPdfBlob(blob: Blob, filename: string) {
  try {
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  } catch (err) {
    console.warn('[whatsapp] pdf download failed', err);
  }
}

export async function openWhatsApp(params: WhatsAppMessageParams): Promise<boolean> {
  const url = buildWhatsAppUrl(params);
  if (!url) return false;

  // Preferred flow: a signed link to the PDF is already inside the message,
  // so we just open WhatsApp — no local downloads, no manual attachments.
  if (params.link) {
    const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = url;
    } else {
      openUrlInNewTab(url);
    }
    return true;
  }

  // Fallback (no signed link available): try Web Share on mobile, otherwise
  // open WhatsApp and offer the PDF as a local download so it can be attached.
  const message = buildMessage(params);
  const filename = params.pdfFilename || `${params.number || 'documento'}.pdf`;
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (isMobile && params.pdfBlob && typeof navigator !== 'undefined' && (navigator as any).canShare) {
    try {
      const file = new File([params.pdfBlob], filename, { type: 'application/pdf' });
      const shareData: any = { files: [file], text: message, title: params.number || 'Documento' };
      if ((navigator as any).canShare(shareData)) {
        await (navigator as any).share(shareData);
        return true;
      }
    } catch (err) {
      console.warn('[whatsapp] share failed, falling back', err);
    }
  }

  if (isMobile) {
    if (params.pdfBlob) downloadPdfBlob(params.pdfBlob, filename);
    window.location.href = url;
    return true;
  }

  openUrlInNewTab(url);
  if (params.pdfBlob) {
    setTimeout(() => downloadPdfBlob(params.pdfBlob!, filename), 300);
  }
  return true;
}

// ============================================================
// Email helper — mirrors WhatsApp so any doc can also be emailed.
// ============================================================

export interface EmailShareParams {
  email?: string | null;
  clientName?: string;
  type: 'quote' | 'invoice' | 'service';
  number?: string;
  plate?: string;
  model?: string;
  link?: string;
  pdfBlob?: Blob | null;
  pdfFilename?: string;
}

function buildEmailSubject(p: EmailShareParams): string {
  switch (p.type) {
    case 'invoice': return `Fatura ${p.number || ''}`.trim();
    case 'quote':   return `Orçamento ${p.number || ''}`.trim();
    case 'service': return `Ordem de serviço ${p.number || ''}`.trim();
  }
}

function buildEmailBody(p: EmailShareParams): string {
  // Reuse the same wording as WhatsApp for consistency.
  const message = buildMessage({ ...p, phone: '0' } as any);
  return message;
}

/**
 * Opens the user's default mail client with subject + body pre-filled,
 * and triggers a local download of the PDF so it can be attached manually.
 * This is the "any device, any client" fallback — works even without a
 * transactional email service configured.
 */
export function openEmailDraft(params: EmailShareParams): boolean {
  const filename = params.pdfFilename || `${params.number || 'documento'}.pdf`;
  const subject = buildEmailSubject(params);
  const body = buildEmailBody(params);
  const to = (params.email || '').trim();
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (params.pdfBlob) downloadPdfBlob(params.pdfBlob, filename);
  // mailto: must stay same-tab to trigger the OS handler on desktop.
  window.location.href = mailto;
  return true;
}


