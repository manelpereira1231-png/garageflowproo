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
import { Download, ArrowUpDown, DollarSign, TrendingUp, Users, Clock, CreditCard, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useNavigate } from "react-router-dom";

interface SubRow {
  id: string;
  shop_id: string;
  shop_name: string;
  plan: string;
  status: string;
  billing_cycle: string;
  trial_end: string | null;
  current_period_end: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

const PLAN_PRICES: Record<string, number> = { free: 0, pro: 49, garage: 99 };

export default function AdminBilling() {
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [planDialog, setPlanDialog] = useState<{ sub: SubRow; newPlan: string; durationType: string; durationValue: number } | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const fetchSubs = async () => {
    setLoading(true);
    const [subsRes, shopsRes] = await Promise.all([
      supabase.from("subscriptions").select("*"),
      supabase.from("shops").select("id, name"),
    ]);
    const shopMap = new Map<string, string>();
    (shopsRes.data || []).forEach(s => shopMap.set(s.id, s.name));

    const rows: SubRow[] = (subsRes.data || []).map(s => ({
      ...s,
      shop_name: shopMap.get(s.shop_id) || "—",
    }));
    rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setSubs(rows);
    setLoading(false);
  };

  useEffect(() => {
    fetchSubs();

    const channel = supabase
      .channel("admin-billing-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => {
        fetchSubs();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const logAction = async (action: string, entityType: string, entityId: string, details: Record<string, any> = {}) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      action, entity_type: entityType, entity_id: entityId, user_id: user?.id, details,
    });
  };

  const changePlan = async () => {
    if (!planDialog) return;
    const { sub, newPlan, durationType, durationValue } = planDialog;

    let currentPeriodEnd: string | null = null;
    if (durationType === "days") {
      const d = new Date(); d.setDate(d.getDate() + durationValue);
      currentPeriodEnd = d.toISOString();
    } else if (durationType === "months") {
      const d = new Date(); d.setMonth(d.getMonth() + durationValue);
      currentPeriodEnd = d.toISOString();
    }

    const { error } = await supabase.from("subscriptions").update({
      plan: newPlan, status: "active", current_period_end: currentPeriodEnd,
      stripe_subscription_id: null,
    }).eq("id", sub.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const durationLabel = durationType === "unlimited" ? "ilimitado" : `${durationValue} ${durationType === "days" ? "dias" : "meses"}`;
      await logAction("plan_changed", "subscription", sub.shop_id, { shop: sub.shop_name, from: sub.plan, to: newPlan, duration: durationLabel });
      toast({ title: `Plano ${newPlan.toUpperCase()} atribuído (${durationLabel})` });
      fetchSubs();
    }
    setPlanDialog(null);
  };

  const cancelSub = async (sub: SubRow) => {
    const { error } = await supabase.from("subscriptions").update({ status: "canceled", plan: "free" }).eq("id", sub.id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      await logAction("subscription_cancelled", "subscription", sub.shop_id, { shop: sub.shop_name });
      toast({ title: "Subscrição cancelada" });
      fetchSubs();
    }
  };

  const exportCSV = () => {
    const headers = ["Oficina", "Plano", "Estado", "Ciclo", "Stripe", "Trial Fim", "Período Fim", "Criada"];
    const rows = filtered.map(s => [
      s.shop_name, s.plan.toUpperCase(), s.status, s.billing_cycle,
      s.stripe_subscription_id ? "Sim" : "Manual",
      s.trial_end ? new Date(s.trial_end).toLocaleDateString("pt-PT") : "—",
      s.current_period_end ? new Date(s.current_period_end).toLocaleDateString("pt-PT") : "—",
      new Date(s.created_at).toLocaleDateString("pt-PT"),
    ]);
    const csv = [headers.join(";"), ...rows.map(r => r.map(c => `"${c}"`).join(";"))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = subs.filter(s => {
    if (filterPlan !== "all" && s.plan !== filterPlan) return false;
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!s.shop_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const trialRemaining = (trialEnd: string | null) => {
    if (!trialEnd) return "—";
    const diff = new Date(trialEnd).getTime() - Date.now();
    if (diff <= 0) return "Expirado";
    return `${Math.ceil(diff / (1000 * 60 * 60 * 24))} dias`;
  };

  // KPI calculations
  const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing');
  const mrr = activeSubs.reduce((sum, s) => sum + (PLAN_PRICES[s.plan] || 0), 0);
  const arr = mrr * 12;
  const paidCount = activeSubs.filter(s => s.plan !== 'free').length;
  const arpu = paidCount > 0 ? mrr / paidCount : 0;
  const trialCount = subs.filter(s => s.status === 'trialing').length;
  const stripeManaged = subs.filter(s => s.stripe_subscription_id).length;
  const manualManaged = subs.length - stripeManaged;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Planos & Billing</h1>
          <p className="text-sm text-muted-foreground">Gestão de subscrições · {subs.length} total · Tempo real</p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <div className="stat-card flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">MRR</p>
            <p className="text-lg font-bold mono">€{mrr}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">ARR</p>
            <p className="text-lg font-bold mono">€{arr}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">ARPU</p>
            <p className="text-lg font-bold mono">€{arpu.toFixed(0)}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Pagantes</p>
            <p className="text-lg font-bold mono">{paidCount}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Clock className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Em Trial</p>
            <p className="text-lg font-bold mono">{trialCount}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Stripe</p>
            <p className="text-lg font-bold mono">{stripeManaged}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-warning flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground">Manual</p>
            <p className="text-lg font-bold mono">{manualManaged}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar oficina..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="trialing">Trial</SelectItem>
            <SelectItem value="canceled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Oficina</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Ciclo</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Trial Restante</TableHead>
              <TableHead>Período Fim</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(sub => (
              <TableRow key={sub.id}>
                <TableCell>
                  <button
                    onClick={() => navigate(`/admin/shops/${sub.shop_id}`)}
                    className="font-medium text-sm text-primary hover:underline"
                  >
                    {sub.shop_name}
                  </button>
                </TableCell>
                <TableCell>
                  <button onClick={() => setPlanDialog({ sub, newPlan: sub.plan, durationType: "months", durationValue: 1 })}>
                    <Badge variant="outline" className={sub.plan === 'garage' ? 'bg-success/15 text-success' : sub.plan === 'pro' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}>
                      {sub.plan.toUpperCase()}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={
                    sub.status === 'active' ? 'bg-success/15 text-success' :
                    sub.status === 'trialing' ? 'bg-primary/15 text-primary' :
                    'bg-destructive/15 text-destructive'
                  }>
                    {sub.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{sub.billing_cycle}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] ${sub.stripe_subscription_id ? 'bg-primary/10 text-primary' : 'bg-warning/10 text-warning'}`}>
                    {sub.stripe_subscription_id ? 'Stripe' : 'Manual'}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm mono">{trialRemaining(sub.trial_end)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-PT") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setPlanDialog({ sub, newPlan: sub.plan, durationType: "months", durationValue: 1 })}>
                      <ArrowUpDown className="w-4 h-4 mr-1" /> Plano
                    </Button>
                    {sub.status !== 'canceled' && (
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => cancelSub(sub)}>
                        Cancelar
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Change Plan Dialog */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Plano - {planDialog?.sub.shop_name}</DialogTitle>
            <DialogDescription>Upgrade ou downgrade do plano desta oficina.</DialogDescription>
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
    </div>
  );
}
