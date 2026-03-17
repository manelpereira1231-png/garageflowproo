export interface MessageTemplate {
  id: string;
  name: string;
  namePt: string;
  subject: string;
  subjectPt: string;
  body: string;
  bodyPt: string;
  variables: string[];
  channel: ("email" | "sms" | "whatsapp")[];
}

export const messageTemplates: MessageTemplate[] = [
  {
    id: "quote_sent",
    name: "Quote Sent",
    namePt: "Orçamento Enviado",
    subject: "Your quote {{quote_number}} is ready",
    subjectPt: "O seu orçamento {{quote_number}} está pronto",
    body: "Hello {{client_name}},\n\nYour quote {{quote_number}} for {{vehicle}} is ready for review.\n\nTotal: {{total}}\n\nPlease review and approve it at your convenience.\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nO seu orçamento {{quote_number}} para o {{vehicle}} está pronto para análise.\n\nTotal: {{total}}\n\nPor favor reveja e aprove quando for conveniente.\n\nCom os melhores cumprimentos,\n{{shop_name}}",
    variables: ["client_name", "quote_number", "vehicle", "total", "shop_name", "approval_link"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "vehicle_ready",
    name: "Vehicle Ready",
    namePt: "Veículo Pronto",
    subject: "Your vehicle is ready for pickup!",
    subjectPt: "O seu veículo está pronto para levantar!",
    body: "Hello {{client_name}},\n\nYour {{vehicle}} is ready for pickup at {{shop_name}}.\n\nPlease come collect it at your earliest convenience.\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nO seu {{vehicle}} está pronto para levantar na {{shop_name}}.\n\nPor favor venha buscá-lo assim que possível.\n\nCom os melhores cumprimentos,\n{{shop_name}}",
    variables: ["client_name", "vehicle", "shop_name"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "service_reminder",
    name: "Service Reminder",
    namePt: "Lembrete de Revisão",
    subject: "Service reminder for your {{vehicle}}",
    subjectPt: "Lembrete de revisão para o seu {{vehicle}}",
    body: "Hello {{client_name}},\n\nIt's time for a service on your {{vehicle}}.\n\n{{service_type}} is due on {{due_date}}.\n\nBook your appointment: {{booking_link}}\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nEstá na hora de uma revisão ao seu {{vehicle}}.\n\n{{service_type}} agendado para {{due_date}}.\n\nMarque a sua marcação: {{booking_link}}\n\nCom os melhores cumprimentos,\n{{shop_name}}",
    variables: ["client_name", "vehicle", "service_type", "due_date", "booking_link", "shop_name"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "inspection_reminder",
    name: "Inspection Reminder",
    namePt: "Lembrete de Inspeção",
    subject: "Vehicle inspection reminder for {{vehicle}}",
    subjectPt: "Lembrete de inspeção para o {{vehicle}}",
    body: "Hello {{client_name}},\n\nYour {{vehicle}} inspection is coming up on {{due_date}}.\n\nWe recommend booking a pre-inspection check.\n\nBook now: {{booking_link}}\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nA inspeção do seu {{vehicle}} está a aproximar-se ({{due_date}}).\n\nRecomendamos agendar uma pré-inspeção.\n\nMarque agora: {{booking_link}}\n\nCom os melhores cumprimentos,\n{{shop_name}}",
    variables: ["client_name", "vehicle", "due_date", "booking_link", "shop_name"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "invoice_overdue",
    name: "Invoice Overdue",
    namePt: "Fatura Vencida",
    subject: "Payment reminder for invoice {{invoice_number}}",
    subjectPt: "Lembrete de pagamento da fatura {{invoice_number}}",
    body: "Hello {{client_name}},\n\nThis is a reminder that invoice {{invoice_number}} for {{total}} is past due since {{due_date}}.\n\nPlease process the payment at your earliest convenience.\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nEste é um lembrete de que a fatura {{invoice_number}} no valor de {{total}} está vencida desde {{due_date}}.\n\nPor favor processe o pagamento assim que possível.\n\nCom os melhores cumprimentos,\n{{shop_name}}",
    variables: ["client_name", "invoice_number", "total", "due_date", "shop_name"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "welcome_client",
    name: "Welcome Client",
    namePt: "Boas-vindas ao Cliente",
    subject: "Welcome to {{shop_name}}!",
    subjectPt: "Bem-vindo à {{shop_name}}!",
    body: "Hello {{client_name}},\n\nWelcome to {{shop_name}}! We're delighted to have you as our client.\n\nYou can access your client portal here: {{portal_link}}\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nBem-vindo à {{shop_name}}! Estamos encantados por tê-lo como nosso cliente.\n\nPode aceder ao seu portal de cliente aqui: {{portal_link}}\n\nCom os melhores cumprimentos,\n{{shop_name}}",
    variables: ["client_name", "shop_name", "portal_link"],
    channel: ["email", "whatsapp"],
  },
];

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  });
  return result;
}
