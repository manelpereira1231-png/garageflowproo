/**
 * FONTE ÚNICA DE VERDADE dos Alertas da oficina.
 *
 * Dashboard, badge do menu e página /alerts consomem EXATAMENTE este hook:
 * mesma query, mesmos estados, mesmos links, mesmo lido/não lido.
 *
 * Inclui dois alertas derivados de condições ativas (stock baixo e faturas
 * vencidas). São calculados aqui — e não no Dashboard — para que apareçam
 * iguais em todo o lado. Nunca duplicam um alerta real equivalente já
 * existente na base de dados.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { resolveAlertLink } from "@/lib/alertLink";

export type AlertStatus = "pending" | "sent" | "resolved" | "dismissed";

export type UnifiedAlert = {
  id: string;
  derived: boolean;
  type: string;
  title: string;
  message: string | null;
  priority: string;
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
  return {
    id: row.id,
    derived: false,
    type: row.type,
    title: row.title,
    message: row.message ?? null,
    priority: row.priority || "medium",
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
    if (!shopIds.length) {
      setRows([]);
      setDerived([]);
      setLoading(false);
      return;
    }

    const [alertsRes, partsRes, overdueRes] = await Promise.all([
      supabase
        .from("alerts")
        .select("*, clients(name, phone, email), vehicles(make, model, plate)")
        .in("shop_id", shopIds)
        .order("created_at", { ascending: false })
        .limit(300),
      supabase
        .from("parts")
        .select("id, name, stock_quantity, min_stock")
        .in("shop_id", shopIds)
        .eq("active", true),
      supabase
        .from("invoices")
        .select("id, number, total, due_date")
        .in("shop_id", shopIds)
        .in("status", ["issued", "partial"])
        .lt("due_date", new Date().toISOString().slice(0, 10)),
    ]);

    const dbAlerts = ((alertsRes.data as any[]) || []).map(mapRow);
    setRows(dbAlerts);

    const now = new Date().toISOString();
    const out: UnifiedAlert[] = [];

    const lowStock = ((partsRes.data as any[]) || []).filter(
      (p) => Number(p.min_stock) > 0 && Number(p.stock_quantity) <= Number(p.min_stock),
    );
    if (lowStock.length > 0) {
      const names = lowStock.slice(0, 3).map((p) => p.name).join(", ");
      out.push({
        id: `derived:stock_low:${lowStock.length}`,
        derived: true,
        type: "stock_low",
        title:
          lowStock.length === 1
            ? `Stock baixo: ${lowStock[0].name}`
            : `${lowStock.length} peças com stock abaixo do mínimo`,
        message: `Repor stock: ${names}${lowStock.length > 3 ? "…" : ""}`,
        priority: "medium",
        status: "pending",
        read: false,
        createdAt: now,
        dueDate: null,
        clientId: null,
        vehicleId: null,
        clientName: null,
        clientPhone: null,
        clientEmail: null,
        make: null,
        model: null,
        plate: null,
        link: "/stock",
        raw: null,
      });
    }

    const overdue = (overdueRes.data as any[]) || [];
    // Nunca duplica: se já existe um alerta real de pagamento por resolver,
    // o alerta derivado não é criado.
    const hasPaymentAlert = dbAlerts.some(
      (a) => a.type === "payment_failed" && (a.status === "pending" || a.status === "sent"),
    );
    if (overdue.length > 0 && !hasPaymentAlert) {
      const total = overdue.reduce((s, i) => s + Number(i.total || 0), 0);
      const single = overdue.length === 1 ? overdue[0] : null;
      out.push({
        id: `derived:overdue:${overdue.length}`,
        derived: true,
        type: "payment_failed",
        title: single
          ? `Fatura ${single.number} vencida`
          : `${overdue.length} faturas vencidas por receber`,
        message: single
          ? `Vencida em ${single.due_date}. Valor em dívida: ${Number(single.total || 0).toFixed(2)}.`
          : `Total em dívida: ${total.toFixed(2)}.`,
        priority: "high",
        status: "pending",
        read: false,
        createdAt: now,
        dueDate: single?.due_date ?? null,
        clientId: null,
        vehicleId: null,
        clientName: null,
        clientPhone: null,
        clientEmail: null,
        make: null,
        model: null,
        plate: null,
        link: single ? `/invoices?search=${encodeURIComponent(single.number)}` : "/invoices",
        raw: null,
      });
    }

    setDerived(out);
    setLoading(false);
  }, [idsKey]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!shopIds.length) return;
    const ch = supabase
      .channel(`gf-alerts-${idsKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => void load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [idsKey, load]);

  const alerts = useMemo(() => {
    const all = [
      ...derived.map((d) => ({ ...d, read: Boolean(derivedRead[d.id]) })),
      ...rows,
    ];
    return all;
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

  return {
    alerts,
    open,
    unreadCount,
    pendingCount: alerts.filter((a) => a.status === "pending").length,
    loading,
    reload: load,
    markRead,
    markAllRead,
    resolve: (a: UnifiedAlert) => setStatus(a, "resolved"),
    dismiss: (a: UnifiedAlert) => setStatus(a, "dismissed"),
  };
}
