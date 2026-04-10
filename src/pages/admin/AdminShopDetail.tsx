import { useEffect, useState, useCallback } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Users, Car, FileText, Wrench, DollarSign, TrendingUp, AlertTriangle, Pencil,
  LogIn, Power, PowerOff, RotateCcw, Clock, Building2, Shield, Percent, Trash2,
  CreditCard, History, Activity,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";

interface ShopDetail {
  id: string; name: string; email: string; phone: string; country: string;
  currency: string; timezone: string; status: string; created_at: string;
  logo_url: string | null; vat_rate: number; labor_rate: number;
  nif: string | null; address: string | null; language: string; slug: string | null;
}

interface SubDetail {
  plan: string; status: string; billing_cycle: string;
  trial_end: string | null; current_period_end: string | null;
  stripe_customer_id: string | null; stripe_subscription_id: string | null;
  discount_percent: number; discount_reason: string | null;
  discount_applied_at: string | null; discount_expires_at: string | null;
}

const PLAN_PRICES: Record<string, number> = { free: 0, pro: 49, garage: 99 };

export default function AdminShopDetail() {
  const { t } = useLanguage();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [sub, setSub] = useState<SubDetail | null>(null);
  const [stats, setStats] = useState({ clients: 0, vehicles: 0, quotes: 0, workOrders: 0, invoices: 0, revenue: 0, avgTicket: 0, pendingAlerts: 0, teamMembers: 0 });
  const [monthlyData, setMonthlyData] = useState<{ month: string; revenue: number; orders: number }[]>([]);
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "", nif: "", address: "", vat_rate: "23", labor_rate: "35" });
  const [saving, setSaving] = useState(false);
  const [stripeInvoices, setStripeInvoices] = useState<any[]>([]);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [planHistory, setPlanHistory] = useState<{ action: string; from?: string; to?: string; date: string; details?: any }[]>([]);

  // Confirmation dialogs
  const [confirmAction, setConfirmAction] = useState<{ type: string; title: string; description: string; onConfirm: () => Promise<void> } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Discount dialog
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountForm, setDiscountForm] = useState({ percent: "0", reason: "", permanent: true, expiresMonths: "1" });
  const [discountSaving, setDiscountSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!id) return;
    const [shopRes, subRes, clientsRes, vehiclesRes, quotesRes, woRes, alertsRes, logsRes, teamRes, invoicesRes, servicesRes] = await Promise.all([
      supabase.from("shops").select("*").eq("id", id).single(),
      supabase.from("subscriptions").select("plan, status, billing_cycle, trial_end, current_period_end, stripe_customer_id, stripe_subscription_id, discount_percent, discount_reason, discount_applied_at, discount_expires_at").eq("shop_id", id).maybeSingle(),
      supabase.from("clients").select("id, name, email, phone, created_at").eq("shop_id", id).is("deleted_at", null).order("created_at", { ascending: false }).limit(50),
      supabase.from("vehicles").select("id").eq("shop_id", id).is("deleted_at", null),
      supabase.from("quotes").select("id, number, status, total, created_at, client_id").eq("shop_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("work_orders").select("id, number, total, status, created_at, technician").eq("shop_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("alerts").select("id, status").eq("shop_id", id).eq("status", "pending"),
      supabase.from("audit_logs").select("*").eq("entity_id", id).order("created_at", { ascending: false }).limit(25),
      supabase.rpc("get_shop_member_emails", { _shop_id: id }),
      supabase.from("invoices").select("id, number, status, total, created_at").eq("shop_id", id).order("created_at", { ascending: false }).limit(50),
      supabase.from("service_catalog").select("id, name, default_price, active").eq("shop_id", id),
    ]);

    if (shopRes.data) setShop(shopRes.data as ShopDetail);
    if (subRes.data) setSub(subRes.data as SubDetail);

    const { data: shopUsers } = await supabase.from("shop_users").select("user_id, role, created_at").eq("shop_id", id);
    const emailMap = new Map<string, string>();
    ((teamRes.data || []) as any[]).forEach((e: any) => emailMap.set(e.user_id, e.email));
    setTeamMembers((shopUsers || []).map(su => ({
      ...su,
      email: emailMap.get(su.user_id) || "—",
    })));

    setClients(clientsRes.data || []);
    setQuotes(quotesRes.data || []);
    setInvoices(invoicesRes.data || []);
    setServices(servicesRes.data || []);

    const completed = (woRes.data || []).filter(wo => wo.status === 'completed' || wo.status === 'delivered');
    const revenue = completed.reduce((s, wo) => s + Number(wo.total || 0), 0);

    setStats({
      clients: clientsRes.data?.length || 0,
      vehicles: vehiclesRes.data?.length || 0,
      quotes: quotesRes.data?.length || 0,
      workOrders: woRes.data?.length || 0,
      invoices: invoicesRes.data?.length || 0,
      revenue,
      avgTicket: completed.length > 0 ? revenue / completed.length : 0,
      pendingAlerts: alertsRes.data?.length || 0,
      teamMembers: shopUsers?.length || 0,
    });

    const now = new Date();
    const md: { month: string; revenue: number; orders: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = d.toLocaleDateString("pt-PT", { month: "short" });
      const monthOrders = (woRes.data || []).filter(wo => {
        const woDate = new Date(wo.created_at);
        return woDate.getMonth() === d.getMonth() && woDate.getFullYear() === d.getFullYear();
      });
      const monthRevenue = monthOrders.filter(wo => wo.status === 'completed' || wo.status === 'delivered')
        .reduce((s, wo) => s + Number(wo.total || 0), 0);
      md.push({ month: monthStr, revenue: Math.round(monthRevenue), orders: monthOrders.length });
    }
    setMonthlyData(md);
    setRecentLogs(logsRes.data || []);

    // Extract plan history from audit logs
    const history = (logsRes.data || [])
      .filter((l: any) => ['plan_changed', 'discount_applied', 'discount_removed', 'trial_reset', 'shop_activated', 'shop_suspended'].includes(l.action))
      .map((l: any) => ({
        action: l.action,
        from: l.details?.from,
        to: l.details?.to,
        date: l.created_at,
        details: l.details,
      }));
    setPlanHistory(history);

    setLoading(false);
  }, [id]);

  // Fetch Stripe invoices when sub has stripe_customer_id
  const fetchStripeInvoices = useCallback(async (customerId: string) => {
    if (!customerId) return;
    setStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription", {
        body: { action: "list_invoices", customer_id: customerId },
      });
      if (!error && data?.invoices) {
        setStripeInvoices(data.invoices);
      }
    } catch (e) {
      console.warn("Could not fetch Stripe invoices:", e);
    }
    setStripeLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
    if (!id) return;

    const channel = supabase
      .channel(`admin-shop-detail-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions", filter: `shop_id=eq.${id}` }, () => fetchAll())
      .on("postgres_changes", { event: "*", schema: "public", table: "shops", filter: `id=eq.${id}` }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id, fetchAll]);

  // --- Confirmation wrapper ---
  const confirmAndExecute = (type: string, title: string, description: string, onConfirm: () => Promise<void>) => {
    setConfirmAction({ type, title, description, onConfirm });
  };

  const executeConfirmed = async () => {
    if (!confirmAction) return;
    setConfirmLoading(true);
    try {
      await confirmAction.onConfirm();
    } finally {
      setConfirmLoading(false);
      setConfirmAction(null);
    }
  };

  // --- Actions with confirmation ---
  const handleChangePlan = (newPlan: string) => {
    if (!id || newPlan === sub?.plan) return;
    const oldPlan = sub?.plan || 'free';
    confirmAndExecute(
      "plan_change",
      "Alterar Plano",
      `Tem a certeza que pretende alterar o plano de ${oldPlan.toUpperCase()} para ${newPlan.toUpperCase()}?`,
      async () => {
        const { data: existing } = await supabase.from("subscriptions").select("id").eq("shop_id", id).maybeSingle();
        let error;
        if (existing) {
          ({ error } = await supabase.from("subscriptions").update({
            plan: newPlan, status: 'active', stripe_subscription_id: null, updated_at: new Date().toISOString(),
          }).eq("shop_id", id));
        } else {
          ({ error } = await supabase.from("subscriptions").insert({ shop_id: id, plan: newPlan, status: 'active' }));
        }
        if (error) { toast.error("Erro ao alterar plano: " + error.message); return; }
        await logAudit({ action: "plan_changed", entityType: "subscription", entityId: id, details: { name: shop?.name, from: oldPlan, to: newPlan } });
        toast.success(`Plano alterado para ${newPlan.toUpperCase()}`);
      }
    );
  };

  const toggleShopStatus = () => {
    if (!shop || !id) return;
    const newStatus = shop.status === 'active' ? 'suspended' : 'active';
    const actionWord = newStatus === 'active' ? 'ativar' : 'suspender';
    confirmAndExecute(
      "status_change",
      `${newStatus === 'active' ? 'Ativar' : 'Suspender'} Oficina`,
      `Tem a certeza que pretende ${actionWord} a oficina "${shop.name}"?`,
      async () => {
        const { error } = await supabase.from("shops").update({ status: newStatus }).eq("id", id);
        if (error) { toast.error(error.message); return; }
        await logAudit({ action: newStatus === 'active' ? 'shop_activated' : 'shop_suspended', entityType: "shop", entityId: id, details: { name: shop.name } });
        toast.success(`Oficina ${newStatus === 'active' ? 'ativada' : 'suspensa'}`);
      }
    );
  };

  const resetTrial = () => {
    if (!id) return;
    confirmAndExecute(
      "trial_reset",
      "Reset de Trial",
      `Tem a certeza que pretende reiniciar o trial de 30 dias para "${shop?.name}"? Esta ação é auditada.`,
      async () => {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 30);
        const { error } = await supabase.from("subscriptions")
          .update({ trial_end: trialEnd.toISOString(), status: "trialing" })
          .eq("shop_id", id);
        if (error) { toast.error(error.message); return; }
        await logAudit({ action: "trial_reset", entityType: "subscription", entityId: id, details: { name: shop?.name, new_trial_end: trialEnd.toISOString() } });
        toast.success("Trial reiniciado (30 dias)");
      }
    );
  };

  const impersonateShop = () => {
    if (!id) return;
    localStorage.setItem("garageflow_active_shop", id);
    window.location.href = "/dashboard";
  };

  // --- Discount System ---
  const openDiscountDialog = () => {
    setDiscountForm({
      percent: String(sub?.discount_percent || 0),
      reason: "",
      permanent: true,
      expiresMonths: "1",
    });
    setDiscountOpen(true);
  };

  const handleApplyDiscount = async () => {
    if (!id || !shop) return;
    const percent = parseFloat(discountForm.percent);
    if (isNaN(percent) || percent < 0 || percent > 80) {
      toast.error("Desconto deve ser entre 0% e 80%");
      return;
    }
    if (!discountForm.reason.trim()) {
      toast.error("Motivo obrigatório para aplicar desconto");
      return;
    }

    setDiscountSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let expiresAt: string | null = null;
      if (!discountForm.permanent) {
        const d = new Date();
        d.setMonth(d.getMonth() + parseInt(discountForm.expiresMonths));
        expiresAt = d.toISOString();
      }

      const { error } = await supabase.from("subscriptions").update({
        discount_percent: percent,
        discount_reason: discountForm.reason,
        discount_applied_at: new Date().toISOString(),
        discount_applied_by: user?.id || null,
        discount_expires_at: expiresAt,
      }).eq("shop_id", id);

      if (error) { toast.error(error.message); return; }

      const oldDiscount = sub?.discount_percent || 0;
      await logAudit({
        action: "discount_applied",
        entityType: "subscription",
        entityId: id,
        details: {
          name: shop.name,
          old_discount: `${oldDiscount}%`,
          new_discount: `${percent}%`,
          reason: discountForm.reason,
          permanent: discountForm.permanent,
          expires_at: expiresAt,
        },
      });

      toast.success(`Desconto de ${percent}% aplicado com sucesso`);
      setDiscountOpen(false);
    } finally {
      setDiscountSaving(false);
    }
  };

  const removeDiscount = () => {
    if (!id) return;
    confirmAndExecute(
      "discount_remove",
      "Remover Desconto",
      `Tem a certeza que pretende remover o desconto de ${sub?.discount_percent}% da oficina "${shop?.name}"?`,
      async () => {
        const { error } = await supabase.from("subscriptions").update({
          discount_percent: 0,
          discount_reason: null,
          discount_applied_at: null,
          discount_applied_by: null,
          discount_expires_at: null,
        }).eq("shop_id", id);
        if (error) { toast.error(error.message); return; }
        await logAudit({ action: "discount_removed", entityType: "subscription", entityId: id, details: { name: shop?.name, old_discount: `${sub?.discount_percent}%` } });
        toast.success("Desconto removido");
      }
    );
  };

  // --- Edit dialog ---
  const openEditDialog = () => {
    if (!shop) return;
    setEditForm({
      name: shop.name || "", email: shop.email || "", phone: shop.phone || "",
      nif: shop.nif || "", address: shop.address || "",
      vat_rate: String(shop.vat_rate), labor_rate: String(shop.labor_rate),
    });
    setEditOpen(true);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    const { error } = await supabase.from("shops").update({
      name: editForm.name, email: editForm.email, phone: editForm.phone,
      nif: editForm.nif || null, address: editForm.address || null,
      vat_rate: parseFloat(editForm.vat_rate), labor_rate: parseFloat(editForm.labor_rate),
    }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t('settings.saved')); setEditOpen(false); }
    setSaving(false);
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      draft: "bg-muted text-muted-foreground", sent: "bg-info/15 text-info",
      approved: "bg-success/15 text-success", rejected: "bg-destructive/15 text-destructive",
      open: "bg-primary/15 text-primary", in_progress: "bg-warning/15 text-warning",
      completed: "bg-success/15 text-success", delivered: "bg-success/15 text-success",
      paid: "bg-success/15 text-success", pending: "bg-warning/15 text-warning",
      overdue: "bg-destructive/15 text-destructive",
    };
    return <Badge variant="outline" className={`text-[10px] ${colors[status] || "bg-muted"}`}>{status}</Badge>;
  };

  if (loading || !shop) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const plan = sub?.plan || 'free';
  const trialDays = sub?.trial_end && new Date(sub.trial_end) > new Date()
    ? Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000) : 0;
  const discount = sub?.discount_percent || 0;
  const originalPrice = PLAN_PRICES[plan] || 0;
  const discountedPrice = originalPrice * (1 - discount / 100);
  const mrrImpact = originalPrice - discountedPrice;

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={() => navigate("/admin/shops")} className="gap-2">
        <ArrowLeft className="w-4 h-4" /> Voltar às oficinas
      </Button>

      {/* Header */}
      <div className="stat-card">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">{shop.name || "Sem nome"}</h1>
            <p className="text-sm text-muted-foreground">{shop.email} · {shop.phone}</p>
            <p className="text-sm text-muted-foreground">{shop.country} · {shop.currency} · {shop.timezone} · {shop.language.toUpperCase()}</p>
            {shop.nif && <p className="text-sm text-muted-foreground">NIF: {shop.nif}</p>}
            {shop.address && <p className="text-sm text-muted-foreground">{shop.address}</p>}
            {shop.slug && <p className="text-xs text-muted-foreground">Slug: {shop.slug}</p>}
            <p className="text-xs text-muted-foreground mt-1">IVA: {shop.vat_rate}% · Mão de obra: €{shop.labor_rate}/h</p>
            <p className="text-xs text-muted-foreground">Criada: {new Date(shop.created_at).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={openEditDialog} className="gap-1">
              <Pencil className="w-3 h-3" /> Editar
            </Button>
            <Button variant="outline" size="sm" onClick={impersonateShop} className="gap-1">
              <LogIn className="w-3 h-3" /> Entrar
            </Button>
            <Button variant="outline" size="sm" onClick={toggleShopStatus} className="gap-1">
              {shop.status === 'active' ? <PowerOff className="w-3 h-3 text-destructive" /> : <Power className="w-3 h-3 text-success" />}
              {shop.status === 'active' ? 'Suspender' : 'Ativar'}
            </Button>
            <Button variant="outline" size="sm" onClick={resetTrial} className="gap-1">
              <RotateCcw className="w-3 h-3" /> Reset Trial
            </Button>
            <Button variant="outline" size="sm" onClick={openDiscountDialog} className="gap-1">
              <Percent className="w-3 h-3" /> Desconto
            </Button>
            <Badge variant="outline" className={shop.status === 'active' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}>
              {shop.status === 'active' ? 'Ativa' : 'Suspensa'}
            </Badge>
            <Select value={plan} onValueChange={handleChangePlan}>
              <SelectTrigger className="w-[130px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">FREE</SelectItem>
                <SelectItem value="pro">PRO</SelectItem>
                <SelectItem value="garage">GARAGE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Subscription details */}
        {sub && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex flex-wrap gap-4 text-xs">
              <span>Estado: <strong>{sub.status}</strong></span>
              <span>Ciclo: <strong>{sub.billing_cycle}</strong></span>
              {sub.stripe_subscription_id && <span className="text-primary">Stripe: {sub.stripe_subscription_id.slice(0, 20)}…</span>}
              {!sub.stripe_subscription_id && <span className="text-warning">Plano Manual (sem Stripe)</span>}
              {trialDays > 0 && <span className="text-warning flex items-center gap-1"><Clock className="w-3 h-3" /> Trial: {trialDays} dias restantes</span>}
              {sub.current_period_end && <span>Expira: {new Date(sub.current_period_end).toLocaleDateString("pt-PT")}</span>}
            </div>

            {/* Discount info */}
            {discount > 0 && (
              <div className="mt-2 p-3 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Percent className="w-4 h-4 text-success" />
                    <span className="text-sm font-semibold text-success">{discount}% desconto</span>
                    <span className="text-xs text-muted-foreground">
                      <span className="line-through">€{originalPrice}</span> → <strong>€{discountedPrice.toFixed(2)}</strong>/mês
                    </span>
                    <span className="text-xs text-destructive">(-€{mrrImpact.toFixed(2)} MRR)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {sub.discount_expires_at ? (
                      <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning">
                        Expira: {new Date(sub.discount_expires_at).toLocaleDateString("pt-PT")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] bg-success/10 text-success">Permanente</Badge>
                    )}
                    <Button variant="ghost" size="sm" onClick={removeDiscount} className="h-6 text-xs text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  </div>
                </div>
                {sub.discount_reason && (
                  <p className="text-xs text-muted-foreground mt-1">Motivo: {sub.discount_reason}</p>
                )}
                {sub.discount_applied_at && (
                  <p className="text-[10px] text-muted-foreground">
                    Aplicado em: {new Date(sub.discount_applied_at).toLocaleString("pt-PT")}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
        {[
          { label: "Equipa", value: stats.teamMembers, icon: Shield },
          { label: "Clientes", value: stats.clients, icon: Users },
          { label: "Veículos", value: stats.vehicles, icon: Car },
          { label: "Orçamentos", value: stats.quotes, icon: FileText },
          { label: "Serviços", value: stats.workOrders, icon: Wrench },
          { label: "Faturas", value: stats.invoices, icon: FileText },
          { label: "Faturação", value: `€${stats.revenue.toFixed(0)}`, icon: DollarSign },
          { label: "Ticket Médio", value: `€${stats.avgTicket.toFixed(0)}`, icon: TrendingUp },
          { label: "Alertas", value: stats.pendingAlerts, icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className="stat-card text-center py-2">
            <s.icon className="w-3.5 h-3.5 mx-auto mb-0.5 text-primary" />
            <p className="text-base font-bold mono leading-tight">{s.value}</p>
            <p className="text-[9px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Resumo</TabsTrigger>
          <TabsTrigger value="team">Equipa ({stats.teamMembers})</TabsTrigger>
          <TabsTrigger value="clients">Clientes ({stats.clients})</TabsTrigger>
          <TabsTrigger value="quotes">Orçamentos ({stats.quotes})</TabsTrigger>
          <TabsTrigger value="services">Serviços ({stats.workOrders})</TabsTrigger>
          <TabsTrigger value="invoices">Faturas ({stats.invoices})</TabsTrigger>
          <TabsTrigger value="catalog">Catálogo ({services.length})</TabsTrigger>
          <TabsTrigger value="stripe" className="gap-1" onClick={() => sub?.stripe_customer_id && fetchStripeInvoices(sub.stripe_customer_id)}>
            <CreditCard className="w-3 h-3" /> Stripe
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1">
            <History className="w-3 h-3" /> Histórico
          </TabsTrigger>
          <TabsTrigger value="logs">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="stat-card">
            <h2 className="text-lg font-semibold mb-4">Faturação vs Serviços (6 meses)</h2>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Faturação (€)" />
                  <Bar dataKey="orders" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} name="Serviços" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="team">
          <div className="stat-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Desde</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{m.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={
                        m.role === 'owner' ? 'bg-primary/15 text-primary' :
                        m.role === 'manager' ? 'bg-success/15 text-success' : 'bg-muted'
                      }>{m.role}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleDateString("pt-PT")}</TableCell>
                  </TableRow>
                ))}
                {teamMembers.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Sem membros</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="clients">
          <div className="stat-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Registado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString("pt-PT")}</TableCell>
                  </TableRow>
                ))}
                {clients.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem clientes</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="quotes">
          <div className="stat-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium text-sm">{q.number}</TableCell>
                    <TableCell>{statusBadge(q.status)}</TableCell>
                    <TableCell className="text-right mono text-sm">€{Number(q.total).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString("pt-PT")}</TableCell>
                  </TableRow>
                ))}
                {quotes.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem orçamentos</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="services">
          <div className="stat-card overflow-x-auto">
            <WorkOrdersTab shopId={id!} statusBadge={statusBadge} />
          </div>
        </TabsContent>

        <TabsContent value="invoices">
          <div className="stat-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-sm">{inv.number}</TableCell>
                    <TableCell>{statusBadge(inv.status)}</TableCell>
                    <TableCell className="text-right mono text-sm">€{Number(inv.total).toFixed(2)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString("pt-PT")}</TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem faturas</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="catalog">
          <div className="stat-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead className="text-right">Preço</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-sm">{s.name}</TableCell>
                    <TableCell className="text-right mono text-sm">€{Number(s.default_price).toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={s.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
                        {s.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {services.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Sem serviços no catálogo</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Stripe Tab */}
        <TabsContent value="stripe">
          <div className="stat-card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary" /> Informação Stripe
            </h2>
            {!sub?.stripe_customer_id ? (
              <div className="text-center py-8">
                <CreditCard className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Esta oficina não tem cliente Stripe associado</p>
                <p className="text-xs text-muted-foreground mt-1">O plano é gerido manualmente</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Customer ID</p>
                    <p className="text-xs font-mono font-medium truncate">{sub.stripe_customer_id}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Subscription ID</p>
                    <p className="text-xs font-mono font-medium truncate">{sub.stripe_subscription_id || "—"}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Estado</p>
                    <Badge variant="outline" className={`text-[10px] ${sub.status === 'active' ? 'bg-success/10 text-success' : sub.status === 'trialing' ? 'bg-warning/10 text-warning' : 'bg-destructive/10 text-destructive'}`}>
                      {sub.status}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground">Período Atual</p>
                    <p className="text-xs font-medium">
                      {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("pt-PT") : "—"}
                    </p>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Faturas Stripe</h3>
                  {stripeLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : stripeInvoices.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Sem faturas Stripe disponíveis</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nº</TableHead>
                          <TableHead>Estado</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead>Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stripeInvoices.map((inv: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm font-mono">{inv.number || "—"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-[10px] ${inv.status === 'paid' ? 'bg-success/10 text-success' : inv.status === 'open' ? 'bg-warning/10 text-warning' : 'bg-muted'}`}>
                                {inv.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right mono text-sm">
                              {inv.currency?.toUpperCase()} {(inv.amount_paid / 100).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {inv.created ? new Date(inv.created * 1000).toLocaleDateString("pt-PT") : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        {/* Plan History Tab */}
        <TabsContent value="history">
          <div className="stat-card">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Histórico de Planos e Alterações
            </h2>
            {planHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Sem alterações registadas</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
                <div className="space-y-4">
                  {planHistory.map((h, i) => {
                    const actionLabels: Record<string, string> = {
                      plan_changed: "Alteração de Plano",
                      discount_applied: "Desconto Aplicado",
                      discount_removed: "Desconto Removido",
                      trial_reset: "Trial Reiniciado",
                      shop_activated: "Oficina Ativada",
                      shop_suspended: "Oficina Suspensa",
                    };
                    const actionColors: Record<string, string> = {
                      plan_changed: "bg-primary",
                      discount_applied: "bg-success",
                      discount_removed: "bg-warning",
                      trial_reset: "bg-primary",
                      shop_activated: "bg-success",
                      shop_suspended: "bg-destructive",
                    };
                    return (
                      <div key={i} className="relative pl-10">
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full ${actionColors[h.action] || 'bg-muted'}`} />
                        <div className="p-3 rounded-lg border border-border">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-sm font-semibold">{actionLabels[h.action] || h.action}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(h.date).toLocaleString("pt-PT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          {h.from && h.to && (
                            <p className="text-sm mt-1">
                              <span className="text-muted-foreground">{String(h.from).toUpperCase()}</span>
                              <span className="mx-1">→</span>
                              <span className="font-bold">{String(h.to).toUpperCase()}</span>
                            </p>
                          )}
                          {h.details?.reason && <p className="text-xs text-muted-foreground mt-1">Motivo: {h.details.reason}</p>}
                          {h.details?.new_discount && <p className="text-xs text-muted-foreground mt-1">Desconto: {h.details.old_discount} → {h.details.new_discount}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="stat-card">
            <h2 className="text-lg font-semibold mb-4">Log de Auditoria</h2>
            {recentLogs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Sem logs registados</p>}
            <div className="space-y-2">
              {recentLogs.map((log: any) => {
                const det = (log.details || {}) as Record<string, any>;
                return (
                  <div key={log.id} className="flex items-start justify-between py-2 border-b border-border last:border-0 gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]">{log.action}</Badge>
                        <span className="text-xs text-muted-foreground">{log.entity_type}</span>
                      </div>
                      {det.from && det.to && (
                        <p className="text-xs mt-0.5">
                          <span className="text-muted-foreground">{String(det.from).toUpperCase()}</span>
                          <span className="text-muted-foreground mx-1">→</span>
                          <span className="font-medium">{String(det.to).toUpperCase()}</span>
                        </p>
                      )}
                      {det.reason && <p className="text-xs text-muted-foreground mt-0.5">Motivo: {det.reason}</p>}
                      {det.old_discount && <p className="text-xs text-muted-foreground mt-0.5">{det.old_discount} → {det.new_discount || "0%"}</p>}
                    </div>
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit Shop Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Editar Oficina</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveShop} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label>Nome *</Label>
                <Input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>NIF</Label>
                <Input value={editForm.nif} onChange={e => setEditForm({...editForm, nif: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Morada</Label>
                <Input value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa IVA (%)</Label>
                <Input type="number" step="0.01" value={editForm.vat_rate} onChange={e => setEditForm({...editForm, vat_rate: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <Label>Taxa Mão de Obra (€/h)</Label>
                <Input type="number" step="0.01" value={editForm.labor_rate} onChange={e => setEditForm({...editForm, labor_rate: e.target.value})} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "A guardar..." : "Guardar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Discount Dialog */}
      <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="w-5 h-5 text-success" /> Aplicar Desconto
            </DialogTitle>
            <DialogDescription>
              Aplique um desconto personalizado (até 80%) para esta oficina. Esta ação será auditada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Percentagem de desconto *</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="80"
                  step="1"
                  value={discountForm.percent}
                  onChange={e => setDiscountForm({ ...discountForm, percent: e.target.value })}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">%</span>
                {plan !== 'free' && (
                  <span className="text-xs text-muted-foreground ml-2">
                    €{PLAN_PRICES[plan]} → <strong>€{(PLAN_PRICES[plan] * (1 - parseFloat(discountForm.percent || "0") / 100)).toFixed(2)}</strong>/mês
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Motivo (obrigatório) *</Label>
              <Textarea
                value={discountForm.reason}
                onChange={e => setDiscountForm({ ...discountForm, reason: e.target.value })}
                placeholder="Ex: Parceiro estratégico, cliente antigo, promoção especial..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Duração</Label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={discountForm.permanent}
                    onChange={() => setDiscountForm({ ...discountForm, permanent: true })}
                    className="accent-primary"
                  />
                  Permanente
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={!discountForm.permanent}
                    onChange={() => setDiscountForm({ ...discountForm, permanent: false })}
                    className="accent-primary"
                  />
                  Temporário
                </label>
              </div>
              {!discountForm.permanent && (
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="24"
                    value={discountForm.expiresMonths}
                    onChange={e => setDiscountForm({ ...discountForm, expiresMonths: e.target.value })}
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">meses</span>
                </div>
              )}
            </div>

            {plan !== 'free' && parseFloat(discountForm.percent || "0") > 0 && (
              <div className="p-3 rounded-lg bg-warning/5 border border-warning/20 text-xs space-y-1">
                <p><strong>Impacto no MRR:</strong> -€{(PLAN_PRICES[plan] * parseFloat(discountForm.percent || "0") / 100).toFixed(2)}/mês</p>
                <p><strong>Preço final:</strong> €{(PLAN_PRICES[plan] * (1 - parseFloat(discountForm.percent || "0") / 100)).toFixed(2)}/mês</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountOpen(false)}>Cancelar</Button>
            <Button onClick={handleApplyDiscount} disabled={discountSaving} className="gap-1">
              {discountSaving ? "A aplicar..." : "Confirmar Desconto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              {confirmAction?.title}
            </DialogTitle>
            <DialogDescription>{confirmAction?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={confirmLoading}>Cancelar</Button>
            <Button
              variant={confirmAction?.type === 'status_change' ? 'destructive' : 'default'}
              onClick={executeConfirmed}
              disabled={confirmLoading}
            >
              {confirmLoading ? "A processar..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component to display work orders in services tab
function WorkOrdersTab({ shopId, statusBadge }: { shopId: string; statusBadge: (s: string) => JSX.Element }) {
  const [workOrders, setWorkOrders] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("work_orders")
      .select("id, number, total, status, created_at, technician")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setWorkOrders(data || []));
  }, [shopId]);

  if (workOrders.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">Sem ordens de serviço</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nº</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Técnico</TableHead>
          <TableHead className="text-right">Total</TableHead>
          <TableHead>Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workOrders.map(wo => (
          <TableRow key={wo.id}>
            <TableCell className="font-medium text-sm">{wo.number}</TableCell>
            <TableCell>{statusBadge(wo.status)}</TableCell>
            <TableCell className="text-sm text-muted-foreground">{wo.technician || "—"}</TableCell>
            <TableCell className="text-right mono text-sm">€{Number(wo.total).toFixed(2)}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{new Date(wo.created_at).toLocaleDateString("pt-PT")}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
