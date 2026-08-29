/**
 * SALES DEMO — camada comercial (Fase 2).
 *
 * Estado puramente local (sessionStorage) para apoiar o comercial durante a
 * apresentação: perfil da oficina, necessidades, funcionalidades demonstradas,
 * recomendação de plano e resumo. Não toca em Auth, Billing nem subscrições.
 */
import type { DemoPlan } from "@/lib/salesDemo";
import { PLAN_LABEL } from "@/lib/salesDemo";

const KEY = "gf_sales_demo_sales_state";

export interface ShopProfile {
  shopName: string;
  people: string;
  users: string;
  vehiclesMonth: string;
  currentSoftware: string;
  mainPain: string;
  goal: string;
}

export interface SalesState {
  profile: ShopProfile;
  needs: string[];
  shown: string[];
  notes: string;
}

export const EMPTY_STATE: SalesState = {
  profile: { shopName: "", people: "", users: "", vehiclesMonth: "", currentSoftware: "", mainPain: "", goal: "" },
  needs: [],
  shown: [],
  notes: "",
};

/** Necessidades — mapeadas a funcionalidades reais do GarageFlow. */
export const NEEDS: { id: string; label: string; route: string; plan: DemoPlan }[] = [
  { id: "organizacao", label: "Organização", route: "/dashboard", plan: "free" },
  { id: "clientes", label: "Clientes", route: "/clients", plan: "free" },
  { id: "viaturas", label: "Veículos", route: "/vehicles", plan: "free" },
  { id: "historico", label: "Histórico", route: "/vehicles", plan: "free" },
  { id: "orcamentos", label: "Orçamentos", route: "/quotes", plan: "free" },
  { id: "reparacoes", label: "Reparações", route: "/services", plan: "free" },
  { id: "agenda", label: "Agenda", route: "/agenda", plan: "pro" },
  { id: "inventario", label: "Inventário", route: "/inventory", plan: "pro" },
  { id: "faturacao", label: "Faturação", route: "/invoices", plan: "pro" },
  { id: "relatorios", label: "Relatórios", route: "/financial-reports", plan: "pro" },
  { id: "comunicacao", label: "Comunicação", route: "/notifications", plan: "pro" },
  { id: "equipa", label: "Equipa", route: "/team", plan: "pro" },
  { id: "automatizacoes", label: "Automatizações", route: "/automations", plan: "garage" },
  { id: "multioficina", label: "Multi-oficina", route: "/settings", plan: "garage" },
];

export function needLabel(id: string) {
  return NEEDS.find((n) => n.id === id)?.label ?? id;
}

/** Guião sugerido por área — curto, factual, opcional. */
export const SCRIPT: { area: string; route: string; line: string }[] = [
  { area: "Dashboard", route: "/dashboard", line: "Vamos começar por perceber rapidamente o estado da oficina." },
  { area: "Clientes", route: "/clients", line: "Aqui centralizamos a informação do cliente e o contacto." },
  { area: "Viaturas", route: "/vehicles", line: "Vamos abrir esta viatura para ver o histórico completo." },
  { area: "Orçamentos", route: "/quotes", line: "Agora vamos acompanhar o processo do orçamento até à aprovação." },
  { area: "Reparações", route: "/services", line: "Depois, acompanhamos a reparação por estados até à entrega." },
  { area: "Faturação", route: "/invoices", line: "A fatura sai do serviço, sem voltar a escrever nada." },
  { area: "Agenda", route: "/agenda", line: "A marcação fica ligada ao cliente e à viatura." },
  { area: "Inventário", route: "/inventory", line: "As peças consumidas saem do stock automaticamente." },
  { area: "Equipa", route: "/team", line: "Cada pessoa vê o que lhe diz respeito, com permissões próprias." },
];

