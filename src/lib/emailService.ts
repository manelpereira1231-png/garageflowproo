import { formatMoney } from "@/lib/money";
import { supabase } from "@/integrations/supabase/client";

interface EmailAttachment {
  filename: string;
  /** Base64-encoded content (no data: prefix). */
  content: string;
  content_type?: string;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  attachments?: EmailAttachment[];
  /** Optional quote token to authorize sending from the public quote approval page. */
  quote_token?: string;
  /** Team invite path: authenticated owner/admin of shop_id may invite any recipient. */
  invite?: boolean;
  shop_id?: string;
}

/** Basic RFC-ish email validation used before hitting the provider. */
export function isValidEmail(value?: string | null): boolean {
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(value.trim());
}

export async function sendEmail({ to, subject, html, from, attachments, quote_token, invite, shop_id }: SendEmailParams) {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, html, from, attachments, quote_token, invite, shop_id },
    });

    if (error) {
      console.error("Failed to send email:", error);
      let realMsg = error.message || "Email send failed";
      try {
        const ctx = (error as any).context;
        const resp: Response | undefined = ctx instanceof Response ? ctx : ctx?.response;
        const body = resp ? await resp.clone().json().catch(() => null) : null;
        if (body?.error) realMsg = body.error;
      } catch {
        // Keep the SDK message if the response body cannot be read.
      }
      throw new Error(realMsg);
    }

    // Check if the edge function returned an error in the response body
    if (data && data.error) {
      console.error("Email service error:", data.error);
      throw new Error(data.error);
    }

    return data;
  } catch (err: any) {
    console.error("sendEmail error:", err);
    throw err;
  }
}

// --- Email Templates ---

export function passwordResetEmailHtml(resetUrl: string, shopName?: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px;">Recuperação de Password</h1>
      <p style="color: #555; font-size: 16px;">
        Recebemos um pedido para repor a sua password${shopName ? ` em ${shopName}` : ''}.
      </p>
      <p style="color: #555; font-size: 16px;">
        Clique no botão abaixo para definir uma nova password. Este link é válido por <strong>1 hora</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${resetUrl}" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
          Redefinir Password
        </a>
      </div>
      <p style="color: #999; font-size: 13px;">
        Se não solicitou esta alteração, ignore este email. ⚠️ Verifique também a pasta de spam.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #bbb; font-size: 12px; text-align: center;">GarageFlow Pro</p>
    </div>
  `;
}

export function clientNotificationEmailHtml(title: string, message: string, shopName?: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px;">${title}</h1>
      <p style="color: #555; font-size: 16px;">${message}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #bbb; font-size: 12px; text-align: center;">${shopName || 'GarageFlow Pro'}</p>
    </div>
  `;
}

