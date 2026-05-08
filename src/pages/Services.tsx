import { useState, useEffect } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, FileDown, ChevronRight as ChevronRightIcon, Pencil, ChevronLeft, ChevronRight, CalendarClock, Wrench, Clock, CheckCircle, Truck, XCircle, Stethoscope, ThumbsUp, Play, MessageCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { ServiceStatus } from "@/types/garage";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { generatePdf, exportToCsv } from "@/lib/pdfGenerator";
import { formatLocalDate } from "@/lib/marketPrice";
import { format } from "date-fns";
import ListSkeleton from "@/components/ListSkeleton";
import { pageCache } from "@/lib/pageCache";

const statusColors: Record<ServiceStatus, string> = {
  open: "bg-info/10 text-info",
  diagnosis: "bg-warning/10 text-warning",
  waiting_approval: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusIcons: Record<ServiceStatus, any> = {
  open: Wrench,
  diagnosis: Stethoscope,
  waiting_approval: Clock,
  approved: ThumbsUp,
  in_progress: Play,
  completed: CheckCircle,
  delivered: Truck,
  cancelled: XCircle,
};

const statusFlow: ServiceStatus[] = ['open', 'diagnosis', 'waiting_approval', 'approved', 'in_progress', 'completed', 'delivered'];
const PAGE_SIZE = 25;

function RepairTimeline({ status }: { status: ServiceStatus }) {
  const currentIdx = statusFlow.indexOf(status);
  
  return (
    <div className="flex items-center gap-0.5 overflow-x-auto py-1">
      {statusFlow.map((s, i) => {
        const Icon = statusIcons[s];
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        const isCancelled = status === 'cancelled';
        
        return (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full border-2 transition-all shrink-0
              ${isCancelled ? 'border-destructive/30 bg-destructive/5' :
                isActive ? 'border-primary bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/20' :
                isDone ? 'border-success bg-success/10 text-success' :
                'border-border bg-muted/30 text-muted-foreground/40'}`}
            >
              <Icon className="w-3 h-3" />
            </div>
            {i < statusFlow.length - 1 && (
              <div className={`w-3 h-0.5 ${isDone ? 'bg-success' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Services() {
  const { t } = useLanguage();
  const { limits, plan } = useSubscription();
  const _shopInit = typeof window !== "undefined" ? localStorage.getItem("garageflow_active_shop") : null;
  const _sCache = pageCache.get<{ rows: any[]; count: number; shop: any }>(`services:${_shopInit}:0:all`);
  const [services, setServices] = useState<any[]>(_sCache?.rows ?? []);
  const [search, setSearch] = useState("");
  const [shop, setShop] = useState<any>(_sCache?.shop ?? null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(_sCache?.count ?? 0);
  const [reminderDialog, setReminderDialog] = useState<any>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderKm, setReminderKm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dataLoading, setDataLoading] = useState(!_sCache);
  const [statusCountsAll, setStatusCountsAll] = useState<Record<string, number>>({});
  const [monthRevenue, setMonthRevenue] = useState<number>(0);

  const activeShopId = useActiveShopId();

  const fetchStats = async (shopId: string) => {
    const { data: allRows } = await supabase
      .from("work_orders")
      .select("status, total, completed_at")
      .eq("shop_id", shopId)
      .limit(2000);
    if (!allRows) return;
    const counts: Record<string, number> = {};
    let revenue = 0;
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    for (const r of allRows as any[]) {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if ((r.status === 'completed' || r.status === 'delivered') && r.completed_at && new Date(r.completed_at) >= monthStart) {
        revenue += Number(r.total || 0);
      }
    }
    setStatusCountsAll(counts);
    setMonthRevenue(revenue);
  };

  const fetchServices = async () => {
    if (!activeShopId) { setDataLoading(false); return; }
    const key = `services:${activeShopId}:${page}:${statusFilter}`;
    const cc = pageCache.get<{ rows: any[]; count: number; shop: any }>(key);
    if (cc) {
      setServices(cc.rows); setTotalCount(cc.count); setShop(cc.shop); setDataLoading(false);
    } else {
      setDataLoading(true);
    }
    try {
      const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeShopId).maybeSingle();
      if (shopData) setShop(shopData);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      let query = supabase
        .from("work_orders")
        .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)", { count: "exact" })
        .eq("shop_id", activeShopId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, count } = await query;
      if (data) setServices(data);
      if (count !== null) setTotalCount(count);
      pageCache.set(key, { rows: data ?? [], count: count ?? 0, shop: shopData ?? null });
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, [page, statusFilter, activeShopId]);
  useEffect(() => { if (activeShopId) fetchStats(activeShopId); }, [activeShopId]);

  const advanceStatus = async (service: any) => {
    const currentIdx = statusFlow.indexOf(service.status);
    if (currentIdx === -1 || currentIdx >= statusFlow.length - 1) return;
    const nextStatus = statusFlow[currentIdx + 1];

    if (nextStatus === 'completed') {
      setReminderDialog(service);
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 6);
      setReminderDate(defaultDate.toISOString().split('T')[0]);
      setReminderKm("");
      return;
    }

    const updates: any = { status: nextStatus };
    if (nextStatus === 'delivered') updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("work_orders").update(updates).eq("id", service.id);
    if (error) toast.error(error.message);
    else { toast.success(`${t(`service.${nextStatus}`)}`); fetchServices(); }
  };

  const completeWithReminder = async (createReminder: boolean) => {
    if (!reminderDialog) return;
    const service = reminderDialog;
    const updates: any = { status: 'completed', completed_at: new Date().toISOString() };
    const { error } = await supabase.from("work_orders").update(updates).eq("id", service.id);
    if (error) { toast.error(error.message); return; }

    if (createReminder && reminderDate) {
      const activeId = localStorage.getItem("garageflow_active_shop");
      await supabase.from("service_reminders").insert({
        shop_id: activeId,
        vehicle_id: service.vehicle_id,
        client_id: service.client_id,
        work_order_id: service.id,
        next_service_date: reminderDate,
        next_service_km: reminderKm ? parseInt(reminderKm) : null,
      } as any);
      toast.success(t('reminders.created'));
    } else {
      toast.success(t('service.completed'));
    }
    setReminderDialog(null);
    fetchServices();
  };

  const cancelService = async (id: string) => {
    const { error } = await supabase.from("work_orders").update({ status: 'cancelled' }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t('service.cancelled')); fetchServices(); }
  };

  const downloadPdf = async (s: any) => {
    if (!shop) return;
    const lines = (Array.isArray(s.lines) ? s.lines : []) as any[];
    const doc = await generatePdf({
      type: 'service', number: s.number, date: formatLocalDate(s.created_at),
      shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone,
      shopNif: shop.nif, shopAddress: shop.address, shopLogoUrl: shop.logo_url,
      clientName: (s.clients as any)?.name || '', clientEmail: (s.clients as any)?.email,
      clientPhone: (s.clients as any)?.phone, clientNif: (s.clients as any)?.nif,
      vehicleMake: (s.vehicles as any)?.make || '', vehicleModel: (s.vehicles as any)?.model || '',
      vehiclePlate: (s.vehicles as any)?.plate || '', lines, subtotal: s.subtotal, vatTotal: s.vat_total,
      total: s.total, profit: s.profit, notes: s.notes, technician: s.technician, diagnosis: s.diagnosis,
      laborHours: s.labor_hours, currency: shop.currency || 'EUR', plan: plan,
    }, limits.pdfWatermark);
    doc.save(`${s.number}.pdf`);
  };

  const handleExportCsv = () => {
    const csvData = services.map(s => ({
      Número: s.number, Cliente: (s.clients as any)?.name,
      Veículo: `${(s.vehicles as any)?.make} ${(s.vehicles as any)?.model}`,
      Matrícula: (s.vehicles as any)?.plate, Status: s.status, Subtotal: s.subtotal,
      IVA: s.vat_total, Total: s.total, Lucro: s.profit,
      Data: formatLocalDate(s.created_at),
    }));
    exportToCsv(csvData, 'servicos');
    toast.success(t('common.exported'));
  };

  const filtered = services.filter(s =>
    s.number?.toLowerCase().includes(search.toLowerCase()) ||
    (s.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Status counts for tabs
  const statusCounts: Record<string, number> = {};
  services.forEach(s => { statusCounts[s.status] = (statusCounts[s.status] || 0) + 1; });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('services.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalCount} {t('services.title').toLowerCase()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileDown className="w-4 h-4 mr-1" />CSV
          </Button>
          <Link to="/services/new">
            <Button><Plus className="w-4 h-4 mr-2" />{t('services.new')}</Button>
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t('service.in_progress')}</p>
          <p className="text-2xl font-bold mt-1">{statusCountsAll.in_progress || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t('service.waiting_approval')}</p>
          <p className="text-2xl font-bold mt-1 text-warning">{statusCountsAll.waiting_approval || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t('service.open')}</p>
          <p className="text-2xl font-bold mt-1 text-info">{statusCountsAll.open || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{shop?.currency === 'BRL' ? 'R$' : '€'} {(t('dashboard.thisMonth') || 'Este mês')}</p>
          <p className="text-2xl font-bold mt-1 text-success mono">{shop?.currency === 'BRL' ? 'R$' : '€'}{monthRevenue.toFixed(0)}</p>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => { setStatusFilter("all"); setPage(0); }}
          className="text-xs shrink-0"
        >
          {t('services.allStatuses') || 'Todos'} ({Object.values(statusCountsAll).reduce((a,b)=>a+b,0) || totalCount})
        </Button>
        {statusFlow.filter(s => s !== 'cancelled').map(s => {
          const Icon = statusIcons[s];
          const c = statusCountsAll[s] || 0;
          return (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => { setStatusFilter(s); setPage(0); }}
              className="text-xs shrink-0 gap-1"
            >
              <Icon className="w-3 h-3" />
              {t(`service.${s}`)}
              {c > 0 && <span className="ml-1 opacity-70">({c})</span>}
            </Button>
          );
        })}
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('services.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2">
        {dataLoading && services.length === 0 ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5">
            {totalCount === 0 ? t('services.empty') : t('services.noResults')}
          </div>
        ) : filtered.map(s => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium mono text-sm">{s.number}</span>
                <p className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yyyy')}</p>
              </div>
              <Badge variant="secondary" className={statusColors[s.status as ServiceStatus]}>
                {t(`service.${s.status}`)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold">{(s.clients as any)?.name}</p>
              <p className="text-xs text-muted-foreground">
                {(s.vehicles as any)?.make} {(s.vehicles as any)?.model} — {(s.vehicles as any)?.plate}
                {s.technician && <span> · 🔧 {s.technician}</span>}
              </p>
            </div>
            <RepairTimeline status={s.status as ServiceStatus} />
            <div className="flex items-center justify-between pt-1 border-t border-border">
              <span className="text-sm font-semibold mono">€{s.total?.toFixed(2)}</span>
              <div className="flex gap-1">
                {!['delivered', 'cancelled'].includes(s.status) && (
                  <Link to={`/services/edit/${s.id}`}>
                    <Button variant="ghost" size="sm" className="text-xs h-7"><Pencil className="w-3 h-3" /></Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={() => downloadPdf(s)} className="text-xs h-7">PDF</Button>
                <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" onClick={() => {
                  const phone = (s.clients as any)?.phone;
                  if (!phone) { toast.error(t('quotes.noClientPhone') || 'Cliente sem telefone'); return; }
                  openWhatsApp({ phone, clientName: (s.clients as any)?.name, type: 'service', number: s.number, plate: (s.vehicles as any)?.plate });
                }}>
                  <MessageCircle className="w-3 h-3 mr-1" />WhatsApp
                </Button>
                {!['delivered', 'cancelled'].includes(s.status) && (
                  <Button variant="default" size="sm" onClick={() => advanceStatus(s)} className="text-xs h-7 gap-1">
                    <ChevronRightIcon className="w-3 h-3" />
                    {t(`service.${statusFlow[statusFlow.indexOf(s.status as ServiceStatus) + 1] || s.status}`)}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('quotes.number')}</TableHead>
              <TableHead>{t('quotes.client')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('quotes.vehicle')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('services.timeline')}</TableHead>
              <TableHead>{t('quotes.total')}</TableHead>
              <TableHead>{t('quotes.status')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataLoading && services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {totalCount === 0 ? t('services.empty') : t('services.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/50">
                <TableCell>
                  <div>
                    <span className="font-medium mono">{s.number}</span>
                    <p className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <div>
                    <span className="font-medium">{(s.clients as any)?.name}</span>
                    {s.technician && <p className="text-xs text-muted-foreground">🔧 {s.technician}</p>}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <span>{(s.vehicles as any)?.make} {(s.vehicles as any)?.model}</span>
                  <span className="mono text-xs text-muted-foreground ml-1">({(s.vehicles as any)?.plate})</span>
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  <RepairTimeline status={s.status as ServiceStatus} />
                </TableCell>
                <TableCell className="font-semibold mono">€{s.total?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[s.status as ServiceStatus]}>
                    {t(`service.${s.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!['delivered', 'cancelled'].includes(s.status) && (
                      <Link to={`/services/edit/${s.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Pencil className="w-3.5 h-3.5 mr-1" />{t('common.edit')}
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => downloadPdf(s)} className="text-xs">PDF</Button>
                    <Button variant="ghost" size="sm" className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => {
                      const phone = (s.clients as any)?.phone;
                      if (!phone) { toast.error(t('quotes.noClientPhone') || 'Cliente sem telefone'); return; }
                      openWhatsApp({ phone, clientName: (s.clients as any)?.name, type: 'service', number: s.number, plate: (s.vehicles as any)?.plate });
                    }}>
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp
                    </Button>
                    {!['delivered', 'cancelled'].includes(s.status) && (
                      <>
                        <Button variant="default" size="sm" onClick={() => advanceStatus(s)} className="text-xs gap-1">
                          <ChevronRightIcon className="w-3.5 h-3.5" />
                          {t(`service.${statusFlow[statusFlow.indexOf(s.status as ServiceStatus) + 1] || s.status}`)}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => cancelService(s.id)} className="text-xs text-destructive">✕</Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} {t('common.of')} {totalCount}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Reminder Dialog */}
      <Dialog open={!!reminderDialog} onOpenChange={(o) => !o && setReminderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              {t('reminders.scheduleTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('reminders.scheduleDescription')}</p>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t('reminders.nextDate')}</Label>
              <Input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} />
            </div>
            <div>
              <Label>{t('reminders.nextKm')}</Label>
              <Input type="number" placeholder="ex: 120000" value={reminderKm} onChange={e => setReminderKm(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => completeWithReminder(false)}>
              {t('reminders.skipReminder')}
            </Button>
            <Button onClick={() => completeWithReminder(true)} disabled={!reminderDate}>
              <CalendarClock className="w-4 h-4 mr-2" />
              {t('reminders.createReminder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
