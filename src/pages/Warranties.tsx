import { useState, useEffect, useCallback } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Plus, Search, Calendar, AlertTriangle, CheckCircle, XCircle, Clock, Car, User, Filter } from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, addMonths } from "date-fns";
import { useLanguage } from "@/i18n/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";

const WARRANTY_TYPES = ['service', 'part', 'general'];
const WARRANTY_STATUSES = ['active', 'expired', 'claimed', 'voided'];

export default function Warranties() {
  const { t } = useLanguage();
  const activeShopId = useActiveShopId();
  const [warranties, setWarranties] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "", vehicle_id: "", work_order_id: "", invoice_id: "",
    type: "service", description: "", coverage: "", notes: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: addMonths(new Date(), 12).toISOString().slice(0, 10),
    status: "active",
  });

  const resetForm = () => setForm({
    client_id: "", vehicle_id: "", work_order_id: "", invoice_id: "",
    type: "service", description: "", coverage: "", notes: "",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: addMonths(new Date(), 12).toISOString().slice(0, 10),
    status: "active",
  });

  const fetchData = useCallback(async () => {
    if (!activeShopId) return;
    const [wRes, cRes, vRes] = await Promise.all([
      supabase.from("warranties").select("*, clients(name), vehicles(make, model, plate)").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name").eq("shop_id", activeShopId).is("deleted_at", null).order("name"),
      supabase.from("vehicles").select("id, make, model, plate, client_id").eq("shop_id", activeShopId).is("deleted_at", null),
    ]);
    setWarranties(wRes.data || []);
    setClients(cRes.data || []);
    setVehicles(vRes.data || []);
    setLoading(false);
  }, [activeShopId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredVehicles = form.client_id
    ? vehicles.filter(v => v.client_id === form.client_id)
    : vehicles;

  const handleSave = async () => {
    if (!activeShopId || !form.client_id || !form.vehicle_id || !form.description.trim()) {
      toast.error(t('warranties.fillRequired'));
      return;
    }
    const payload = {
      shop_id: activeShopId,
      client_id: form.client_id,
      vehicle_id: form.vehicle_id,
      work_order_id: form.work_order_id || null,
      invoice_id: form.invoice_id || null,
      type: form.type,
      description: form.description.trim(),
      coverage: form.coverage.trim() || null,
      notes: form.notes.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      status: form.status,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("warranties").update(payload).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("warranties").insert(payload));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? t('warranties.updated') : t('warranties.created'));
    setOpen(false);
    setEditingId(null);
    resetForm();
    fetchData();
  };

  const openEdit = (w: any) => {
    setForm({
      client_id: w.client_id, vehicle_id: w.vehicle_id,
      work_order_id: w.work_order_id || "", invoice_id: w.invoice_id || "",
      type: w.type, description: w.description, coverage: w.coverage || "",
      notes: w.notes || "", start_date: w.start_date, end_date: w.end_date,
      status: w.status,
    });
    setEditingId(w.id);
    setOpen(true);
  };

  const getStatusBadge = (status: string, endDate: string) => {
    const daysLeft = differenceInDays(new Date(endDate), new Date());
    if (status === 'claimed') return <Badge className="bg-warning/10 text-warning border-warning/30"><AlertTriangle className="w-3 h-3 mr-1" />{t('warranties.status.claimed')}</Badge>;
    if (status === 'voided') return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />{t('warranties.status.voided')}</Badge>;
    if (status === 'expired' || daysLeft < 0) return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />{t('warranties.status.expired')}</Badge>;
    if (daysLeft <= 30) return <Badge className="bg-warning/10 text-warning border-warning/30"><AlertTriangle className="w-3 h-3 mr-1" />{t('warranties.status.expiringSoon')}</Badge>;
    return <Badge className="bg-success/10 text-success border-success/30"><CheckCircle className="w-3 h-3 mr-1" />{t('warranties.status.active')}</Badge>;
  };

  const filtered = warranties.filter(w => {
    const matchSearch = !search || 
      w.description?.toLowerCase().includes(search.toLowerCase()) ||
      (w.clients as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      (w.vehicles as any)?.plate?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || w.status === statusFilter || 
      (statusFilter === 'expiring' && w.status === 'active' && differenceInDays(new Date(w.end_date), new Date()) <= 30 && differenceInDays(new Date(w.end_date), new Date()) >= 0);
    return matchSearch && matchStatus;
  });

  const stats = {
    total: warranties.length,
    active: warranties.filter(w => w.status === 'active' && differenceInDays(new Date(w.end_date), new Date()) >= 0).length,
    expiring: warranties.filter(w => w.status === 'active' && differenceInDays(new Date(w.end_date), new Date()) <= 30 && differenceInDays(new Date(w.end_date), new Date()) >= 0).length,
    claimed: warranties.filter(w => w.status === 'claimed').length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-primary" />
            {t('warranties.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('warranties.subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingId(null); setOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" />
          {t('warranties.add')}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('warranties.total'), value: stats.total, icon: ShieldCheck, color: "text-primary" },
          { label: t('warranties.status.active'), value: stats.active, icon: CheckCircle, color: "text-success" },
          { label: t('warranties.expiringSoonCount'), value: stats.expiring, icon: AlertTriangle, color: "text-warning" },
          { label: t('warranties.status.claimed'), value: stats.claimed, icon: AlertTriangle, color: "text-destructive" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-3 pb-2 px-4">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={`w-3.5 h-3.5 ${kpi.color}`} />
                <p className="text-[10px] text-muted-foreground">{kpi.label}</p>
              </div>
              <p className="text-xl font-bold">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('warranties.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-4 h-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('common.all')}</SelectItem>
            <SelectItem value="active">{t('warranties.status.active')}</SelectItem>
            <SelectItem value="expiring">{t('warranties.status.expiringSoon')}</SelectItem>
            <SelectItem value="claimed">{t('warranties.status.claimed')}</SelectItem>
            <SelectItem value="expired">{t('warranties.status.expired')}</SelectItem>
            <SelectItem value="voided">{t('warranties.status.voided')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-2xl">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
          <h3 className="text-lg font-semibold mb-1">{t('warranties.emptyTitle')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('warranties.emptyDescription')}</p>
          <Button variant="outline" onClick={() => { resetForm(); setEditingId(null); setOpen(true); }}>
            <Plus className="w-4 h-4 mr-1" />{t('warranties.add')}
          </Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('warranties.description')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('common.client')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('common.vehicle')}</TableHead>
                <TableHead>{t('warranties.type')}</TableHead>
                <TableHead>{t('warranties.period')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(w => (
                <TableRow key={w.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(w)}>
                  <TableCell className="font-medium max-w-[200px] truncate">{w.description}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex items-center gap-1 text-sm">
                      <User className="w-3 h-3 text-muted-foreground" />
                      {(w.clients as any)?.name}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1 text-sm">
                      <Car className="w-3 h-3 text-muted-foreground" />
                      {(w.vehicles as any)?.make} {(w.vehicles as any)?.model} — {(w.vehicles as any)?.plate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {t(`warranties.type.${w.type}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {format(new Date(w.start_date), 'dd/MM/yyyy')} — {format(new Date(w.end_date), 'dd/MM/yyyy')}
                  </TableCell>
                  <TableCell>{getStatusBadge(w.status, w.end_date)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="ghost" onClick={e => { e.stopPropagation(); openEdit(w); }}>
                      {t('common.edit')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={open} onOpenChange={o => { if (!o) { setOpen(false); setEditingId(null); resetForm(); } else setOpen(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t('warranties.edit') : t('warranties.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('common.client')} *</Label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v, vehicle_id: "" }))}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('common.vehicle')} *</Label>
              <Select value={form.vehicle_id} onValueChange={v => setForm(f => ({ ...f, vehicle_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('common.select')} /></SelectTrigger>
                <SelectContent>
                  {filteredVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('warranties.description')} *</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={t('warranties.descriptionPlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('warranties.type')}</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WARRANTY_TYPES.map(wt => <SelectItem key={wt} value={wt}>{t(`warranties.type.${wt}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('common.status')}</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WARRANTY_STATUSES.map(ws => <SelectItem key={ws} value={ws}>{t(`warranties.status.${ws}`)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('warranties.startDate')}</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <Label>{t('warranties.endDate')}</Label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>{t('warranties.coverage')}</Label>
              <Textarea value={form.coverage} onChange={e => setForm(f => ({ ...f, coverage: e.target.value }))} placeholder={t('warranties.coveragePlaceholder')} rows={2} />
            </div>
            <div>
              <Label>{t('common.notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditingId(null); resetForm(); }}>{t('common.cancel')}</Button>
            <Button onClick={handleSave}>{editingId ? t('common.save') : t('warranties.add')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
