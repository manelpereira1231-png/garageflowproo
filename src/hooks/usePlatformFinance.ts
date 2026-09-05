/**
 * usePlatformFinance — fonte ÚNICA de dados do Centro Financeiro do Admin.
 *
 * Reutiliza dados que já existem (subscriptions, shops, market_escrow) e junta
 * as despesas/definições da plataforma. Tolerante a falhas: se o Stripe falhar,
 * o resto continua a funcionar com os dados da base de dados.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  type ExpenseRow, type SubscriptionRow, type DateRange, type ProjectionAssumptions,
  DEFAULT_ASSUMPTIONS, isRealPaidSubscription, subscriptionMrr, summariseExpenses,
  classifySubscription, hasActivePlanAccess, contractedMonthlyValue,
  computeMonthlyCost, computeProfitability, computeBreakEven, computeCac, computeLtv,
  buildCashFlow, computeRunway, simulateDistribution, inRange, monthlyEquivalent,
} from "@/lib/platformFinance";

export interface StripeFinancials {
  ok: boolean;
  error?: string;
  syncedAt?: string;
  balanceAvailable?: number;
  balancePending?: number;
  chargesTotal?: number;
  chargesCount?: number;
  failedCount?: number;
  failedAmount?: number;
  refundsTotal?: number;
  refundsCount?: number;
  disputesCount?: number;
  disputesAmount?: number;
  fees?: number;
  revenueByMonth?: Record<string, number>;
}

export interface FinanceSettings {
  id?: string;
  min_cash_reserve: number;
  known_bank_balance: number | null;
  known_bank_balance_updated_at: string | null;
  assumptions: Partial<ProjectionAssumptions>;
  alert_thresholds: Record<string, number>;
}

const DEFAULT_SETTINGS: FinanceSettings = {
  min_cash_reserve: 0,
  known_bank_balance: null,
  known_bank_balance_updated_at: null,
  assumptions: {},
  alert_thresholds: { cacIncreasePct: 20, mrrDropPct: 10, expenseIncreasePct: 25, churnPct: 5, runwayMonths: 6, marginDropPct: 10 },
};

export function usePlatformFinance(range: DateRange) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<{ id: string; name: string; country: string | null; created_at: string; is_demo?: boolean | null }[]>([]);
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [settings, setSettings] = useState<FinanceSettings>(DEFAULT_SETTINGS);
  const [stripe, setStripe] = useState<StripeFinancials | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [demoShopIds, setDemoShopIds] = useState<Set<string>>(new Set());

  const loadCore = useCallback(async () => {
    setLoading(true);
    try {
      const [shopsRes, demoRes, subsRes, expRes, setRes] = await Promise.all([
        supabase.from("shops").select("id, name, country, created_at, is_demo").eq("is_demo", false),
        supabase.from("shops").select("id").eq("is_demo", true),
        supabase.from("subscriptions").select("shop_id, plan, status, trial_end, updated_at, created_at, discount_percent, stripe_subscription_id, revenue_type"),
        supabase.from("platform_expenses").select("*").order("expense_date", { ascending: false }),
        supabase.from("platform_finance_settings").select("*").limit(1).maybeSingle(),
      ]);
      setDemoShopIds(new Set((demoRes.data || []).map((r: any) => r.id)));
      if (shopsRes.data) setShops(shopsRes.data as any);
      if (subsRes.data) setSubs(subsRes.data as any);
      if (expRes.data) setExpenses(expRes.data as any);
      if (setRes.data) {
        setSettings({
          id: (setRes.data as any).id,
          min_cash_reserve: Number((setRes.data as any).min_cash_reserve) || 0,
          known_bank_balance: (setRes.data as any).known_bank_balance !== null ? Number((setRes.data as any).known_bank_balance) : null,
          known_bank_balance_updated_at: (setRes.data as any).known_bank_balance_updated_at,
          assumptions: (setRes.data as any).assumptions || {},
          alert_thresholds: { ...DEFAULT_SETTINGS.alert_thresholds, ...((setRes.data as any).alert_thresholds || {}) },
        });
      }
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Falha ao carregar dados financeiros");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStripe = useCallback(async () => {
    setStripeLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke<StripeFinancials>("admin-stripe-balance");
      if (fnError) throw fnError;
      setStripe(data ?? { ok: false, error: "sem resposta" });
    } catch (e: any) {
      // Nunca substituir dados por zeros por causa de uma falha de API.
      setStripe(prev => prev ?? { ok: false, error: e?.message || "indisponível" });
    } finally {
      setStripeLoading(false);
    }
  }, []);

  useEffect(() => { void loadCore(); void loadStripe(); }, [loadCore, loadStripe]);

  // ------------------------------------------------------------ Derivados
  const metrics = useMemo(() => {
    const isDemo = (s: SubscriptionRow) => demoShopIds.has(s.shop_id);
    const paying = subs.filter(s => isRealPaidSubscription(s, { isDemoShop: isDemo(s) }));
    const mrr = paying.reduce((s, x) => s + subscriptionMrr(x), 0);
    const payingCustomers = paying.length;
    const arpu = payingCustomers > 0 ? mrr / payingCustomers : null;

    // Valor de tabela contratado (acesso ativo, com ou sem pagamento) — NÃO é receita.
    const accessSubs = subs.filter(s => !isDemo(s) && hasActivePlanAccess(s));
    const contractedMonthly = accessSubs.reduce((sum, s) => sum + contractedMonthlyValue(s), 0);
    const nonPaying = accessSubs.filter(s => !isRealPaidSubscription(s, { isDemoShop: false }));
    const classCounts = accessSubs.reduce<Record<string, number>>((acc, s) => {
      const k = classifySubscription(s, { isDemoShop: false });
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});

    const newSubsInPeriod = paying.filter(s => inRange(s.created_at, range)).length;
    const cancelledInPeriod = subs.filter(s =>
      (s.status === "canceled" || s.status === "cancelled") && !!s.stripe_subscription_id && inRange(s.updated_at, range)).length;

    // Churn mensal (últimos 60 dias / 2) — mesma metodologia da página Receita.
    const sixty = Date.now() - 60 * 86400000;
    const cancelled60 = subs.filter(s =>
      (s.status === "canceled" || s.status === "cancelled") && !!s.stripe_subscription_id && new Date(s.updated_at).getTime() > sixty).length;
    const churnMonthly = payingCustomers > 0 ? (cancelled60 / 2 / payingCustomers) * 100 : 0;

    // Receita por plano
    const byPlan = new Map<string, { mrr: number; count: number }>();
    for (const s of paying) {
      const k = String(s.plan || "—");
      const cur = byPlan.get(k) || { mrr: 0, count: 0 };
      byPlan.set(k, { mrr: cur.mrr + subscriptionMrr(s), count: cur.count + 1 });
    }

    // MRR mensal dos últimos 12 meses (subs Stripe ativas criadas até ao fim do mês)
    const monthly: { month: string; label: string; mrr: number; new: number; churn: number }[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const key = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
      const monthMrr = paying
        .filter(s => new Date(s.created_at).getTime() <= mEnd.getTime())
        .reduce((sum, s) => sum + subscriptionMrr(s), 0);
      monthly.push({
        month: key,
        label: m.toLocaleDateString("pt-PT", { month: "short" }),
        mrr: Math.round(monthMrr),
        new: paying.filter(s => s.created_at.slice(0, 7) === key).length,
        churn: subs.filter(s => (s.status === "canceled" || s.status === "cancelled") && s.updated_at.slice(0, 7) === key).length,
      });
    }

    const periodExpenses = expenses.filter(e => inRange(e.expense_date, range));
    const expenseSummary = summariseExpenses(periodExpenses);
    const monthlyCost = computeMonthlyCost(expenses, payingCustomers);
    const profitability = computeProfitability(mrr, monthlyCost);
    const breakEven = computeBreakEven(monthlyCost.total, arpu, payingCustomers);
    const cac = computeCac(periodExpenses, newSubsInPeriod);
    const { ltv, ltvCac } = computeLtv(arpu, churnMonthly, profitability.grossMargin);

    const openingBalance = settings.known_bank_balance ?? 0;
    const cashFlow = buildCashFlow(monthly.map(m => ({ month: m.month, mrr: m.mrr })), expenses, openingBalance);

    const stripeBalance = stripe?.ok ? (stripe.balanceAvailable ?? 0) : null;
    const knownCash =
      settings.known_bank_balance !== null || stripeBalance !== null
        ? (settings.known_bank_balance ?? 0) + (stripeBalance ?? 0)
        : null;

    const burnRate = Math.max(monthlyCost.total - mrr, 0);
    const runway = computeRunway(knownCash, burnRate);

    const upcomingRecurring = expenses.filter(e => e.is_recurring).reduce((s, e) => s + monthlyEquivalent(e), 0);
    const distribution = simulateDistribution({
      knownCash,
      unpaidExpenses: expenses.filter(e => !e.is_paid).reduce((s, e) => s + (Number(e.amount_total) || 0), 0),
      upcomingRecurring,
      taxesEstimate: profitability.operatingResult > 0 ? profitability.operatingResult * 0.21 : 0,
      minReserve: settings.min_cash_reserve,
    });

    // IVA
    const vatCharged = 0; // faturação SaaS via Stripe — não disponível na BD interna
    const vatOnExpenses = periodExpenses.reduce((s, e) => s + (Number(e.vat_amount) || 0), 0);

    const assumptions: ProjectionAssumptions = {
      ...DEFAULT_ASSUMPTIONS,
      arpu: arpu ?? DEFAULT_ASSUMPTIONS.arpu,
      fixedCosts: monthlyCost.fixed || DEFAULT_ASSUMPTIONS.fixedCosts,
      churnPct: churnMonthly || DEFAULT_ASSUMPTIONS.churnPct,
      cac: cac.cac ?? DEFAULT_ASSUMPTIONS.cac,
      ...settings.assumptions,
    };

    return {
      mrr, arr: mrr * 12, arpu, payingCustomers, newSubsInPeriod, cancelledInPeriod, churnMonthly,
      trialing: subs.filter(s => s.status === "trialing" && !!s.stripe_subscription_id).length,
      byPlan: Array.from(byPlan.entries()).map(([plan, v]) => ({ plan, ...v })).sort((a, b) => b.mrr - a.mrr),
      monthly, periodExpenses, expenseSummary, monthlyCost, profitability, breakEven,
      cac, ltv, ltvCacRatio: ltvCac(cac.cac), cashFlow, knownCash, stripeBalance, burnRate, runway,
      distribution, vatCharged, vatOnExpenses, assumptions, totalShops: shops.length,
    };
  }, [subs, expenses, shops, settings, stripe, range]);

  return {
    loading, error, expenses, settings, stripe, stripeLoading, metrics, shops,
    reload: loadCore, reloadStripe: loadStripe, setSettingsLocal: setSettings,
  };
}
