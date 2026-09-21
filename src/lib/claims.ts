/**
 * Gestão de sinistros (seguradoras) — constantes, etiquetas e templates.
 *
 * Tudo funciona sem qualquer API externa de seguradora: a oficina regista
 * manualmente o que acontece fora do GarageFlow (email, telefone, portais).
 */

export const CLAIM_STATUSES = [
  "new",
  "reported",
  "waiting_expert",
  "expert_scheduled",
  "expert_done",
  "quote_preparing",
  "quote_sent",
  "waiting_approval",
  "approved",
  "partially_approved",
  "changes_requested",
  "rejected",
  "repairing",
  "repair_done",
  "waiting_docs",
  "done",
  "cancelled",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  new: "Novo",
  reported: "Participação",
  waiting_expert: "A aguardar peritagem",
  expert_scheduled: "Peritagem agendada",
  expert_done: "Peritagem realizada",
  quote_preparing: "Orçamento em preparação",
  quote_sent: "Orçamento enviado",
  waiting_approval: "A aguardar aprovação",
  approved: "Aprovado",
  partially_approved: "Aprovado parcialmente",
  changes_requested: "Alterações solicitadas",
  rejected: "Recusado",
  repairing: "Em reparação",
  repair_done: "Reparação concluída",
  waiting_docs: "A aguardar documentação",
  done: "Concluído",
  cancelled: "Cancelado",
};

/** Cor semântica (tokens do design system) por estado. */
export function claimStatusTone(status: string): string {
  switch (status) {
    case "approved":
    case "repair_done":
    case "done":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "rejected":
    case "cancelled":
      return "bg-destructive/15 text-destructive border-destructive/30";
    case "changes_requested":
    case "waiting_approval":
    case "waiting_expert":
    case "waiting_docs":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "repairing":
    case "partially_approved":
      return "bg-primary/15 text-primary border-primary/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export const EXPERT_STATUSES = [
  "not_scheduled",
  "scheduled",
  "done",
  "waiting_report",
  "report_received",
  "closed",
] as const;
export const EXPERT_STATUS_LABELS: Record<string, string> = {
  not_scheduled: "Não agendada",
  scheduled: "Agendada",
  done: "Realizada",
  waiting_report: "A aguardar relatório",
  report_received: "Relatório recebido",
  closed: "Concluída",
};

export const APPROVAL_STATUSES = [
  "waiting",
  "approved",
  "partial",
  "rejected",
  "changes_requested",
] as const;
export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  waiting: "A aguardar",
  approved: "Aprovado",
  partial: "Aprovado parcialmente",
  rejected: "Recusado",
  changes_requested: "Alterações solicitadas",
};

export const CONTACT_KINDS = [
  "insurer",
  "claims_manager",
  "expert",
  "expert_company",
  "broker",
  "client",
  "other",
] as const;
export const CONTACT_KIND_LABELS: Record<string, string> = {
  insurer: "Seguradora",
  claims_manager: "Gestor de sinistro",
  expert: "Perito",
  expert_company: "Empresa de peritagem",
  broker: "Mediador",
  client: "Cliente",
  other: "Outro",
};

export const COMM_KINDS = ["email", "phone", "portal", "expert", "meeting", "note", "other"] as const;
export const COMM_KIND_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Telefone",
  portal: "Portal da seguradora",
  expert: "Perito",
  meeting: "Reunião",
  note: "Nota interna",
  other: "Outro",
};

export const COMM_STATUS_LABELS: Record<string, string> = {
  prepared: "Preparado",
  sent: "Enviado",
  received: "Recebido",
  logged: "Registado",
};

export const DOC_CATEGORIES = [
  "report",
  "friendly_declaration",
  "policy",
  "vehicle_doc",
  "photos",
  "expertise",
  "quote",
  "authorization",
  "communication",
  "invoice",
  "other",
] as const;
export const DOC_CATEGORY_LABELS: Record<string, string> = {
  report: "Participação",
  friendly_declaration: "Declaração amigável",
  policy: "Apólice",
  vehicle_doc: "Documento da viatura",
  photos: "Fotografias",
  expertise: "Peritagem",
  quote: "Orçamento",
  authorization: "Autorização",
  communication: "Comunicação",
  invoice: "Fatura",
  other: "Outros",
};

export const CLAIM_TYPES = [
  "Colisão",
  "Choque",
  "Capotamento",
  "Furto / Roubo",
  "Incêndio",
  "Fenómenos da natureza",
  "Quebra isolada de vidros",
  "Atos de vandalismo",
  "Danos próprios",
  "Outro",
];

export const LIABILITY_OPTIONS = [
  "Terceiro responsável",
  "Cliente responsável",
  "Responsabilidade partilhada",
  "Por apurar",
];

export interface ClaimTemplateContext {
  insurer?: string;
  claim_number?: string;
  policy_number?: string;
  client?: string;
  vehicle?: string;
  plate?: string;
  wo_number?: string;
  quote_number?: string;
  amount?: string;
  date?: string;
  shop_name?: string;
}

