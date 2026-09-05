/**
 * platformFinance — lógica financeira CENTRALIZADA da GarageFlow (Admin).
 *
 * Objetivo: um KPI = uma fórmula = um valor, em todo o Admin.
 * Regras não negociáveis:
 *  - Nunca inventar dados. Sem dados → NAO_DISPONIVEL.
 *  - Valores baseados em pressupostos → ESTIMATIVA.
 *  - Valores futuros → PROJECAO.
 *  - Receita real = subscrições Stripe confirmadas (mesma regra do AdminFinance).
 */

export type ValueSource = 'api' | 'database' | 'manual' | 'estimate' | 'projection' | 'unavailable';

export const SOURCE_LABEL: Record<ValueSource, string> = {
  api: 'API',
  database: 'BASE DE DADOS',
  manual: 'MANUAL',
  estimate: 'ESTIMATIVA',
  projection: 'PROJEÇÃO',
  unavailable: 'NÃO DISPONÍVEL',
};

export interface SubscriptionRow {
  shop_id: string;
  plan: string | null;
  status: string | null;
  trial_end?: string | null;
  updated_at: string;
  created_at: string;
  discount_percent?: number | null;
  stripe_subscription_id?: string | null;
  revenue_type?: string | null;
}

export interface ExpenseRow {
  id: string;
  description: string;
  category: string;
  subcategory: string | null;
  vendor: string | null;
  amount_net: number;
  vat_amount: number;
  amount_total: number;
  expense_date: string;
  is_recurring: boolean;
  frequency: string | null;
  next_due_date: string | null;
  payment_method: string | null;
  document_url: string | null;
  notes: string | null;
  source: string;
  cost_type: string;
  acquisition_channel: string | null;
  is_paid: boolean;
  paid_at: string | null;
  created_at: string;
}

/** Preços base por plano (EUR/mês). Mantém a mesma tabela usada no AdminFinance. */
export const PLAN_PRICE_EUR: Record<string, number> = { free: 0, start: 0, pro: 49, garage: 99 };

/** Regra única de "receita real": só Stripe confirmado conta. */
export function isRealPaidSubscription(s: SubscriptionRow): boolean {
  return (
    s.status === 'active' &&
    s.plan !== 'free' &&
    s.plan !== 'start' &&
    (s.revenue_type === 'stripe_paid' || !!s.stripe_subscription_id)
  );
}

export function subscriptionMrr(s: SubscriptionRow, priceMap: Record<string, number> = PLAN_PRICE_EUR): number {
  const base = priceMap[String(s.plan || '').toLowerCase()] ?? 0;
  const disc = s.discount_percent || 0;
  return base * (1 - disc / 100);
}

// ---------------------------------------------------------------- Categorias

export const EXPENSE_CATEGORIES: Record<string, { label: string; costType: 'operational' | 'growth'; subcategories: string[] }> = {
  technology: {
    label: 'Tecnologia',
    costType: 'operational',
    subcategories: ['Stripe', 'Supabase', 'APIs', 'Email', 'SMS', 'WhatsApp', 'Domínios', 'Software', 'Hosting', 'Cloud', 'Ferramentas SaaS', 'Serviços IA', 'Outros'],
  },
  marketing: {
    label: 'Marketing',
    costType: 'growth',
    subcategories: ['Google Ads', 'Meta Ads', 'TikTok Ads', 'LinkedIn Ads', 'SEO', 'Conteúdo', 'Design', 'Agência', 'Influenciadores', 'Outros'],
  },
  sales: {
    label: 'Vendas',
    costType: 'growth',
    subcategories: ['Comerciais', 'Comissões comerciais', 'Afiliados', 'Comissões afiliados', 'CRM', 'Prospecção', 'Ferramentas comerciais', 'Bónus', 'Outros'],
  },
  people: {
    label: 'Pessoal',
    costType: 'operational',
    subcategories: ['Salários', 'Segurança Social', 'Subsídio de alimentação', 'Freelancers', 'Prestadores de serviços', 'Outros encargos'],
  },
  admin: {
    label: 'Administração',
    costType: 'operational',
    subcategories: ['Contabilidade', 'Jurídico', 'Seguros', 'Bancos', 'Escritório', 'Telecomunicações', 'Equipamentos', 'Deslocações', 'Outros'],
  },
  taxes: {
    label: 'Impostos',
    costType: 'operational',
    subcategories: ['IVA', 'IRC', 'Outros impostos'],
  },
  other: {
    label: 'Outros custos',
    costType: 'operational',
    subcategories: ['Outros'],
  },
};

