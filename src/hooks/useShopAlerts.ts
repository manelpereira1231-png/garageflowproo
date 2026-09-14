/**
 * FONTE ÚNICA DE VERDADE dos Alertas da oficina.
 *
 * Dashboard, badge do menu e página /alerts consomem EXATAMENTE este hook:
 * mesma query, mesmos estados, mesmos links, mesmo lido/não lido.
 *
 * FILOSOFIA
 * - Alerta = problema, risco ou ação que merece atenção. Nunca um log.
 * - Cada alerta abre SEMPRE o objeto exato que lhe deu origem.
 * - Cada situação real gera UM alerta (nunca um por dia). Como os alertas
 *   derivados são calculados a partir do estado atual, desaparecem sozinhos
 *   quando a situação é resolvida (fatura paga, stock reposto, etc.).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { resolveAlertLink } from "@/lib/alertLink";

export type AlertStatus = "pending" | "sent" | "resolved" | "dismissed";
/** critical = a oficina está a perder dinheiro/parada; high = precisa de ação; low = vigiar. */
export type AlertPriority = "critical" | "high" | "low";

export type UnifiedAlert = {
  id: string;
  derived: boolean;
  type: string;
  title: string;
  /** Linha curta de contexto: entidade + identificação. */
  subtitle: string | null;
  /** Linha curta de detalhe: valor, prazo, estado. */
  message: string | null;
  priority: AlertPriority;
  status: AlertStatus;
  read: boolean;
  createdAt: string;
  dueDate: string | null;
  clientId: string | null;
  vehicleId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  make: string | null;
  model: string | null;
  plate: string | null;
  link: string | null;
  raw: any;
};

const DERIVED_READ_KEY = "garageflow_derived_alerts_read";

