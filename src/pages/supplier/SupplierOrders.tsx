import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";
import { format } from "date-fns";

interface Order {
  id: string;
  status: string;
  total: number;
  currency: string;
  tracking_code: string | null;
  carrier: string | null;
  buyer_shop_id: string | null;
  created_at: string;
}

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"];

export default function SupplierOrders() {
  const { supplierId } = useIsSupplier();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!supplierId) return;
    setLoading(true);
    const { data } = await supabase
      .from("gsn_orders" as any)
      .select("id,status,total,currency,tracking_code,carrier,buyer_shop_id,created_at")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(200);
    setOrders((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [supplierId]);

  const advance = async (id: string, status: string) => {
    const { error } = await supabase.from("gsn_orders" as any).update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Estado atualizado");
    load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Encomendas</h1>
        <p className="text-sm text-muted-foreground">Encomendas recebidas de oficinas.</p>
      </div>
      <Card>
        <CardHeader><CardTitle>Todas as encomendas ({orders.length})</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-sm text-muted-foreground">A carregar...</p> :
           orders.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem encomendas.</p> : (
            <div className="space-y-2">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between gap-3 p-3 border rounded-md">
                  <div className="min-w-0">
                    <p className="text-sm font-mono truncate">#{o.id.slice(0,8)}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(o.created_at), "dd/MM/yyyy HH:mm")}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{o.currency} {Number(o.total).toFixed(2)}</p>
                    <Badge variant="outline">{o.status}</Badge>
                  </div>
                  <select className="text-xs border rounded px-2 py-1 bg-background" value={o.status} onChange={(e) => advance(o.id, e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