export const ACQUISITION_CHANNELS = [
  'google_ads', 'meta_ads', 'tiktok_ads', 'linkedin_ads', 'outbound', 'comerciais', 'afiliados', 'organico', 'referencias', 'outros',
] as const;

export const CHANNEL_LABEL: Record<string, string> = {
  google_ads: 'Google Ads',
  meta_ads: 'Meta Ads',
  tiktok_ads: 'TikTok Ads',
  linkedin_ads: 'LinkedIn Ads',
  outbound: 'Outbound',
  comerciais: 'Comerciais',
  afiliados: 'Afiliados',
  organico: 'Orgânico',
  referencias: 'Referências',
  outros: 'Outros',
};

export function categoryLabel(key: string): string {
  return EXPENSE_CATEGORIES[key]?.label || key;
}

// ------------------------------------------------------------------ Períodos

export type PeriodPreset =
  | 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'last_year' | 'custom';

export interface DateRange { from: string; to: string; label: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function resolvePeriod(preset: PeriodPreset, custom?: { from: string; to: string }): DateRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case 'today':
      return { from: iso(now), to: iso(now), label: 'Hoje' };
    case 'week': {
      const day = (now.getDay() + 6) % 7; // segunda = 0
      const start = new Date(y, m, now.getDate() - day);
      return { from: iso(start), to: iso(now), label: 'Esta semana' };
    }
    case 'month':
      return { from: iso(new Date(y, m, 1)), to: iso(now), label: 'Este mês' };
    case 'last_month':
      return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)), label: 'Mês anterior' };
    case 'quarter': {
      const q = Math.floor(m / 3);
      return { from: iso(new Date(y, q * 3, 1)), to: iso(now), label: 'Trimestre' };
    }
    case 'year':
      return { from: iso(new Date(y, 0, 1)), to: iso(now), label: 'Este ano' };
    case 'last_year':
      return { from: iso(new Date(y - 1, 0, 1)), to: iso(new Date(y - 1, 11, 31)), label: 'Ano anterior' };
    default:
      return { from: custom?.from || iso(new Date(y, m, 1)), to: custom?.to || iso(now), label: 'Período personalizado' };
  }
}

export function inRange(dateStr: string, range: DateRange): boolean {
  const d = dateStr.slice(0, 10);
  return d >= range.from && d <= range.to;
}

// ------------------------------------------------------------------ Despesas

export interface ExpenseBreakdownItem {
  key: string;
  label: string;
  total: number;
  net: number;
  vat: number;
  count: number;
  items: ExpenseRow[];
}

export interface ExpenseSummary {
  total: number;
  net: number;
  vat: number;
  recurring: number;      // total de despesas marcadas como recorrentes no período
  oneOff: number;
  operational: number;
  growth: number;
  paid: number;           // efetivamente pagas (caixa)
  unpaid: number;         // registadas mas por pagar (compromisso)
  byCategory: ExpenseBreakdownItem[];
  byChannel: ExpenseBreakdownItem[];
  count: number;
}

