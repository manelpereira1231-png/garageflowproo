import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Package, ShoppingCart, AlertTriangle, TrendingUp, Star, Boxes, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { formatMoney } from "@/lib/money";
import { format } from "date-fns";

interface Stats {
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
  ordersNew: number;
  ordersProcessing: number;
  lowStock: number;
  active: number;
  outOfStock: number;
  ratingAverage: number;
}

interface RecentOrder {
  id: string;
  order_number: string | null;
  status: string;
  total: number;
  currency: string;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendente", paid: "Pago", confirmed: "Aceite", preparing: "Em preparação",
  shipped: "Enviado", partial: "Parcial", delivered: "Concluído", cancelled: "Cancelado", refunded: "Reembolsado",
};

const COUNTED = ["paid", "confirmed", "preparing", "shipped", "partial", "delivered"];

const initial: Stats = { revenueToday: 0, revenueMonth: 0, revenueYear: 0, ordersNew: 0, ordersProcessing: 0, lowStock: 0, active: 0, outOfStock: 0, ratingAverage: 0 };

export default function SupplierDashboard() {
  const { supplierId } = useIsSupplier();
  const [stats, setStats] = useState<Stats>(initial);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    const now = new Date();
    const startYear = new Date(now.getFullYear(), 0, 1).toISOString();

    const [{ count: active }, { count: out }, { count: low }, { data: supplier }, { data: yearOrders }, { data: recentRows }] = await Promise.all([
      supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).eq("status", "active").is("deleted_at", null),
      supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).eq("stock", 0).is("deleted_at", null),
      supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).lte("stock", 5).gt("stock", 0).is("deleted_at", null),
      supabase.from("gsn_suppliers" as any).select("rating_average").eq("id", supplierId).maybeSingle(),
      supabase.from("gsn_orders" as any).select("status,total,created_at").eq("supplier_id", supplierId).gte("created_at", startYear),
      supabase.from("gsn_orders" as any).select("id,order_number,status,total,currency,created_at").eq("supplier_id", supplierId).order("created_at", { ascending: false }).limit(8),
    ]);

    const rows = ((yearOrders as any) ?? []) as { status: string; total: number; created_at: string }[];
    const todayKey = now.toDateString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let revenueToday = 0, revenueMonth = 0, revenueYear = 0, ordersNew = 0, ordersProcessing = 0;
    for (const r of rows) {
      const d = new Date(r.created_at);
      if (COUNTED.includes(r.status)) {
        const v = Number(r.total) || 0;
        revenueYear += v;
        if (d.getTime() >= monthStart) revenueMonth += v;
        if (d.toDateString() === todayKey) revenueToday += v;
      }
      if (r.status === "pending" || r.status === "paid") ordersNew++;
      if (r.status === "confirmed" || r.status === "preparing") ordersProcessing++;
    }

    setStats({
      revenueToday, revenueMonth, revenueYear, ordersNew, ordersProcessing,
      lowStock: low ?? 0,
      active: active ?? 0,
      outOfStock: out ?? 0,
      ratingAverage: Number((supplier as any)?.rating_average ?? 0),
    });
    setRecent(((recentRows as any) ?? []) as RecentOrder[]);
    setLoading(false);
  }, [supplierId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!supplierId) return;
    const channel = supabase
      .channel(`gsn-dash-${supplierId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "gsn_orders", filter: `supplier_id=eq.${supplierId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [supplierId, load]);

  const cards = [
    { label: "Receita hoje", value: formatMoney(stats.revenueToday), icon: TrendingUp },
    { label: "Receita mês", value: formatMoney(stats.revenueMonth), icon: TrendingUp },
    { label: "Receita ano", value: formatMoney(stats.revenueYear), icon: TrendingUp },
    { label: "Encomendas novas", value: stats.ordersNew, icon: ShoppingCart },
    { label: "Em processamento", value: stats.ordersProcessing, icon: ShoppingCart },
    { label: "Produtos ativos", value: stats.active, icon: Package },
    { label: "Stock baixo", value: stats.lowStock, icon: AlertTriangle },
    { label: "Sem stock", value: stats.outOfStock, icon: Boxes },
    { label: "Avaliação média", value: stats.ratingAverage.toFixed(1), icon: Star },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral da atividade da sua loja.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <c.icon className="w-4 h-4 text-primary" />
              </div>
              {loading ? <Skeleton className="h-7 w-20" /> : <p className="text-2xl font-bold">{c.value}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas encomendas</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Inbox className="w-8 h-8 mx-auto mb-2 opacity-60" />
              <p className="text-sm">Ainda não existem encomendas.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((o) => (
                <Link key={o.id} to="/supplier/orders" className="flex items-center justify-between gap-3 p-3 border rounded-md hover:bg-accent/40">
                  <div className="min-w-0">
                    <p className="text-sm font-mono font-medium truncate">{o.order_number ?? `#${o.id.slice(0, 8)}`}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatMoney(Number(o.total), o.currency)}</p>
                    <Badge variant="outline">{STATUS_LABEL[o.status] ?? o.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