export function alertEmailHtml(alertTitle: string, alertMessage: string, shopName?: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
        <h2 style="color: #92400e; font-size: 18px; margin: 0 0 8px;">${alertTitle}</h2>
        <p style="color: #78350f; font-size: 14px; margin: 0;">${alertMessage}</p>
      </div>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #bbb; font-size: 12px; text-align: center;">${shopName || 'GarageFlow Pro'}</p>
    </div>
  `;
}

export function loyaltyEmailHtml(
  type: 'points_earned' | 'points_redeemed' | 'tier_upgrade',
  clientName: string,
  shopName: string,
  points: number,
  newTier?: string,
  totalPoints?: number,
): string {
  const tierLabels: Record<string, string> = { bronze: 'Bronze', silver: 'Silver 🥈', gold: 'Gold 🥇', platinum: 'Platinum 💎' };
  const tierColors: Record<string, string> = { bronze: '#b45309', silver: '#64748b', gold: '#ca8a04', platinum: '#7c3aed' };

  let title = '';
  let message = '';
  if (type === 'tier_upgrade') {
    title = `Parabéns, ${clientName}! 🎉`;
    message = `Subiu para o nível <strong style="color:${tierColors[newTier || 'bronze']}">${tierLabels[newTier || 'bronze']}</strong> no programa de fidelização da ${shopName}!<br/><br/>Pontos atuais: <strong>${(totalPoints || 0).toLocaleString()}</strong>`;
  } else if (type === 'points_earned') {
    title = `Ganhou ${points} pontos! ⭐`;
    message = `Olá ${clientName}, foram adicionados <strong>${points}</strong> pontos à sua conta na ${shopName}.<br/>Total atual: <strong>${(totalPoints || 0).toLocaleString()}</strong> pontos.`;
  } else {
    title = `Resgate de ${points} pontos`;
    message = `Olá ${clientName}, foram resgatados <strong>${points}</strong> pontos da sua conta na ${shopName}.<br/>Saldo restante: <strong>${(totalPoints || 0).toLocaleString()}</strong> pontos.`;
  }

  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
      <div style="background:#262626;padding:20px 28px;border-radius:10px 10px 0 0;">
        <span style="color:#ffb41e;font-size:18px;font-weight:700;">${shopName}</span>
        <span style="float:right;color:#fbbf24;font-size:14px;">⭐ Programa de Fidelização</span>
      </div>
      <div style="padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 10px 10px;">
        <h2 style="color:#1f2937;font-size:20px;margin:0 0 16px;">${title}</h2>
        <p style="color:#6b7280;font-size:14px;line-height:1.6;">${message}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
        <p style="color:#bbb;font-size:11px;text-align:center;">${shopName} · Programa de Fidelização GarageFlow</p>
      </div>
    </div>`;
}

