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
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Power, PowerOff, RotateCcw, Search, Bell, Download, Eye, Trash2, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

interface ShopRow {
  id: string;
  name: string;
  email: string;
  country: string;
  currency: string;
  timezone: string;
  status: string;
  created_at: string;
  plan: string;
  clientCount: number;
  workOrderCount: number;
  alertCount: number;
  revenue: number;
}

export default function AdminShops() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [deleteShop, setDeleteShop] = useState<ShopRow | null>(null);
  const [planDialog, setPlanDialog] = useState<{ shop: ShopRow; newPlan: string; durationType: string; durationValue: number } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchShops = async () => {
    setLoading(true);
    const [shopsRes, subsRes, clientsRes, woRes, alertsRes] = await Promise.all([
      supabase.from("shops").select("id, name, email, country, currency, timezone, status, created_at"),
      supabase.from("subscriptions").select("shop_id, plan, status, trial_end"),
      supabase.from("clients").select("id, shop_id"),
      supabase.from("work_orders").select("id, shop_id, total, status"),
      supabase.from("alerts").select("id, shop_id, status").eq("status", "pending"),
    ]);

    const subsMap = new Map<string, string>();
    (subsRes.data || []).forEach(s => subsMap.set(s.shop_id, s.plan));

    const countBy = (arr: any[] | null, shopId: string) => (arr || []).filter(r => r.shop_id === shopId).length;
    const revenueBy = (shopId: string) => (woRes.data || [])
      .filter(r => r.shop_id === shopId && (r.status === 'completed' || r.status === 'delivered'))
      .reduce((sum, r) => sum + Number(r.total || 0), 0);

    const rows: ShopRow[] = (shopsRes.data || []).map(s => ({
      ...s,
      plan: subsMap.get(s.id) || "free",
      clientCount: countBy(clientsRes.data, s.id),
      workOrderCount: countBy(woRes.data, s.id),
      alertCount: countBy(alertsRes.data, s.id),
      revenue: revenueBy(s.id),
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

  const changePlan = async () => {
    if (!planDialog) return;
    const { shop, newPlan, durationType, durationValue } = planDialog;

    let currentPeriodEnd: string | null = null;
    if (durationType === "days") {
      const d = new Date(); d.setDate(d.getDate() + durationValue);
      currentPeriodEnd = d.toISOString();
    } else if (durationType === "months") {
      const d = new Date(); d.setMonth(d.getMonth() + durationValue);
      currentPeriodEnd = d.toISOString();
    }
    // "unlimited" → null (sem data de fim)

    const updateData: Record<string, any> = {
      plan: newPlan,
      status: "active",
      current_period_end: currentPeriodEnd,
    };

    const { error } = await supabase.from("subscriptions")
      .update(updateData)
      .eq("shop_id", shop.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const durationLabel = durationType === "unlimited" ? "ilimitado" : `${durationValue} ${durationType === "days" ? "dias" : "meses"}`;
      await logAction("plan_changed", "subscription", shop.id, { name: shop.name, from: shop.plan, to: newPlan, duration: durationLabel });
      toast({ title: `Plano ${newPlan.toUpperCase()} atribuído (${durationLabel})` });
      fetchShops();
    }
    setPlanDialog(null);
  };

  const handleDeleteShop = async () => {
    if (!deleteShop) return;
    // Use server-side cascade delete function
    const { error } = await supabase.rpc('cascade_delete_shop', { _shop_id: deleteShop.id });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction("shop_deleted", "shop", deleteShop.id, { name: deleteShop.name });
      toast({ title: "Oficina eliminada permanentemente" });
      fetchShops();
    }
    setDeleteShop(null);
  };

  const exportCSV = () => {
    const headers = ["Nome", "Email", "País", "Plano", "Estado", "Clientes", "Serviços", "Faturação", "Criada em"];
    const rows = filtered.map(s => [
      s.name, s.email, s.country, s.plan.toUpperCase(), s.status,
      s.clientCount, s.workOrderCount, `€${s.revenue.toFixed(2)}`,
      new Date(s.created_at).toLocaleDateString("pt-PT"),
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.map(c => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `oficinas_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q)) return false;
    }
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Oficinas</h1>
          <p className="text-sm text-muted-foreground">Gerir todas as oficinas do sistema ({shops.length} total)</p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar nome, email, ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativa</SelectItem>
            <SelectItem value="suspended">Suspensa</SelectItem>
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
              <TableHead>Email</TableHead>
              <TableHead>País</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Clientes</TableHead>
              <TableHead className="text-center">Serviços</TableHead>
              <TableHead className="text-right">Faturação</TableHead>
              <TableHead>Criada</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(shop => (
              <TableRow key={shop.id}>
                <TableCell className="font-medium">{shop.name || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{shop.email || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{shop.country}</TableCell>
                <TableCell>
                  <button onClick={() => setPlanDialog({ shop, newPlan: shop.plan, durationType: "months", durationValue: 1 })}>
                    {planBadge(shop.plan)}
                  </button>
                </TableCell>
                <TableCell>{statusBadge(shop.status)}</TableCell>
                <TableCell className="text-center mono">{shop.clientCount}</TableCell>
                <TableCell className="text-center mono">{shop.workOrderCount}</TableCell>
                <TableCell className="text-right mono">€{shop.revenue.toFixed(2)}</TableCell>
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {new Date(shop.created_at).toLocaleDateString("pt-PT")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/shops/${shop.id}`)} title="Ver detalhes">
                      <Eye className="w-4 h-4" />
                    </Button>
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
                    <Button variant="ghost" size="icon" onClick={() => setDeleteShop(shop)} title="Eliminar oficina">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  Nenhuma oficina encontrada
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Change Plan Dialog */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano - {planDialog?.shop.name}</DialogTitle>
            <DialogDescription>Selecione o plano e a duração a oferecer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Plano</label>
              <Select value={planDialog?.newPlan || "free"} onValueChange={v => planDialog && setPlanDialog({ ...planDialog, newPlan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro (€49/mês)</SelectItem>
                  <SelectItem value="garage">Garage (€99/mês)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Duração</label>
              <Select value={planDialog?.durationType || "months"} onValueChange={v => planDialog && setPlanDialog({ ...planDialog, durationType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">Dias</SelectItem>
                  <SelectItem value="months">Meses</SelectItem>
                  <SelectItem value="unlimited">Ilimitado (sem expiração)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {planDialog?.durationType !== "unlimited" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Quantidade ({planDialog?.durationType === "days" ? "dias" : "meses"})
                </label>
                <Input
                  type="number"
                  min={1}
                  max={planDialog?.durationType === "days" ? 3650 : 120}
                  value={planDialog?.durationValue || 1}
                  onChange={e => planDialog && setPlanDialog({ ...planDialog, durationValue: Math.max(1, parseInt(e.target.value) || 1) })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanDialog(null)}>Cancelar</Button>
            <Button onClick={changePlan}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Shop Dialog */}
      <Dialog open={!!deleteShop} onOpenChange={() => setDeleteShop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Oficina</DialogTitle>
            <DialogDescription>
              Tem a certeza que deseja eliminar permanentemente a oficina "{deleteShop?.name}"?
              Todos os dados (clientes, veículos, orçamentos, serviços) serão apagados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteShop(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDeleteShop}>Eliminar Permanentemente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
