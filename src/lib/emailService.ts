import { supabase } from "@/integrations/supabase/client";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  try {
    const { data, error } = await supabase.functions.invoke("send-email", {
      body: { to, subject, html, from },
    });

    if (error) {
      console.error("Failed to send email:", error);
      throw new Error(error.message || "Email send failed");
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
          Aceitar Convite
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
  },
};

export function quoteEmailHtml(data: QuoteEmailData): string {
  const l = emailLabels[data.lang || 'pt'] || emailLabels.pt;
  const cur = data.currency === 'EUR' ? '€' : data.currency;

  const linesHtml = data.lines.map((line, i) => `
    <tr style="background-color: ${i % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280;">${line.type === 'service' ? l.service : l.part}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937;">${line.name}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937; text-align: center;">${line.quantity}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937; text-align: right;">${cur}${line.unit_price.toFixed(2)}</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #6b7280; text-align: center;">${line.vat_rate}%</td>
      <td style="padding: 10px 12px; font-size: 13px; color: #1f2937; font-weight: 600; text-align: right;">${cur}${(line.quantity * line.unit_price).toFixed(2)}</td>
    </tr>
  `).join('');

  const logoHtml = data.shopLogoUrl
    ? `<img src="${data.shopLogoUrl}" alt="${data.shopName}" style="max-height: 48px; max-width: 160px; margin-bottom: 8px;" /><br/>`
    : '';

  const approvalHtml = data.approvalUrl ? `
    <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
      <p style="color: #166534; font-size: 14px; margin: 0 0 16px;">${l.approveOnline}</p>
      <a href="${data.approvalUrl}" style="display: inline-block; background-color: #16a34a; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-size: 15px; font-weight: 700; letter-spacing: 0.3px;">
        ✓ ${l.approve}
      </a>
    </div>
  ` : '';

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
          <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">${l.subtotal}</td><td style="text-align: right; font-size: 13px; color: #1f2937;">${cur}${data.subtotal.toFixed(2)}</td></tr>
          <tr><td style="padding: 4px 0; font-size: 13px; color: #6b7280;">${l.vatLabel}</td><td style="text-align: right; font-size: 13px; color: #1f2937;">${cur}${data.vatTotal.toFixed(2)}</td></tr>
          <tr><td colspan="2" style="padding: 8px 0 0; border-top: 1px solid #e5e7eb;"></td></tr>
          <tr>
            <td style="padding: 8px 12px; background-color: #262626; border-radius: 6px 0 0 6px; font-size: 15px; font-weight: 700; color: #ffb41e;">${l.total}</td>
            <td style="padding: 8px 12px; background-color: #262626; border-radius: 0 6px 6px 0; text-align: right; font-size: 15px; font-weight: 700; color: #ffb41e;">${cur}${data.total.toFixed(2)}</td>
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