export function inviteUserEmailHtml(inviteUrl: string, shopName: string, role: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h1 style="color: #1a1a1a; font-size: 24px;">Convite para ${shopName}</h1>
      <p style="color: #555; font-size: 16px;">
        Foi convidado para se juntar a <strong>${shopName}</strong> como <strong>${role}</strong>.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${inviteUrl}" style="background-color: #2563eb; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
          Ativar Conta
        </a>
      </div>
      <p style="color: #999; font-size: 13px;">
        Se não reconhece este convite, pode ignorar este email. ⚠️ Verifique também a pasta de spam.
      </p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
      <p style="color: #bbb; font-size: 12px; text-align: center;">GarageFlow Pro</p>
    </div>
  `;
}

interface QuoteEmailData {
  shopName: string;
  shopEmail: string;
  shopPhone: string;
  shopNif?: string;
  shopAddress?: string;
  shopLogoUrl?: string;
  clientName: string;
  quoteNumber: string;
  quoteDate: string;
  validityDate: string;
  lines: { type: string; name: string; quantity: number; unit_price: number; vat_rate: number }[];
  subtotal: number;
  vatTotal: number;
  total: number;
  currency: string;
  vehicleInfo: string;
  notes?: string;
  approvalUrl?: string;
  lang?: string;
  status?: string;
}

const emailLabels: Record<string, Record<string, string>> = {
  pt: {
    subject: 'Orçamento',
    greeting: 'Olá',
    intro: 'Segue em anexo o orçamento solicitado para o seu veículo',
    type: 'Tipo', description: 'Descrição', qty: 'Qtd', price: 'Preço', vat: 'IVA', lineTotal: 'Total',
    subtotal: 'Subtotal', vatLabel: 'IVA', total: 'TOTAL',
    validity: 'Válido até', vehicle: 'Veículo', notes: 'Notas',
    approve: 'Aprovar Orçamento', reject: 'Rejeitar',
    approveOnline: 'Pode aprovar ou rejeitar este orçamento online clicando no botão abaixo:',
    footer: 'Obrigado pela preferência!',
    service: 'Serviço', part: 'Peça',
    contact: 'Contacto',
    alreadyApproved: 'Este orçamento já foi aprovado. Obrigado pela sua confirmação — iremos avançar com a intervenção.',
    alreadyRejected: 'Este orçamento foi rejeitado. Se pretender rever, contacte-nos.',
    alreadyConverted: 'Este orçamento já foi aprovado e convertido em ordem de serviço.',
    viewOnline: 'Ver orçamento',
  },
  en: {
    subject: 'Quote',
    greeting: 'Hello',
    intro: 'Please find below the quote requested for your vehicle',
    type: 'Type', description: 'Description', qty: 'Qty', price: 'Price', vat: 'VAT', lineTotal: 'Total',
    subtotal: 'Subtotal', vatLabel: 'VAT', total: 'TOTAL',
    validity: 'Valid until', vehicle: 'Vehicle', notes: 'Notes',
    approve: 'Approve Quote', reject: 'Reject',
    approveOnline: 'You can approve or reject this quote online by clicking the button below:',
    footer: 'Thank you for your preference!',
    service: 'Service', part: 'Part',
    contact: 'Contact',
    alreadyApproved: 'This quote has already been approved. Thank you — we will proceed with the work.',
    alreadyRejected: 'This quote has been rejected. Contact us if you want to revisit it.',
    alreadyConverted: 'This quote has already been approved and converted into a work order.',
    viewOnline: 'View quote',
  },
  es: {
    subject: 'Presupuesto',
    greeting: 'Hola',
    intro: 'A continuación encontrará el presupuesto solicitado para su vehículo',
    type: 'Tipo', description: 'Descripción', qty: 'Cant', price: 'Precio', vat: 'IVA', lineTotal: 'Total',
    subtotal: 'Subtotal', vatLabel: 'IVA', total: 'TOTAL',
    validity: 'Válido hasta', vehicle: 'Vehículo', notes: 'Notas',
    approve: 'Aprobar Presupuesto', reject: 'Rechazar',
    approveOnline: 'Puede aprobar o rechazar este presupuesto online haciendo clic en el botón:',
    footer: '¡Gracias por su preferencia!',
    service: 'Servicio', part: 'Pieza',
    contact: 'Contacto',
    alreadyApproved: 'Este presupuesto ya ha sido aprobado. Gracias — procederemos con la intervención.',
    alreadyRejected: 'Este presupuesto ha sido rechazado. Contáctenos si desea revisarlo.',
    alreadyConverted: 'Este presupuesto ya fue aprobado y convertido en orden de servicio.',
    viewOnline: 'Ver presupuesto',
  },
};

export function quoteEmailHtml(data: QuoteEmailData): string {
  const l = emailLabels[data.lang || 'pt'] || emailLabels.pt;


  const linesHtml = data.lines.map((line, i) => `
    <tr style="background-color: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${line.type === 'service' ? l.service : l.part}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937;">${line.name}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937; text-align: center;">${line.quantity}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937; text-align: right;">${formatMoney(line.unit_price, data.currency)}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; text-align: center;">${line.vat_rate}%</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right;">${formatMoney((line.quantity * line.unit_price), data.currency)}</td>
    </tr>
  `).join('');

  const logoHtml = data.shopLogoUrl
    ? `<img src="${data.shopLogoUrl}" alt="${data.shopName}" style="max-height: 48px; max-width: 160px; margin-bottom: 8px;" /><br/>`
    : '';

  // A quote is "resolved" when the client already decided or it expired — in these
  // cases we NEVER render the "Approve" call-to-action, only a status banner.
  const isResolved =
    data.status === 'approved' ||
    data.status === 'converted' ||
    data.status === 'rejected' ||
    data.status === 'expired';
  const expiredMsg: Record<string, string> = {
    pt: 'Este orçamento encontra-se expirado. Contacte-nos para uma nova proposta.',
    en: 'This quote has expired. Contact us for a new proposal.',
    es: 'Este presupuesto ha expirado. Contáctenos para una nueva propuesta.',
  };
  const decidedMsg =
    data.status === 'rejected' ? l.alreadyRejected
    : data.status === 'converted' ? l.alreadyConverted
    : data.status === 'expired' ? (expiredMsg[data.lang || 'pt'] || expiredMsg.pt)
    : l.alreadyApproved;
  const decidedColor = data.status === 'rejected' ? '#991b1b' : data.status === 'expired' ? '#92400e' : '#166534';
  const decidedBg = data.status === 'rejected' ? '#fef2f2' : data.status === 'expired' ? '#fffbeb' : '#f0fdf4';
  const decidedBorder = data.status === 'rejected' ? '#fecaca' : data.status === 'expired' ? '#fde68a' : '#bbf7d0';

  const approvalHtml = isResolved ? `
    <div style="background-color: ${decidedBg}; border: 1px solid ${decidedBorder}; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="color: ${decidedColor}; font-size: 14px; margin: 0; font-weight: 600;">${decidedMsg}</p>
    </div>
  ` : (data.approvalUrl ? `
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="color: #166534; font-size: 14px; margin: 0 0 16px;">${l.approveOnline}</p>
      <a href="${data.approvalUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
        ✓ ${l.approve}
      </a>
    </div>
  ` : '');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; background-color: #ffffff;">
      <!-- Header -->
      <div style="background-color: #262626; padding: 24px 32px; border-radius: 12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align: middle;">
            ${logoHtml}
            <span style="color: #ffb41e; font-size: 20px; font-weight: 700;">${data.shopName}</span>
            ${data.shopNif ? `<br/><span style="color: #9ca3af; font-size: 11px;">NIF: ${data.shopNif}</span>` : ''}
            ${data.shopAddress ? `<br/><span style="color: #9ca3af; font-size: 11px;">${data.shopAddress}</span>` : ''}
          </td>
          <td style="text-align: right; vertical-align: middle;">
            <span style="color: #ffffff; font-size: 22px; font-weight: 700;">${l.subject}</span><br/>
            <span style="color: #ffb41e; font-size: 16px; font-weight: 600;">${data.quoteNumber}</span><br/>
            <span style="color: #9ca3af; font-size: 12px;">${data.quoteDate}</span>
          </td>
        </tr></table>
      </div>

      <!-- Body -->
      <div style="padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #1f2937; font-size: 15px; margin: 0 0 4px;">${l.greeting}, <strong>${data.clientName}</strong></p>
        <p style="color: #6b7280; font-size: 14px; margin: 0 0 20px;">${l.intro} <strong>${data.vehicleInfo}</strong>.</p>

        <!-- Quote Details -->
        <div style="border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
            <thead>
              <tr style="background-color: #262626;">
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #ffb41e; text-transform: uppercase; letter-spacing: 0.5px;">${l.type}</th>
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; color: #ffb41e; text-transform: uppercase; letter-spacing: 0.5px;">${l.description}</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 600; color: #ffb41e; text-transform: uppercase; letter-spacing: 0.5px;">${l.qty}</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #ffb41e; text-transform: uppercase; letter-spacing: 0.5px;">${l.price}</th>
                <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 600; color: #ffb41e; text-transform: uppercase; letter-spacing: 0.5px;">${l.vat}</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; color: #ffb41e; text-transform: uppercase; letter-spacing: 0.5px;">${l.lineTotal}</th>
              </tr>
            </thead>
            <tbody>${linesHtml}</tbody>
          </table>
        </div>

        <!-- Totals -->
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 260px; margin-left: auto;">
          <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">${l.subtotal}</td><td style="text-align: right; font-size: 13px; color: #1f2937;">${formatMoney(data.subtotal, data.currency)}</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">${l.vatLabel}</td><td style="text-align: right; font-size: 13px; color: #1f2937;">${formatMoney(data.vatTotal, data.currency)}</td></tr>
          <tr><td colspan="2" style="padding: 8px 0 0; border-top: 1px solid #e5e7eb;"></td></tr>
          <tr>
            <td style="padding: 8px 12px; background-color: #262626; border-radius: 6px 0 0 6px; font-size: 15px; font-weight: 700; color: #ffb41e;">${l.total}</td>
            <td style="padding: 8px 12px; background-color: #262626; border-radius: 0 6px 6px 0; text-align: right; font-size: 15px; font-weight: 700; color: #ffb41e;">${formatMoney(data.total, data.currency)}</td>
          </tr>
        </table>

        <!-- Validity & Vehicle -->
        <div style="margin-top: 20px; padding: 12px 16px; background-color: #f9fafb; border-radius: 8px; font-size: 13px; color: #6b7280;">
          <strong>${l.validity}:</strong> ${data.validityDate} &nbsp;|&nbsp; <strong>${l.vehicle}:</strong> ${data.vehicleInfo}
        </div>

        ${data.notes ? `<div style="margin-top: 16px; padding: 12px 16px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; font-size: 13px; color: #92400e;"><strong>${l.notes}:</strong> ${data.notes}</div>` : ''}

        ${approvalHtml}

        <!-- Footer -->
        <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
          <p style="color: #9ca3af; font-size: 13px; margin: 0 0 4px;">${l.footer}</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">
            ${l.contact}: ${data.shopEmail} | ${data.shopPhone}
          </p>
        </div>
      </div>
    </div>
  `;
}

