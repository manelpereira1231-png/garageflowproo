/**
 * SALES DEMO — percurso guiado (100% simulado).
 *
 * Define as etapas da apresentação: o que mostrar (stage do DemoStage),
 * o que o visitante está a ver (context), o que dizer (guião comercial)
 * e o que isso resolve (momento de valor).
 * Não toca em Auth, Billing, subscrições nem dados reais.
 */
import type { DemoPlan } from "@/lib/salesDemo";

export const PLAN_ORDER: DemoPlan[] = ["free", "pro", "garage"];

export function planRank(p: DemoPlan) {
  return PLAN_ORDER.indexOf(p);
}

/** Caso fictício que atravessa toda a demonstração (história única e coerente). */
export const DEMO_CASE = {
  shop: "AutoPrime Lisboa",
  client: "Rui Marques",
  vehicle: "VW Golf VII 1.6 TDI",
  plate: "12-AB-34",
  job: "Travões à frente",
  order: "OS-2041",
  quote: "ORC-2026/118",
};

export interface TourStep {
  id: string;
  /** chave do DemoStage */
  stage: string;
  area: string;
  /** o que o visitante está a ver neste ecrã (modo autónomo) */
  context?: string;
  /** o que aconteceu antes / porque chegámos aqui */
  before?: string;
  say: string;
  value?: string;
  /** plano mínimo em que a área está incluída */
  minPlan: DemoPlan;
  /** etapa exclusiva da demo comercial (planos, recomendação) */
  commercial?: boolean;
  /** assistência discreta ao comercial: pontos a destacar */
  highlights?: string[];
  /** assistência discreta ao comercial: perguntas sugeridas */
  questions?: string[];
  /** necessidade correspondente (ver NEEDS em salesDemoSales) */
  need?: string;
}

