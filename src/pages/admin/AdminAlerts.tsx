import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bell, CheckCircle, AlertTriangle, Clock, Download, Search, Trash2,
  Eye, XCircle, Info, ChevronDown, ChevronUp, RotateCw,
} from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

interface AlertRow {
  id: string;
  title: string;
  message: string;
  type: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  follow_up_count: number;
  last_follow_up_at: string | null;
  next_follow_up_at: string | null;
  shop_id: string;
  shop_name: string;
  client_name: string | null;
  client_id: string | null;
  vehicle_info: string | null;
  vehicle_id: string | null;
}

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/30",
  medium: "bg-warning/15 text-warning border-warning/30",
  low: "bg-info/15 text-info border-info/30",
};

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  sent: Info,
  resolved: CheckCircle,
  dismissed: XCircle,
};

export default function AdminAlerts() {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [filterType, setFilterType] = useState("all");
  const [filterShop, setFilterShop] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedAlert, setSelectedAlert] = useState<AlertRow | null>(null);
  const [deleteAlertId, setDeleteAlertId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchAlerts = async () => {
    setLoading(true);
    const [alertsRes, shopsRes, clientsRes, vehiclesRes] = await Promise.all([
      supabase.from("alerts").select("*").order("created_at", { ascending: false }).limit(500),
      supabase.from("shops").select("id, name"),
      supabase.from("clients").select("id, name"),
      supabase.from("vehicles").select("id, make, model, plate"),
    ]);

    const shopMap = new Map<string, string>();
    (shopsRes.data || []).forEach(s => shopMap.set(s.id, s.name));
    const clientMap = new Map<string, string>();
    (clientsRes.data || []).forEach(c => clientMap.set(c.id, c.name));
    const vehicleMap = new Map<string, string>();
    (vehiclesRes.data || []).forEach(v => vehicleMap.set(v.id, `${v.make} ${v.model} (${v.plate})`));

    setAlerts((alertsRes.data || []).map(a => ({
      ...a,
      shop_name: shopMap.get(a.shop_id) || "—",
      client_name: a.client_id ? clientMap.get(a.client_id) || null : null,
      vehicle_info: a.vehicle_id ? vehicleMap.get(a.vehicle_id) || null : null,
    })));
    setLoading(false);
  };

  useEffect(() => {
    fetchAlerts();

    // Realtime: auto-refresh on alert changes
    const channel = supabase
      .channel("admin-alerts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => {
        fetchAlerts();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const updateStatus = async (alertId: string, status: string) => {
    const { error } = await supabase.from("alerts").update({ status }).eq("id", alertId);
    if (error) { toast.error(error.message); return; }
    toast.success(status === 'resolved' ? t('alerts.resolved') : `Estado alterado para ${status}`);
    fetchAlerts();
    setSelectedAlert(null);
  };

  const deleteAlert = async (alertId: string) => {
    const { error } = await supabase.from("alerts").delete().eq("id", alertId);
    if (error) { toast.error(error.message); return; }
    toast.success(t('common.deleted'));
    setDeleteAlertId(null);
    fetchAlerts();
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("alerts").update({ status }).in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} alertas atualizados`);
    setSelectedIds(new Set());
    fetchAlerts();
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    const { error } = await supabase.from("alerts").delete().in("id", ids);
    if (error) { toast.error(error.message); return; }
    toast.success(`${ids.length} alertas eliminados`);
    setSelectedIds(new Set());
    fetchAlerts();
  };

  const resolveAll = async () => {
    const { error } = await supabase.from("alerts").update({ status: "resolved" }).eq("status", "pending");
    if (error) { toast.error(error.message); return; }
    toast.success(t('alerts.resolveAll'));
    fetchAlerts();
  };

  const exportCSV = () => {
    const headers = ["Oficina", "Título", "Mensagem", "Tipo", "Prioridade", "Estado", "Cliente", "Veículo", "Data", "Criado", "Follow-ups"];
    const rows = filtered.map(a => [
      a.shop_name, a.title, a.message,
      t(`alerts.type.${a.type}`), a.priority,
      t(`alerts.status${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`),
      a.client_name || '—', a.vehicle_info || '—',
      a.due_date ? new Date(a.due_date).toLocaleDateString() : '—',
      new Date(a.created_at).toLocaleDateString(),
      String(a.follow_up_count),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin_alertas_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('common.exported'));
  };

  const shops = [...new Map(alerts.map(a => [a.shop_id, a.shop_name])).entries()];
  const types = [...new Set(alerts.map(a => a.type))];

  const filtered = alerts.filter(a => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterShop !== "all" && a.shop_id !== filterShop) return false;
    if (filterPriority !== "all" && a.priority !== filterPriority) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) ||
        a.message.toLowerCase().includes(q) ||
        a.shop_name.toLowerCase().includes(q) ||
        (a.client_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(a => a.id)));
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  const pendingCount = alerts.filter(a => a.status === 'pending').length;
  const sentCount = alerts.filter(a => a.status === 'sent').length;
  const resolvedCount = alerts.filter(a => a.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t('alerts.title')} — Admin</h1>
          <p className="text-sm text-muted-foreground">
            {t('admin.alerts.subtitle')}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={fetchAlerts} variant="outline" size="sm" className="gap-2">
            <RotateCw className="w-4 h-4" /> {t('common.refresh')}
          </Button>
          <Button onClick={exportCSV} variant="outline" size="sm" className="gap-2">
            <Download className="w-4 h-4" /> {t('alerts.export')}
          </Button>
          {pendingCount > 0 && (
            <Button onClick={resolveAll} size="sm" className="gap-2">
              <CheckCircle className="w-4 h-4" /> {t('alerts.resolveAll')} ({pendingCount})
            </Button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-warning mb-1">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Pendentes</span>
          </div>
          <span className="text-2xl font-bold">{pendingCount}</span>
        </div>
        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-info mb-1">
            <Info className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Enviados</span>
          </div>
          <span className="text-2xl font-bold">{sentCount}</span>
        </div>
        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-success mb-1">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Resolvidos</span>
          </div>
          <span className="text-2xl font-bold">{resolvedCount}</span>
        </div>
        <div className="stat-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Bell className="w-4 h-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Total</span>
          </div>
          <span className="text-2xl font-bold">{alerts.length}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por título, mensagem, oficina, cliente..."
            value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterShop} onValueChange={setFilterShop}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Oficina" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as oficinas</SelectItem>
            {shops.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}
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
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder={t('alerts.filterType')} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('alerts.allTypes')}</SelectItem>
            {types.map(tp => <SelectItem key={tp} value={tp}>{t(`alerts.type.${tp}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Prioridade" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
            <SelectItem value="medium">Média</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border">
          <span className="text-sm font-medium">{selectedIds.size} selecionados</span>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('resolved')} className="gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Resolver
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('pending')} className="gap-1">
            <Clock className="w-3.5 h-3.5" /> Reabrir
          </Button>
          <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('dismissed')} className="gap-1">
            <XCircle className="w-3.5 h-3.5" /> Ignorar
          </Button>
          <Button size="sm" variant="destructive" onClick={bulkDelete} className="gap-1">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="stat-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll} className="rounded border-border" />
              </TableHead>
              <TableHead>{t('alerts.shopCol')}</TableHead>
              <TableHead>{t('alerts.titleCol')}</TableHead>
              <TableHead>{t('alerts.typeCol')}</TableHead>
              <TableHead>Prioridade</TableHead>
              <TableHead>{t('alerts.clientCol')}</TableHead>
              <TableHead>{t('alerts.statusCol')}</TableHead>
              <TableHead>{t('alerts.dateCol')}</TableHead>
              <TableHead>Follow-ups</TableHead>
              <TableHead>{t('alerts.actionsCol')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(alert => {
              const StatusIcon = statusIcons[alert.status] || Bell;
              return (
                <TableRow key={alert.id} className="hover:bg-muted/50">
                  <TableCell>
                    <input type="checkbox" checked={selectedIds.has(alert.id)}
                      onChange={() => toggleSelect(alert.id)} className="rounded border-border" />
                  </TableCell>
                  <TableCell className="font-medium text-sm max-w-[120px] truncate">{alert.shop_name}</TableCell>
                  <TableCell>
                    <button onClick={() => setSelectedAlert(alert)} className="text-left hover:underline">
                      <p className="text-sm font-medium">{alert.title}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">{alert.message}</p>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{t(`alerts.type.${alert.type}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs ${priorityStyles[alert.priority] || ''}`}>
                      {alert.priority === 'high' ? 'Alta' : alert.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {alert.client_name || '—'}
                    {alert.vehicle_info && (
                      <p className="text-xs text-muted-foreground">{alert.vehicle_info}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      alert.status === 'pending' ? 'bg-warning/15 text-warning border-warning/30' :
                      alert.status === 'sent' ? 'bg-info/15 text-info border-info/30' :
                      alert.status === 'resolved' ? 'bg-success/15 text-success border-success/30' :
                      'bg-muted text-muted-foreground'
                    }>
                      <StatusIcon className="w-3 h-3 mr-1" />
                      {t(`alerts.status${alert.status.charAt(0).toUpperCase() + alert.status.slice(1)}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {alert.due_date ? new Date(alert.due_date).toLocaleDateString() : new Date(alert.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-center">{alert.follow_up_count}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedAlert(alert)} title="Ver detalhes">
                        <Eye className="w-4 h-4" />
                      </Button>
                      {alert.status === 'pending' && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => updateStatus(alert.id, 'resolved')} title="Resolver">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}
                      {(alert.status === 'pending' || alert.status === 'sent') && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => updateStatus(alert.id, 'dismissed')} title="Ignorar">
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteAlertId(alert.id)} title="Eliminar">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {t('alerts.noAlerts')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Detalhes do Alerta
            </DialogTitle>
          </DialogHeader>
          {selectedAlert && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Oficina</label>
                  <p className="text-sm font-medium">{selectedAlert.shop_name}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Tipo</label>
                  <p className="text-sm"><Badge variant="outline">{t(`alerts.type.${selectedAlert.type}`)}</Badge></p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Prioridade</label>
                  <p><Badge variant="outline" className={priorityStyles[selectedAlert.priority] || ''}>
                    {selectedAlert.priority === 'high' ? 'Alta' : selectedAlert.priority === 'medium' ? 'Média' : 'Baixa'}
                  </Badge></p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Estado</label>
                  <p><Badge variant="outline" className={
                    selectedAlert.status === 'pending' ? 'bg-warning/15 text-warning border-warning/30' :
                    selectedAlert.status === 'resolved' ? 'bg-success/15 text-success border-success/30' :
                    'bg-muted text-muted-foreground'
                  }>
                    {t(`alerts.status${selectedAlert.status.charAt(0).toUpperCase() + selectedAlert.status.slice(1)}`)}
                  </Badge></p>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Título</label>
                <p className="text-sm font-medium mt-0.5">{selectedAlert.title}</p>
              </div>

              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wide">Mensagem</label>
                <p className="text-sm mt-0.5 bg-muted p-3 rounded-lg">{selectedAlert.message}</p>
              </div>

              {(selectedAlert.client_name || selectedAlert.vehicle_info) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedAlert.client_name && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Cliente</label>
                      <p className="text-sm font-medium">{selectedAlert.client_name}</p>
                    </div>
                  )}
                  {selectedAlert.vehicle_info && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Veículo</label>
                      <p className="text-sm font-medium">{selectedAlert.vehicle_info}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Criado</label>
                  <p className="text-sm">{new Date(selectedAlert.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Data limite</label>
                  <p className="text-sm">{selectedAlert.due_date ? new Date(selectedAlert.due_date).toLocaleDateString() : '—'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Follow-ups</label>
                  <p className="text-sm">{selectedAlert.follow_up_count}</p>
                </div>
              </div>

              {selectedAlert.last_follow_up_at && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground uppercase tracking-wide">Último follow-up</label>
                    <p className="text-sm">{new Date(selectedAlert.last_follow_up_at).toLocaleString()}</p>
                  </div>
                  {selectedAlert.next_follow_up_at && (
                    <div>
                      <label className="text-xs text-muted-foreground uppercase tracking-wide">Próximo follow-up</label>
                      <p className="text-sm">{new Date(selectedAlert.next_follow_up_at).toLocaleString()}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2 border-t border-border">
                {selectedAlert.status === 'pending' && (
                  <Button onClick={() => updateStatus(selectedAlert.id, 'resolved')} className="gap-2 flex-1">
                    <CheckCircle className="w-4 h-4" /> Resolver
                  </Button>
                )}
                {(selectedAlert.status === 'pending' || selectedAlert.status === 'sent') && (
                  <Button variant="outline" onClick={() => updateStatus(selectedAlert.id, 'dismissed')} className="gap-2 flex-1">
                    <XCircle className="w-4 h-4" /> Ignorar
                  </Button>
                )}
                {selectedAlert.status === 'resolved' || selectedAlert.status === 'dismissed' ? (
                  <Button variant="outline" onClick={() => updateStatus(selectedAlert.id, 'pending')} className="gap-2 flex-1">
                    <RotateCw className="w-4 h-4" /> Reabrir
                  </Button>
                ) : null}
                <Button variant="destructive" onClick={() => { setSelectedAlert(null); setDeleteAlertId(selectedAlert.id); }} className="gap-2">
                  <Trash2 className="w-4 h-4" /> Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteAlertId} onOpenChange={(open) => !open && setDeleteAlertId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar alerta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser revertida. O alerta será permanentemente eliminado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteAlertId && deleteAlert(deleteAlertId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
