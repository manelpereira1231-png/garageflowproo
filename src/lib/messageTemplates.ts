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

// Variáveis suportadas nos templates de estado da Ordem de Serviço:
//   {{wo_number}}   → N.º da Ordem de Serviço
//   {{shop_name}}   → Nome da Oficina
//   {{vehicle}}     → Marca e Modelo
//   {{plate}}       → Matrícula
//   {{client_name}} → Nome do Cliente (opcional)
//   {{quote_total}} → Valor aprovado do orçamento

export const messageTemplates: MessageTemplate[] = [
  {
    id: "wo_received",
    name: "Vehicle Received",
    namePt: "Receção do veículo",
    subject: "We have received your vehicle",
    subjectPt: "Recebemos o seu veículo",
    body: "Order {{wo_number}}\n\nHello {{client_name}},\n\nYour vehicle {{vehicle}} ({{plate}}) has been received at our facilities.\n\nOur team will perform the initial assessment and keep you informed about the next steps.\n\nThank you for your trust.",
    bodyPt: "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nO seu veículo {{vehicle}} ({{plate}}) foi recebido nas nossas instalações.\n\nA nossa equipa irá realizar a avaliação inicial e mantê-lo(a) informado(a) sobre os próximos passos.\n\nObrigado pela sua confiança.",
    variables: ["wo_number", "client_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_diagnosis",
    name: "Diagnosis in progress",
    namePt: "Diagnóstico",
    subject: "Diagnosis in progress",
    subjectPt: "Diagnóstico em curso",
    body: "Order {{wo_number}}\n\nHello {{client_name}},\n\nWe are performing the diagnosis of your {{vehicle}} ({{plate}}) to identify the cause of the required intervention.\n\nIf any additional service is required or if there is any change to the quote, we will contact you before proceeding.",
    bodyPt: "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nEstamos a realizar o diagnóstico do seu {{vehicle}} ({{plate}}) para identificar a origem da intervenção necessária.\n\nCaso seja necessário algum serviço adicional ou exista alguma alteração ao orçamento, entraremos em contacto antes de avançar.",
    variables: ["wo_number", "client_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_awaiting_approval",
    name: "Awaiting approval",
    namePt: "Aguardando aprovação",
    subject: "We are awaiting your approval",
    subjectPt: "Aguardamos a sua aprovação",
    body: "Order {{wo_number}}\n\nHello {{client_name}},\n\nThe diagnosis of your vehicle has been completed.\n\nThe quote is available for your review and approval.\n\nAs soon as we receive your confirmation, we will start the work.",
    bodyPt: "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nO diagnóstico do seu veículo foi concluído.\n\nO orçamento encontra-se disponível para a sua análise e aprovação.\n\nAssim que recebermos a sua confirmação, iniciaremos os trabalhos.",
    variables: ["wo_number", "client_name"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_quote_approved",
    name: "Quote approved",
    namePt: "Orçamento aprovado",
    subject: "Quote approved",
    subjectPt: "Orçamento aprovado",
    body: "Order {{wo_number}}\n\nHello {{client_name}},\n\nWe confirm that the quote for your {{vehicle}} ({{plate}}) has been approved.\n\nApproved amount: €{{quote_total}}\n\nThe intervention will begin soon. We will keep you informed about the progress of the work.",
    bodyPt: "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nConfirmamos que o orçamento para o seu {{vehicle}} ({{plate}}) foi aprovado.\n\nValor aprovado: €{{quote_total}}\n\nA intervenção será iniciada em breve. Iremos mantê-lo(a) informado(a) sobre a evolução dos trabalhos.",
    variables: ["wo_number", "client_name", "vehicle", "plate", "quote_total"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_in_progress",
    name: "Work in progress",
    namePt: "Em execução",
    subject: "Work in progress",
    subjectPt: "Trabalhos em execução",
    body: "Order {{wo_number}}\n\nHello {{client_name}},\n\nWe inform you that the work on your {{vehicle}} ({{plate}}) is now in progress.\n\nOur team is performing the planned intervention and we will notify you as soon as it is completed.",
    bodyPt: "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nInformamos que os trabalhos no seu {{vehicle}} ({{plate}}) já se encontram em execução.\n\nA nossa equipa está a realizar a intervenção prevista e iremos notificá-lo(a) assim que esta estiver concluída.",
    variables: ["wo_number", "client_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_completed",
    name: "Service completed",
    namePt: "Concluído",
    subject: "Service completed",
    subjectPt: "Serviço concluído",
    body: "Order {{wo_number}}\n\nHello {{client_name}},\n\nWe are pleased to inform you that the intervention on your {{vehicle}} ({{plate}}) has been successfully completed.\n\nThe vehicle is ready for delivery.\n\nWe will contact you if pickup still needs to be scheduled.",
    bodyPt: "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nTemos o prazer de informar que a intervenção no seu {{vehicle}} ({{plate}}) foi concluída com sucesso.\n\nO veículo encontra-se preparado para entrega.\n\nEntraremos em contacto consigo caso ainda seja necessário agendar a recolha.",
    variables: ["wo_number", "client_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_delivered",
    name: "Vehicle delivered",
    namePt: "Entregue",
    subject: "Vehicle delivered",
    subjectPt: "Veículo entregue",
    body: "Order {{wo_number}}\n\nHello {{client_name}},\n\nWe confirm the delivery of your {{vehicle}} ({{plate}}).\n\nWe thank you for the trust placed in our services and look forward to welcoming you again in the future.\n\nIf you have any questions or need assistance, we will always be available.",
    bodyPt: "Ordem de Serviço {{wo_number}}\n\nOlá {{client_name}},\n\nConfirmamos a entrega do seu {{vehicle}} ({{plate}}).\n\nAgradecemos a confiança depositada nos nossos serviços e esperamos voltar a recebê-lo numa próxima oportunidade.\n\nSe tiver alguma questão ou necessitar de assistência, estaremos sempre disponíveis.",
    variables: ["wo_number", "client_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
];

export function renderTemplate(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  });
  return result;
}