/** Momentos de valor — descrições factuais do funcionamento real. */
export const VALUE_MOMENTS: { title: string; body: string; route: string }[] = [
  {
    title: "Cliente + Viatura + Histórico",
    body: "Toda a informação relevante fica organizada no contexto da viatura, incluindo intervenções anteriores.",
    route: "/vehicles",
  },
  {
    title: "Orçamento → Reparação",
    body: "Depois de aprovado, o orçamento dá origem à reparação sem reintroduzir dados.",
    route: "/quotes",
  },
  {
    title: "Reparação → Fatura",
    body: "A faturação parte do trabalho realizado e das peças consumidas.",
    route: "/services",
  },
  {
    title: "Equipa",
    body: "Acompanhamento do trabalho por técnico, com acesso limitado ao que lhe compete.",
    route: "/team",
  },
];

/** Objeções — respostas factuais, sem argumentos manipulativos. */
export const OBJECTIONS: { id: string; label: string; answer: string; route?: string }[] = [
  {
    id: "caro",
    label: "É caro.",
    answer:
      "O preço é fixo e transparente por mês. Vale a pena comparar o plano abaixo: se as funcionalidades que precisa já lá estão, começamos por esse.",
    route: "/billing",
  },
  {
    id: "pequena",
    label: "Só tenho uma oficina pequena.",
    answer:
      "Nesse caso o plano de entrada costuma chegar. Só faz sentido subir quando precisar de faturação, relatórios ou equipa com permissões.",
    route: "/clients",
  },
  {
    id: "ja-tenho",
    label: "Já tenho software.",
    answer:
      "Podemos comparar em concreto: histórico por viatura, orçamento que se transforma em reparação e faturação a partir do serviço. Se já tem tudo isso, não precisa de mudar.",
    route: "/services",
  },
  {
    id: "nao-agora",
    label: "Não quero mudar agora.",
    answer: "Sem problema. Fica com o resumo da demonstração e retomamos quando fizer sentido.",
  },
  {
    id: "experimentar",
    label: "Quero experimentar primeiro.",
    answer: "Pode começar pelo processo de subscrição normal disponível na página de planos, com os dados da sua oficina.",
    route: "/billing",
  },
  {
    id: "porque-pro",
    label: "Porque preciso do Pro?",
    answer: "Só precisa se necessitar do que o Start não inclui. Veja a lista real de diferenças em Comparar planos.",
  },
  {
    id: "porque-garage",
    label: "Porque preciso do Garage?",
    answer: "Faz sentido sobretudo com várias oficinas ou automatizações. Caso contrário, o Pro chega.",
  },
];

// ── Estado ────────────────────────────────────────────────────────────

export function loadSalesState(): SalesState {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    return { ...EMPTY_STATE, ...(JSON.parse(raw) as Partial<SalesState>) };
  } catch {
    return EMPTY_STATE;
  }
}