export const TOUR: TourStep[] = [
  {
    id: "dashboard",
    stage: "dashboard",
    area: "Dashboard",
    context: "Esta é a primeira vista ao abrir o GarageFlow: o estado da oficina no momento.",
    before: `Começamos o dia na ${DEMO_CASE.shop}.`,
    say: "Aqui percebemos rapidamente o que está a acontecer na oficina.",
    value: "Tudo o que está em curso — serviços, orçamentos por aprovar e veículos em oficina — numa só vista.",
    minPlan: "free",
    need: "organizacao",
    highlights: ["Tudo numa vista, sem abrir folhas de cálculo", "Comparação automática com o mês anterior"],
    questions: ["Hoje, como sabe o que está em oficina?", "Quanto tempo perde a juntar estes números?"],
  },
  {
    id: "client",
    stage: "client",
    area: "Clientes",
    context: `Ficha do cliente ${DEMO_CASE.client}, que acabou de chegar à oficina.`,
    before: "O cliente liga a dizer que os travões estão a chiar.",
    say: "O cliente fica com toda a informação centralizada.",
    value: "Contactos, veículos e histórico de serviços associados ao mesmo cliente.",
    minPlan: "free",
    need: "clientes",
  },
  {
    id: "vehicle",
    stage: "vehicle",
    area: "Veículo",
    context: `A veículo do ${DEMO_CASE.client}: ${DEMO_CASE.vehicle} (${DEMO_CASE.plate}).`,
    before: "A partir da ficha do cliente abrimos a veículo em causa.",
    say: "Vamos abrir esta veículo para ver a ficha completa.",
    value: "Cada veículo tem ficha própria, com quilometragem, próxima revisão e intervenções.",
    minPlan: "free",
    need: "viaturas",
  },
  {
    id: "history",
    stage: "history",
    area: "Histórico",
    context: `Tudo o que já foi feito nesta veículo (${DEMO_CASE.plate}).`,
    before: "Antes de orçamentar, confirmamos o que já foi feito.",
    say: "Este é o histórico da veículo, sempre disponível.",
    value: "O histórico acompanha a veículo — evita repetir diagnósticos e ajuda a justificar trabalhos.",
    minPlan: "free",
    need: "historico",
  },
  {
    id: "quote",
    stage: "quote",
    area: "Orçamento",
    context: `Orçamento ${DEMO_CASE.quote} para ${DEMO_CASE.job}, criado a partir da veículo.`,
    before: "Diagnóstico feito: pastilhas e discos à frente.",
    say: "Agora vamos acompanhar este orçamento até à aprovação.",
    value: "O orçamento é enviado ao cliente e aprovado digitalmente, ficando registado.",
    minPlan: "free",
    need: "orcamentos",
    highlights: ["Orçamento em minutos, com peças e mão de obra", "Envio por email e WhatsApp num clique"],
    questions: ["Quantos orçamentos faz por semana?", "Quantos ficam sem resposta?"],
  },
  {
    id: "notify",
    stage: "notify",
    area: "Notificação e aprovação",
    context: "O cliente recebe o orçamento no telemóvel e responde — a oficina é notificada.",
    before: `${DEMO_CASE.quote} enviado por email e WhatsApp.`,
    say: "O cliente aprova no telemóvel e a oficina sabe de imediato.",
    value: "Sem telefonemas a perguntar: a resposta do cliente fica registada com data e hora.",
    minPlan: "free",
    need: "comunicacao",
    highlights: ["Aprovação digital com data, hora e assinatura", "Fim dos telefonemas a perguntar"],
    questions: ["Já teve discussões sobre o que foi autorizado?"],
  },
  {
    id: "repair",
    stage: "repair",
    area: "Reparação",
    context: `Orçamento aprovado convertido no serviço ${DEMO_CASE.order}, já em reparação.`,
    before: "O cliente aprovou. O trabalho pode começar.",
    say: "Depois da aprovação, o trabalho passa para a reparação.",
    value: "O orçamento aprovado dá origem à reparação sem reintroduzir dados.",
    minPlan: "free",
    need: "reparacoes",
  },
  {
    id: "tasks",
    stage: "tasks",
    area: "Modo Oficina",
    context: `Vista do técnico no telemóvel, com a tarefa da ${DEMO_CASE.order}.`,
    before: "O serviço foi atribuído ao técnico.",
    say: "O técnico trabalha a partir das tarefas dele.",
    value: "Cada técnico vê apenas os serviços que lhe estão atribuídos.",
    minPlan: "pro",
    need: "equipa",
  },
  {
    id: "parts",
    stage: "parts",
    area: "Peças e stock",
    context: `As peças usadas na ${DEMO_CASE.order} a sair do inventário.`,
    before: "O técnico registou as peças aplicadas.",
    say: "As peças usadas saem do stock automaticamente.",
    value: "O consumo de peças no serviço atualiza o inventário, sem contagem manual.",
    minPlan: "pro",
    need: "inventario",
    highlights: ["Stock atualizado pelo próprio serviço", "Alertas de mínimos"],
    questions: ["Com que frequência faz inventário à mão?"],
  },
  {
    id: "agenda",
    stage: "agenda",
    area: "Agenda",
    context: "A semana da oficina, com as entradas marcadas e a OS-2041 em curso.",
    before: "A reparação precisa de espaço na box.",
    say: "A agenda mostra a carga real da oficina.",
    value: "Marcações, confirmações e conclusões na mesma vista semanal.",
    minPlan: "free",
    need: "organizacao",
    highlights: ["Marcação online do cliente cai aqui", "Estado por marcação: marcada, confirmada, concluída"],
  },
  {
    id: "invoices",
    stage: "invoices",
    area: "Faturação",
    context: `Fatura do serviço ${DEMO_CASE.order}, gerada a partir do trabalho concluído.`,
    before: "Veículo entregue ao cliente.",
    say: "A fatura sai do serviço, sem reescrever nada.",
    value: "Documento numerado sequencialmente e enviado ao cliente com link de pagamento.",
    minPlan: "free",
    need: "faturacao",
    highlights: ["Numeração sequencial automática", "Link de pagamento e envio automático"],
    questions: ["Quem trata da faturação hoje?"],
  },
  {
    id: "alerts",
    stage: "alerts",
    area: "Alertas",
    context: "O que a oficina não pode deixar cair: orçamentos por responder, revisões e stock.",
    say: "Os alertas evitam que trabalho e dinheiro fiquem esquecidos.",
    value: "A aplicação avisa em vez de depender da memória de alguém.",
    minPlan: "free",
    need: "comunicacao",
    highlights: ["Revisões e inspeções a vencer geram retorno de clientes"],
  },
  {
    id: "metrics",
    stage: "metrics",
    area: "Relatórios",
    context: "O resultado de todos os trabalhos registados, em números.",
    before: "Trabalho concluído, veículo entregue e faturada.",
    say: "E no fim do mês temos a leitura financeira da oficina.",
    value: "Faturação, ticket médio e taxa de aprovação a partir do trabalho registado.",
    minPlan: "pro",
    need: "relatorios",
  },
  {
    id: "plans",
    stage: "plans",
    area: "Planos",
    context: "O que está incluído em cada plano do GarageFlow.",
    say: "Vamos ver qual o plano que faz sentido para a sua oficina.",
    minPlan: "free",
    commercial: true,
  },
  {
    id: "recommendation",
    stage: "recommendation",
    area: "Recomendação",
    context: "Sugestão de plano com base nas áreas que viu nesta demonstração.",
    say: "Com base no que falámos, esta é a nossa recomendação.",
    minPlan: "free",
    commercial: true,
  },
  {
    id: "conversion",
    stage: "conversion",
    area: "Próximo passo",
    context: "Como é o arranque real numa oficina.",
    say: "O arranque é simples e normalmente acontece no mesmo dia.",
    minPlan: "free",
  },
];

export const PLAN_STEP_NOTE: Record<DemoPlan, string> = {
  free: "Esta área não está incluída no Start.",
  pro: "Esta área não está incluída no Pro.",
  garage: "",
};

/** Percurso da demo autónoma (/demo): sem etapas comerciais. */
export const SELF_TOUR: TourStep[] = TOUR.filter((s) => !s.commercial);