export function summariseExpenses(expenses: ExpenseRow[]): ExpenseSummary {
  const byCat = new Map<string, ExpenseRow[]>();
  const byCh = new Map<string, ExpenseRow[]>();
  let total = 0, net = 0, vat = 0, recurring = 0, oneOff = 0, operational = 0, growth = 0, paid = 0, unpaid = 0;

  for (const e of expenses) {
    const t = Number(e.amount_total) || 0;
    total += t;
    net += Number(e.amount_net) || 0;
    vat += Number(e.vat_amount) || 0;
    if (e.is_recurring) recurring += t; else oneOff += t;
    if (e.cost_type === 'growth') growth += t; else operational += t;
    if (e.is_paid) paid += t; else unpaid += t;
    byCat.set(e.category, [...(byCat.get(e.category) || []), e]);
    if (e.acquisition_channel) byCh.set(e.acquisition_channel, [...(byCh.get(e.acquisition_channel) || []), e]);
  }

  const build = (map: Map<string, ExpenseRow[]>, labelFn: (k: string) => string): ExpenseBreakdownItem[] =>
    Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        label: labelFn(key),
        total: items.reduce((s, x) => s + (Number(x.amount_total) || 0), 0),
        net: items.reduce((s, x) => s + (Number(x.amount_net) || 0), 0),
        vat: items.reduce((s, x) => s + (Number(x.vat_amount) || 0), 0),
        count: items.length,
        items,
      }))
      .sort((a, b) => b.total - a.total);

  return {
    total, net, vat, recurring, oneOff, operational, growth, paid, unpaid,
    byCategory: build(byCat, categoryLabel),
    byChannel: build(byCh, (k) => CHANNEL_LABEL[k] || k),
    count: expenses.length,
  };
}

/** Normaliza uma despesa recorrente para custo mensal equivalente. */
export function monthlyEquivalent(e: ExpenseRow): number {
  const t = Number(e.amount_total) || 0;
  if (!e.is_recurring) return 0;
  switch (e.frequency) {
    case 'monthly': return t;
    case 'quarterly': return t / 3;
    case 'yearly': return t / 12;
    case 'weekly': return t * 4.33;
    default: return t;
  }
}

/** Custo mensal para manter a GarageFlow (base: despesas recorrentes ativas). */
export interface MonthlyCostBreakdown {
  fixed: number;               // recorrentes normalizadas
  variable: number;            // média mensal das despesas pontuais dos últimos 3 meses
  total: number;
  operational: number;
  growth: number;
  byCategory: { key: string; label: string; monthly: number }[];
  perShop: number | null;      // null quando não há oficinas pagantes
  hasData: boolean;
}

export function computeMonthlyCost(allExpenses: ExpenseRow[], payingShops: number): MonthlyCostBreakdown {
  const recurringActive = allExpenses.filter(e => e.is_recurring);
  const fixed = recurringActive.reduce((s, e) => s + monthlyEquivalent(e), 0);

  // Custo variável: média mensal das despesas pontuais dos últimos 3 meses completos.
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1).toISOString().slice(0, 10);
  const oneOffRecent = allExpenses.filter(e => !e.is_recurring && e.expense_date >= cutoff);
  const variable = oneOffRecent.reduce((s, e) => s + (Number(e.amount_total) || 0), 0) / 3;

  const catMap = new Map<string, number>();
  for (const e of recurringActive) catMap.set(e.category, (catMap.get(e.category) || 0) + monthlyEquivalent(e));
  for (const e of oneOffRecent) catMap.set(e.category, (catMap.get(e.category) || 0) + (Number(e.amount_total) || 0) / 3);

  const operational =
    recurringActive.filter(e => e.cost_type !== 'growth').reduce((s, e) => s + monthlyEquivalent(e), 0) +
    oneOffRecent.filter(e => e.cost_type !== 'growth').reduce((s, e) => s + (Number(e.amount_total) || 0), 0) / 3;
  const growth =
    recurringActive.filter(e => e.cost_type === 'growth').reduce((s, e) => s + monthlyEquivalent(e), 0) +
    oneOffRecent.filter(e => e.cost_type === 'growth').reduce((s, e) => s + (Number(e.amount_total) || 0), 0) / 3;

  const total = fixed + variable;
  return {
    fixed, variable, total, operational, growth,
    byCategory: Array.from(catMap.entries())
      .map(([key, monthly]) => ({ key, label: categoryLabel(key), monthly }))
      .sort((a, b) => b.monthly - a.monthly),
    perShop: payingShops > 0 ? total / payingShops : null,
    hasData: allExpenses.length > 0,
  };
}

// ------------------------------------------------------------- Rentabilidade

export interface Profitability {
  revenue: number;
  costs: number;
  grossProfit: number;
  operatingResult: number;
  netProfitEstimate: number;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  hasData: boolean;
}

