import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Package, ShoppingCart, AlertTriangle, TrendingUp, Star, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";

interface Stats {
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
  orders: number;
  lowStock: number;
  active: number;
  outOfStock: number;
  ratingAverage: number;
}

const initial: Stats = { revenueToday: 0, revenueMonth: 0, revenueYear: 0, orders: 0, lowStock: 0, active: 0, outOfStock: 0, ratingAverage: 0 };

export default function SupplierDashboard() {
  const { supplierId } = useIsSupplier();
  const [stats, setStats] = useState<Stats>(initial);

  useEffect(() => {
    if (!supplierId) return;
    (async () => {
      const [{ count: active }, { count: out }, { count: low }, { count: orders }, { data: supplier }] = await Promise.all([
        supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).eq("status", "active").is("deleted_at", null),
        supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).eq("stock", 0).is("deleted_at", null),
        supabase.from("gsn_products" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId).lte("stock", 5).gt("stock", 0).is("deleted_at", null),
        supabase.from("gsn_orders" as any).select("id", { count: "exact", head: true }).eq("supplier_id", supplierId),
        supabase.from("gsn_suppliers" as any).select("rating_average").eq("id", supplierId).maybeSingle(),
      ]);
      setStats({
        revenueToday: 0, revenueMonth: 0, revenueYear: 0,
        orders: orders ?? 0,
        lowStock: low ?? 0,
        active: active ?? 0,
        outOfStock: out ?? 0,
        ratingAverage: Number((supplier as any)?.rating_average ?? 0),
      });
    })();
  }, [supplierId]);

  const cards = [
    { label: "Receita hoje", value: `€ ${stats.revenueToday.toFixed(2)}`, icon: TrendingUp },
    { label: "Receita mês", value: `€ ${stats.revenueMonth.toFixed(2)}`, icon: TrendingUp },
    { label: "Receita ano", value: `€ ${stats.revenueYear.toFixed(2)}`, icon: TrendingUp },
    { label: "Encomendas", value: stats.orders, icon: ShoppingCart },
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <c.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-2xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Últimas encomendas</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Ainda não há encomendas. O marketplace B2B abre na próxima fase.</p>
        </CardContent>
      </Card>
    </div>
  );
}
