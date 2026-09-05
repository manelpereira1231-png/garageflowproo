/**
 * Notificação ao cliente quando a oficina reagenda uma marcação.
 *
 * Reutiliza a infraestrutura já existente — não cria sistemas paralelos:
 *  - Email    → `lib/emailService.ts` (sendEmail → edge function `send-email`)
 *               + registo em `email_logs` (entity_type = 'appointment').
 *  - WhatsApp → `lib/whatsapp.ts` (openWhatsApp, mensagem pré-preenchida).
 */
import { sendEmail, clientNotificationEmailHtml, isValidEmail } from "@/lib/emailService";
import { openWhatsApp } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";

export interface RescheduleNotifyContext {
  appointmentId: string;
  shopId: string;
  shopName?: string | null;
  shopPhone?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  serviceType?: string | null;
  vehicleLabel?: string | null;
  /** Data/hora anteriores (opcionais). */
  oldDate?: string | null;
  oldTime?: string | null;
  newDate: string;
  newTime: string;
}

function fmtDate(value?: string | null): string {
  if (!value) return "";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return String(value);
  return `${d}/${m}/${y}`;
}

function fmtTime(value?: string | null): string {
  return value ? String(value).slice(0, 5) : "";
}

/** Texto simples enviado ao cliente (sem termos técnicos). */
export function buildRescheduleMessage(ctx: RescheduleNotifyContext): string {
  const lines: string[] = [];
  lines.push(`Olá${ctx.clientName ? ` ${ctx.clientName}` : ""},`);
  lines.push("");
  lines.push(
    `A sua marcação${ctx.shopName ? ` na ${ctx.shopName}` : ""} foi reagendada.`,
  );
  lines.push("");
  if (ctx.oldDate) {
    lines.push(`Data anterior: ${fmtDate(ctx.oldDate)}${ctx.oldTime ? ` às ${fmtTime(ctx.oldTime)}` : ""}`);
  }
  lines.push(`Nova data: ${fmtDate(ctx.newDate)}`);
  lines.push(`Nova hora: ${fmtTime(ctx.newTime)}`);
  if (ctx.serviceType) lines.push(`Serviço: ${ctx.serviceType}`);
  if (ctx.vehicleLabel) lines.push(`Viatura: ${ctx.vehicleLabel}`);
  lines.push("");
  lines.push(
    ctx.shopPhone
      ? `Se precisar de alguma alteração, contacte-nos através do ${ctx.shopPhone}.`
      : "Se precisar de alguma alteração, entre em contacto diretamente com a oficina.",
  );
  return lines.join("\n");
}

export function rescheduleSubject(ctx: RescheduleNotifyContext): string {
  return `Marcação reagendada — ${fmtDate(ctx.newDate)} às ${fmtTime(ctx.newTime)}`;
}

/** Envia o email da nova data ao cliente e regista o resultado em `email_logs`. */
export async function sendRescheduleEmail(ctx: RescheduleNotifyContext): Promise<void> {
  const to = (ctx.clientEmail || "").trim();
  if (!isValidEmail(to)) throw new Error("O cliente não tem email válido.");
  if (!ctx.shopId) throw new Error("Oficina ativa não identificada.");

  const subject = rescheduleSubject(ctx);
  const body = buildRescheduleMessage(ctx)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  try {
    await sendEmail({
      to,
      subject,
      html: clientNotificationEmailHtml("Marcação reagendada", body, ctx.shopName || undefined),
      shop_id: ctx.shopId,
    });
    await supabase.from("email_logs").insert({
      shop_id: ctx.shopId,
      to_email: to,
      subject,
      status: "sent",
      entity_type: "appointment",
      entity_id: ctx.appointmentId,
    });
  } catch (err: any) {
    await supabase.from("email_logs").insert({
      shop_id: ctx.shopId,
      to_email: to,
      subject,
      status: "failed",
      error_message: err?.message || "unknown",
      entity_type: "appointment",
      entity_id: ctx.appointmentId,
    });
    throw err;
  }
}

/** Abre o WhatsApp com a mensagem da nova data pré-preenchida. */
export async function sendRescheduleWhatsApp(ctx: RescheduleNotifyContext): Promise<void> {
  if (!ctx.clientPhone) throw new Error("O cliente não tem telefone registado.");
  const ok = await openWhatsApp({
    phone: ctx.clientPhone,
    clientName: ctx.clientName || undefined,
    type: "client",
    shopName: ctx.shopName || undefined,
    customMessage: buildRescheduleMessage(ctx),
  });
  if (!ok) throw new Error("Não foi possível abrir o WhatsApp com este número.");
}
