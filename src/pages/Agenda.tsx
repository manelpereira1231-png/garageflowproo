import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShopContext } from "@/hooks/useShopContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar, ChevronLeft, ChevronRight, Plus, Clock, Copy, ExternalLink } from "lucide-react";
import { format, startOfWeek, addDays, isSameDay, addWeeks, subWeeks } from "date-fns";
import { pt, enUS, es } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

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
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-500/15 text-blue-700 border-blue-300",
  confirmed: "bg-green-500/15 text-green-700 border-green-300",
  completed: "bg-muted text-muted-foreground border-border",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_DOT: Record<string, string> = {
  scheduled: "bg-blue-500",
  confirmed: "bg-green-500",
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
};

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 - 19:00

export default function Agenda() {
  const { activeShopId } = useShopContext();
  const { t, language } = useLanguage();
  const locale = language === "pt" ? pt : language === "es" ? es : enUS;

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [vehicles, setVehicles] = useState<{ id: string; plate: string; make: string; model: string; client_id: string }[]>([]);
  const [shopSlug, setShopSlug] = useState("");
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    client_id: "",
    vehicle_id: "",
    service_type: "",
    date: format(new Date(), "yyyy-MM-dd"),
    time: "09:00",
    duration_minutes: 60,
    notes: "",
    status: "scheduled",
  });

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    if (!activeShopId) return;
    loadData();
  }, [activeShopId, weekStart]);

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

  const handleCreate = async () => {
    if (!activeShopId || !form.date || !form.time || !form.service_type) {
      toast({ title: t('agenda.fillRequired'), variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("appointments").insert({
      shop_id: activeShopId,
      client_id: form.client_id || null,
      vehicle_id: form.vehicle_id || null,
      service_type: form.service_type,
      date: form.date,
      time: form.time,
      duration_minutes: form.duration_minutes,
      notes: form.notes || null,
      status: form.status,
    } as any);

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: "destructive" });
      return;
    }

    // Create internal alert
    await supabase.from("alerts").insert({
      shop_id: activeShopId,
      type: "appointment",
      title: t('agenda.newAppointmentAlert'),
      message: `${form.service_type} - ${form.date} ${form.time}`,
      priority: "low",
    } as any);

    toast({ title: t('agenda.created') });
    setDialogOpen(false);
    setForm({ client_id: "", vehicle_id: "", service_type: "", date: format(new Date(), "yyyy-MM-dd"), time: "09:00", duration_minutes: 60, notes: "", status: "scheduled" });
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

  const publicDomain = "https://garageflow.pt";
  const bookingUrl = shopSlug ? `${publicDomain}/book/${shopSlug}` : "";

  const clientVehicles = form.client_id ? vehicles.filter(v => v.client_id === form.client_id) : vehicles;

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
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> {t('agenda.new')}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{t('agenda.new')}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>{t('agenda.serviceType')}</Label>
                  <Input value={form.service_type} onChange={e => setForm({ ...form, service_type: e.target.value })} placeholder={t('agenda.serviceTypePlaceholder')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{t('agenda.date')}</Label>
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                  </div>
                  <div>
                    <Label>{t('agenda.time')}</Label>
                    <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
                  </div>
                </div>
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
                <Button onClick={handleCreate} className="w-full">{t('agenda.create')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

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
            {/* Header row */}
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

            {/* Time slots */}
            {HOURS.map(hour => (
              <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-border/50 min-h-[60px]">
                <div className="p-2 text-xs text-muted-foreground text-right pr-3 pt-1">
                  {String(hour).padStart(2, "0")}:00
                </div>
                {weekDays.map((day, di) => {
                  const apps = getAppsForDayHour(day, hour);
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
                            {app.client_name && <span>· {app.client_name}</span>}
                          </div>
                          <div className="flex gap-1 mt-0.5">
                            {app.status === "scheduled" && (
                              <button onClick={() => updateStatus(app.id, "confirmed")} className="text-[9px] bg-green-500/20 text-green-700 px-1 rounded hover:bg-green-500/30">✓</button>
                            )}
                            {(app.status === "scheduled" || app.status === "confirmed") && (
                              <>
                                <button onClick={() => updateStatus(app.id, "completed")} className="text-[9px] bg-muted px-1 rounded hover:bg-muted/80">✔</button>
                                <button onClick={() => updateStatus(app.id, "cancelled")} className="text-[9px] bg-destructive/20 text-destructive px-1 rounded hover:bg-destructive/30">✕</button>
                              </>
                            )}
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
    </div>
  );
}
