/**
 * SALES DEMO — percurso guiado (100% simulado).
 *
 * Define as etapas da apresentação: o que mostrar (stage do DemoStage),
 * o que dizer (guião curto) e o que isso resolve (momento de valor).
 * Não toca em Auth, Billing, subscrições nem dados reais.
 */
import type { DemoPlan } from "@/lib/salesDemo";

export const PLAN_ORDER: DemoPlan[] = ["free", "pro", "garage"];

export function planRank(p: DemoPlan) {
  return PLAN_ORDER.indexOf(p);
}

export interface TourStep {
  id: string;
  /** chave do DemoStage */
  stage: string;
  area: string;
  say: string;
  value?: string;
  /** plano mínimo em que a área está incluída */
  minPlan: DemoPlan;
  /** necessidade correspondente (ver NEEDS em salesDemoSales) */
  need?: string;
}

export const TOUR: TourStep[] = [
  {
    id: "dashboard",
    stage: "dashboard",
    area: "Dashboard",
    say: "Aqui percebemos rapidamente o que está a acontecer na oficina.",
    value: "Tudo o que está em curso — serviços, orçamentos por aprovar e viaturas em oficina — numa só vista.",
    minPlan: "free",
    need: "organizacao",
  },
  {
    id: "client",
    stage: "client",
    area: "Clientes",
    say: "O cliente fica com toda a informação centralizada.",
    value: "Contactos, viaturas e histórico de serviços associados ao mesmo cliente.",
    minPlan: "free",
    need: "clientes",
  },
  {
    id: "vehicle",
    stage: "vehicle",
    area: "Viatura",
    say: "Vamos abrir esta viatura para ver a ficha completa.",
    value: "Cada viatura tem ficha própria, com quilometragem, próxima revisão e intervenções.",
    minPlan: "free",
    need: "viaturas",
  },
  {
    id: "history",
    stage: "history",
    area: "Histórico",
    say: "Este é o histórico da viatura, sempre disponível.",
    value: "O histórico acompanha a viatura — evita repetir diagnósticos e ajuda a justificar trabalhos.",
    minPlan: "free",
    need: "historico",
  },
  {
    id: "quote",
    stage: "quote",
    area: "Orçamento",
    say: "Agora vamos acompanhar este orçamento até à aprovação.",
    value: "O orçamento é enviado ao cliente e aprovado digitalmente, ficando registado.",
    minPlan: "free",
    need: "orcamentos",
  },
  {
    id: "repair",
    stage: "repair",
    area: "Reparação",
    say: "Depois da aprovação, o trabalho passa para a reparação.",
    value: "O orçamento aprovado dá origem à reparação sem reintroduzir dados.",
    minPlan: "free",
    need: "reparacoes",
  },
  {
    id: "tasks",
    stage: "tasks",
    area: "Modo Oficina",
    say: "O técnico trabalha a partir das tarefas dele.",
    value: "Cada técnico vê apenas os serviços que lhe estão atribuídos.",
    minPlan: "pro",
    need: "equipa",
  },
  {
    id: "parts",
    stage: "parts",
    area: "Peças e stock",
    say: "As peças usadas saem do stock automaticamente.",
    value: "O consumo de peças no serviço atualiza o inventário, sem contagem manual.",
    minPlan: "pro",
    need: "inventario",
  },
  {
    id: "metrics",
    stage: "metrics",
    area: "Relatórios",
    say: "E no fim do mês temos a leitura financeira da oficina.",
    value: "Faturação, ticket médio e taxa de aprovação a partir do trabalho registado.",
    minPlan: "pro",
    need: "relatorios",
  },
  {
    id: "plans",
    stage: "plans",
    area: "Planos",
    say: "Vamos ver qual o plano que faz sentido para a sua oficina.",
    minPlan: "free",
  },
  {
    id: "recommendation",
    stage: "recommendation",
    area: "Recomendação",
    say: "Com base no que falámos, esta é a nossa recomendação.",
    minPlan: "free",
  },
  {
    id: "conversion",
    stage: "conversion",
    area: "Próximo passo",
    say: "O arranque é simples e normalmente acontece no mesmo dia.",
    minPlan: "free",
  },
];

export const PLAN_STEP_NOTE: Record<DemoPlan, string> = {
  free: "Esta área não está incluída no Start.",
  pro: "Esta área não está incluída no Pro.",
  garage: "",
};
