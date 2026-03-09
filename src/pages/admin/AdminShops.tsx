import { useEffect, useState, useCallback } from "react";
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
import { Power, PowerOff, RotateCcw, Search, Bell, Download, Eye, Trash2, LogIn, Building2, Clock, Users, Wrench, DollarSign } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

interface ShopRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  currency: string;
  timezone: string;
  status: string;
  created_at: string;
  plan: string;
  subStatus: string;
  trialEnd: string | null;
  currentPeriodEnd: string | null;
  stripeManaged: boolean;
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

  const fetchShops = useCallback(async () => {
    setLoading(true);
    const [shopsRes, subsRes, clientsRes, woRes, alertsRes] = await Promise.all([
      supabase.from("shops").select("id, name, email, phone, country, currency, timezone, status, created_at"),
      supabase.from("subscriptions").select("shop_id, plan, status, trial_end, current_period_end, stripe_subscription_id"),
      supabase.from("clients").select("id, shop_id"),
      supabase.from("work_orders").select("id, shop_id, total, status"),
      supabase.from("alerts").select("id, shop_id, status").eq("status", "pending"),
    ]);

    const subsMap = new Map<string, { plan: string; status: string; trial_end: string | null; current_period_end: string | null; stripe_subscription_id: string | null }>();
    (subsRes.data || []).forEach(s => subsMap.set(s.shop_id, s));

    const countBy = (arr: any[] | null, shopId: string) => (arr || []).filter(r => r.shop_id === shopId).length;
    const revenueBy = (shopId: string) => (woRes.data || [])
      .filter(r => r.shop_id === shopId && (r.status === 'completed' || r.status === 'delivered'))
      .reduce((sum, r) => sum + Number(r.total || 0), 0);

    const rows: ShopRow[] = (shopsRes.data || []).map(s => {
      const sub = subsMap.get(s.id);
      return {
        ...s,
        plan: sub?.plan || "free",
        subStatus: sub?.status || "active",
        trialEnd: sub?.trial_end || null,
        currentPeriodEnd: sub?.current_period_end || null,
        stripeManaged: !!sub?.stripe_subscription_id,
        clientCount: countBy(clientsRes.data, s.id),
        workOrderCount: countBy(woRes.data, s.id),
        alertCount: countBy(alertsRes.data, s.id),
        revenue: revenueBy(s.id),
      };
    });

    // Sort by created_at DESC
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setShops(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShops();

    const channel = supabase
      .channel("admin-shops-list-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, () => fetchShops())
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => fetchShops())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchShops]);

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
    }
  };

  const impersonateShop = (shop: ShopRow) => {
    localStorage.setItem("garageflow_active_shop", shop.id);
    window.location.href = "/dashboard";
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

    const updateData: Record<string, any> = {
      plan: newPlan,
      status: "active",
      current_period_end: currentPeriodEnd,
      stripe_subscription_id: null,
      updated_at: new Date().toISOString(),
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
    }
    setPlanDialog(null);
  };

  const handleDeleteShop = async () => {
    if (!deleteShop) return;
    const { error } = await supabase.rpc('cascade_delete_shop', { _shop_id: deleteShop.id });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction("shop_deleted", "shop", deleteShop.id, { name: deleteShop.name });
      toast({ title: "Oficina eliminada permanentemente" });
    }
    setDeleteShop(null);
  };

  const exportCSV = () => {
    const headers = ["Nome", "Email", "Telefone", "País", "Plano", "Estado Sub.", "Stripe", "Estado Oficina", "Clientes", "Serviços", "Faturação", "Trial Fim", "Período Fim", "Criada em"];
    const rows = filtered.map(s => [
      s.name, s.email, s.phone, s.country, s.plan.toUpperCase(), s.subStatus,
      s.stripeManaged ? "Sim" : "Manual", s.status,
      s.clientCount, s.workOrderCount, `€${s.revenue.toFixed(2)}`,
      s.trialEnd ? new Date(s.trialEnd).toLocaleDateString("pt-PT") : "—",
      s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString("pt-PT") : "—",
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

  const subStatusBadge = (status: string, stripeManaged: boolean) => {
    const label = stripeManaged ? `${status} (Stripe)` : `${status} (Manual)`;
    const colors: Record<string, string> = {
      active: "bg-success/10 text-success",
      trialing: "bg-warning/10 text-warning",
      canceled: "bg-destructive/10 text-destructive",
      cancelled: "bg-destructive/10 text-destructive",
      past_due: "bg-destructive/10 text-destructive",
    };
    return <Badge variant="outline" className={`text-[10px] ${colors[status] || "bg-muted"}`}>{label}</Badge>;
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
      if (!s.name.toLowerCase().includes(q) && !s.email.toLowerCase().includes(q) && !s.id.toLowerCase().includes(q) && !s.phone.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Summary stats
  const totalRevenue = filtered.reduce((s, sh) => s + sh.revenue, 0);
  const totalClients = filtered.reduce((s, sh) => s + sh.clientCount, 0);
  const totalWO = filtered.reduce((s, sh) => s + sh.workOrderCount, 0);

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
          <p className="text-sm text-muted-foreground">
            Gerir todas as oficinas · {shops.length} total · Atualização em tempo real
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Filtradas</p>
            <p className="text-lg font-bold mono">{filtered.length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Clientes</p>
            <p className="text-lg font-bold mono">{totalClients}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Wrench className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Serviços</p>
            <p className="text-lg font-bold mono">{totalWO}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">Faturação</p>
            <p className="text-lg font-bold mono">€{totalRevenue.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar nome, email, telefone, ID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
              <TableHead>Oficina</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Subscrição</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-center">Clientes</TableHead>
              <TableHead className="text-center">Serviços</TableHead>
              <TableHead className="text-center">Alertas</TableHead>
              <TableHead className="text-right">Faturação</TableHead>
              <TableHead>Criada</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(shop => (
              <TableRow key={shop.id} className="group">
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{shop.name || "—"}</p>
                    <p className="text-[11px] text-muted-foreground">{shop.email}</p>
                    {shop.phone && <p className="text-[10px] text-muted-foreground">{shop.phone}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <button onClick={() => setPlanDialog({ shop, newPlan: shop.plan, durationType: "months", durationValue: 1 })}>
                    {planBadge(shop.plan)}
                  </button>
                </TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    {subStatusBadge(shop.subStatus, shop.stripeManaged)}
                    {shop.trialEnd && new Date(shop.trialEnd) > new Date() && (
                      <p className="text-[10px] text-warning flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        Trial: {Math.ceil((new Date(shop.trialEnd).getTime() - Date.now()) / 86400000)}d
                      </p>
                    )}
                    {shop.currentPeriodEnd && (
                      <p className="text-[10px] text-muted-foreground">
                        Até: {new Date(shop.currentPeriodEnd).toLocaleDateString("pt-PT")}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell>{statusBadge(shop.status)}</TableCell>
                <TableCell className="text-center mono text-sm">{shop.clientCount}</TableCell>
                <TableCell className="text-center mono text-sm">{shop.workOrderCount}</TableCell>
                <TableCell className="text-center">
                  {shop.alertCount > 0 ? (
                    <Badge variant="outline" className="bg-warning/10 text-warning text-xs">{shop.alertCount}</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right mono text-sm">€{shop.revenue.toFixed(0)}</TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(shop.created_at).toLocaleDateString("pt-PT")}
                </TableCell>
                <TableCell>
                  <div className="flex gap-0.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/admin/shops/${shop.id}`)} title="Ver detalhes">
                      <Eye className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => impersonateShop(shop)} title="Entrar como oficina">
                      <LogIn className="w-3.5 h-3.5 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleStatus(shop)}
                      title={shop.status === "active" ? "Suspender" : "Ativar"}>
                      {shop.status === "active"
                        ? <PowerOff className="w-3.5 h-3.5 text-destructive" />
                        : <Power className="w-3.5 h-3.5 text-success" />
                      }
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resetTrial(shop)} title="Reset Trial">
                      <RotateCcw className="w-3.5 h-3.5 text-primary" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resetAlerts(shop)} title="Reset Alertas">
                      <Bell className="w-3.5 h-3.5 text-warning" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteShop(shop)} title="Eliminar oficina">
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
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
            <DialogDescription>
              Plano atual: <strong>{planDialog?.shop.plan.toUpperCase()}</strong>
              {planDialog?.shop.stripeManaged && " (Gerido pelo Stripe — será convertido para manual)"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Plano</label>
              <Select value={planDialog?.newPlan || "free"} onValueChange={v => planDialog && setPlanDialog({ ...planDialog, newPlan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free (€0/mês)</SelectItem>
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
