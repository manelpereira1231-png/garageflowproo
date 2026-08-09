import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * DINHEIRO EM JOGO — valor potencial associado a oportunidades REAIS já
 * existentes no sistema. Não é lucro e nada é inventado: cada linha tem
 * origem rastreável numa tabela existente (quotes, invoices/payments e
 * service_reminders). Reutiliza os dados que o ERP já grava — não cria
 * qualquer sistema financeiro paralelo.
 *
 * Origens:
 *  - Orçamentos pendentes  → quotes.status in (draft, sent) e ainda válidos
 *  - Pagamentos pendentes  → invoices (issued/partial) menos payments já recebidos
 *  - Clientes a recuperar  → service_reminders vencidos, estimados pelo ticket
 *                            médio real da própria oficina (0 se não houver histórico)
 *
 * SEMÂNTICA (não misturar):
 *  - confirmedTotal = valores financeiros REAIS já existentes (orçamentos + faturas por receber)
 *  - estimatedTotal = POTENCIAL ESTIMADO (revisões vencidas × ticket médio histórico)
 * Nunca somar os dois num único número apresentado como dinheiro garantido.
 */

export interface StakeQuote {
  id: string;
  number: string | null;
  total: number;
  validity_date: string | null;
  created_at: string;
  clientName: string | null;
}

export interface StakeInvoice {
  id: string;
  number: string | null;
  outstanding: number;
  due_date: string | null;
  overdue: boolean;
  clientName: string | null;
}

export interface StakeReminder {
  id: string;
  service_type: string | null;
  next_service_date: string | null;
  clientName: string | null;
  plate: string | null;
}

export interface MoneyAtStake {
  loading: boolean;
  /** Valor REAL: orçamentos pendentes + faturas por receber. */
  confirmedTotal: number;
  /** POTENCIAL ESTIMADO: revisões vencidas × ticket médio. Nunca somar ao confirmado. */
  estimatedTotal: number;
  quotesValue: number;
  paymentsValue: number;
  recoveryValue: number;
  avgTicket: number;
  quotes: StakeQuote[];
  invoices: StakeInvoice[];
  reminders: StakeReminder[];
  refresh: () => void;
}

const EMPTY: Omit<MoneyAtStake, "refresh"> = {
  loading: true,
  confirmedTotal: 0,
  estimatedTotal: 0,
  quotesValue: 0,
  paymentsValue: 0,
  recoveryValue: 0,
  avgTicket: 0,
  quotes: [],
  invoices: [],
  reminders: [],
};

export function useMoneyAtStake(shopIds: string[]): MoneyAtStake {
  const [state, setState] = useState(EMPTY);
  const key = shopIds.filter(Boolean).sort().join(",");

  const load = useCallback(async () => {
    const ids = key ? key.split(",") : [];
    if (ids.length === 0) {
      setState({ ...EMPTY, loading: false });
      return;
    }
    setState((s) => ({ ...s, loading: true }));
    const today = new Date().toISOString().slice(0, 10);

    const [quotesRes, invoicesRes, remindersRes, deliveredRes] = await Promise.all([
      supabase
        .from("quotes")
        .select("id, number, total, validity_date, created_at, clients(name)")
        .in("shop_id", ids)
        .in("status", ["draft", "sent"])
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("invoices")
        .select("id, number, total, due_date, clients(name)")
        .in("shop_id", ids)
        .in("status", ["issued", "partial"])
        .order("due_date", { ascending: true })
        .limit(200),
      supabase
        .from("service_reminders")
        .select("id, service_type, next_service_date, clients(name), vehicles(plate)")
        .in("shop_id", ids)
        .eq("status", "pending")
        .lt("next_service_date", today)
        .order("next_service_date", { ascending: true })
        .limit(200),
      supabase
        .from("work_orders")
        .select("total")
        .in("shop_id", ids)
        .in("status", ["completed", "delivered"])
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    // --- Orçamentos pendentes (ainda válidos) ---
    const quotes: StakeQuote[] = ((quotesRes.data as any[]) || [])
      .filter((q) => !q.validity_date || q.validity_date >= today)
      .map((q) => ({
        id: q.id,
        number: q.number ?? null,
        total: Number(q.total || 0),
        validity_date: q.validity_date ?? null,
        created_at: q.created_at,
        clientName: q.clients?.name ?? null,
      }));
    const quotesValue = quotes.reduce((s, q) => s + q.total, 0);

    // --- Pagamentos pendentes (fatura menos pagamentos registados) ---
    const rawInvoices = (invoicesRes.data as any[]) || [];
    let paidByInvoice = new Map<string, number>();
    if (rawInvoices.length > 0) {
      const { data: payments } = await supabase
        .from("payments")
        .select("invoice_id, amount")
        .in("invoice_id", rawInvoices.map((i) => i.id));
      (payments || []).forEach((p: any) => {
        paidByInvoice.set(p.invoice_id, (paidByInvoice.get(p.invoice_id) || 0) + Number(p.amount || 0));
      });
    }
    const invoices: StakeInvoice[] = rawInvoices
      .map((i) => ({
        id: i.id,
        number: i.number ?? null,
        outstanding: Math.max(0, Number(i.total || 0) - (paidByInvoice.get(i.id) || 0)),
        due_date: i.due_date ?? null,
        overdue: !!i.due_date && i.due_date < today,
        clientName: i.clients?.name ?? null,
      }))
      .filter((i) => i.outstanding > 0);
    const paymentsValue = invoices.reduce((s, i) => s + i.outstanding, 0);

    // --- Clientes a recuperar (revisões em atraso) ---
    const deliveredTotals = ((deliveredRes.data as any[]) || []).map((o) => Number(o.total || 0)).filter((n) => n > 0);
    const avgTicket = deliveredTotals.length > 0
      ? deliveredTotals.reduce((s, n) => s + n, 0) / deliveredTotals.length
      : 0;
    const reminders: StakeReminder[] = ((remindersRes.data as any[]) || []).map((r) => ({
      id: r.id,
      service_type: r.service_type ?? null,
      next_service_date: r.next_service_date ?? null,
      clientName: r.clients?.name ?? null,
      plate: r.vehicles?.plate ?? null,
    }));
    // Sem histórico → 0. Nunca inventamos um valor de referência.
    const recoveryValue = avgTicket > 0 ? reminders.length * avgTicket : 0;

    setState({
      loading: false,
      confirmedTotal: quotesValue + paymentsValue,
      estimatedTotal: recoveryValue,
      quotesValue,
      paymentsValue,
      recoveryValue,
      avgTicket,
      quotes,
      invoices,
      reminders,
    });
  }, [key]);

  useEffect(() => { void load(); }, [load]);

  return { ...state, refresh: load };
}
