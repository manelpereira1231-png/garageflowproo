/**
 * Sinistros v2 — fases calculadas, próximo passo e prazos legais (PT).
 * A coluna `claims.status` continua a ser a fonte persistida; a fase é derivada.
 */

export type RepairPhase = "entrada" | "peritagem" | "autorizacao" | "reparacao" | "faturacao" | "fechado";
export const REPAIR_PHASES: RepairPhase[] = ["entrada", "peritagem", "autorizacao", "reparacao", "faturacao", "fechado"];
export const REPAIR_PHASE_LABELS: Record<RepairPhase, string> = {
  entrada: "Entrada", peritagem: "Peritagem", autorizacao: "Autorização",
  reparacao: "Reparação", faturacao: "Faturação", fechado: "Fechado",
};
export const TOTAL_LOSS_PHASES = ["entrada", "peritagem", "perda_total", "decisao", "encargos", "fechado"] as const;
export type TotalLossPhase = (typeof TOTAL_LOSS_PHASES)[number];
export const TOTAL_LOSS_PHASE_LABELS: Record<TotalLossPhase, string> = {
  entrada: "Entrada", peritagem: "Peritagem", perda_total: "Perda total",
  decisao: "Decisão do cliente", encargos: "Encargos", fechado: "Fechado",
};

/** Mapeamento dos estados antigos (19 + legados) para as 6 fases. */
export const STATUS_TO_PHASE: Record<string, RepairPhase> = {
  new: "entrada", waiting_data: "entrada", reported: "entrada", waiting_docs: "entrada",
  waiting_expert: "peritagem", expert_scheduled: "peritagem", expert_done: "peritagem",
  quote_preparing: "autorizacao", quote_sent: "autorizacao", changes_requested: "autorizacao",
  waiting_authorization: "autorizacao", waiting_approval: "autorizacao", approved: "autorizacao",
  partially_approved: "autorizacao", rejected: "autorizacao",
  repairing: "reparacao", waiting_parts: "reparacao",
  repair_done: "faturacao", waiting_invoice: "faturacao", invoiced: "faturacao", waiting_payment: "faturacao", paid: "faturacao",
  done: "fechado", cancelled: "fechado",
};
/** Estado persistido representativo de cada fase (usado no avanço automático). */
export const PHASE_TO_STATUS: Record<RepairPhase, string> = {
  entrada: "new", peritagem: "waiting_expert", autorizacao: "waiting_authorization",
  reparacao: "repairing", faturacao: "waiting_invoice", fechado: "done",
};

export type Sup = { id: string; type: string; number: number | null; description: string; amount_requested: number; amount_approved: number | null; status: string; requested_at: string; decided_at?: string | null };
export const isPendingSup = (s: Sup) => s.status === "pending" || s.status === "no_perito";
export const authorizedTotal = (sups: Sup[]) =>
  sups.filter((s) => s.status === "approved" || s.status === "partial").reduce((t, s) => t + Number(s.amount_approved || 0), 0);

export type PhaseCtx = { sups: Sup[]; woDone?: boolean; billedAndPaid?: boolean };

/** Fase de reparação calculada a partir dos eventos; só avança, nunca recua. */
export function computeRepairPhase(claim: any, ctx: PhaseCtx): RepairPhase {
  if (claim.phase_override && REPAIR_PHASES.includes(claim.phase_override)) return claim.phase_override;
  const base = STATUS_TO_PHASE[claim.status] || "entrada";
  if (base === "fechado") return "fechado";
  let idx = REPAIR_PHASES.indexOf(base);
  const bump = (p: RepairPhase) => { idx = Math.max(idx, REPAIR_PHASES.indexOf(p)); };
  const initial = ctx.sups.find((s) => s.type === "inicial");
  if (initial && (initial.status === "approved" || initial.status === "partial")) bump("reparacao");
  if (ctx.woDone) bump("faturacao");
  if (ctx.billedAndPaid) bump("fechado");
  // adicional pendente prende o processo em Autorização (exceto se já faturado/fechado)
  if (ctx.sups.some((s) => s.type === "adicional" && isPendingSup(s)) && idx < REPAIR_PHASES.indexOf("faturacao")) {
    idx = REPAIR_PHASES.indexOf("autorizacao");
  }
  return REPAIR_PHASES[idx];
}

export function computeTotalLossPhase(claim: any): TotalLossPhase {
  if (claim.status === "done" || claim.status === "cancelled") return "fechado";
  if (claim.client_decision && claim.client_decision !== "pending") return "encargos";
  return "decisao";
}