export function computeProfitability(revenue: number, monthly: MonthlyCostBreakdown, taxRate = 0.21): Profitability {
  const costs = monthly.total;
  const grossProfit = revenue - monthly.operational;
  const operatingResult = revenue - costs;
  const netProfitEstimate = operatingResult > 0 ? operatingResult * (1 - taxRate) : operatingResult;
  const pct = (v: number) => (revenue > 0 ? (v / revenue) * 100 : null);
  return {
    revenue, costs, grossProfit, operatingResult, netProfitEstimate,
    grossMargin: pct(grossProfit),
    operatingMargin: pct(operatingResult),
    netMargin: pct(netProfitEstimate),
    hasData: revenue > 0 || costs > 0,
  };
}

// ---------------------------------------------------------------- Break-even

export interface BreakEven {
  monthlyCost: number;
  arpu: number | null;
  contributionPerShop: number | null;
  shopsNeeded: number | null;
  revenueNeeded: number;
  currentShops: number;
  safetyMargin: number | null;   // % acima do break-even
  available: boolean;
}

export function computeBreakEven(monthlyCost: number, arpu: number | null, payingShops: number, variableCostPerShop = 0): BreakEven {
  const contribution = arpu !== null && arpu > 0 ? arpu - variableCostPerShop : null;
  const shopsNeeded = contribution && contribution > 0 ? Math.ceil(monthlyCost / contribution) : null;
  const currentRevenue = (arpu || 0) * payingShops;
  return {
    monthlyCost,
    arpu,
    contributionPerShop: contribution,
    shopsNeeded,
    revenueNeeded: monthlyCost,
    currentShops: payingShops,
    safetyMargin: monthlyCost > 0 ? ((currentRevenue - monthlyCost) / monthlyCost) * 100 : null,
    available: monthlyCost > 0 && contribution !== null && contribution > 0,
  };
}

// ------------------------------------------------------------------ CAC / LTV

export interface CacResult {
  cac: number | null;
  acquisitionSpend: number;
  newCustomers: number;
  byChannel: { channel: string; label: string; spend: number; customers: number | null; cac: number | null }[];
  available: boolean;
}

export function computeCac(expenses: ExpenseRow[], newCustomers: number): CacResult {
  const acq = expenses.filter(e => e.cost_type === 'growth');
  const acquisitionSpend = acq.reduce((s, e) => s + (Number(e.amount_total) || 0), 0);
  const chMap = new Map<string, number>();
  for (const e of acq) {
    const k = e.acquisition_channel || 'outros';
    chMap.set(k, (chMap.get(k) || 0) + (Number(e.amount_total) || 0));
  }
  return {
    cac: newCustomers > 0 && acquisitionSpend > 0 ? acquisitionSpend / newCustomers : null,
    acquisitionSpend,
    newCustomers,
    // Sem atribuição por canal na base de dados → clientes por canal fica NÃO DISPONÍVEL.
    byChannel: Array.from(chMap.entries())
      .map(([channel, spend]) => ({ channel, label: CHANNEL_LABEL[channel] || channel, spend, customers: null, cac: null }))
      .sort((a, b) => b.spend - a.spend),
    available: acquisitionSpend > 0 && newCustomers > 0,
  };
}

export function computeLtv(arpu: number | null, churnMonthlyPct: number, grossMarginPct: number | null): { ltv: number | null; ltvCac: (cac: number | null) => number | null } {
  const ltv = arpu && churnMonthlyPct > 0
    ? (arpu * ((grossMarginPct ?? 100) / 100)) / (churnMonthlyPct / 100)
    : null;
  return {
    ltv,
    ltvCac: (cac: number | null) => (ltv && cac && cac > 0 ? ltv / cac : null),
  };
}

// --------------------------------------------------------- Cash flow / caixa

export interface CashFlowMonth {
  month: string;
  inflow: number;        // caixa: pagamentos confirmados (aprox. MRR do mês)
  outflow: number;       // caixa: despesas pagas
  net: number;
  accrualRevenue: number;   // contabilístico
  accrualExpenses: number;  // contabilístico
  balance: number;
}