export function saveSalesState(s: SalesState) {
  try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export function clearSalesState() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

// ── Recomendação ──────────────────────────────────────────────────────

export interface Recommendation {
  plan: DemoPlan;
  confidence: "forte" | "provavel" | "indicativa";
  reasons: string[];
  belowNote: string | null;
  aboveNote: string | null;
}

const num = (v: string) => {
  const n = parseInt(String(v).replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

export function recommend(state: SalesState): Recommendation {
  const { profile, needs } = state;
  const users = num(profile.users) || num(profile.people);
  const volume = num(profile.vehiclesMonth);
  const reasons: string[] = [];

  let plan: DemoPlan = "free";

  const garageNeeds = needs.filter((n) => NEEDS.find((x) => x.id === n)?.plan === "garage");
  const proNeeds = needs.filter((n) => NEEDS.find((x) => x.id === n)?.plan === "pro");

  if (garageNeeds.length > 0) {
    plan = "garage";
    reasons.push(`Necessita de ${garageNeeds.map(needLabel).join(" e ")}, disponível no Garage.`);
  } else if (proNeeds.length > 0) {
    plan = "pro";
    reasons.push(`Necessita de ${proNeeds.map(needLabel).join(", ")}, incluído no Pro.`);
  }

  if (users >= 6 && plan === "free") {
    plan = "pro";
  }
  if (users >= 3) reasons.push(`Equipa de ${users} utilizadores — justifica acessos e permissões distintas.`);
  if (volume >= 80 && plan === "free") {
    plan = "pro";
    reasons.push(`Volume de cerca de ${volume} veículos/mês exige acompanhamento e relatórios.`);
  } else if (volume > 0) {
    reasons.push(`Volume indicado: cerca de ${volume} veículos/mês.`);
  }

  if (profile.currentSoftware.trim()) {
    reasons.push(`Já utiliza ${profile.currentSoftware.trim()} — a comparação deve ser feita funcionalidade a funcionalidade.`);
  }
  if (profile.mainPain.trim()) {
    reasons.push(`Dificuldade indicada: ${profile.mainPain.trim()}.`);
  }
  if (reasons.length === 0) {
    reasons.push("Sem informação adicional, o plano de entrada cobre clientes, viaturas, histórico e orçamentos.");
  }

  const filled =
    Object.values(profile).filter((v) => v.trim()).length + (needs.length > 0 ? 2 : 0);
  const confidence: Recommendation["confidence"] =
    filled >= 6 ? "forte" : filled >= 3 ? "provavel" : "indicativa";

  const belowNote =
    plan === "free"
      ? null
      : plan === "pro"
        ? "No Start ficariam de fora as áreas assinaladas acima (ex.: faturação, relatórios, equipa)."
        : "No Pro ficariam de fora multi-oficina e automatizações.";

  const aboveNote =
    plan === "free"
      ? "O Pro faria sentido quando precisar de faturação, relatórios, agenda ou equipa com permissões."
      : plan === "pro"
        ? "O Garage acrescentaria multi-oficina e automatizações, se um dia crescer nesse sentido."
        : null;

  return { plan, confidence, reasons: reasons.slice(0, 4), belowNote, aboveNote };
}

export const CONFIDENCE_LABEL: Record<Recommendation["confidence"], string> = {
  forte: "Recomendação forte",
  provavel: "Recomendação provável",
  indicativa: "Indicação preliminar (pouca informação)",
};

// ── Resumo ────────────────────────────────────────────────────────────

export function buildSummary(state: SalesState, rec: Recommendation, price: string, nextStep: string): string {
  const lines: string[] = [];
  lines.push("GarageFlow — Resumo da demonstração");
  lines.push("");
  lines.push(`Oficina: ${state.profile.shopName || "—"}`);
  if (state.profile.people.trim()) lines.push(`Pessoas: ${state.profile.people}`);
  if (state.profile.users.trim()) lines.push(`Utilizadores: ${state.profile.users}`);
  if (state.profile.vehiclesMonth.trim()) lines.push(`Viaturas/mês: ${state.profile.vehiclesMonth}`);
  if (state.profile.currentSoftware.trim()) lines.push(`Software atual: ${state.profile.currentSoftware}`);
  lines.push("");
  lines.push("Necessidades:");
  lines.push(...(state.needs.length ? state.needs.map((n) => `- ${needLabel(n)}`) : ["- (não registadas)"]));
  lines.push("");
  lines.push("O que foi demonstrado:");
  lines.push(...(state.shown.length ? state.shown.map((s) => `- ${s}`) : ["- (não registado)"]));
  lines.push("");
  lines.push(`Plano recomendado: ${PLAN_LABEL[rec.plan]}${price ? ` — ${price}` : ""}`);
  lines.push(`(${CONFIDENCE_LABEL[rec.confidence]})`);
  lines.push("");
  lines.push("Motivos:");
  lines.push(...rec.reasons.map((r) => `- ${r}`));
  if (state.notes.trim()) {
    lines.push("");
    lines.push("Notas:");
    lines.push(state.notes.trim());
  }
  lines.push("");
  lines.push(`Próximo passo: ${nextStep}`);
  return lines.join("\n");
}
