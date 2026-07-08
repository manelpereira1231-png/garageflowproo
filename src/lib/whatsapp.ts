/** WhatsApp utility for sharing documents without exposing PDF links in the message. */

export type ServiceStage =
  | 'open'
  | 'diagnosis'
  | 'waiting_approval'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'delivered';

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
  /** For type='service' — pre-fills the stage-specific message from the workshop timeline. */
  serviceStage?: ServiceStage;
  /** Optional approved total (used in the "approved" stage message). */
  total?: number;
}

function vehicleLabel(p: WhatsAppMessageParams): string {
  const parts = [p.model, p.plate].filter(Boolean);
  if (!parts.length) return 'o seu veículo';
  if (p.model && p.plate) return `${p.model} (${p.plate})`;
  return parts.join(' ');
}

function formatEUR(v?: number): string {
  if (typeof v !== 'number' || isNaN(v)) return '';
  return `€${v.toFixed(2)}`;
}

function buildServiceStageMessage(p: WhatsAppMessageParams): string | null {
  const stage = p.serviceStage;
  if (!stage) return null;
  const name = p.clientName ? ` ${p.clientName}` : '';
  const header = `Ordem de Serviço${p.number ? ` ${p.number}` : ''}`;
  const veh = vehicleLabel(p);
  const total = formatEUR(p.total);

  switch (stage) {
    case 'open':
      return `${header}\n\nOlá${name},\n\nO seu veículo ${veh} foi recebido nas nossas instalações.\n\nA nossa equipa irá realizar a avaliação inicial e mantê-lo(a) informado(a) sobre os próximos passos.\n\nObrigado pela sua confiança.`;
    case 'diagnosis':
      return `${header}\n\nOlá${name},\n\nEstamos a realizar o diagnóstico do seu ${veh} para identificar a origem da intervenção necessária.\n\nCaso seja necessário algum serviço adicional ou exista alguma alteração ao orçamento, entraremos em contacto antes de avançar.`;
    case 'waiting_approval':
      return `${header}\n\nOlá${name},\n\nO diagnóstico do seu veículo foi concluído.\n\nO orçamento encontra-se disponível para a sua análise e aprovação.\n\nAssim que recebermos a sua confirmação, iniciaremos os trabalhos.`;
    case 'approved':
      return `${header}\n\nOlá${name},\n\nConfirmamos que o orçamento para o seu ${veh} foi aprovado.${total ? `\n\nValor aprovado: ${total}` : ''}\n\nA intervenção será iniciada em breve. Iremos mantê-lo(a) informado(a) sobre a evolução dos trabalhos.`;
    case 'in_progress':
      return `${header}\n\nOlá${name},\n\nInformamos que os trabalhos no seu ${veh} já se encontram em execução.\n\nA nossa equipa está a realizar a intervenção prevista e iremos notificá-lo(a) assim que esta estiver concluída.`;
    case 'completed':
      return `${header}\n\nOlá${name},\n\nTemos o prazer de informar que a intervenção no seu ${veh} foi concluída com sucesso.\n\nO veículo encontra-se preparado para entrega. Entraremos em contacto consigo caso ainda seja necessário agendar a recolha.`;
    case 'delivered':
      return `${header}\n\nOlá${name},\n\nConfirmamos a entrega do seu ${veh}.\n\nAgradecemos a confiança depositada nos nossos serviços e esperamos voltar a recebê-lo numa próxima oportunidade.\n\nSe tiver alguma questão ou necessitar de assistência, estaremos sempre disponíveis.`;
  }
  return null;
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
  const includeLink = opts?.includeLink !== false; // default true for email; WhatsApp forces false
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
  // Include the public link in the WhatsApp message — quotes need it to approve,
  // and invoices need it as a PDF download fallback for desktop chats.
  const message = buildMessage(params, { includeLink: true });
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}`;
}

function buildPdfFile(params: WhatsAppMessageParams): File | null {
  if (!params.pdfBlob) return null;
  const filename = params.pdfFilename || `${params.number || 'documento'}.pdf`;
  return new File([params.pdfBlob], filename, { type: 'application/pdf' });
}

function canSharePdfFile(file: File, message: string, title: string): boolean {
  if (typeof navigator === 'undefined' || typeof (navigator as any).share !== 'function') return false;
  const shareData: any = { files: [file], text: message, title };
  if (typeof (navigator as any).canShare !== 'function') return true;
  return Boolean((navigator as any).canShare(shareData));
}

function openUrlInNewTab(url: string) {
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

/**
 * Sends the document to WhatsApp as an actual PDF attachment whenever possible.
 *
 * - Mobile (Android/iOS): uses the Web Share API with `files` so WhatsApp
 *   receives the PDF + the pre-filled message in a single native share sheet.
 * - Desktop: opens WhatsApp Web with the message pre-filled and automatically
 *   downloads the PDF so the user just drops it into the chat. WhatsApp Web
 *   does not accept file attachments via URL, so this is the closest to a
 *   "one click send" experience the platform allows.
 *
 * The signed PDF link is intentionally NOT included in the message body —
 * the goal is a professional flow where the PDF itself is delivered.
 */
export async function openWhatsApp(params: WhatsAppMessageParams): Promise<boolean> {
  const url = buildWhatsAppUrl(params);
  if (!url) return false;

  const message = buildMessage(params, { includeLink: true });
  const filename = params.pdfFilename || `${params.number || 'documento'}.pdf`;
  const file = buildPdfFile(params);

  // 1) Preferred flow: native share with the PDF file attached + message text.
  // This is the only browser-supported way to hand a Blob to WhatsApp as a real file.
  if (file && canSharePdfFile(file, message, params.number || 'Documento')) {
    try {
      const shareData: any = { files: [file], text: message, title: params.number || 'Documento' };
      await (navigator as any).share(shareData);
      return true;
    } catch (err) {
      console.warn('[whatsapp] share failed, falling back', err);
    }
  }

  // 2) Fallback: WhatsApp URLs cannot pre-attach files. We still never place the
  // signed PDF link in the message; the PDF is downloaded locally to attach.
  openUrlInNewTab(url);
  if (params.pdfBlob) {
    setTimeout(() => downloadPdfBlob(params.pdfBlob!, filename), 400);
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


