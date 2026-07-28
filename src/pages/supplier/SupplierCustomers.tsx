import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { formatMoney } from "@/lib/money";

interface Row { buyer_shop_id: string; orders: number; total: number; }

export default function SupplierCustomers() {
  const { supplierId } = useIsSupplier();
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!supplierId) return;
    (async () => {
      const { data } = await supabase.from("gsn_orders" as any)
        .select("buyer_shop_id,total")
        .eq("supplier_id", supplierId);
      const agg = new Map<string, Row>();
      ((data as any[]) ?? []).forEach((o: any) => {
        if (!o.buyer_shop_id) return;
        const cur = agg.get(o.buyer_shop_id) ?? { buyer_shop_id: o.buyer_shop_id, orders: 0, total: 0 };
        cur.orders += 1;
        cur.total += Number(o.total);
        agg.set(o.buyer_shop_id, cur);
      });
      setRows(Array.from(agg.values()).sort((a, b) => b.total - a.total));
    })();
  }, [supplierId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">Oficinas que compram os seus produtos.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>{rows.length} oficinas compradoras</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem clientes.</p> : (
            <div className="space-y-2">
              {rows.map(r => (
                <div key={r.buyer_shop_id} className="flex items-center justify-between p-3 border rounded-md">
                  <p className="text-sm font-mono">{r.buyer_shop_id.slice(0,8)}...</p>
                  <div className="text-right text-sm">
                    <p className="font-semibold">{formatMoney(r.total)}</p>
                    <p className="text-xs text-muted-foreground">{r.orders} encomendas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
