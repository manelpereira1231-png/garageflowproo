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
    namePt: "Orçamento Pendente",
    subject: "Orçamento pendente de aprovação — {{quote_number}}",
    subjectPt: "Orçamento pendente de aprovação — {{quote_number}}",
    body: "Hello {{client_name}},\n\nYou have a pending quote ({{quote_number}}, total {{total}}) for your {{vehicle}}.\n\nAs soon as we receive your confirmation we can start the work.\n\nApproval link: {{approval_link}}\n\nThank you.\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nTem um orçamento pendente de aprovação referente à sua viatura {{vehicle}}.\n\nNúmero: {{quote_number}}\nValor total: {{total}}\n\nAssim que recebermos a sua confirmação poderemos iniciar os trabalhos.\n\nAprovar aqui: {{approval_link}}\n\nObrigado.\n\nCumprimentos,\n{{shop_name}}",
    variables: ["client_name", "quote_number", "vehicle", "total", "shop_name", "approval_link"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "quote_approved",
    name: "Quote Approved",
    namePt: "Orçamento Aprovado",
    subject: "Quote {{quote_number}} approved — work starting",
    subjectPt: "Orçamento {{quote_number}} aprovado — trabalhos iniciados",
    body: "Hello {{client_name}},\n\nThe quote for your {{vehicle}} has been approved and the work will start shortly.\n\nThank you for your trust.\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nO orçamento referente à sua viatura {{vehicle}} foi aprovado e os trabalhos serão iniciados em breve.\n\nAgradecemos a sua confiança.\n\nCumprimentos,\n{{shop_name}}",
    variables: ["client_name", "quote_number", "vehicle", "shop_name"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "work_order_completed",
    name: "Work Order Completed",
    namePt: "Ordem de Serviço Concluída",
    subject: "Work order {{wo_number}} completed",
    subjectPt: "Ordem de serviço {{wo_number}} concluída",
    body: "Hello {{client_name}},\n\nWe inform you that work order #{{wo_number}} has been successfully completed.\n\nYour vehicle is ready for pickup.\n\nIf you have any questions we are fully available to help.\n\nThank you for your trust.\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nInformamos que a sua ordem de serviço nº {{wo_number}} foi concluída com sucesso.\n\nA sua viatura já se encontra disponível para levantamento.\n\nCaso tenha alguma questão, estamos totalmente disponíveis para ajudar.\n\nObrigado pela sua confiança.\n\nCumprimentos,\n{{shop_name}}",
    variables: ["client_name", "wo_number", "vehicle", "shop_name"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "vehicle_ready",
    name: "Vehicle Ready",
    namePt: "Viatura Pronta para Levantamento",
    subject: "Your vehicle is ready for pickup",
    subjectPt: "A sua viatura está pronta para levantamento",
    body: "Hello {{client_name}},\n\nWe inform you that your {{vehicle}} is ready for pickup.\n\nYou can come to our premises during business hours.\n\nThank you for your preference.\n\nBest regards,\n{{shop_name}}",
    bodyPt: "Olá {{client_name}},\n\nInformamos que a sua viatura {{vehicle}} está pronta para levantamento.\n\nPode dirigir-se às nossas instalações dentro do horário de funcionamento.\n\nObrigado pela sua preferência.\n\nCumprimentos,\n{{shop_name}}",
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
