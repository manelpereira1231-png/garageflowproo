import { supabase } from "@/integrations/supabase/client";

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, from }: SendEmailParams) {
  const { data, error } = await supabase.functions.invoke("send-email", {
    body: { to, subject, html, from },
  });

  if (error) {
    console.error("Failed to send email:", error);
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
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
