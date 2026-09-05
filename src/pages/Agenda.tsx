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
import { pt, ptBR, enUS, es, hi } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { suggestSlots, detectConflict, DEFAULT_OPENING_HOURS, type OpeningHours, type SlotSuggestion } from "@/lib/schedulingEngine";
import { sendRescheduleEmail, sendRescheduleWhatsApp, type RescheduleNotifyContext } from "@/lib/appointmentNotify";
import { isValidEmail } from "@/lib/emailService";
import { Mail, MessageCircle } from "lucide-react";

interface Appointment {
  id: string;
  shop_id: string;
  client_id: string | null;
  vehicle_id: string | null;
  service_type: string;
  service_id?: string | null;
  assigned_to?: string | null;
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

interface CatalogItem { id: string; name: string; default_time: number; default_price: number }
interface Mechanic { id: string; label: string }

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
  const locale = language === "pt" ? pt
    : language === "pt-BR" ? ptBR
    : language === "es" ? es
    : language === "hi" ? hi
    : enUS;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; make: string; model: string; client_id: string }[]>([]);
  const [shopSlug, setShopSlug] = useState("");
  const [loading, setLoading] = useState(true);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [openingHours, setOpeningHours] = useState<OpeningHours>(DEFAULT_OPENING_HOURS);
  const [suggestions, setSuggestions] = useState<SlotSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);

  const [form, setForm] = useState({
    client_id: "", vehicle_id: "", service_type: "", service_id: "", assigned_to: "",
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
  const [notifyChannels, setNotifyChannels] = useState<{ email: boolean; whatsapp: boolean }>({ email: false, whatsapp: false });
  const [rescheduling, setRescheduling] = useState(false);
  /** Guardado quando a marcação já foi reagendada mas a notificação falhou (permite tentar de novo). */
  const [notifyRetry, setNotifyRetry] = useState<RescheduleNotifyContext | null>(null);
  const [shopInfo, setShopInfo] = useState<{ name: string; phone: string | null }>({ name: '', phone: null });


  const acceptAppointment = async (appt: Appointment) => {
    const { error } = await supabase.from('appointments').update({ status: 'confirmed' } as any).eq('id', appt.id);
    if (error) { toast({ title: t('common.error'), description: error.message, variant: 'destructive' }); return; }
    if (appt.client_email) {
      supabase.functions.invoke('send-email', {
        body: {
          to: appt.client_email,
          subject: `Marcação confirmada — ${appt.date} ${String(appt.time).slice(0,5)}`,
          html: `<p>Olá ${appt.client_name || ''},</p><p>A sua marcação foi <strong>confirmada</strong> para <strong>${appt.date} às ${String(appt.time).slice(0,5)}</strong>.</p><p>Serviço: ${appt.service_type}</p><p>Obrigado.</p>`,
          shop_id: activeShopId,
        },
      }).catch(() => {});
    }
    toast({ title: t('agenda.confirmed') || 'Confirmada' });
    loadData();
  };

  /** Contactos resolvidos do cliente (da própria marcação ou da ficha de cliente). */
  const [rescheduleContact, setRescheduleContact] = useState<{ name: string; email: string | null; phone: string | null }>({ name: '', email: null, phone: null });

  const openReschedule = async (appt: Appointment) => {
    setRescheduleAppt(appt);
    setRescheduleData({ date: appt.date, time: String(appt.time).slice(0, 5) });
    setNotifyRetry(null);

    let name = appt.client_name || '';
    let email = appt.client_email || null;
    let phone = appt.client_phone || null;
    if (appt.client_id && (!email || !phone || !name)) {
      const { data } = await supabase.from('clients').select('name, email, phone').eq('id', appt.client_id).maybeSingle();
      if (data) {
        name = name || (data as any).name || '';
        email = email || (data as any).email || null;
        phone = phone || (data as any).phone || null;
      }
    }
    setRescheduleContact({ name, email, phone });
    setNotifyChannels({ email: isValidEmail(email), whatsapp: !isValidEmail(email) && !!phone });
  };

  const buildNotifyContext = (appt: Appointment): RescheduleNotifyContext => {
    const veh = vehicles.find(v => v.id === appt.vehicle_id);
    return {
      appointmentId: appt.id,
      shopId: activeShopId || appt.shop_id,
      shopName: shopInfo.name || undefined,
      shopPhone: shopInfo.phone,
      clientName: rescheduleContact.name || appt.client_name,
      clientEmail: rescheduleContact.email,
      clientPhone: rescheduleContact.phone,
      serviceType: appt.service_type,
      vehicleLabel: veh ? `${[veh.make, veh.model].filter(Boolean).join(' ')}${veh.plate ? ` — ${veh.plate}` : ''}`.trim() : null,
      oldDate: appt.date,
      oldTime: String(appt.time).slice(0, 5),
      newDate: rescheduleData.date,
      newTime: rescheduleData.time,
    };
  };

  /** Envia pelos canais escolhidos. Devolve os canais entregues; lança se todos falharem. */
  const runNotifications = async (ctx: RescheduleNotifyContext, channels: { email: boolean; whatsapp: boolean }) => {
    const sent: string[] = [];
    const failed: string[] = [];
    if (channels.email) {
      try { await sendRescheduleEmail(ctx); sent.push('email'); } catch { failed.push('email'); }
    }
    if (channels.whatsapp) {
      try { await sendRescheduleWhatsApp(ctx); sent.push('WhatsApp'); } catch { failed.push('WhatsApp'); }
    }
    return { sent, failed };
  };

  const submitReschedule = async () => {
    if (!rescheduleAppt || rescheduling) return;
    if (!rescheduleData.date || !rescheduleData.time) {
      toast({ title: 'Indique a nova data e hora', variant: 'destructive' });
      return;
    }
    setRescheduling(true);
    const appt = rescheduleAppt;
    const { error } = await supabase.from('appointments')
      .update({ date: rescheduleData.date, time: rescheduleData.time, status: 'confirmed' } as any)
      .eq('id', appt.id);
    if (error) {
      setRescheduling(false);
      toast({ title: t('common.error'), description: 'Não foi possível guardar a nova data.', variant: 'destructive' });
      return;
    }

    const ctx = buildNotifyContext(appt);
    const channels = { ...notifyChannels };
    setRescheduleAppt(null);
    setRescheduling(false);
    loadData();

    if (!channels.email && !channels.whatsapp) {
      toast({ title: 'Marcação reagendada' });
      return;
    }

    const { sent, failed } = await runNotifications(ctx, channels);
    if (sent.length && !failed.length) {
      toast({ title: `Marcação reagendada e cliente notificado por ${sent.join(' e ')}.` });
    } else if (sent.length) {
      setNotifyRetry(ctx);
      toast({ title: `Marcação reagendada. Notificação enviada por ${sent.join(' e ')}, mas falhou por ${failed.join(' e ')}.`, variant: 'destructive' });
    } else {
      setNotifyRetry(ctx);
      toast({ title: 'Marcação reagendada com sucesso, mas não foi possível enviar a notificação ao cliente.', variant: 'destructive' });
    }
  };

  const retryNotification = async () => {
    if (!notifyRetry) return;
    const { sent, failed } = await runNotifications(notifyRetry, notifyChannels);
    if (sent.length && !failed.length) {
      setNotifyRetry(null);
      toast({ title: `Cliente notificado por ${sent.join(' e ')}.` });
    } else {
      toast({ title: 'Continua a não ser possível notificar o cliente.', variant: 'destructive' });
    }
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
          shop_id: activeShopId,
        },
      }).catch(() => {});
    }
    loadData();
  };

  const pendingPortalAppts = useMemo(
    () => appointments.filter(a => a.status === 'pending' && (a.source === 'portal' || a.source === 'public')),
    [appointments]
  );

  /** Etiqueta legível da viatura associada à marcação (quando existe). */
  const vehicleLabelOf = (appt: Appointment) => {
    const veh = vehicles.find(v => v.id === appt.vehicle_id);
    if (!veh) return null;
    return `${[veh.make, veh.model].filter(Boolean).join(' ')}${veh.plate ? ` — ${veh.plate}` : ''}`.trim();
  };

  /** Disponibilidade da oficina no horário pedido por cada marcação pendente. */
  const [pendingAvailability, setPendingAvailability] = useState<Record<string, 'free' | 'busy' | 'closed'>>({});

  useEffect(() => {
    if (!activeShopId || pendingPortalAppts.length === 0) { setPendingAvailability({}); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(pendingPortalAppts.map(async (a) => {
        const slots = await getDaySlots({
          shopId: activeShopId,
          date: a.date,
          durationMinutes: a.duration_minutes || 60,
          openingHours,
          excludeAppointmentId: a.id,
        });
        if (slots.length === 0) return [a.id, 'closed'] as const;
        const conflict = await detectConflict({
          shopId: activeShopId,
          date: a.date,
          time: String(a.time).slice(0, 5),
          durationMinutes: a.duration_minutes || 60,
          excludeId: a.id,
        });
        return [a.id, conflict ? 'busy' : 'free'] as const;
      }));
      if (!cancelled) setPendingAvailability(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [activeShopId, pendingPortalAppts, openingHours]);

  /** Horários do dia escolhido no reagendamento rápido. */
  const [rescheduleSlots, setRescheduleSlots] = useState<{ time: string; free: boolean }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  useEffect(() => {
    if (!rescheduleAppt || !activeShopId || !rescheduleData.date) { setRescheduleSlots([]); return; }
    let cancelled = false;
    setLoadingSlots(true);
    getDaySlots({
      shopId: activeShopId,
      date: rescheduleData.date,
      durationMinutes: rescheduleAppt.duration_minutes || 60,
      openingHours,
      excludeAppointmentId: rescheduleAppt.id,
    })
      .then(s => { if (!cancelled) setRescheduleSlots(s); })
      .finally(() => { if (!cancelled) setLoadingSlots(false); });
    return () => { cancelled = true; };
  }, [rescheduleAppt, rescheduleData.date, activeShopId, openingHours]);

  const loadData = async () => {
    if (!activeShopId) return;
    setLoading(true);
    const weekEnd = addDays(weekStart, 6);

    const [apptRes, clientRes, vehicleRes, shopRes, catalogRes, teamRes] = await Promise.all([
      supabase.from("appointments").select("*")
        .eq("shop_id", activeShopId)
        .gte("date", format(weekStart, "yyyy-MM-dd"))
        .lte("date", format(weekEnd, "yyyy-MM-dd"))
        .order("time"),
      supabase.from("clients").select("id, name").eq("shop_id", activeShopId).is("deleted_at", null).order("name").limit(1000),
      supabase.from("vehicles").select("id, plate, make, model, client_id").eq("shop_id", activeShopId).is("deleted_at", null).limit(1000),
      supabase.from("shops").select("slug, opening_hours, name, phone").eq("id", activeShopId).maybeSingle(),
      supabase.from("service_catalog").select("id, name, default_time, default_price").eq("shop_id", activeShopId).eq("active", true).order("name"),
      supabase.from("shop_users").select("id, user_id, role").eq("shop_id", activeShopId),
    ]);

    if (apptRes.data) setAppointments(apptRes.data as Appointment[]);
    if (clientRes.data) setClients(clientRes.data);
    if (vehicleRes.data) setVehicles(vehicleRes.data);
    if (shopRes.data?.slug) setShopSlug(shopRes.data.slug);
    if (shopRes.data) setShopInfo({ name: (shopRes.data as any).name || '', phone: (shopRes.data as any).phone || null });
    if ((shopRes.data as any)?.opening_hours) setOpeningHours((shopRes.data as any).opening_hours as OpeningHours);
    if (catalogRes.data) setCatalog(catalogRes.data as CatalogItem[]);

    if (teamRes.data && teamRes.data.length) {
      const { data: emails } = await supabase.rpc("get_shop_member_emails", { _shop_id: activeShopId });
      const emailMap = new Map((emails || []).map((e: any) => [e.user_id, e.email]));
      setMechanics(
        teamRes.data.map((m: any) => ({
          id: m.user_id,
          label: (emailMap.get(m.user_id) as string) || m.role,
        }))
      );
    } else {
      setMechanics([]);
    }
    setLoading(false);
  };

  const resetForm = () => setForm({
    client_id: "", vehicle_id: "", service_type: "", service_id: "", assigned_to: "",
    date: format(new Date(), "yyyy-MM-dd"), time: "09:00",
    duration_minutes: 60, notes: "", status: "scheduled",
  });

  const openEdit = (appt: Appointment) => {
    setEditingAppt(appt);
    setForm({
      client_id: appt.client_id || "",
      vehicle_id: appt.vehicle_id || "",
      service_type: appt.service_type,
      service_id: appt.service_id || "",
      assigned_to: appt.assigned_to || "",
      date: appt.date,
      time: appt.time.slice(0, 5),
      duration_minutes: appt.duration_minutes,
      notes: appt.notes || "",
      status: appt.status,
    });
    setSuggestions([]);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingAppt(null);
    resetForm();
    setSuggestions([]);
    setDialogOpen(true);
  };

  const onServiceCatalogPick = (id: string) => {
    const svc = catalog.find(c => c.id === id);
    if (!svc) return;
    setForm(f => ({
      ...f,
      service_id: id,
      service_type: svc.name,
      duration_minutes: svc.default_time || f.duration_minutes,
    }));
    setSuggestions([]);
  };

  const requestSuggestions = async () => {
    if (!activeShopId) return;
    setSuggesting(true);
    try {
      const slots = await suggestSlots({
        shopId: activeShopId,
        durationMinutes: form.duration_minutes,
        openingHours,
        preferredDate: form.date,
        mechanicId: form.assigned_to || null,
        mechanics,
        limit: 3,
      });
      setSuggestions(slots);
      if (!slots.length) toast({ title: t('agenda.noSlots') || 'Sem horários disponíveis nos próximos 14 dias', variant: "destructive" });
    } finally {
      setSuggesting(false);
    }
  };

  const applySuggestion = (s: SlotSuggestion) => {
    setForm(f => ({ ...f, date: s.date, time: s.time, assigned_to: s.mechanicId || f.assigned_to }));
    setSuggestions([]);
  };

  const handleSave = async () => {
    if (!activeShopId || !form.date || !form.time || !form.service_type) {
      toast({ title: t('agenda.fillRequired'), variant: "destructive" });
      return;
    }

    // Conflict detection
    const conflict = await detectConflict({
      shopId: activeShopId,
      date: form.date,
      time: form.time,
      durationMinutes: form.duration_minutes,
      mechanicId: form.assigned_to || null,
      excludeId: editingAppt?.id,
    });
    if (conflict) {
      toast({
        title: t('agenda.conflict') || 'Conflito de horário',
        description: t('agenda.conflictMsg') || 'Já existe uma marcação sobreposta. Usa "Sugerir horário" para encontrar um slot livre.',
        variant: "destructive",
      });
      return;
    }

    const payload = {
      shop_id: activeShopId,
      client_id: form.client_id || null,
      vehicle_id: form.vehicle_id || null,
      service_type: form.service_type,
      service_id: form.service_id || null,
      assigned_to: form.assigned_to || null,
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
      // Notify assigned mechanic
      if (form.assigned_to) {
        await supabase.from("notifications").insert({
          shop_id: activeShopId,
          user_id: form.assigned_to,
          type: "appointment_assigned",
          title: t('agenda.assignedTitle') || 'Nova marcação atribuída',
          message: `${form.service_type} — ${form.date} ${form.time}`,
        } as any);
      }
      toast({ title: t('agenda.created') });
    }

    setDialogOpen(false);
    setEditingAppt(null);
    resetForm();
    loadData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("appointments").delete().eq("id", id).eq("shop_id", activeShopId);
    setDeleteConfirm(null);
    toast({ title: t('agenda.deleted') });
    loadData();
  };

  const updateStatus = async (id: string, status: string) => {
    await supabase.from("appointments").update({ status } as any).eq("id", id).eq("shop_id", activeShopId);
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Nova data</Label>
                <Input type="date" value={rescheduleData.date} onChange={(e) => setRescheduleData({ ...rescheduleData, date: e.target.value })} />
              </div>
              <div>
                <Label>Nova hora</Label>
                <Input type="time" value={rescheduleData.time} onChange={(e) => setRescheduleData({ ...rescheduleData, time: e.target.value })} />
              </div>
            </div>

            {/* Notificação ao cliente */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div>
                <p className="text-sm font-semibold">Notificação ao cliente</p>
                <p className="text-xs text-muted-foreground">Informe o cliente automaticamente sobre a alteração da marcação.</p>
              </div>
              {(isValidEmail(rescheduleContact.email) || rescheduleContact.phone) ? (
                <div className="flex flex-wrap gap-2">
                  {isValidEmail(rescheduleContact.email) && (
                    <Button
                      type="button"
                      size="sm"
                      variant={notifyChannels.email ? 'default' : 'outline'}
                      onClick={() => setNotifyChannels(c => ({ ...c, email: !c.email }))}
                    >
                      <Mail className="w-3.5 h-3.5 mr-1.5" /> Email
                    </Button>
                  )}
                  {rescheduleContact.phone && (
                    <Button
                      type="button"
                      size="sm"
                      variant={notifyChannels.whatsapp ? 'default' : 'outline'}
                      onClick={() => setNotifyChannels(c => ({ ...c, whatsapp: !c.whatsapp }))}
                    >
                      <MessageCircle className="w-3.5 h-3.5 mr-1.5" /> WhatsApp
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Este cliente não tem email nem telefone registados.</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleAppt(null)} disabled={rescheduling}>Cancelar</Button>
            <Button onClick={submitReschedule} disabled={rescheduling}>
              {rescheduling ? 'A guardar...' : (notifyChannels.email || notifyChannels.whatsapp) ? 'Confirmar e notificar cliente' : 'Confirmar reagendamento'}
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

      {/* Falha ao notificar — permitir tentar novamente */}
      {notifyRetry && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="py-3 px-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <p className="text-sm flex-1">Marcação reagendada com sucesso, mas não foi possível enviar a notificação ao cliente.</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={retryNotification}>Tentar novamente</Button>
              <Button size="sm" variant="ghost" onClick={() => setNotifyRetry(null)}>Dispensar</Button>
            </div>
          </CardContent>
        </Card>
      )}

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
          <div className="min-w-[640px] sm:min-w-[700px]">
            <div className="grid grid-cols-[52px_repeat(7,minmax(84px,1fr))] sm:grid-cols-[60px_repeat(7,1fr)] border-b border-border">
              <div className="p-2 text-xs text-muted-foreground sticky left-0 z-20 bg-card" />
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
              <div key={hour} className="grid grid-cols-[52px_repeat(7,minmax(84px,1fr))] sm:grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[60px]">
                <div className="p-1 sm:p-2 text-[11px] sm:text-xs text-muted-foreground text-right pr-2 sm:pr-3 pt-1 sticky left-0 z-20 bg-card border-r border-border/50">
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
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {app.status === "scheduled" && (
                              <button onClick={() => updateStatus(app.id, "confirmed")} className="text-[9px] bg-green-500/20 text-green-700 px-1 rounded hover:bg-green-500/30">✓</button>
                            )}
                            {(app.status === "scheduled" || app.status === "confirmed") && (
                              <button onClick={() => updateStatus(app.id, "completed")} className="text-[9px] bg-muted px-1 rounded hover:bg-muted/80">✔</button>
                            )}
                            {(app.source === 'portal' || app.source === 'public') && app.status !== 'pending' && (
                              <button onClick={() => openReschedule(app)} title="Reagendar e notificar cliente" className="text-[9px] bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1 rounded hover:bg-amber-500/25">
                                <CalendarClock className="w-2.5 h-2.5 inline" />
                              </button>
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
          <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
            {catalog.length > 0 && (
              <div>
                <Label>Serviço do catálogo</Label>
                <Select value={form.service_id} onValueChange={onServiceCatalogPick}>
                  <SelectTrigger><SelectValue placeholder="Escolher serviço (preenche duração)" /></SelectTrigger>
                  <SelectContent>
                    {catalog.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name} · {c.default_time}min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>{t('agenda.serviceType')} *</Label>
              <Input value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value, service_id: "" })} placeholder={t('agenda.serviceTypePlaceholder')} />
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
            {mechanics.length > 0 && (
              <div>
                <Label className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> Mecânico</Label>
                <Select value={form.assigned_to || "__any__"} onValueChange={v => setForm({ ...form, assigned_to: v === "__any__" ? "" : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__any__">Qualquer mecânico disponível</SelectItem>
                    {mechanics.map(m => <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="rounded-md border border-primary/20 bg-primary/5 p-2 space-y-2">
              <Button type="button" size="sm" variant="outline" className="w-full" onClick={requestSuggestions} disabled={suggesting || !form.service_type}>
                <Sparkles className="w-4 h-4 mr-1" />
                {suggesting ? 'A analisar...' : 'Sugerir melhor horário'}
              </Button>
              {suggestions.length > 0 && (
                <div className="space-y-1">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="w-full text-left text-xs px-2 py-1.5 rounded bg-card border border-border hover:border-primary hover:bg-primary/10 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
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
