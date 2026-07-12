import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar as CalIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { formatLocalDate } from "@/lib/marketPrice";

type Meeting = { id: string; title: string; meeting_type: string; scheduled_at: string; status: string; notes?: string; lead_id?: string };
type Task = { id: string; title: string; due_at?: string; status: string; priority?: string };
type DemoReq = { id: string; shop_name: string; name: string; phone: string; email: string; status: string; scheduled_at?: string; best_contact_time?: string; created_at: string };

export default function CommercialMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [demos, setDemos] = useState<DemoReq[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", meeting_type: "meeting", scheduled_at: "", duration_minutes: "30" });

  const load = async () => {
    const [m, t, d] = await Promise.all([
      supabase.from("crm_meetings" as any).select("*").order("scheduled_at", { ascending: true }),
      supabase.from("crm_tasks" as any).select("*").eq("status", "open").order("due_at", { ascending: true }),
      supabase.from("demo_requests" as any).select("*").in("status", ["new", "contacted", "scheduled"]).order("created_at", { ascending: false }),
    ]);
    setMeetings(((m.data as unknown) || []) as Meeting[]);
    setTasks(((t.data as unknown) || []) as Task[]);
    setDemos(((d.data as unknown) || []) as DemoReq[]);
  };
  useEffect(() => {
    load();
    const ch = supabase.channel("commercial-meetings-demos")
      .on("postgres_changes", { event: "*", schema: "public", table: "demo_requests" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const create = async () => {
    if (!form.title.trim() || !form.scheduled_at) { toast.error("Título e data obrigatórios"); return; }
    const { error } = await supabase.from("crm_meetings" as any).insert({
      title: form.title.trim(),
      meeting_type: form.meeting_type,
      scheduled_at: new Date(form.scheduled_at).toISOString(),
      duration_minutes: Number(form.duration_minutes) || 30,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Reunião marcada");
    setOpen(false);
    setForm({ title: "", meeting_type: "meeting", scheduled_at: "", duration_minutes: "30" });
    load();
  };

  const markDone = async (id: string) => {
    await supabase.from("crm_meetings" as any).update({ status: "done" }).eq("id", id);
    load();
  };

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86400000);

  const today = meetings.filter((m) => {
    const d = new Date(m.scheduled_at);
    return d >= startOfToday && d < endOfToday;
  });
  const week = meetings.filter((m) => {
    const d = new Date(m.scheduled_at);
    return d >= startOfToday && d < endOfWeek;
  });
  const upcoming = meetings.filter((m) => new Date(m.scheduled_at) >= now && m.status === "scheduled");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Centro de Reuniões</h2>
          <p className="text-sm text-muted-foreground">Reuniões, demos e follow-ups com oficinas e leads.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Marcar Reunião</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova reunião</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.meeting_type} onValueChange={(v) => setForm({ ...form, meeting_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="meeting">Reunião</SelectItem>
                      <SelectItem value="demo">Demonstração</SelectItem>
                      <SelectItem value="follow_up">Follow-up</SelectItem>
                      <SelectItem value="call">Chamada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Duração (min)</Label><Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} /></div>
              </div>
              <div><Label>Data e hora *</Label><Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /></div>
              <Button className="w-full" onClick={create}>Marcar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Hoje</div><div className="text-2xl font-bold">{today.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Esta semana</div><div className="text-2xl font-bold">{week.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Próximas</div><div className="text-2xl font-bold">{upcoming.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Tarefas pendentes</div><div className="text-2xl font-bold">{tasks.length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            🎯 Pedidos de Demonstração
            <Badge variant="secondary">{demos.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {demos.length === 0 && <div className="text-sm text-muted-foreground">Sem pedidos ativos. Partilhe <code>garageflow.pt/demo</code>.</div>}
          <div className="space-y-2">
            {demos.slice(0, 10).map((d) => (
              <div key={d.id} className="flex items-center justify-between border rounded-lg p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{d.shop_name}</span>
                    <Badge variant={d.status === "new" ? "default" : "outline"}>
                      {d.status === "new" ? "Novo" : d.status === "contacted" ? "Em contacto" : "Agendada"}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {d.name} · {d.phone}
                    {d.scheduled_at && <> · 📅 {new Date(d.scheduled_at).toLocaleString('pt-PT')}</>}
                    {!d.scheduled_at && d.best_contact_time && <> · ⏰ {d.best_contact_time}</>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" asChild><a href={`tel:${d.phone}`}>Ligar</a></Button>
                  <Button size="sm" variant="outline" asChild><a href="/commercial/demos">Gerir</a></Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Próximas reuniões</CardTitle></CardHeader>
        <CardContent>
          {upcoming.length === 0 && <div className="text-sm text-muted-foreground">Sem reuniões agendadas.</div>}
          <div className="space-y-2">
            {upcoming.map((m) => (
              <div key={m.id} className="flex items-center justify-between border rounded-lg p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CalIcon className="w-4 h-4 text-primary" />
                    <span className="font-medium text-sm">{m.title}</span>
                    <Badge variant="outline">{m.meeting_type}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{new Date(m.scheduled_at).toLocaleString('pt-PT')}</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => markDone(m.id)}><CheckCircle2 className="w-4 h-4 mr-1" /> Concluir</Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tarefas pendentes</CardTitle></CardHeader>
        <CardContent>
          {tasks.length === 0 && <div className="text-sm text-muted-foreground">Sem tarefas abertas.</div>}
          <div className="space-y-2">
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                <span>{t.title}</span>
                <span className="text-xs text-muted-foreground">{t.due_at ? new Date(t.due_at).toLocaleDateString('pt-PT') : 'Sem prazo'}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
