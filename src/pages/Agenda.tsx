import { useState, useEffect, useMemo } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, Copy, ExternalLink, Trash2, Edit, CalendarCheck, CalendarX, CalendarClock, CheckCircle2, Sparkles, User } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { pt, enUS, es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { suggestSlots, detectConflict, DEFAULT_OPENING_HOURS, type OpeningHours, type SlotSuggestion } from "@/lib/schedulingEngine";

interface Appointment {
  id: string;
  shop_id: string;
  client_id: string | null;
  vehicle_id: string | null;
  service_type: string;
  date: string;
  time: string;
  duration_minutes: number;
  status: string;
  notes: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  created_at: string;
  source?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-400",
  scheduled: "bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-400",
  confirmed: "bg-green-500/15 text-green-700 border-green-300 dark:text-green-400",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_DOT: Record<string, string> = {
  pending: "bg-amber-500",
  scheduled: "bg-blue-500",
  confirmed: "bg-green-500",
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8);

export default function Agenda() {
  const { activeShopId } = useShopContext();
  const { t, language } = useLanguage();
  const locale = language === "pt" ? pt : language === "es" ? es : enUS;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; make: string; model: string; client_id: string }[]>([]);
  const [shopSlug, setShopSlug] = useState("");
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    client_id: "", vehicle_id: "", service_type: "",
    date: format(new Date(), "yyyy-MM-dd"), time: "09:00",
    duration_minutes: 60, notes: "", status: "scheduled",
  });

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    if (!activeShopId) return;
    loadData();
  }, [activeShopId, weekStart]);

  // Realtime: instantly receive new portal bookings + status updates
  useEffect(() => {
    if (!activeShopId) return;
    const channel = supabase
      .channel(`agenda-${activeShopId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `shop_id=eq.${activeShopId}` }, (payload: any) => {
        const row = payload.new || payload.old;
        if (payload.eventType === 'INSERT' && row?.source === 'portal') {
          toast({ title: t('agenda.newPortalBooking') || 'Nova marcação do portal', description: `${row.client_name || ''} — ${row.date} ${String(row.time).slice(0,5)}` });
        }
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeShopId]);

  // Reschedule dialog state
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleData, setRescheduleData] = useState({ date: '', time: '09:00' });

  const acceptAppointment = async (appt: Appointment) => {
    const { error } = await supabase.from('appointments').update({ status: 'confirmed' } as any).eq('id', appt.id);
    if (error) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); return; }
    if (appt.client_email) {
      supabase.functions.invoke('send-email', {
        body: {
          to: appt.client_email,
          subject: `Marcação confirmada — ${appt.date} ${String(appt.time).slice(0,5)}`,
          html: `<p>Olá ${appt.client_name || ''},</p><p>A sua marcação foi <strong>confirmada</strong> para <strong>${appt.date} às ${String(appt.time).slice(0,5)}</strong>.</p><p>Serviço: ${appt.service_type}</p><p>Obrigado.</p>`,
        },
      }).catch(() => {});
    }
    toast({ title: t('agenda.confirmed') || 'Confirmada' });
    loadData();
  };

  const openReschedule = (appt: Appointment) => {
    setRescheduleAppt(appt);
    setRescheduleData({ date: appt.date, time: String(appt.time).slice(0, 5) });
  };

  const submitReschedule = async () => {
    if (!rescheduleAppt) return;
    const { error } = await supabase.from('appointments')
      .update({ date: rescheduleData.date, time: rescheduleData.time, status: 'confirmed' } as any)
      .eq('id', rescheduleAppt.id);
    if (error) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); return; }
    if (rescheduleAppt.client_email) {
      supabase.functions.invoke('send-email', {
        body: {
          to: rescheduleAppt.client_email,
          subject: `Marcação reagendada — ${rescheduleData.date} ${rescheduleData.time}`,
          html: `<p>Olá ${rescheduleAppt.client_name || ''},</p><p>A sua marcação foi <strong>reagendada</strong> para <strong>${rescheduleData.date} às ${rescheduleData.time}</strong>.</p><p>Serviço: ${rescheduleAppt.service_type}</p>`,
        },
      }).catch(() => {});
    }
    setRescheduleAppt(null);
    toast({ title: t('agenda.rescheduled') || 'Reagendada e cliente notificado' });
    loadData();
  };

  const rejectAppointment = async (appt: Appointment) => {
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' } as any).eq('id', appt.id);
    if (error) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); return; }
    if (appt.client_email) {
      supabase.functions.invoke('send-email', {
        body: {
          to: appt.client_email,
          subject: 'Marcação não confirmada',
          html: `<p>Olá ${appt.client_name || ''},</p><p>Lamentamos, a sua marcação para ${appt.date} ${String(appt.time).slice(0,5)} não pôde ser confirmada. Por favor escolha outra data no portal.</p>`,
        },
      }).catch(() => {});
    }
    loadData();
  };

  const pendingPortalAppts = useMemo(
    () => appointments.filter(a => a.status === 'pending' && a.source === 'portal'),
    [appointments]
  );

  const loadData = async () => {
    if (!activeShopId) return;
    setLoading(true);
    const weekEnd = addDays(weekStart, 6);

    const [apptRes, clientRes, vehicleRes, shopRes] = await Promise.all([
      supabase.from("appointments").select("*")
        .eq("shop_id", activeShopId)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("time"),
      supabase.from("clients").select("id, name").eq("shop_id", activeShopId).is("deleted_at", null).order("name"),
      supabase.from("vehicles").select("id, plate, make, model, client_id").eq("shop_id", activeShopId).is("deleted_at", null),
      supabase.from("shops").select("slug").eq("id", activeShopId).single(),
    ]);

    if (apptRes.data) setAppointments(apptRes.data as Appointment[]);
    if (clientRes.data) setClients(clientRes.data);
    if (vehicleRes.data) setVehicles(vehicleRes.data);
    if (shopRes.data?.slug) setShopSlug(shopRes.data.slug);
    setLoading(false);
  };

  const resetForm = () => setForm({
    client_id: "", vehicle_id: "", service_type: "",
    date: format(new Date(), "yyyy-MM-dd"), time: "09:00",
    duration_minutes: 60, notes: "", status: "scheduled",
  });

  const openEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    setForm({
      client_id: appt.client_id || "",
      vehicle_id: appt.vehicle_id || "",
      service_type: appt.service_type,
      date: appt.date,
      time: appt.time.slice(0, 5),
      duration_minutes: appt.duration_minutes,
      notes: appt.notes || "",
      status: appt.status,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingAppt(null);
    resetForm();
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!activeShopId || !form.date || !form.time || !form.service_type) {
      toast({ title: t('agenda.fillRequired'), variant: "destructive" });
      return;
    }

    const payload = {
      shop_id: activeShopId,
      client_id: form.client_id || null,
      vehicle_id: form.vehicle_id || null,
      service_type: form.service_type,
      date: form.date,
      time: form.time,
      duration_minutes: form.duration_minutes,
      notes: form.notes || null,
      status: form.status,
    } as any;

    if (editingAppt) {
      const { error } = await supabase.from("appointments").update(payload).eq("id", editingAppt.id);
      if (error) { toast({ title: t('common.error'), description: error.message, variant: "destructive" }); return; }
      toast({ title: t('agenda.updated') });
    } else {
      const { error } = await supabase.from("appointments").insert(payload);
      if (error) { toast({ title: t('common.error'), description: error.message, variant: "destructive" }); return; }
      await supabase.from("alerts").insert({
        shop_id: activeShopId, type: "appointment",
        title: t('agenda.newAppointmentAlert'),
        message: `${form.service_type} - ${form.date} ${form.time}`,
        priority: "low",
      } as any);
      toast({ title: t('agenda.created') });
    }

    setDialogOpen(false);
    setEditingAppt(null);
    resetForm();
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id);
    setDeleteConfirm(null);
    toast({ title: t('agenda.deleted') });
    loadData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status } as any).eq("id", id);
    loadData();
  };

  const getAppsForDayHour = (day: Date, hour: number) =>
    appointments.filter(a => isSameDay(new Date(a.date), day) && parseInt(a.time.split(":")[0]) === hour);

  const getDayAppCount = (day: Date) =>
    appointments.filter(a => isSameDay(new Date(a.date), day)).length;

  // Summary KPIs
  const totalWeek = appointments.length;
  const scheduledCount = appointments.filter(a => a.status === 'scheduled').length;
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;

  const publicDomain = "https://garageflow.pt";
  const bookingUrl = shopSlug ? `${publicDomain}/book/${shopSlug}` : "";
  const clientVehicles = form.client_id ? vehicles.filter(v => v.client_id === form.client_id) : vehicles;

  const [statusFilterTab, setStatusFilterTab] = useState("all");

  const filteredAppointments = useMemo(() => {
    if (statusFilterTab === "all") return appointments;
    return appointments.filter(a => a.status === statusFilterTab);
  }, [appointments, statusFilterTab]);

  const getFilteredAppsForDayHour = (day: Date, hour: number) =>
    filteredAppointments.filter(a => isSameDay(new Date(a.date), day) && parseInt(a.time.split(":")[0]) === hour);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            {t('agenda.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('agenda.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {bookingUrl && (
            <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast({ title: t('agenda.linkCopied') }); }}>
              <Copy className="w-4 h-4 mr-1" /> {t('agenda.copyLink')}
            </Button>
          )}
          <Button size="sm" onClick={openCreate}><Plus className="w-4 h-4 mr-1" /> {t('agenda.new')}</Button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('agenda.totalWeek'), value: totalWeek, icon: CalendarClock, color: "text-primary" },
          { label: t('agenda.scheduled'), value: scheduledCount, icon: CalendarClock, color: "text-blue-500" },
          { label: t('agenda.confirmed'), value: confirmedCount, icon: CalendarCheck, color: "text-green-500" },
          { label: t('agenda.completed'), value: completedCount, icon: CheckCircle2, color: "text-muted-foreground" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-3 pb-2 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pending portal bookings */}
      {pendingPortalAppts.length > 0 && (
        <Card className="border-amber-400/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <CalendarClock className="w-4 h-4" />
              {pendingPortalAppts.length} {pendingPortalAppts.length === 1 ? 'marcação pendente do portal' : 'marcações pendentes do portal'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pb-3">
            {pendingPortalAppts.map((a) => (
              <div key={a.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-md bg-card border border-border">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{a.client_name || 'Cliente'} <span className="text-muted-foreground font-normal">— {a.service_type}</span></p>
                  <p className="text-xs text-muted-foreground">
                    {a.date} às {String(a.time).slice(0, 5)}
                    {a.client_phone && <> · {a.client_phone}</>}
                    {a.client_email && <> · {a.client_email}</>}
                  </p>
                  {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{a.notes}"</p>}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" onClick={() => acceptAppointment(a)} className="bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Aceitar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openReschedule(a)}>
                    <CalendarClock className="w-3.5 h-3.5 mr-1" /> Reagendar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => rejectAppointment(a)} className="text-destructive hover:text-destructive">
                    <CalendarX className="w-3.5 h-3.5 mr-1" /> Recusar
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Reschedule dialog */}
      <Dialog open={!!rescheduleAppt} onOpenChange={(o) => !o && setRescheduleAppt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reagendar marcação</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nova data</Label>
              <Input type="date" value={rescheduleData.date} onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })} />
            </div>
            <div>
              <Label>Nova hora</Label>
              <Input type="time" value={rescheduleData.time} onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">O cliente recebe email com a nova data e a marcação fica confirmada.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleAppt(null)}>Cancelar</Button>
            <Button onClick={submitReschedule}>Confirmar e notificar cliente</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Booking link info */}
      {bookingUrl && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-3 px-4 flex items-center gap-3 text-sm">
            <ExternalLink className="w-4 h-4 text-primary shrink-0" />
            <span className="text-muted-foreground">{t('agenda.publicLink')}:</span>
            <a href={bookingUrl} target="_blank" rel="noopener" className="text-primary font-medium hover:underline truncate">{bookingUrl}</a>
          </CardContent>
        </Card>
      )}

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-sm font-semibold text-foreground">
          {format(weekStart, "d MMM", { locale })} — {format(addDays(weekStart, 6), "d MMM yyyy", { locale })}
        </h2>
        <div className="flex gap-1">
          <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            {t('agenda.today')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekStart(addWeeks(weekStart, 1))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <Tabs value={statusFilterTab} onValueChange={setStatusFilterTab}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs px-3 h-7">{t('common.all')} ({totalWeek})</TabsTrigger>
          <TabsTrigger value="scheduled" className="text-xs px-3 h-7">{t('agenda.scheduled')} ({scheduledCount})</TabsTrigger>
          <TabsTrigger value="confirmed" className="text-xs px-3 h-7">{t('agenda.confirmed')} ({confirmedCount})</TabsTrigger>
          <TabsTrigger value="completed" className="text-xs px-3 h-7">{t('agenda.completed')} ({completedCount})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Status legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {[["scheduled", t('agenda.scheduled')], ["confirmed", t('agenda.confirmed')], ["completed", t('agenda.completed')], ["cancelled", t('agenda.cancelled')]].map(([s, label]) => (
          <div key={s} className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[s]}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div className="p-2 text-xs text-muted-foreground" />
              {weekDays.map((day, i) => {
                const isToday = isSameDay(day, new Date());
                const count = getDayAppCount(day);
                return (
                  <div key={i} className={`p-2 text-center border-l border-border ${isToday ? 'bg-primary/5' : ''}`}>
                    <div className="text-xs text-muted-foreground">{format(day, "EEE", { locale })}</div>
                    <div className={`text-lg font-bold ${isToday ? 'text-primary' : 'text-foreground'}`}>{format(day, "d")}</div>
                    {count > 0 && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count}</Badge>}
                  </div>
                );
              })}
            </div>

            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[60px]">
                <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {weekDays.map((day, di) => {
                  const apps = getFilteredAppsForDayHour(day, hour);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={di} className={`border-l border-border/50 p-0.5 ${isToday ? 'bg-primary/[0.02]' : ''}`}>
                      {apps.map(app => (
                        <div key={app.id}
                          className={`text-[11px] rounded px-1.5 py-1 mb-0.5 border cursor-pointer hover:opacity-80 transition-opacity ${STATUS_COLORS[app.status] || STATUS_COLORS.scheduled}`}>
                          <div className="font-medium truncate">{app.service_type}</div>
                          <div className="flex items-center gap-1 text-[10px] opacity-75">
                            <Clock className="w-3 h-3" />
                            {app.time.slice(0, 5)}
                            {app.duration_minutes > 0 && <span>({app.duration_minutes}m)</span>}
                            {app.client_name && <span>· {app.client_name}</span>}
                          </div>
                          <div className="flex gap-1 mt-0.5">
                            {app.status === "scheduled" && (
                              <button onClick={() => updateStatus(app.id, "confirmed")} className="text-[9px] bg-green-500/20 text-green-700 px-1 rounded hover:bg-green-500/30">✓</button>
                            )}
                            {(app.status === "scheduled" || app.status === "confirmed") && (
                              <button onClick={() => updateStatus(app.id, "completed")} className="text-[9px] bg-muted px-1 rounded hover:bg-muted/80">✔</button>
                            )}
                            <button onClick={() => openEdit(app)} className="text-[9px] bg-primary/10 text-primary px-1 rounded hover:bg-primary/20">
                              <Edit className="w-2.5 h-2.5 inline" />
                            </button>
                            <button onClick={() => setDeleteConfirm(app.id)} className="text-[9px] bg-destructive/10 text-destructive px-1 rounded hover:bg-destructive/20">
                              <Trash2 className="w-2.5 h-2.5 inline" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) { setEditingAppt(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingAppt ? t('agenda.editAppointment') : t('agenda.new')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('agenda.serviceType')} *</Label>
              <Input value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })} placeholder={t('agenda.serviceTypePlaceholder')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t('agenda.date')}</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
              <div><Label>{t('agenda.time')}</Label><Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('agenda.duration')}</Label>
                <Select value={String(form.duration_minutes)} onValueChange={v => setForm({ ...form, duration_minutes: Number(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 min</SelectItem>
                    <SelectItem value="60">1h</SelectItem>
                    <SelectItem value="90">1h30</SelectItem>
                    <SelectItem value="120">2h</SelectItem>
                    <SelectItem value="180">3h</SelectItem>
                    <SelectItem value="240">4h</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editingAppt && (
                <div>
                  <Label>{t('agenda.status')}</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="scheduled">{t('agenda.scheduled')}</SelectItem>
                      <SelectItem value="confirmed">{t('agenda.confirmed')}</SelectItem>
                      <SelectItem value="completed">{t('agenda.completed')}</SelectItem>
                      <SelectItem value="cancelled">{t('agenda.cancelled')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div>
              <Label>{t('clients.title')}</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v, vehicle_id: "" })}>
                <SelectTrigger><SelectValue placeholder={t('agenda.selectClient')} /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {clientVehicles.length > 0 && (
              <div>
                <Label>{t('vehicles.title')}</Label>
                <Select value={form.vehicle_id} onValueChange={v => setForm({ ...form, vehicle_id: v })}>
                  <SelectTrigger><SelectValue placeholder={t('agenda.selectVehicle')} /></SelectTrigger>
                  <SelectContent>
                    {clientVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.plate} - {v.make} {v.model}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t('agenda.notes')}</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleSave} className="w-full">
              {editingAppt ? t('common.save') : t('agenda.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('agenda.deleteConfirm')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('agenda.deleteConfirmMsg')}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>{t('common.delete')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
