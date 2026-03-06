import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bell, Search, CheckCircle, Clock, AlertTriangle, Download, Info, Plus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const alertTypeIcons: Record<string, any> = {
  revision: Clock,
  oil: AlertTriangle,
  inspection: AlertTriangle,
  warranty: AlertTriangle,
  inactive_client: Bell,
  expired_quote: Clock,
  payment_failed: AlertTriangle,
  service_due: Clock,
  quote_pending: Clock,
  custom: Bell,
};

const alertStatusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  sent: "bg-info/10 text-info border-info/30",
  resolved: "bg-success/10 text-success border-success/30",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const alertTypeColors: Record<string, string> = {
  payment_failed: "text-destructive",
  warranty: "text-destructive",
  expired_quote: "text-warning",
  revision: "text-warning",
  oil: "text-warning",
  service_due: "text-warning",
  quote_pending: "text-warning",
  inspection: "text-info",
  inactive_client: "text-info",
  custom: "text-primary",
};

export default function Alerts() {
  const { t } = useLanguage();
  const { plan, shopId, loading: subLoading, validatePlanAction } = useSubscription();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAlert, setNewAlert] = useState({
    title: "",
    message: "",
    type: "custom",
    priority: "medium",
  });

  const fetchAlerts = async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from("alerts")
      .select("*, clients(name), vehicles(make, model, plate)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    if (data) setAlerts(data);
  };

  useEffect(() => { if (shopId) fetchAlerts(); }, [shopId]);

  // Realtime: live updates for alerts
  useEffect(() => {
    if (!shopId) return;
    const channel = supabase
      .channel(`alerts-${shopId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'alerts',
        filter: `shop_id=eq.${shopId}`,
      }, () => {
        fetchAlerts();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [shopId]);

  const resolveAlert = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ status: 'resolved' }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t('alerts.resolved')); fetchAlerts(); }
  };

  const dismissAlert = async (id: string) => {
    const { error } = await supabase.from("alerts").update({ status: 'dismissed' }).eq("id", id);
    if (error) toast.error(error.message);
    else fetchAlerts();
  };

  const handleCreateAlert = async () => {
    if (!shopId || !newAlert.title.trim() || !newAlert.message.trim()) return;
    setCreating(true);
    try {
      // Backend validation via RPC
      const { data: canCreate, error: rpcError } = await supabase.rpc('validate_plan_limit', {
        _action_type: 'create_basic_alert',
        _shop_id: shopId,
      });
      
      console.log("[Alerts] validate_plan_limit result:", { canCreate, rpcError, shopId });
      
      if (rpcError) {
        console.error("[Alerts] RPC error:", rpcError);
        toast.error(rpcError.message);
        return;
      }
      
      if (!canCreate) {
        toast.error(t('alerts.planLimitReached'));
        return;
      }

      const { error } = await supabase.from("alerts").insert({
        shop_id: shopId,
        title: newAlert.title.trim(),
        message: newAlert.message.trim(),
        type: newAlert.type,
        priority: newAlert.priority,
        status: "pending",
      });

      if (error) {
        console.error("[Alerts] Insert error:", error);
        toast.error(error.message);
      } else {
        toast.success(t('alerts.created'));
        setCreateOpen(false);
        setNewAlert({ title: "", message: "", type: "custom", priority: "medium" });
        fetchAlerts();
      }
    } finally {
      setCreating(false);
    }
  };

  const exportCSV = () => {
    const headers = [t('alerts.typeCol'), t('alerts.titleCol'), t('alerts.clientCol'), t('alerts.vehicleCol'), t('alerts.dateCol'), t('alerts.statusCol')];
    const rows = filtered.map(a => [
      t(`alerts.type.${a.type}`),
      a.title,
      (a.clients as any)?.name || '',
      (a.vehicles as any) ? `${(a.vehicles as any).make} ${(a.vehicles as any).model}` : '',
      a.due_date || new Date(a.created_at).toLocaleDateString(),
      t(`alerts.status${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `alertas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported'));
  };

  const filtered = alerts.filter(a => {
    const matchSearch = a.title?.toLowerCase().includes(search.toLowerCase()) ||
      (a.clients as any)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || a.type === filterType;
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchType && matchStatus;
  });

  const alertTypes = ['revision', 'oil', 'inspection', 'warranty', 'inactive_client', 'expired_quote', 'payment_failed', 'service_due', 'quote_pending', 'custom'];

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // FREE plan: show upgrade message
  if (plan === 'free') {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">{t('alerts.title')}</h1>
        </div>
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground mb-4">{t('alerts.disabledFree')}</p>
          <Link to="/billing">
            <Button>{t('nav.billing')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = alerts.filter(a => a.status === 'pending').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;
  const sentCount = alerts.filter(a => a.status === 'sent').length;
  const dismissedCount = alerts.filter(a => a.status === 'dismissed').length;

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('alerts.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pendingCount} {t('alerts.pending')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            {t('alerts.export')}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t('alerts.create')}
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-warning">{pendingCount}</p>
          <p className="text-xs text-muted-foreground">{t('alerts.statusPending')}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-info">{sentCount}</p>
          <p className="text-xs text-muted-foreground">{t('alerts.statusSent')}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">{resolvedCount}</p>
          <p className="text-xs text-muted-foreground">{t('alerts.statusResolved')}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-muted-foreground">{dismissedCount}</p>
          <p className="text-xs text-muted-foreground">{t('alerts.statusDismissed')}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('alerts.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder={t('alerts.filterType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('alerts.allTypes')}</SelectItem>
            {alertTypes.map(type => (
              <SelectItem key={type} value={type}>{t(`alerts.type.${type}`)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('alerts.allStatus')}</SelectItem>
            <SelectItem value="pending">{t('alerts.statusPending')}</SelectItem>
            <SelectItem value="sent">{t('alerts.statusSent')}</SelectItem>
            <SelectItem value="resolved">{t('alerts.statusResolved')}</SelectItem>
            <SelectItem value="dismissed">{t('alerts.statusDismissed')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('alerts.typeCol')}</TableHead>
              <TableHead>{t('alerts.titleCol')}</TableHead>
              <TableHead>{t('alerts.clientCol')}</TableHead>
              <TableHead>{t('alerts.vehicleCol')}</TableHead>
              <TableHead>{t('alerts.dateCol')}</TableHead>
              <TableHead>{t('alerts.statusCol')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('alerts.empty')}
                </TableCell>
              </TableRow>
            ) : filtered.map(a => {
              const Icon = alertTypeIcons[a.type] || Bell;
              const typeColor = alertTypeColors[a.type] || 'text-warning';
              return (
                <TableRow key={a.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${typeColor}`} />
                      <span className="text-xs">{t(`alerts.type.${a.type}`)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{a.title}</TableCell>
                  <TableCell>{(a.clients as any)?.name || '—'}</TableCell>
                  <TableCell>
                    {(a.vehicles as any) ? `${(a.vehicles as any).make} ${(a.vehicles as any).model}` : '—'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.due_date || new Date(a.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={alertStatusStyles[a.status] || ''}>
                      {a.status === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                      {a.status === 'sent' && <Info className="w-3 h-3 mr-1" />}
                      {a.status === 'resolved' && <CheckCircle className="w-3 h-3 mr-1" />}
                      {t(`alerts.status${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {a.status === 'pending' && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => resolveAlert(a.id)} className="text-xs">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" />
                          {t('alerts.resolve')}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => dismissAlert(a.id)} className="text-xs text-muted-foreground">
                          {t('alerts.dismiss')}
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Create Alert Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t('alerts.create')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t('alerts.titleCol')} *</Label>
              <Input
                value={newAlert.title}
                onChange={e => setNewAlert(p => ({ ...p, title: e.target.value }))}
                placeholder={t('alerts.titlePlaceholder')}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('alerts.messageLabel')} *</Label>
              <Textarea
                value={newAlert.message}
                onChange={e => setNewAlert(p => ({ ...p, message: e.target.value }))}
                placeholder={t('alerts.messagePlaceholder')}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t('alerts.typeCol')}</Label>
                <Select value={newAlert.type} onValueChange={v => setNewAlert(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{t('alerts.type.custom')}</SelectItem>
                    <SelectItem value="revision">{t('alerts.type.revision')}</SelectItem>
                    <SelectItem value="service_due">{t('alerts.type.service_due')}</SelectItem>
                    <SelectItem value="inspection">{t('alerts.type.inspection')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t('alerts.priorityLabel')}</Label>
                <Select value={newAlert.priority} onValueChange={v => setNewAlert(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t('alerts.priorityLow')}</SelectItem>
                    <SelectItem value="medium">{t('alerts.priorityMedium')}</SelectItem>
                    <SelectItem value="high">{t('alerts.priorityHigh')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreateAlert} disabled={!newAlert.title.trim() || !newAlert.message.trim() || creating}>
              {creating ? t('common.loading') : t('alerts.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
