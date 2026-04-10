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
import { useLanguage } from "@/i18n/LanguageContext";

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
  discountPercent: number;
}

export default function AdminShops() {
  const { t } = useLanguage();
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
      supabase.from("subscriptions").select("shop_id, plan, status, trial_end, current_period_end, stripe_subscription_id, discount_percent"),
      supabase.from("clients").select("id, shop_id"),
      supabase.from("work_orders").select("id, shop_id, total, status"),
      supabase.from("alerts").select("id, shop_id, status").eq("status", "pending"),
    ]);

    const subsMap = new Map<string, { plan: string; status: string; trial_end: string | null; current_period_end: string | null; stripe_subscription_id: string | null; discount_percent: number }>();
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
        discountPercent: Number(sub?.discount_percent || 0),
      };
    });

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
      toast({ title: t('admin.common.error'), description: error.message, variant: "destructive" });
    } else {
      await logAction(newStatus === "active" ? "shop_activated" : "shop_suspended", "shop", shop.id, { name: shop.name });
      toast({ title: newStatus === 'active' ? t('admin.shops.shopActivated') : t('admin.shops.shopSuspended') });
    }
  };

  const resetTrial = async (shop: ShopRow) => {
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 30);
    const { error } = await supabase.from("subscriptions")
      .update({ trial_end: trialEnd.toISOString(), status: "trialing" })
      .eq("shop_id", shop.id);
    if (error) {
      toast({ title: t('admin.common.error'), description: error.message, variant: "destructive" });
    } else {
      await logAction("trial_reset", "subscription", shop.id, { name: shop.name });
      toast({ title: t('admin.shops.trialReset30') });
    }
  };

  const resetAlerts = async (shop: ShopRow) => {
    const { error } = await supabase.from("alerts")
      .update({ status: "resolved" })
      .eq("shop_id", shop.id)
      .eq("status", "pending");
    if (error) {
      toast({ title: t('admin.common.error'), description: error.message, variant: "destructive" });
    } else {
      await logAction("alerts_reset", "alerts", shop.id, { name: shop.name });
      toast({ title: t('admin.shops.alertsReset') });
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
      toast({ title: t('admin.common.error'), description: error.message, variant: "destructive" });
    } else {
      const durationLabel = durationType === "unlimited" ? t('admin.shops.unlimited') : `${durationValue} ${durationType === "days" ? t('admin.shops.days') : t('admin.shops.months')}`;
      await logAction("plan_changed", "subscription", shop.id, { name: shop.name, from: shop.plan, to: newPlan, duration: durationLabel });
      toast({ title: `${newPlan.toUpperCase()} ${t('admin.shops.planAssigned')} (${durationLabel})` });
    }
    setPlanDialog(null);
  };

  const handleDeleteShop = async () => {
    if (!deleteShop) return;
    const { error } = await supabase.rpc('cascade_delete_shop', { _shop_id: deleteShop.id });
    if (error) {
      toast({ title: t('admin.common.error'), description: error.message, variant: "destructive" });
    } else {
      await logAction("shop_deleted", "shop", deleteShop.id, { name: deleteShop.name });
      toast({ title: t('admin.shops.shopDeletedPerm') });
    }
    setDeleteShop(null);
  };

  const exportCSV = () => {
    const headers = [t('admin.shops.shop'), "Email", t('admin.shops.plan'), t('admin.shops.status'), t('admin.shops.clients'), t('admin.shops.services'), t('admin.shops.revenue'), t('admin.shops.created')];
    const rows = filtered.map(s => [
      s.name, s.email, s.plan.toUpperCase(), s.status,
      s.clientCount, s.workOrderCount, `€${s.revenue.toFixed(2)}`,
      new Date(s.created_at).toLocaleDateString(),
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
    const statusLabels: Record<string, string> = {
      active: "Ativo",
      trialing: "Em Trial",
      canceled: "Cancelado",
      cancelled: "Cancelado",
      past_due: "Pagamento Pendente",
    };
    const label = `${statusLabels[status] || status} (${stripeManaged ? 'Stripe' : 'Manual'})`;
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
      ? <Badge variant="outline" className="bg-success/15 text-success border-success/30">{t('admin.shops.activeFemale')}</Badge>
      : <Badge variant="outline" className="bg-destructive/15 text-destructive border-destructive/30">{t('admin.shops.suspendedFemale')}</Badge>;
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

  const totalRevenue = filtered.reduce((s, sh) => s + sh.revenue, 0);
  const totalClients = filtered.reduce((s, sh) => s + sh.clientCount, 0);
  const totalWO = filtered.reduce((s, sh) => s + sh.workOrderCount, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <div key={i} className="stat-card h-20 animate-pulse bg-muted/30" />)}
        </div>
        <div className="stat-card h-64 animate-pulse bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('admin.shops.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.shops.subtitle')} · {shops.length} {t('admin.shops.total')} · {t('admin.shops.realtime')}
          </p>
        </div>
        <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" /> {t('admin.shops.exportCsv')}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="stat-card flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t('admin.shops.filtered')}</p>
            <p className="text-lg font-bold mono">{filtered.length}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Users className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t('admin.shops.clients')}</p>
            <p className="text-lg font-bold mono">{totalClients}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <Wrench className="w-5 h-5 text-primary flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t('admin.shops.services')}</p>
            <p className="text-lg font-bold mono">{totalWO}</p>
          </div>
        </div>
        <div className="stat-card flex items-center gap-3">
          <DollarSign className="w-5 h-5 text-success flex-shrink-0" />
          <div>
            <p className="text-xs text-muted-foreground">{t('admin.shops.revenue')}</p>
            <p className="text-lg font-bold mono">€{totalRevenue.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('admin.shops.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterPlan} onValueChange={setFilterPlan}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder={t('admin.shops.plan')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.shops.all')}</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="garage">Garage</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder={t('admin.shops.status')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.shops.all')}</SelectItem>
            <SelectItem value="active">{t('admin.shops.activeFemale')}</SelectItem>
            <SelectItem value="suspended">{t('admin.shops.suspendedFemale')}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder={t('admin.shops.country')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('admin.shops.all')}</SelectItem>
            {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="stat-card text-center py-16">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">{t('admin.shops.noShopFound')}</h3>
          <p className="text-sm text-muted-foreground">{t('admin.shops.subtitle')}</p>
        </div>
      ) : (
        <div className="stat-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin.shops.shop')}</TableHead>
                <TableHead>{t('admin.shops.plan')}</TableHead>
                <TableHead>{t('admin.shops.subscription')}</TableHead>
                <TableHead>{t('admin.shops.status')}</TableHead>
                <TableHead className="text-center">{t('admin.shops.clients')}</TableHead>
                <TableHead className="text-center">{t('admin.shops.services')}</TableHead>
                <TableHead className="text-center">{t('admin.shops.alerts')}</TableHead>
                <TableHead className="text-right">{t('admin.shops.revenue')}</TableHead>
                <TableHead className="text-center">Desconto</TableHead>
                <TableHead>{t('admin.shops.created')}</TableHead>
                <TableHead>{t('admin.shops.actions')}</TableHead>
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
                          {t('admin.shops.until')}: {new Date(shop.currentPeriodEnd).toLocaleDateString()}
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
                  <TableCell className="text-right mono text-sm font-medium">€{shop.revenue.toFixed(0)}</TableCell>
                  <TableCell className="text-center">
                    {shop.discountPercent > 0 ? (
                      <Badge variant="outline" className="bg-warning/10 text-warning text-xs">{shop.discountPercent}%</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(shop.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-0.5 opacity-70 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/shops/${shop.id}`)} title={t('admin.shops.viewDetails')}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => impersonateShop(shop)} title={t('admin.shops.enterAsShop')}>
                        <LogIn className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => toggleStatus(shop)} title={shop.status === 'active' ? t('admin.shops.suspend') : t('admin.shops.activate')}>
                        {shop.status === 'active' ? <PowerOff className="w-4 h-4 text-destructive" /> : <Power className="w-4 h-4 text-success" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => resetTrial(shop)} title={t('admin.shops.resetTrial')}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => resetAlerts(shop)} title={t('admin.shops.resetAlerts')}>
                        <Bell className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteShop(shop)} title={t('admin.shops.deleteShop')}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Change Plan Dialog */}
      <Dialog open={!!planDialog} onOpenChange={() => setPlanDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.shops.changePlan')} — {planDialog?.shop.name}</DialogTitle>
            <DialogDescription>
              {planDialog?.shop.stripeManaged && t('admin.shops.stripeManagedNote')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('admin.shops.plan')}</label>
              <Select value={planDialog?.newPlan || "free"} onValueChange={v => planDialog && setPlanDialog({ ...planDialog, newPlan: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro (€49)</SelectItem>
                  <SelectItem value="garage">Garage (€99)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">{t('admin.shops.duration')}</label>
              <Select value={planDialog?.durationType || "months"} onValueChange={v => planDialog && setPlanDialog({ ...planDialog, durationType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="days">{t('admin.shops.days')}</SelectItem>
                  <SelectItem value="months">{t('admin.shops.months')}</SelectItem>
                  <SelectItem value="unlimited">{t('admin.shops.unlimited')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {planDialog?.durationType !== "unlimited" && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  {t('admin.shops.quantity')} ({planDialog?.durationType === "days" ? t('admin.shops.days') : t('admin.shops.months')})
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
            <Button variant="outline" onClick={() => setPlanDialog(null)}>{t('admin.shops.cancel')}</Button>
            <Button onClick={changePlan}>{t('admin.shops.confirm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteShop} onOpenChange={() => setDeleteShop(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.shops.deleteTitle')}</DialogTitle>
            <DialogDescription>
              {t('admin.shops.deleteConfirm')} "{deleteShop?.name}"? {t('admin.shops.deleteWarn')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteShop(null)}>{t('admin.shops.cancel')}</Button>
            <Button variant="destructive" onClick={handleDeleteShop}>{t('admin.shops.deletePerm')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