function fill(text: string, ctx: ClaimTemplateContext): string {
  const map: Record<string, string> = {
    "[SEGURADORA]": ctx.insurer || "—",
    "[Nº SINISTRO]": ctx.claim_number || "—",
    "[Nº APÓLICE]": ctx.policy_number || "—",
    "[CLIENTE]": ctx.client || "—",
    "[VIATURA]": ctx.vehicle || "—",
    "[MATRÍCULA]": ctx.plate || "—",
    "[Nº ORDEM DE SERVIÇO]": ctx.wo_number || "—",
    "[Nº ORÇAMENTO]": ctx.quote_number || "—",
    "[VALOR]": ctx.amount || "—",
    "[DATA]": ctx.date || new Date().toLocaleDateString("pt-PT"),
    "[OFICINA]": ctx.shop_name || "",
  };
  return Object.entries(map).reduce(
    (acc, [k, v]) => acc.split(k).join(v),
    text,
  );
}

export interface ClaimEmailTemplate {
  key: string;
  label: string;
  subject: string;
  body: string;
}

const RAW_TEMPLATES: ClaimEmailTemplate[] = [
  {
    key: "send_quote",
    label: "Envio de orçamento",
    subject: "Orçamento — Sinistro [Nº SINISTRO] | [MATRÍCULA]",
    body: `Exmos. Senhores da [SEGURADORA],

Segue em anexo o orçamento [Nº ORÇAMENTO] referente ao sinistro [Nº SINISTRO] (apólice [Nº APÓLICE]).

Cliente: [CLIENTE]
Viatura: [VIATURA] — [MATRÍCULA]
Ordem de serviço: [Nº ORDEM DE SERVIÇO]
Valor total: [VALOR]

Ficamos a aguardar a vossa análise e autorização para iniciar a reparação.

Com os melhores cumprimentos,
[OFICINA]`,
  },
  {
    key: "ask_approval",
    label: "Pedido de aprovação",
    subject: "Pedido de autorização — Sinistro [Nº SINISTRO]",
    body: `Exmos. Senhores da [SEGURADORA],

Vimos solicitar a autorização para avançar com a reparação do sinistro [Nº SINISTRO], viatura [VIATURA] — [MATRÍCULA], no valor de [VALOR].

A viatura encontra-se nas nossas instalações a aguardar resposta.

Com os melhores cumprimentos,
[OFICINA]`,
  },
  {
    key: "ask_info",
    label: "Pedido de informação",
    subject: "Pedido de informação — Sinistro [Nº SINISTRO]",
    body: `Exmos. Senhores da [SEGURADORA],

Relativamente ao sinistro [Nº SINISTRO] (apólice [Nº APÓLICE]), agradecemos que nos informem do ponto de situação do processo.

Viatura: [VIATURA] — [MATRÍCULA]
Cliente: [CLIENTE]

Com os melhores cumprimentos,
[OFICINA]`,
  },
  {
    key: "send_docs",
    label: "Envio de documentos",
    subject: "Envio de documentos — Sinistro [Nº SINISTRO]",
    body: `Exmos. Senhores da [SEGURADORA],

Enviamos em anexo a documentação solicitada relativa ao sinistro [Nº SINISTRO], viatura [MATRÍCULA].

Com os melhores cumprimentos,
[OFICINA]`,
  },
  {
    key: "answer_changes",
    label: "Resposta a pedido de alteração",
    subject: "Orçamento revisto — Sinistro [Nº SINISTRO]",
    body: `Exmos. Senhores da [SEGURADORA],

Na sequência do vosso pedido de alteração, enviamos o orçamento revisto [Nº ORÇAMENTO] relativo ao sinistro [Nº SINISTRO], no valor de [VALOR].

Com os melhores cumprimentos,
[OFICINA]`,
  },
  {
    key: "ask_update",
    label: "Pedido de atualização do processo",
    subject: "Ponto de situação — Sinistro [Nº SINISTRO]",
    body: `Exmos. Senhores da [SEGURADORA],

Não obtivemos ainda resposta relativamente ao sinistro [Nº SINISTRO] (viatura [MATRÍCULA]). Agradecemos a atualização do estado do processo.

Com os melhores cumprimentos,
[OFICINA]`,
  },
  {
    key: "repair_done",
    label: "Confirmação de reparação concluída",
    subject: "Reparação concluída — Sinistro [Nº SINISTRO]",
    body: `Exmos. Senhores da [SEGURADORA],

Informamos que a reparação da viatura [VIATURA] — [MATRÍCULA], referente ao sinistro [Nº SINISTRO], foi concluída em [DATA].

Seguirá a respetiva faturação.

Com os melhores cumprimentos,
[OFICINA]`,
  },
  {
    key: "other",
    label: "Outro",
    subject: "Sinistro [Nº SINISTRO] — [MATRÍCULA]",
    body: `Exmos. Senhores da [SEGURADORA],

`,
  },
];

export const CLAIM_EMAIL_TEMPLATES = RAW_TEMPLATES;

export function renderClaimTemplate(key: string, ctx: ClaimTemplateContext): { subject: string; body: string } {
  const tpl = RAW_TEMPLATES.find((t) => t.key === key) || RAW_TEMPLATES[0];
  return { subject: fill(tpl.subject, ctx), body: fill(tpl.body, ctx) };
}
