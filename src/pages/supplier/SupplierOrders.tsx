import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatMoney } from "@/lib/money";
import { ChevronDown, ChevronUp, Inbox } from "lucide-react";

interface OrderItem {
  id: string;
  title: string | null;
  sku: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface OrderEvent {
  id: string;
  from_status: string | null;
  to_status: string | null;
  note: string | null;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  currency: string;
  tracking_code: string | null;
  buyer_shop_id: string | null;
  created_at: string;
  items?: OrderItem[];
  shopName?: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente",
  paid: "Pago",
  confirmed: "Aceite",
  preparing: "Em preparação",
  shipped: "Enviado",
  partial: "Parcial",
  delivered: "Concluído",
  cancelled: "Cancelado",
  refunded: "Reembolsado",
};

// Next steps allowed from each state (supplier side)
const NEXT: Record<string, string[]> = {
  pending: ["confirmed", "cancelled"],
  paid: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  partial: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  refunded: [],
};

const FILTERS: { key: string; label: string; match: (s: string) => boolean }[] = [
  { key: "all", label: "Todos", match: () => true },
  { key: "new", label: "Novos", match: (s) => s === "pending" || s === "paid" },
  { key: "processing", label: "Em preparação", match: (s) => s === "confirmed" || s === "preparing" },
  { key: "shipped", label: "Enviados", match: (s) => s === "shipped" || s === "partial" },
  { key: "done", label: "Concluídos", match: (s) => s === "delivered" },
  { key: "cancelled", label: "Cancelados", match: (s) => s === "cancelled" || s === "refunded" },
];

export default function SupplierOrders() {
  const { supplierId } = useIsSupplier();
  const [params, setParams] = useSearchParams();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const filter = params.get("f") ?? "all";
  const [open, setOpen] = useState<string | null>(params.get("o"));
  const [busy, setBusy] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, OrderEvent[]>>({});

  const setFilter = (k: string) => {
    const next = new URLSearchParams(params);
    if (k === "all") next.delete("f"); else next.set("f", k);
    setParams(next, { replace: true });
  };

  // Histórico real de estados do pedido aberto
  useEffect(() => {
    if (!open || events[open]) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("gsn_order_events" as any)
        .select("id,from_status,to_status,note,created_at")
        .eq("order_id", open)
        .order("created_at", { ascending: true });
      if (!cancelled) setEvents((prev) => ({ ...prev, [open]: ((data as any) ?? []) as OrderEvent[] }));
    })();
    return () => { cancelled = true; };
  }, [open, events]);

  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("gsn_orders" as any)
      .select("id,order_number,status,total,currency,tracking_code,buyer_shop_id,created_at")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      toast.error("Não foi possível carregar as encomendas");
      setLoading(false);
      return;
    }

    const rows = ((data as any) ?? []) as Order[];
    const ids = rows.map((r) => r.id);
    const shopIds = Array.from(new Set(rows.map((r) => r.buyer_shop_id).filter(Boolean))) as string[];

    const [{ data: items }, { data: shops }] = await Promise.all([
      ids.length
        ? supabase.from("gsn_order_items" as any).select("id,order_id,title,sku,quantity,unit_price,line_total").in("order_id", ids)
        : Promise.resolve({ data: [] as any }),
      shopIds.length
        ? supabase.from("shops" as any).select("id,name").in("id", shopIds)
        : Promise.resolve({ data: [] as any }),
    ]);

    const shopMap = new Map<string, string>(((shops as any) ?? []).map((s: any) => [s.id, s.name]));
    const itemMap = new Map<string, OrderItem[]>();
    ((items as any) ?? []).forEach((it: any) => {
      const list = itemMap.get(it.order_id) ?? [];
      list.push(it);
      itemMap.set(it.order_id, list);
    });

    setOrders(rows.map((r) => ({
      ...r,
      items: itemMap.get(r.id) ?? [],
      shopName: r.buyer_shop_id ? shopMap.get(r.buyer_shop_id) : undefined,
    })));
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { void load(); }, [load]);

  // Live updates when a workshop places or changes an order
  useEffect(() => {
    if (!supplierId) return;
    const channel = supabase
      .channel(`gsn-orders-${supplierId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gsn_orders", filter: `supplier_id=eq.${supplierId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supplierId, load]);

  const transition = async (id: string, to: string) => {
    if (busy) return;
    setBusy(id);
    const { error } = await supabase.rpc("gsn_order_transition" as any, { _order_id: id, _to: to, _note: null });
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(`Encomenda atualizada para ${STATUS_LABEL[to] ?? to}`);
    void load();
  };

  const visible = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    return orders.filter((o) => f.match(o.status));
  }, [orders, filter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Encomendas</h1>
        <p className="text-sm text-muted-foreground">Encomendas recebidas de oficinas.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} className="shrink-0" onClick={() => setFilter(f.key)}>
            {f.label}
            <span className="ml-2 text-xs opacity-70">{orders.filter((o) => f.match(o.status)).length}</span>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{visible.length} encomendas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-sm">Ainda não existem encomendas nesta vista.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visible.map((o) => (
                <div key={o.id} className="border rounded-md">
                  <button
                    type="button"
                    className="w-full flex flex-wrap items-center justify-between gap-3 p-3 text-left"
                    onClick={() => setOpen(open === o.id ? null : o.id)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold font-mono truncate">{o.order_number ?? `#${o.id.slice(0, 8)}`}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {o.shopName ?? "Oficina"} · {format(new Date(o.created_at), "dd/MM/yyyy HH:mm")} · {o.items?.length ?? 0} artigos
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="font-semibold">{formatMoney(Number(o.total), o.currency)}</p>
                      <Badge variant="outline">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                      {open === o.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </div>
                  </button>

                  {open === o.id && (
                    <div className="border-t p-3 space-y-3">
                      <div className="text-sm">
                        <p className="font-medium">Oficina</p>
                        <p className="text-muted-foreground">{o.shopName ?? "Oficina GarageFlow"}</p>
                      </div>
                      {(o.items ?? []).length === 0 ? (
                        <p className="text-xs text-muted-foreground">Sem linhas registadas.</p>
                      ) : (
                        <div className="space-y-1">
                          {(o.items ?? []).map((it) => (
                            <div key={it.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="min-w-0 truncate">{it.title ?? "Produto"}{it.sku ? ` · ${it.sku}` : ""}</span>
                              <span className="shrink-0 text-muted-foreground">{it.quantity} × {formatMoney(Number(it.unit_price), o.currency)}</span>
                              <span className="w-24 text-right font-medium">{formatMoney(Number(it.line_total), o.currency)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(NEXT[o.status] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground">Sem ações disponíveis neste estado.</p>
                        ) : (
                          (NEXT[o.status] ?? []).map((to) => (
                            <Button
                              key={to}
                              size="sm"
                              variant={to === "cancelled" ? "outline" : "default"}
                              disabled={busy === o.id}
                              onClick={() => transition(o.id, to)}
                            >
                              {to === "cancelled" ? "Recusar / Cancelar" : STATUS_LABEL[to] ?? to}
                            </Button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
