import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Power, PowerOff, RotateCcw, Search, Bell } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ShopRow {
  id: string;
  name: string;
  country: string;
  currency: string;
  timezone: string;
  status: string;
  created_at: string;
  plan: string;
  clientCount: number;
  workOrderCount: number;
  alertCount: number;
}

export default function AdminShops() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const fetchShops = async () => {
    setLoading(true);

    const [shopsRes, subsRes, clientsRes, woRes, alertsRes] = await Promise.all([
      supabase.from("shops").select("id, name, country, currency, timezone, status, created_at"),
      supabase.from("subscriptions").select("shop_id, plan, status, trial_end"),
      supabase.from("clients").select("id, shop_id"),
      supabase.from("work_orders").select("id, shop_id"),
      supabase.from("alerts").select("id, shop_id, status").eq("status", "pending"),
    ]);

    const subsMap = new Map<string, string>();
    (subsRes.data || []).forEach(s => subsMap.set(s.shop_id, s.plan));

    const countBy = (arr: any[] | null, shopId: string) =>
      (arr || []).filter(r => r.shop_id === shopId).length;

    const rows: ShopRow[] = (shopsRes.data || []).map(s => ({
      ...s,
      plan: subsMap.get(s.id) || "free",
      clientCount: countBy(clientsRes.data, s.id),
      workOrderCount: countBy(woRes.data, s.id),
      alertCount: countBy(alertsRes.data, s.id),
    }));

    setShops(rows);
    setLoading(false);
  };

  useEffect(() => { fetchShops(); }, []);

  const logAction = async (action: string, entityType: string, entityId: string, details: Record<string, any> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action, entity_type: entityType, entity_id: entityId,
      user_id: user?.id, details,
    });
  };

  const toggleStatus = async (shop: ShopRow) => {
    const newStatus = shop.status === "active" ? "suspended" : "active";
    const { error } = await supabase.from("shops").update({ status: newStatus }).eq("id", shop.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction(newStatus === "active" ? "shop_activated" : "shop_suspended", "shop", shop.id, { name: shop.name });
      toast({ title: `Oficina ${newStatus === 'active' ? 'ativada' : 'suspensa'}` });
      fetchShops();
    }
  };

  const resetTrial = async (shop: ShopRow) => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    const { error } = await supabase.from("subscriptions")
      .update({ trial_end: trialEnd.toISOString(), status: "trialing" })
      .eq("shop_id", shop.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction("trial_reset", "subscription", shop.id, { name: shop.name });
      toast({ title: "Trial reiniciado (30 dias)" });
      fetchShops();
    }
  };

  const resetAlerts = async (shop: ShopRow) => {
    const { error } = await supabase.from("alerts")
      .update({ status: "resolved" })
      .eq("shop_id", shop.id)
      .eq("status", "pending");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction("alerts_reset", "alerts", shop.id, { name: shop.name });
      toast({ title: "Alertas resetados" });
      fetchShops();
    }
  };

  const planBadge = (plan: string) => {
    const colors: Record<string, string> = {
      free: "bg-muted text-muted-foreground",
      pro: "bg-primary/15 text-primary border-primary/30",
      garage: "bg-success/15 text-success border-success/30",
    };
    return <Badge variant="outline" className={colors[plan] || ""}>{plan.toUpperCase()}</Badge>;
  };

  const statusBadge = (status: string) => {
    return status === "active"
      ? <Badge variant="outline" className="bg-success/15 text-success border-success/30">Ativa</Badge>
      : <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">Suspensa</Badge>;
  };

  const countries = [...new Set(shops.map(s => s.country))];

  const filtered = shops.filter(s => {
    if (filterPlan !== "all" && s.plan !== filterPlan) return false;
    if (filterCountry !== "all" && s.country !== filterCountry) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Oficinas</h1>
        <p className="text-sm text-muted-foreground">Gerir todas as oficinas do sistema</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar oficina..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9" />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Plano" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="garage">Garage</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="País" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Clientes</TableHead>
              <TableHead className="text-center">Serviços</TableHead>
              <TableHead className="text-center">Alertas</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(shop => (
              <TableRow key={shop.id}>
                <TableCell className="font-medium">{shop.name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{shop.country}</TableCell>
                <TableCell>{planBadge(shop.plan)}</TableCell>
                <TableCell>{statusBadge(shop.status)}</TableCell>
                <TableCell className="text-center mono">{shop.clientCount}</TableCell>
                <TableCell className="text-center mono">{shop.workOrderCount}</TableCell>
                <TableCell className="text-center mono">{shop.alertCount}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => toggleStatus(shop)}
                      title={shop.status === "active" ? "Suspender" : "Ativar"}>
                      {shop.status === "active"
                        ? <PowerOff className="w-4 h-4 text-destructive" />
                        : <Power className="w-4 h-4 text-success" />
                      }
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => resetTrial(shop)} title="Reset Trial">
                      <RotateCcw className="w-4 h-4 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => resetAlerts(shop)} title="Reset Alertas">
                      <Bell className="w-4 h-4 text-warning" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhuma oficina encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