export function buildCashFlow(
  months: { month: string; mrr: number }[],
  expenses: ExpenseRow[],
  openingBalance: number,
): CashFlowMonth[] {
  let balance = openingBalance;
  return months.map(({ month, mrr }) => {
    const monthExpenses = expenses.filter(e => e.expense_date.slice(0, 7) === month);
    const outflowCash = monthExpenses.filter(e => e.is_paid).reduce((s, e) => s + (Number(e.amount_total) || 0), 0);
    const accrualExpenses = monthExpenses.reduce((s, e) => s + (Number(e.amount_total) || 0), 0);
    const net = mrr - outflowCash;
    balance += net;
    return { month, inflow: mrr, outflow: outflowCash, net, accrualRevenue: mrr, accrualExpenses, balance };
  });
}

export function computeRunway(availableCash: number | null, burnRateMonthly: number): number | null {
  if (availableCash === null || availableCash <= 0) return null;
  if (burnRateMonthly <= 0) return null; // sem burn (ou lucro) → não aplicável
  return availableCash / burnRateMonthly;
}

// ------------------------------------------------------------------- Projeção

export interface ProjectionAssumptions {
  arpu: number;
  monthlyGrowthPct: number;
  churnPct: number;
  cac: number;
  fixedCosts: number;
  variableCostPerShop: number;
  salesReps: number;
  costPerRep: number;
  marketingSpend: number;
  taxRate: number;
}

export const DEFAULT_ASSUMPTIONS: ProjectionAssumptions = {
  arpu: 49,
  monthlyGrowthPct: 10,
  churnPct: 3,
  cac: 150,
  fixedCosts: 0,
  variableCostPerShop: 0,
  salesReps: 0,
  costPerRep: 1500,
  marketingSpend: 0,
  taxRate: 21,
};

export interface ProjectionScenario {
  shops: number;
  mrr: number;
  arr: number;
  costs: number;
  profit: number;
  margin: number | null;
  costPerShop: number;
  breakEvenShops: number | null;
  cashFlow: number;
}

export function projectScenario(shops: number, a: ProjectionAssumptions): ProjectionScenario {
  const mrr = shops * a.arpu;
  const costs = a.fixedCosts + a.variableCostPerShop * shops + a.salesReps * a.costPerRep + a.marketingSpend;
  const profit = mrr - costs;
  const contribution = a.arpu - a.variableCostPerShop;
  const fixedPart = a.fixedCosts + a.salesReps * a.costPerRep + a.marketingSpend;
  return {
    shops,
    mrr,
    arr: mrr * 12,
    costs,
    profit,
    margin: mrr > 0 ? (profit / mrr) * 100 : null,
    costPerShop: shops > 0 ? costs / shops : 0,
    breakEvenShops: contribution > 0 ? Math.ceil(fixedPart / contribution) : null,
    cashFlow: profit > 0 ? profit * (1 - a.taxRate / 100) : profit,
  };
}

export const SCENARIO_SIZES = [50, 100, 200, 300, 500, 1000, 2000];

// ----------------------------------------------------- Distribuição (simulação)

export interface DistributionSimulation {
  knownCash: number | null;
  commitments: number;
  taxesEstimate: number;
  minReserve: number;
  potentiallyAvailable: number | null;
  available: boolean;
}

export function simulateDistribution(params: {
  knownCash: number | null;
  unpaidExpenses: number;
  upcomingRecurring: number;
  taxesEstimate: number;
  minReserve: number;
}): DistributionSimulation {
  const commitments = params.unpaidExpenses + params.upcomingRecurring;
  if (params.knownCash === null) {
    return { knownCash: null, commitments, taxesEstimate: params.taxesEstimate, minReserve: params.minReserve, potentiallyAvailable: null, available: false };
  }
  const potentially = params.knownCash - commitments - params.taxesEstimate - params.minReserve;
  return {
    knownCash: params.knownCash,
    commitments,
    taxesEstimate: params.taxesEstimate,
    minReserve: params.minReserve,
    potentiallyAvailable: Math.max(potentially, 0),
    available: true,
  };
}

// ------------------------------------------------------------------- Formatos

export function eur(v: number | null | undefined, digits = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `€${Number(v).toLocaleString('pt-PT', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return `${v.toFixed(digits)}%`;
}
