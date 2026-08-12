/**
 * Comunicação mecânico ↔ cliente sobre uma Ordem de Serviço.
 *
 * Camada ÚNICA e centralizada — não é um sistema paralelo:
 *  - WhatsApp  → `lib/whatsapp.ts` (openWhatsApp, comportamento inalterado:
 *                abre a app/WhatsApp Web com a mensagem pré-preenchida);
 *  - Email     → `lib/emailService.ts` (sendEmail → edge function `send-email`);
 *  - Registo   → tabela `email_logs` (entity_type = 'service'), protegida por RLS
 *                (só membros da oficina podem inserir/ver).
 *
 * Os textos pré-definidos reutilizam `lib/messageTemplates.ts` (os mesmos que a
 * página Services usa por estado da OS). Enviar uma mensagem NUNCA altera o
 * estado da OS — apenas comunica o estado real.
 */
import { messageTemplates, renderTemplate } from "@/lib/messageTemplates";
import { sendEmail, clientNotificationEmailHtml, isValidEmail } from "@/lib/emailService";
import { openWhatsApp } from "@/lib/whatsapp";
import { supabase } from "@/integrations/supabase/client";

export interface WorkOrderCommsContext {
  workOrderId: string;
  number: string;
  status: string;
  shopId: string;
  shopName?: string;
  clientName?: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
  vehicleMake?: string;
  vehicleModel?: string;
  plate?: string;
  total?: number;
  lang?: string;
}

export interface CommsPreset {
  id: string;
  label: string;
  subject: string;
  body: string;
}

/** Presets extra pedidos pela oficina (não existem em messageTemplates). */
const EXTRA_PRESETS: { id: string; label: string; subject: string; body: string }[] = [
  {
    id: "wo_need_info",
    label: "Precisamos de mais informação",
    subject: "Precisamos de mais informação",
    body:
      "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nPara avançarmos com a intervenção no seu {{vehicle}} ({{plate}}), precisamos de mais alguma informação da sua parte.\n\nAgradecemos que nos contacte assim que lhe for possível.",
  },
  {
    id: "wo_extra_issue",
    label: "Encontrámos um problema adicional",
    subject: "Situação adicional detetada",
    body:
      "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nDurante a intervenção no seu {{vehicle}} ({{plate}}) foi detetada uma situação adicional que não estava prevista.\n\nAntes de avançarmos, gostaríamos de falar consigo para explicar o que foi encontrado e apresentar as opções disponíveis.",
  },
  {
    id: "wo_ready_pickup",
    label: "Viatura pronta para levantamento",
    subject: "A sua viatura está pronta para levantamento",
    body:
      "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nA sua viatura {{vehicle}} ({{plate}}) está pronta e disponível para levantamento.\n\nPode passar pelas nossas instalações no horário que lhe for mais conveniente.",
  },
];

function vars(ctx: WorkOrderCommsContext): Record<string, string> {
  return {
    wo_number: ctx.number || "",
    client_name: ctx.clientName || "",
    shop_name: ctx.shopName || "",
    vehicle: `${ctx.vehicleMake || ""} ${ctx.vehicleModel || ""}`.trim(),
    plate: ctx.plate || "",
    quote_total: Number(ctx.total || 0).toFixed(2),
  };
}

/** Presets disponíveis, já renderizados com os dados reais da OS. */
export function getCommsPresets(ctx: WorkOrderCommsContext): CommsPreset[] {
  const v = vars(ctx);
  const pt = (ctx.lang || "pt") === "pt";
  const fromTemplates = messageTemplates.map((tpl) => ({
    id: tpl.id,
    label: pt ? tpl.namePt : tpl.name,
    subject: renderTemplate(pt ? tpl.subjectPt : tpl.subject, v),
    body: renderTemplate(pt ? tpl.bodyPt : tpl.body, v),
  }));
  const extras = EXTRA_PRESETS.map((p) => ({
    id: p.id,
    label: p.label,
    subject: renderTemplate(p.subject, v),
    body: renderTemplate(p.body, v),
  }));
  return [...fromTemplates, ...extras];
}

/** Preset sugerido a partir do estado REAL da OS (nunca o altera). */
export function defaultPresetIdForStatus(status: string): string {
  const map: Record<string, string> = {
    open: "wo_received",
    diagnosis: "wo_diagnosis",
    waiting_approval: "wo_awaiting_approval",
    approved: "wo_quote_approved",
    in_progress: "wo_in_progress",
    completed: "wo_completed",
    delivered: "wo_delivered",
  };
  return map[status] || "wo_in_progress";
}

/** Converte o texto simples num email HTML com a identidade da oficina. */
export function commsEmailHtml(subject: string, body: string, shopName?: string): string {
  const escaped = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");
  return clientNotificationEmailHtml(subject, escaped, shopName);
}

/**
 * Envia o email ao cliente da OS e regista em `email_logs`.
 * Falhas ficam igualmente registadas (status = 'failed') e são propagadas
 * para a UI mostrar o erro ao mecânico.
 */
export async function sendWorkOrderEmail(
  ctx: WorkOrderCommsContext,
  subject: string,
  body: string,
): Promise<void> {
  const to = (ctx.clientEmail || "").trim();
  if (!isValidEmail(to)) throw new Error("O cliente não tem email válido.");
  if (!ctx.shopId) throw new Error("Oficina ativa não identificada.");

  const fullSubject = `${subject} — ${ctx.number}`;
  try {
    await sendEmail({
      to,
      subject: fullSubject,
      html: commsEmailHtml(subject, body, ctx.shopName),
      shop_id: ctx.shopId,
    });
    await supabase.from("email_logs").insert({
      shop_id: ctx.shopId,
      to_email: to,
      subject: fullSubject,
      status: "sent",
      entity_type: "service",
      entity_id: ctx.workOrderId,
    });
  } catch (err: any) {
    await supabase.from("email_logs").insert({
      shop_id: ctx.shopId,
      to_email: to,
      subject: fullSubject,
      status: "failed",
      error_message: err?.message || "unknown",
      entity_type: "service",
      entity_id: ctx.workOrderId,
    });
    throw err;
  }
}

/** Abre o WhatsApp (app ou Web) com a mensagem escolhida pré-preenchida. */
export async function sendWorkOrderWhatsApp(
  ctx: WorkOrderCommsContext,
  body: string,
): Promise<boolean> {
  if (!ctx.clientPhone) throw new Error("O cliente não tem telefone registado.");
  return openWhatsApp({
    phone: ctx.clientPhone,
    clientName: ctx.clientName,
    type: "service",
    number: ctx.number,
    plate: ctx.plate,
    model: `${ctx.vehicleMake || ""} ${ctx.vehicleModel || ""}`.trim(),
    serviceStage: ctx.status as any,
    total: ctx.total,
    shopName: ctx.shopName,
    customMessage: body,
  });
}