/** Badge do cabeçalho. */
export function phaseBadge(claim: any, phase: string, sups: Sup[], isBR: boolean): { label: string; tone: "amber" | "blue" | "red" | "green" | "gray" } {
  if (claim.status === "cancelled") return { label: "Cancelado", tone: "gray" };
  if (claim.outcome === "perda_total") return phase === "fechado" ? { label: "Fechado", tone: "green" } : { label: "Perda total", tone: "red" };
  if (sups.some(isPendingSup) && phase === "autorizacao") return { label: "À espera do perito", tone: "amber" };
  if (phase === "reparacao") return { label: claim.status === "waiting_parts" ? (isBR ? "Aguardando peças" : "A aguardar peças") : "Em reparação", tone: "blue" };
  if (phase === "peritagem") return { label: "Peritagem", tone: "amber" };
  if (phase === "autorizacao") return { label: "À espera de autorização", tone: "amber" };
  if (phase === "faturacao") return { label: isBR ? "Emissão de nota fiscal" : "Faturação", tone: "blue" };
  if (phase === "fechado") return { label: "Fechado", tone: "green" };
  return { label: "Entrada", tone: "gray" };
}

const ddmm = (d: string | Date, loc: string) => new Date(d).toLocaleDateString(loc, { day: "2-digit", month: "2-digit" });

export function nextStep(claim: any, phase: string, sups: Sup[], links: { supplement_id: string | null; created_at: string; audience: string }[], isBR: boolean): string {
  const loc = isBR ? "pt-BR" : "pt-PT";
  const pend = sups.filter(isPendingSup).sort((a, b) => (a.number || 0) - (b.number || 0))[0];
  if (pend && claim.outcome !== "perda_total") {
    const label = pend.type === "inicial" ? "o orçamento inicial" : `o adicional #${pend.number ?? ""}`;
    const l = links.find((x) => x.audience === "perito" && x.supplement_id === pend.id);
    return l ? `perito validar ${label} (link enviado ${ddmm(l.created_at, loc)})` : `enviar ${label} ao perito para validação`;
  }
  if (claim.outcome === "perda_total") {
    if (phase === "decisao") return "registar a decisão do cliente sobre a perda total";
    if (phase === "encargos") return isBR ? "emitir a nota fiscal de encargos" : "emitir a fatura de encargos";
    return "processo encerrado";
  }
  switch (phase) {
    case "entrada": return claim.insurer_id ? "marcar a peritagem com a seguradora" : "indicar a seguradora do sinistro";
    case "peritagem": return claim.expert_date ? `peritagem marcada para ${ddmm(claim.expert_date, loc)}` : "registar a data da peritagem";
    case "autorizacao": return sups.some((s) => s.type === "inicial") ? "aguardar a decisão da seguradora" : "registar a autorização inicial da seguradora";
    case "reparacao": return claim.work_order_id ? "concluir a reparação na ordem de serviço" : "criar a ordem de serviço da reparação";
    case "faturacao": return isBR ? "emitir as notas fiscais à seguradora e ao cliente" : "emitir as faturas à seguradora e ao cliente";
    default: return "processo encerrado";
  }
}

/* ---------------- Dias úteis em Portugal ---------------- */

function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(y, month - 1, day));
}
const key = (d: Date) => d.toISOString().slice(0, 10);
const holidayCache: Record<number, Set<string>> = {};
export function ptHolidays(y: number): Set<string> {
  if (holidayCache[y]) return holidayCache[y];
  const e = easter(y);
  const add = (n: number) => key(new Date(e.getTime() + n * 86400000));
  const fixed = ["01-01", "04-25", "05-01", "06-10", "08-15", "10-05", "11-01", "12-01", "12-08", "12-25"].map((md) => `${y}-${md}`);
  return (holidayCache[y] = new Set([...fixed, add(-2), add(0), add(60)]));
}
const toUTC = (s: string | Date) => { const d = new Date(s); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };
export const isBusinessDay = (d: Date) => { const w = d.getUTCDay(); return w !== 0 && w !== 6 && !ptHolidays(d.getUTCFullYear()).has(key(d)); };
export function addBusinessDays(start: string | Date, n: number): Date {
  let d = toUTC(start); let left = n;
  while (left > 0) { d = new Date(d.getTime() + 86400000); if (isBusinessDay(d)) left--; }
  return d;
}
/** Dias úteis entre hoje e o limite (positivo = faltam; negativo = atraso). */
export function businessDaysUntil(limit: Date, today = new Date()): number {
  const t = toUTC(today);
  if (key(t) === key(limit)) return 0;
  const sign = limit > t ? 1 : -1; let d = t; let n = 0;
  while (key(d) !== key(limit)) { d = new Date(d.getTime() + sign * 86400000); if (isBusinessDay(d)) n += sign; }
  return n;
}