function readDerivedRead(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(DERIVED_READ_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDerivedRead(map: Record<string, string>) {
  try {
    localStorage.setItem(DERIVED_READ_KEY, JSON.stringify(map));
  } catch {
    /* storage indisponível — o alerta apenas continua por ler */
  }
}

const money = (v: any) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(Number(v || 0));

const daysSince = (iso: string | null | undefined) => {
  if (!iso) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
};

const dayLabel = (n: number) => (n === 1 ? "há 1 dia" : `há ${n} dias`);

function normalizePriority(p: any): AlertPriority {
  const v = String(p || "").toLowerCase();
  if (v === "critical" || v === "urgent") return "critical";
  if (v === "low") return "low";
  return "high";
}

/** Base comum de um alerta derivado — evita repetir 15 campos por caso. */
function derivedAlert(a: Partial<UnifiedAlert> & { id: string; type: string; title: string }): UnifiedAlert {
  return {
    derived: true,
    subtitle: null,
    message: null,
    priority: "high",
    status: "pending",
    read: false,
    createdAt: new Date().toISOString(),
    dueDate: null,
    clientId: null,
    vehicleId: null,
    clientName: null,
    clientPhone: null,
    clientEmail: null,
    make: null,
    model: null,
    plate: null,
    link: null,
    raw: null,
    ...a,
  } as UnifiedAlert;
}

function mapRow(row: any): UnifiedAlert {
  const client = row.clients || null;
  const vehicle = row.vehicles || null;
  const base = {
    type: row.type,
    title: row.title,
    message: row.message ?? null,
    clientName: client?.name ?? null,
    plate: vehicle?.plate ?? null,
  };
  const parts = [client?.name, vehicle?.plate].filter(Boolean);
  return {
    id: row.id,
    derived: false,
    type: row.type,
    title: row.title,
    subtitle: parts.length ? parts.join(" · ") : null,
    message: row.message ?? null,
    priority: normalizePriority(row.priority),
    status: (row.status || "pending") as AlertStatus,
    read: Boolean(row.read_at),
    createdAt: row.created_at,
    dueDate: row.due_date ?? null,
    clientId: row.client_id ?? null,
    vehicleId: row.vehicle_id ?? null,
    clientName: client?.name ?? null,
    clientPhone: client?.phone ?? null,
    clientEmail: client?.email ?? null,
    make: vehicle?.make ?? null,
    model: vehicle?.model ?? null,
    plate: vehicle?.plate ?? null,
    link: resolveAlertLink(base),
    raw: row,
  };
}

const today = () => new Date().toISOString().slice(0, 10);

export function useShopAlerts(options?: { shopIds?: string[] | null }) {
  const { activeShopId, shops } = useShopContext();
  const contextIds = useMemo(
    () => (activeShopId ? [activeShopId] : (shops || []).map((s) => s.id)),
    [activeShopId, shops],
  );
  const shopIds = options?.shopIds && options.shopIds.length ? options.shopIds : contextIds;
  const idsKey = shopIds.join(",");

  const [rows, setRows] = useState<UnifiedAlert[]>([]);
  const [derived, setDerived] = useState<UnifiedAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [derivedRead, setDerivedRead] = useState<Record<string, string>>(() => readDerivedRead());

  const load = useCallback(async () => {
    const ids = idsKey ? idsKey.split(",") : [];
    if (!ids.length) {
      setRows([]);
      setDerived([]);
      setLoading(false);
      return;
    }

    const [alertsRes, partsRes, overdueRes, apptRes, ordersRes, quotesRes] = await Promise.all([
      supabase
        .from("alerts")
        .select("*, clients(name, phone, email), vehicles(make, model, plate)")
        .in("shop_id", ids)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("parts")
        .select("id, name, reference, stock_quantity, min_stock")
        .in("shop_id", ids)
        .eq("active", true),
      supabase
        .from("invoices")
        .select("id, number, total, due_date, clients(name)")
        .in("shop_id", ids)
        .in("status", ["issued", "partial"])
        .lt("due_date", today()),
      supabase
        .from("appointments")
        .select("id, date, time, service_type, status, source, client_name, clients(name)")
        .in("shop_id", ids)
        .eq("status", "pending")
        .order("date", { ascending: true })
        .limit(30),
      supabase
        .from("work_orders")
        .select("id, number, status, created_at, completed_at, delivered_at, quote_id, clients(name), vehicles(make, model, plate)")
        .in("shop_id", ids)
        .in("status", ["in_progress", "waiting_parts", "completed"])
        .limit(200),
      supabase
        .from("quotes")
        .select("id, number, status, total, date, created_at, clients(name)")
        .in("shop_id", ids)
        .in("status", ["sent", "approved"])
        .limit(200),
    ]);

    const dbAlerts = ((alertsRes.data as any[]) || []).map(mapRow);
    setRows(dbAlerts);

    const out: UnifiedAlert[] = [];
    // Dedupe por SITUAÇÃO concreta (tipo + título), nunca por tipo inteiro:
    // um alerta guardado não pode apagar todos os derivados da mesma família.
    const openDbKeys = new Set(
      dbAlerts
        .filter((a) => a.status === "pending" || a.status === "sent")
        .map((a) => `${a.type}|${(a.title || "").toLowerCase()}`),
    );

    // ---- STOCK: um alerta por peça, com link para a peça ----
    for (const p of ((partsRes.data as any[]) || [])) {
      const min = Number(p.min_stock || 0);
      const qty = Number(p.stock_quantity || 0);
      if (min <= 0 || qty > min) continue;
      const rupture = qty <= 0;
      out.push(
        derivedAlert({
          id: `derived:part:${p.id}`,
          type: rupture ? "stock_out" : "stock_low",
          title: rupture ? `Rutura de stock — ${p.name}` : `Stock abaixo do mínimo — ${p.name}`,
          subtitle: p.reference ? `Ref. ${p.reference}` : null,
          message: `Stock atual: ${qty} · mínimo: ${min}`,
          priority: rupture ? "critical" : "high",
          link: `/stock?search=${encodeURIComponent(p.reference || p.name)}`,
        }),
      );
    }

    // ---- FINANCEIRO: um alerta por fatura vencida, com link para a fatura ----
    for (const inv of ((overdueRes.data as any[]) || [])) {
      const late = daysSince(inv.due_date);
      out.push(
        derivedAlert({
          id: `derived:invoice:${inv.id}`,
          type: "invoice_overdue",
          title: `Fatura ${inv.number} vencida`,
          subtitle: (inv.clients as any)?.name || null,
          message: `${money(inv.total)} · vencida ${dayLabel(late)}`,
          priority: late >= 30 ? "critical" : "high",
          dueDate: inv.due_date,
          link: `/invoices?search=${encodeURIComponent(inv.number)}`,
        }),
      );
    }

    // ---- MARCAÇÕES: pedidos por responder, com link para a marcação ----
    for (const ap of ((apptRes.data as any[]) || [])) {
      const name = (ap.clients as any)?.name || ap.client_name || "Cliente";
      const when = `${new Date(ap.date).toLocaleDateString("pt-PT")} às ${String(ap.time).slice(0, 5)}`;
      out.push(
        derivedAlert({
          id: `derived:appointment:${ap.id}`,
          type: "appointment_new",
          title: "Nova marcação recebida",
          subtitle: name,
          message: `${when}${ap.service_type ? ` · ${ap.service_type}` : ""}`,
          priority: "high",
          dueDate: ap.date,
          link: `/agenda?appointment=${ap.id}`,
        }),
      );
    }

    // ---- SERVIÇOS: atrasados e veículos prontos por levantar ----
    const orders = (ordersRes.data as any[]) || [];
    const convertedQuoteIds = new Set(orders.map((o) => o.quote_id).filter(Boolean));
    for (const o of orders) {
      const veh = (o.vehicles as any) || null;
      const vehLabel = veh ? `${veh.make || ""} ${veh.model || ""} — ${veh.plate || ""}`.trim() : null;
      const subtitle = [(o.clients as any)?.name, vehLabel].filter(Boolean).join(" · ") || null;

      // Veículo já entregue = situação encerrada, sem alerta.
      if (o.delivered_at) continue;
      if (o.status === "completed") {
        // Só depois de 2 dias — evita alertar logo após marcar como pronto.
        const waiting = daysSince(o.completed_at || o.created_at);
        if (waiting >= 2) {
          out.push(
            derivedAlert({
              id: `derived:pickup:${o.id}`,
              type: "vehicle_ready",
              title: `Veículo pronto por levantar — ${o.number}`,
              subtitle,
              message: `Concluído ${dayLabel(waiting)}`,
              priority: waiting >= 7 ? "critical" : "high",
              link: `/services?search=${encodeURIComponent(o.number)}`,
            }),
          );
        }
        continue;
      }

      const running = daysSince(o.created_at);
      if (running >= 7) {
        out.push(
          derivedAlert({
            id: `derived:late-order:${o.id}`,
            type: "service_late",
            title: `Serviço atrasado — ${o.number}`,
            subtitle,
            message: `Em curso ${dayLabel(running)}`,
            priority: running >= 14 ? "critical" : "high",
            link: `/services?search=${encodeURIComponent(o.number)}`,
          }),
        );
      }
    }

    // ---- ORÇAMENTOS: aprovados sem ação e enviados sem resposta ----
    for (const q of ((quotesRes.data as any[]) || [])) {
      const clientName = (q.clients as any)?.name || null;
      if (q.status === "approved") {
        // Já convertido em serviço = ação tratada, não gera alerta.
        if (convertedQuoteIds.has(q.id)) continue;
        out.push(
          derivedAlert({
            id: `derived:quote-approved:${q.id}`,
            type: "quote_approved",
            title: `Orçamento ${q.number} aprovado`,
            subtitle: clientName,
            message: `${money(q.total)} · falta abrir o serviço`,
            priority: "high",
            link: `/quotes?search=${encodeURIComponent(q.number)}`,
          }),
        );
        continue;
      }
      const sentDays = daysSince(q.created_at || q.date);
      if (sentDays >= 3) {
        out.push(
          derivedAlert({
            id: `derived:quote-pending:${q.id}`,
            type: "quote_pending",
            title: `Orçamento ${q.number} aguarda aprovação`,
            subtitle: clientName,
            message: `${money(q.total)} · enviado ${dayLabel(sentDays)}`,
            priority: "low",
            link: `/quotes?search=${encodeURIComponent(q.number)}`,
          }),
        );
      }
    }

    setDerived(out.filter((a) => !openDbKeys.has(`${a.type}|${a.title.toLowerCase()}`)));
    setLoading(false);
  }, [idsKey]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!idsKey) return;
    const ch = supabase
      .channel(`gf-alerts-${idsKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [idsKey, load]);

  const PRIORITY_ORDER: Record<AlertPriority, number> = { critical: 0, high: 1, low: 2 };

  const alerts = useMemo(() => {
    const all = [
      ...derived.map((d) => ({ ...d, read: Boolean(derivedRead[d.id]) })),
      ...rows,
    ];
    return all.sort((a, b) => {
      const p = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (p !== 0) return p;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derived, rows, derivedRead]);

  /** Abrir um alerta (em qualquer ecrã) marca-o como lido em todo o sistema. */
  const markRead = useCallback(async (alert: UnifiedAlert) => {
    if (alert.read) return;
    if (alert.derived) {
      const next = { ...readDerivedRead(), [alert.id]: new Date().toISOString() };
      writeDerivedRead(next);
      setDerivedRead(next);
      return;
    }
    setRows((prev) => prev.map((a) => (a.id === alert.id ? { ...a, read: true } : a)));
    await supabase.from("alerts").update({ read_at: new Date().toISOString() } as any).eq("id", alert.id);
  }, []);

  const setStatus = useCallback(async (alert: UnifiedAlert, status: AlertStatus) => {
    if (alert.derived) return;
    setRows((prev) => prev.map((a) => (a.id === alert.id ? { ...a, status } : a)));
    const { error } = await supabase.from("alerts").update({ status } as any).eq("id", alert.id);
    if (error) void load();
  }, [load]);

  const markAllRead = useCallback(async () => {
    const unread = alerts.filter((a) => !a.read);
    const dbIds = unread.filter((a) => !a.derived).map((a) => a.id);
    const derivedIds = unread.filter((a) => a.derived).map((a) => a.id);
    if (derivedIds.length) {
      const map = readDerivedRead();
      derivedIds.forEach((id) => { map[id] = new Date().toISOString(); });
      writeDerivedRead(map);
      setDerivedRead(map);
    }
    if (dbIds.length) {
      setRows((prev) => prev.map((a) => (dbIds.includes(a.id) ? { ...a, read: true } : a)));
      await supabase.from("alerts").update({ read_at: new Date().toISOString() } as any).in("id", dbIds);
    }
  }, [alerts]);

  const open = alerts.filter((a) => a.status === "pending" || a.status === "sent");
  /** Badge: apenas alertas por tratar E por ler. Nunca conta itens técnicos. */
  const unreadCount = open.filter((a) => !a.read).length;

  const countsByPriority = useMemo(
    () => ({
      critical: open.filter((a) => a.priority === "critical").length,
      high: open.filter((a) => a.priority === "high").length,
      low: open.filter((a) => a.priority === "low").length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alerts],
  );

  return {
    alerts,
    open,
    unreadCount,
    countsByPriority,
    pendingCount: alerts.filter((a) => a.status === "pending").length,
    loading,
    reload: load,
    markRead,
    markAllRead,
    resolve: (a: UnifiedAlert) => setStatus(a, "resolved"),
    dismiss: (a: UnifiedAlert) => setStatus(a, "dismissed"),
  };
}
