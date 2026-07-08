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
    body: "Order: {{wo_number}}\n\nHello,\n\n{{shop_name}} confirms that your vehicle {{vehicle}} with plate {{plate}} has been received at our facilities.\n\nOur team will perform the initial assessment and keep you informed about the next steps.\n\nThank you for your trust.",
    bodyPt: "Ordem de Serviço: {{wo_number}}\n\nOlá,\n\nA {{shop_name}} informa que o seu veículo {{vehicle}} com matrícula {{plate}} foi recebido nas nossas instalações.\n\nA nossa equipa irá realizar a avaliação inicial e mantê-lo(a) informado(a) sobre os próximos passos.\n\nObrigado pela sua confiança.",
    variables: ["wo_number", "shop_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_diagnosis",
    name: "Diagnosis in progress",
    namePt: "Diagnóstico",
    subject: "Diagnosis in progress",
    subjectPt: "Diagnóstico em curso",
    body: "Order: {{wo_number}}\n\nHello,\n\n{{shop_name}} is performing the diagnosis of your vehicle {{vehicle}} with plate {{plate}}, to identify the cause of the required intervention.\n\nIf any additional service is required or if the quote changes, we will contact you before proceeding.\n\nThank you for your trust.",
    bodyPt: "Ordem de Serviço: {{wo_number}}\n\nOlá,\n\nA {{shop_name}} está a realizar o diagnóstico do seu veículo {{vehicle}} com matrícula {{plate}}, para identificar a origem da intervenção necessária.\n\nCaso seja necessário algum serviço adicional ou exista alguma alteração ao orçamento, entraremos em contacto antes de avançar.\n\nObrigado pela sua confiança.",
    variables: ["wo_number", "shop_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_awaiting_approval",
    name: "Awaiting approval",
    namePt: "Aguardando aprovação",
    subject: "We are awaiting your approval",
    subjectPt: "Aguardamos a sua aprovação",
    body: "Order: {{wo_number}}\n\nHello,\n\n{{shop_name}} informs that the diagnosis of your vehicle {{vehicle}} with plate {{plate}} has been completed.\n\nThe quote is available for your review and approval.\n\nAs soon as we receive your confirmation, we will start the work.\n\nThank you for your trust.",
    bodyPt: "Ordem de Serviço: {{wo_number}}\n\nOlá,\n\nA {{shop_name}} informa que o diagnóstico do seu veículo {{vehicle}} com matrícula {{plate}} foi concluído.\n\nO orçamento encontra-se disponível para a sua análise e aprovação.\n\nAssim que recebermos a sua confirmação, iniciaremos os trabalhos.\n\nObrigado pela sua confiança.",
    variables: ["wo_number", "shop_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_quote_approved",
    name: "Quote approved",
    namePt: "Orçamento aprovado",
    subject: "Quote approved",
    subjectPt: "Orçamento aprovado",
    body: "Order: {{wo_number}}\n\nHello,\n\n{{shop_name}} confirms that the quote for your vehicle {{vehicle}} with plate {{plate}} has been approved.\n\nApproved amount: {{quote_total}}\n\nThe intervention will start shortly. We will keep you informed about the progress of the work.\n\nThank you for your trust.",
    bodyPt: "Ordem de Serviço: {{wo_number}}\n\nOlá,\n\nA {{shop_name}} confirma que o orçamento para o seu veículo {{vehicle}} com matrícula {{plate}} foi aprovado.\n\nValor aprovado: {{quote_total}}\n\nA intervenção será iniciada em breve. Iremos mantê-lo(a) informado(a) sobre a evolução dos trabalhos.\n\nObrigado pela sua confiança.",
    variables: ["wo_number", "shop_name", "vehicle", "plate", "quote_total"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_in_progress",
    name: "Work in progress",
    namePt: "Em execução",
    subject: "Work in progress",
    subjectPt: "Trabalhos em execução",
    body: "Order: {{wo_number}}\n\nHello,\n\n{{shop_name}} informs that the work on your vehicle {{vehicle}} with plate {{plate}} is now in progress.\n\nOur team is performing the planned intervention and we will notify you as soon as it is completed.\n\nThank you for your trust.",
    bodyPt: "Ordem de Serviço: {{wo_number}}\n\nOlá,\n\nA {{shop_name}} informa que os trabalhos no seu veículo {{vehicle}} com matrícula {{plate}} já se encontram em execução.\n\nA nossa equipa está a realizar a intervenção prevista e iremos notificá-lo(a) assim que esta estiver concluída.\n\nObrigado pela sua confiança.",
    variables: ["wo_number", "shop_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_completed",
    name: "Service completed",
    namePt: "Concluído",
    subject: "Service completed",
    subjectPt: "Serviço concluído",
    body: "Order: {{wo_number}}\n\nHello,\n\n{{shop_name}} is pleased to inform that the intervention on your vehicle {{vehicle}} with plate {{plate}} has been successfully completed.\n\nThe vehicle is ready for delivery. We will contact you if pickup still needs to be scheduled.\n\nThank you for your trust.",
    bodyPt: "Ordem de Serviço: {{wo_number}}\n\nOlá,\n\nA {{shop_name}} tem o prazer de informar que a intervenção no seu veículo {{vehicle}} com matrícula {{plate}} foi concluída com sucesso.\n\nO veículo encontra-se preparado para entrega. Entraremos em contacto consigo caso ainda seja necessário agendar a recolha.\n\nObrigado pela sua confiança.",
    variables: ["wo_number", "shop_name", "vehicle", "plate"],
    channel: ["email", "sms", "whatsapp"],
  },
  {
    id: "wo_delivered",
    name: "Vehicle delivered",
    namePt: "Entregue",
    subject: "Vehicle delivered",
    subjectPt: "Veículo entregue",
    body: "Order: {{wo_number}}\n\nHello,\n\n{{shop_name}} confirms the delivery of your vehicle {{vehicle}} with plate {{plate}}.\n\nWe thank you for the trust placed in our services and look forward to welcoming you again in the future.\n\nIf you have any questions or need assistance, we will always be available.\n\nThank you for your preference.",
    bodyPt: "Ordem de Serviço: {{wo_number}}\n\nOlá,\n\nA {{shop_name}} confirma a entrega do seu veículo {{vehicle}} com matrícula {{plate}}.\n\nAgradecemos a confiança depositada nos nossos serviços e esperamos voltar a recebê-lo numa próxima oportunidade.\n\nSe tiver alguma questão ou necessitar de assistência, estaremos sempre disponíveis.\n\nObrigado pela sua preferência.",
    variables: ["wo_number", "shop_name", "vehicle", "plate"],
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