export type Deadline = { id: string; name: string; rule: string; limit: Date | null; doneAt: string | null; field?: string };
/** Prazos do DL 291/2007 (art. 36.º e 43.º) — apenas para oficinas de Portugal. */
export function ptDeadlines(claim: any, sups: Sup[]): Deadline[] {
  const daaa = !!claim.has_daaa, dis = !!claim.requires_disassembly;
  const part = claim.report_date || claim.claim_date || (claim.created_at ? String(claim.created_at).slice(0, 10) : null);
  const firstLimit = part ? addBusinessDays(part, 2) : null;
  const expN = daaa ? (dis ? 6 : 4) : (dis ? 12 : 8);
  const repN = daaa ? 2 : 4;
  const libN = daaa ? 15 : 30;
  const paidAt = ["paid", "done"].includes(claim.status) ? (claim.closed_at ? String(claim.closed_at).slice(0, 10) : String(claim.updated_at || "").slice(0, 10)) : null;
  const list: Deadline[] = [
    { id: "first", name: "Primeiro contacto e marcação da peritagem", rule: "2 dias úteis após a participação", limit: firstLimit, doneAt: claim.first_contact_at, field: "first_contact_at" },
    { id: "expert", name: "Peritagem concluída", rule: `${expN} dias úteis após o 1.º contacto${dis ? " (com desmontagem)" : ""}`, limit: firstLimit ? addBusinessDays(firstLimit, expN) : null, doneAt: claim.expert_done_date, field: "expert_done_date" },
    { id: "report", name: "Relatório de peritagem disponível", rule: `${repN} dias úteis após a peritagem`, limit: claim.expert_done_date ? addBusinessDays(claim.expert_done_date, repN) : null, doneAt: claim.expert_report_at, field: "expert_report_at" },
    { id: "liability", name: "Assumir ou recusar responsabilidade", rule: `${libN} dias úteis após o 1.º contacto`, limit: firstLimit ? addBusinessDays(firstLimit, libN) : null, doneAt: claim.liability_assumed_at, field: "liability_assumed_at" },
    { id: "payment", name: "Pagamento", rule: "8 dias úteis após assumir a responsabilidade", limit: claim.liability_assumed_at ? addBusinessDays(claim.liability_assumed_at, 8) : null, doneAt: paidAt },
  ];
  for (const s of sups.filter((x) => x.type === "adicional")) {
    list.push({ id: `sup-${s.id}`, name: `Validar adicional #${s.number ?? ""}`, rule: "2 dias úteis após o pedido (prazo interno)", limit: addBusinessDays(s.requested_at, 2), doneAt: isPendingSup(s) ? null : (s.decided_at || s.requested_at) });
  }
  return list;
}
export function deadlineState(d: Deadline): { tone: "green" | "amber" | "red" | "gray"; label: string; overdue: boolean; dueSoon: boolean } {
  if (d.doneAt) return { tone: "green", label: `Cumprido ${new Date(d.doneAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}`, overdue: false, dueSoon: false };
  if (!d.limit) return { tone: "gray", label: "A aguardar início", overdue: false, dueSoon: false };
  const n = businessDaysUntil(d.limit);
  if (n < 0) return { tone: "red", label: `Atrasado ${-n} ${-n === 1 ? "dia" : "dias"}`, overdue: true, dueSoon: false };
  if (n <= 2) return { tone: "amber", label: n === 0 ? "Termina hoje" : `Faltam ${n} ${n === 1 ? "dia" : "dias"}`, overdue: false, dueSoon: true };
  return { tone: "gray", label: `Até ${d.limit.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}`, overdue: false, dueSoon: false };
}
export const claimHasOverdue = (claim: any, sups: Sup[]) =>
  claim.status !== "done" && claim.status !== "cancelled" && ptDeadlines(claim, sups).some((d) => deadlineState(d).overdue);

/** Mensagem simples ao cliente para cada fase. */
export function clientMessageForPhase(phase: string, isBR: boolean, hasPendingSup: boolean): string {
  const car = isBR ? "o seu veículo" : "a sua viatura";
  if (hasPendingSup) return "Ao desmontar encontrámos danos adicionais. Já pedimos aprovação à seguradora e avisamos assim que houver resposta.".replace("encontrámos", isBR ? "encontramos" : "encontrámos").replace("pedimos", "pedimos");
  const m: Record<string, string> = {
    entrada: `Recebemos ${car} e abrimos o processo junto da seguradora.`,
    peritagem: `${isBR ? "O" : "O"} perito da seguradora vai avaliar os danos de ${car}. Avisamos logo que haja novidades.`,
    autorizacao: "A peritagem está feita. Estamos a aguardar a autorização da seguradora para iniciar a reparação.",
    reparacao: `A seguradora autorizou a reparação. ${isBR ? "Já estamos reparando" : "Já estamos a reparar"} ${car}.`,
    faturacao: `A reparação está concluída. ${car.charAt(0).toUpperCase() + car.slice(1)} está ${isBR ? "pronto" : "pronta"} para levantar.`,
    fechado: "O processo do sinistro está encerrado. Obrigado pela confiança.",
    decisao: "O perito declarou perda total. Precisamos da sua decisão sobre o que fazer com a viatura.",
    encargos: "Registámos a sua decisão. Vamos tratar dos encargos e do fecho do processo.",
  };
  let msg = m[phase] || m.entrada;
  if (isBR) msg = msg.replace("Estamos a aguardar", "Estamos aguardando").replace("Registámos", "Registramos").replace("levantar", "retirar").replace("viatura", "veículo");
  return msg;
}
