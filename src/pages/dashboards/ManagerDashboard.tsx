import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { useAuthReady } from "@/hooks/useAuthReady";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BriefcaseBusiness, CalendarDays, ClipboardList, FileText, Package, Users, Wrench } from "lucide-react";

interface WorkOrderRow {
  id: string;
  number: string | null;
  status: string;
  created_at: string;
  vehicles: { plate: string | null; make: string | null; model: string | null } | null;
}

export default function ManagerDashboard() {
  const { user, isReady } = useAuthReady();
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [activeOrders, setActiveOrders] = useState<WorkOrderRow[]>([]);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [openQuotes, setOpenQuotes] = useState(0);
  const [activeClients, setActiveClients] = useState(0);
  const [lowStock, setLowStock] = useState(0);

  useEffect(() => {
    if (!isReady || !user || !shopId) return;
    (async () => {
      setLoading(true);
      const todayIso = new Date().toISOString().slice(0, 10);
      const [ordersRes, apptsRes, quotesRes, clientsRes, partsRes] = await Promise.all([
        supabase
          .from("work_orders")
          .select("id, number, status, created_at, vehicles(plate,make,model)")
          .eq("shop_id", shopId)
          .in("status", ["open", "diagnosis", "waiting_approval", "approved", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .eq("date", todayIso),
        supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .in("status", ["draft", "sent", "pending"]),
        supabase
          .from("clients")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", shopId)
          .is("deleted_at", null),
        supabase
          .from("parts")
          .select("id, stock_quantity, min_stock")
          .eq("shop_id", shopId)
          .eq("active", true),
      ]);

      setActiveOrders((ordersRes.data as any) || []);
      setTodayAppointments(apptsRes.count || 0);
      setOpenQuotes(quotesRes.count || 0);
      setActiveClients(clientsRes.count || 0);
      setLowStock(((partsRes.data as any[]) || []).filter((p) => Number(p.stock_quantity || 0) <= Number(p.min_stock || 0)).length);
      setLoading(false);
    })();
  }, [isReady, user, shopId]);

  if (loading) return <div className="p-6"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto">
      <header className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/15 border border-primary/30">
          <BriefcaseBusiness className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Manager — Gestão operacional</h1>
          <p className="text-sm text-muted-foreground">Oficina, agenda, clientes, stock e execução diária.</p>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Wrench} label="OS ativas" value={activeOrders.length} />
        <StatCard icon={CalendarDays} label="Agenda hoje" value={todayAppointments} />
        <StatCard icon={FileText} label="Orçamentos abertos" value={openQuotes} />
        <StatCard icon={Users} label="Clientes ativos" value={activeClients} />
        <StatCard icon={Package} label="Stock baixo" value={lowStock} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild><Link to="/services"><Wrench className="w-4 h-4 mr-2" />Ordens de serviço</Link></Button>
        <Button asChild variant="outline"><Link to="/agenda"><CalendarDays className="w-4 h-4 mr-2" />Agenda</Link></Button>
        <Button asChild variant="outline"><Link to="/stock"><Package className="w-4 h-4 mr-2" />Stock</Link></Button>
        <Button asChild variant="outline"><Link to="/team"><Users className="w-4 h-4 mr-2" />Equipa</Link></Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="w-5 h-5" />
          <h2 className="text-lg font-semibold">Ordens em execução</h2>
          <Badge variant="outline">{activeOrders.length}</Badge>
        </div>
        {activeOrders.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem ordens ativas neste momento.</p>
        ) : (
          <ul className="divide-y divide-border">
            {activeOrders.map((order) => (
              <li key={order.id} className="py-2 flex items-center justify-between gap-2">
                <Link to={`/services/edit/${order.id}`} className="flex-1 min-w-0 flex items-center gap-2 hover:underline">
                  <span className="font-mono text-xs text-muted-foreground">{order.number || "—"}</span>
                  <span className="truncate">
                    {order.vehicles?.plate || "s/matrícula"} · {order.vehicles?.make || ""} {order.vehicles?.model || ""}
                  </span>
                </Link>
                <Badge variant="outline">{order.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <Card className="p-4 border">
      <div className="flex items-center gap-2 mb-1 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl md:text-3xl font-bold">{value}</div>
    </Card>
  );
}