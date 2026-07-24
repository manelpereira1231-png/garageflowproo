import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { useSupplierMarket } from "@/hooks/useSupplierMarket";
import { toast } from "sonner";

export default function PartsOrders() {
  const { activeShopId } = useSupplierMarket();
  const [rows, setRows] = useState<any[]>([]);

  const load = async () => {
    if (!activeShopId) { setRows([]); return; }
    const { data } = await supabase
      .from("gsn_orders" as any)
      .select("id,status,total,currency,tracking_code,carrier,created_at,supplier:gsn_suppliers(company_name,trade_name)")
      .eq("buyer_shop_id", activeShopId)
      .order("created_at", { ascending: false });
    setRows((data as any) ?? []);
  };
  useEffect(() => { void load(); }, [activeShopId]);

  const cancel = async (id: string) => {
    const { error } = await supabase.rpc("gsn_order_transition" as any, { _order_id: id, _to: "cancelled", _note: "Cancelada pela oficina" });
    if (error) return toast.error(error.message);
    toast.success("Encomenda cancelada");
    void load();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Minhas encomendas</h1>
      <Card>
        <CardHeader><CardTitle>{rows.length} encomendas</CardTitle></CardHeader>
        <CardContent>
          {rows.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem encomendas.</p> : (
            <div className="space-y-2">
              {rows.map((o) => (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 border rounded-md">
                  <div className="min-w-0">
                    <Link to={`/parts/orders/${o.id}`} className="text-sm font-medium hover:text-primary">#{o.id.slice(0,8)}</Link>
                    <p className="text-xs text-muted-foreground">{o.supplier?.trade_name ?? o.supplier?.company_name} · {format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{o.currency} {Number(o.total).toFixed(2)}</p>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>
                  {(o.status === "pending" || o.status === "paid") && (
                    <Button size="sm" variant="ghost" onClick={() => cancel(o.id)}>Cancelar</Button>
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
