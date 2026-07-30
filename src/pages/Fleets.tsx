import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Truck, Search, Car, Wrench, Eye } from "lucide-react";
import ListSkeleton from "@/components/ListSkeleton";
import { formatMoney } from "@/lib/money";

type FleetRow = {
  id: string;
  name: string;
  fleet_name: string | null;
  fleet_manager: string | null;
  phone: string | null;
  email: string | null;
  vehicles: number;
  openOrders: number;
  spend: number;
};

/** Visão dedicada às frotas (clientes empresariais com vários veículos). */
export default function Fleets() {
  const activeShopId = useActiveShopId();
  const [rows, setRows] = useState<FleetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeShopId) { setLoading(false); return; }
      setLoading(true);
      const { data: clients } = await supabase
        .from("clients")
        .select("id, name, fleet_name, fleet_manager, phone, email")
        .eq("shop_id", activeShopId)
        .eq("is_fleet", true)
        .is("deleted_at", null)
        .order("name");

      const ids = (clients ?? []).map((c: any) => c.id);
      let vehicles: any[] = [];
      let orders: any[] = [];
      if (ids.length) {
        const [v, o] = await Promise.all([
          supabase.from("vehicles").select("id, client_id").in("client_id", ids),
          supabase.from("work_orders").select("id, client_id, status, total").in("client_id", ids),
        ]);
        vehicles = v.data ?? [];
        orders = o.data ?? [];
      }

      const mapped: FleetRow[] = (clients ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        fleet_name: c.fleet_name,
        fleet_manager: c.fleet_manager,
        phone: c.phone,
        email: c.email,
        vehicles: vehicles.filter(v => v.client_id === c.id).length,
        openOrders: orders.filter(o => o.client_id === c.id && !["completed", "delivered", "cancelled"].includes(String(o.status))).length,
        spend: orders.filter(o => o.client_id === c.id).reduce((s, o) => s + Number(o.total || 0), 0),
      }));
      if (!cancelled) { setRows(mapped); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [activeShopId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(r =>
      [r.name, r.fleet_name, r.fleet_manager].filter(Boolean).some(v => String(v).toLowerCase().includes(term))
    );
  }, [rows, q]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Truck className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Frotas</h1>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Procurar frota, empresa ou responsável" className="pl-9" />
      </div>

      {loading ? (
        <ListSkeleton />
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Truck className="w-8 h-8 mx-auto text-muted-foreground" />
            <p className="text-sm font-medium">Ainda não tem frotas registadas</p>
            <p className="text-xs text-muted-foreground">
              Edite um cliente empresarial e ative a opção "Cliente de frota" para o ver aqui.
            </p>
            <Link to="/clients"><Button variant="outline" size="sm" className="mt-2">Ir para Clientes</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(r => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{r.fleet_name || r.name}</p>
                    {r.fleet_name && <p className="text-xs text-muted-foreground truncate">{r.name}</p>}
                  </div>
                  <Badge variant="outline" className="shrink-0">Frota</Badge>
                </div>
                {r.fleet_manager && <p className="text-xs text-muted-foreground truncate">Responsável: {r.fleet_manager}</p>}
                <div className="flex flex-wrap gap-3 text-xs pt-1">
                  <span className="inline-flex items-center gap-1"><Car className="w-3.5 h-3.5" />{r.vehicles} veículos</span>
                  <span className="inline-flex items-center gap-1"><Wrench className="w-3.5 h-3.5" />{r.openOrders} em curso</span>
                </div>
                <p className="text-sm font-bold">{formatMoney(r.spend)}</p>
                <Link to={`/clients?client=${r.id}`}>
                  <Button variant="outline" size="sm" className="w-full mt-1 text-xs">
                    <Eye className="w-3.5 h-3.5 mr-1" />Ver cliente
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