// ────────────────────────────────────────────────────────────────────────
// Invoice emails — two distinct templates:
//   • variant='issued' → "Nova Fatura Disponível" (pagamento pendente)
//   • variant='paid'   → "Pagamento Confirmado"  (fatura liquidada)
// Both templates reutilizam a mesma identidade visual (header charcoal +
// amber, cartões, badges) do quoteEmailHtml para manter consistência.
// ────────────────────────────────────────────────────────────────────────

export interface InvoiceEmailItem {
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate?: number;
  total: number;
}

export interface InvoiceEmailData {
  variant: 'issued' | 'paid';
  shopName: string;
  shopEmail?: string;
  shopPhone?: string;
  shopNif?: string;
  shopAddress?: string;
  shopLogoUrl?: string;
  clientName: string;
  invoiceNumber: string;
  invoiceDate: string;
  vehicleInfo: string;
  plate?: string;
  total: number;
  subtotal?: number;
  taxTotal?: number;
  items?: InvoiceEmailItem[];
  amountPaid?: number;
  paymentDate?: string;
  paymentMethod?: string;
  currency?: string;
  viewUrl?: string;
}

export function invoiceEmailHtml(data: InvoiceEmailData): string {
  const isoCountry = (data.currency === 'BRL' ? 'pt-BR' : 'pt-PT');
  const isPaid = data.variant === 'paid';
  const fmt = (v?: number) => (typeof v === 'number' ? `${formatMoney(v, data.currency)}` : '—');

  const logoHtml = data.shopLogoUrl
    ? `<img src="${data.shopLogoUrl}" alt="${data.shopName}" style="max-height: 48px; max-width: 160px; margin-bottom: 8px;" /><br/>`
    : '';

  const headerTitle = isPaid ? 'Pagamento Confirmado' : 'Nova Fatura';
  const badgeBg = isPaid ? '#f0fdf4' : '#fff7ed';
  const badgeBorder = isPaid ? '#bbf7d0' : '#fed7aa';
  const badgeColor = isPaid ? '#166534' : '#9a3412';
  const badgeIcon = isPaid ? '🟢' : '🟠';
  const badgeText = isPaid ? 'Pago' : 'Pendente de Pagamento';

  const hero = isPaid
    ? `<h2 style="color:#166534;font-size:22px;margin:0 0 8px;">✅ Pagamento Confirmado</h2>
       <p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.6;">
         Olá <strong>${data.clientName}</strong>,<br/><br/>
         Confirmamos que recebemos com sucesso o pagamento da sua fatura.
         Muito obrigado pela confiança depositada na <strong>${data.shopName}</strong>.
         Foi um prazer realizar o serviço na sua viatura — esperamos voltar a recebê-lo sempre que precisar.
       </p>`
    : `<h2 style="color:#1f2937;font-size:22px;margin:0 0 8px;">A sua fatura está disponível</h2>
       <p style="color:#374151;font-size:14px;margin:0 0 20px;line-height:1.6;">
         Olá <strong>${data.clientName}</strong>,<br/><br/>
         Foi emitida uma nova fatura referente ao serviço realizado na sua viatura.
         Segue abaixo um resumo, com o PDF em anexo.
       </p>`;

  const rows: [string, string][] = [
    ['Nº Fatura', data.invoiceNumber],
    ['Cliente', data.clientName],
    ['Veículo', data.vehicleInfo || '—'],
    ...(data.plate ? ([['Matrícula', data.plate]] as [string, string][]) : []),
    ['Data', data.invoiceDate],
    ['Total', fmt(data.total)],
    ...(isPaid && typeof data.amountPaid === 'number' ? ([['Valor Pago', fmt(data.amountPaid)]] as [string, string][]) : []),
    ...(isPaid && data.paymentDate ? ([['Data do Pagamento', data.paymentDate]] as [string, string][]) : []),
    ...(isPaid && data.paymentMethod ? ([['Método de Pagamento', data.paymentMethod]] as [string, string][]) : []),
  ];

  const summary = rows.map(([k, v], i) => `
    <tr style="background-color:${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding:10px 14px;font-size:13px;color:#6b7280;width:45%;">${k}</td>
      <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600;text-align:right;">${v}</td>
    </tr>`).join('');

  // Itens discriminados (linhas da fatura) — mesmo detalhe do orçamento
  const itemsHtml = (data.items && data.items.length) ? `
    <h3 style="color:#1f2937;font-size:14px;font-weight:700;margin:24px 0 10px;text-transform:uppercase;letter-spacing:0.4px;">Detalhe da Fatura</h3>
    <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:8px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background-color:#262626;color:#ffb41e;">
            <th align="left"  style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">Descrição</th>
            <th align="right" style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;width:60px;">Qtd</th>
            <th align="right" style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;width:90px;">Unit.</th>
            <th align="right" style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;width:60px;">${data.currency === "BRL" ? "Imposto" : "IVA"}</th>
            <th align="right" style="padding:10px 14px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;width:100px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${data.items.map((it, i) => `
            <tr style="background-color:${i % 2 === 0 ? '#ffffff' : '#f9fafb'};border-top:1px solid #e5e7eb;">
              <td style="padding:10px 14px;font-size:13px;color:#111827;">${(it.description || '—').replace(/</g, '&lt;')}</td>
              <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;">${Number(it.quantity || 0).toLocaleString(isoCountry, { maximumFractionDigits: 2 })}</td>
              <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;">${fmt(Number(it.unit_price || 0))}</td>
              <td style="padding:10px 14px;font-size:13px;color:#374151;text-align:right;">${it.vat_rate != null ? `${Number(it.vat_rate).toFixed(0)}%` : '—'}</td>
              <td style="padding:10px 14px;font-size:13px;color:#111827;font-weight:600;text-align:right;">${fmt(Number(it.total || 0))}</td>
            </tr>`).join('')}
          ${(typeof data.subtotal === 'number' || typeof data.taxTotal === 'number') ? `
            <tr style="background-color:#f9fafb;border-top:1px solid #e5e7eb;">
              <td colspan="4" style="padding:8px 14px;font-size:12px;color:#6b7280;text-align:right;">Subtotal</td>
              <td style="padding:8px 14px;font-size:12px;color:#111827;text-align:right;">${fmt(data.subtotal ?? (data.total - (data.taxTotal || 0)))}</td>
            </tr>
            <tr style="background-color:#f9fafb;">
              <td colspan="4" style="padding:8px 14px;font-size:12px;color:#6b7280;text-align:right;">${data.currency === "BRL" ? "Imposto" : "IVA"}</td>
              <td style="padding:8px 14px;font-size:12px;color:#111827;text-align:right;">${fmt(data.taxTotal ?? 0)}</td>
            </tr>` : ''}
          <tr style="background-color:#262626;color:#ffb41e;">
            <td colspan="4" style="padding:12px 14px;font-size:13px;font-weight:700;text-align:right;">TOTAL</td>
            <td style="padding:12px 14px;font-size:14px;font-weight:800;text-align:right;">${fmt(data.total)}</td>
          </tr>
        </tbody>
      </table>
    </div>` : '';

  const ctaHtml = data.viewUrl ? `
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${data.viewUrl}" style="display:inline-block;background-color:#262626;color:#ffb41e;padding:12px 28px;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;letter-spacing:0.3px;">
        Ver Fatura
      </a>
    </div>` : '';

  const closing = isPaid
    ? `<p style="color:#374151;font-size:14px;line-height:1.6;margin:20px 0 0;">
         A sua fatura encontra-se totalmente liquidada. Guarde este documento para o seu arquivo pessoal ou fiscal.
         Caso necessite de qualquer esclarecimento estaremos sempre disponíveis.<br/><br/>
         Mais uma vez, muito obrigado por escolher a <strong>${data.shopName}</strong>.<br/>
         Esperamos voltar a recebê-lo em breve. 🚗
       </p>`
    : `<p style="color:#374151;font-size:14px;line-height:1.6;margin:20px 0 0;">
         Caso tenha alguma dúvida relativamente à faturação, estaremos totalmente disponíveis para ajudar.<br/><br/>
         Obrigado pela confiança.<br/>
         <strong>${data.shopName}</strong>
       </p>`;

  const preheader = isPaid
    ? `Confirmamos o pagamento da fatura ${data.invoiceNumber}. Obrigado pela confiança.`
    : `A sua fatura ${data.invoiceNumber} está disponível. PDF em anexo.`;

  return `
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;background-color:#ffffff;">
      <!-- Header -->
      <div style="background-color:#262626;padding:24px 32px;border-radius:12px 12px 0 0;">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="vertical-align:middle;">
            ${logoHtml}
            <span style="color:#ffb41e;font-size:20px;font-weight:700;">${data.shopName}</span>
            ${data.shopNif ? `<br/><span style="color:#9ca3af;font-size:11px;">NIF: ${data.shopNif}</span>` : ''}
            ${data.shopAddress ? `<br/><span style="color:#9ca3af;font-size:11px;">${data.shopAddress}</span>` : ''}
          </td>
          <td style="text-align:right;vertical-align:middle;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">${headerTitle}</span><br/>
            <span style="color:#ffb41e;font-size:16px;font-weight:600;">${data.invoiceNumber}</span><br/>
            <span style="color:#9ca3af;font-size:12px;">${data.invoiceDate}</span>
          </td>
        </tr></table>
      </div>

      <!-- Body -->
      <div style="padding:32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
        <!-- Status badge -->
        <div style="display:inline-block;background-color:${badgeBg};border:1px solid ${badgeBorder};color:${badgeColor};padding:6px 14px;border-radius:999px;font-size:12px;font-weight:700;margin-bottom:20px;">
          ${badgeIcon} ${badgeText}
        </div>

        ${hero}

        <!-- Summary card -->
        <div style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:8px 0 8px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${summary}
          </table>
        </div>

        ${itemsHtml}

        <!-- PDF note -->
        <div style="margin-top:16px;padding:12px 16px;background-color:#f9fafb;border-radius:8px;font-size:13px;color:#6b7280;">
          📎 PDF da fatura em anexo${isPaid ? ' para o seu arquivo.' : '.'}
        </div>

        ${ctaHtml}

        ${closing}

        <!-- Footer -->
        <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">
            ${data.shopName}${data.shopEmail ? ` · ${data.shopEmail}` : ''}${data.shopPhone ? ` · ${data.shopPhone}` : ''}
          </p>
        </div>
      </div>
    </div>
  `;
}
