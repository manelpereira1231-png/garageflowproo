import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Phone, PhoneOff, PhoneMissed, CalendarPlus, RotateCw, Building2, Mail, Globe,
  MapPin, User, StickyNote, ListChecks, History, Plus, Save,
} from "lucide-react";
import { toast } from "sonner";

export const PIPELINE_STAGES: { value: string; label: string; tone: string }[] = [
  { value: "lead", label: "Novo Lead", tone: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  { value: "contacted", label: "Contactado", tone: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  { value: "awaiting_reply", label: "Aguarda Resposta", tone: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  { value: "demo_scheduled", label: "Demo Agendada", tone: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  { value: "demo_done", label: "Demo Realizada", tone: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  { value: "negotiation", label: "Negociação", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  { value: "customer", label: "Cliente", tone: "bg-green-500/15 text-green-700 dark:text-green-400" },
  { value: "lost", label: "Perdido", tone: "bg-red-500/15 text-red-700 dark:text-red-400" },
  { value: "callback_later", label: "Contactar Mais Tarde", tone: "bg-gray-500/15 text-gray-600 dark:text-gray-400" },
];

const CALL_OUTCOMES = [
  { value: "answered", label: "Já liguei", icon: Phone, tone: "" },
  { value: "no_answer", label: "Não atendeu", icon: PhoneMissed, tone: "" },
  { value: "invalid_number", label: "Número inválido", icon: PhoneOff, tone: "" },
  { value: "callback", label: "Voltar a ligar", icon: RotateCw, tone: "" },
  { value: "meeting_scheduled", label: "Marcar reunião", icon: CalendarPlus, tone: "" },
] as const;

type Lead = {
  id: string;
  name: string;
  owner_name?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  district?: string | null;
  country?: string | null;
  website?: string | null;
  pipeline_stage: string;
  status?: string | null;
  estimated_value?: number | null;
  next_contact_at?: string | null;
  shop_link_id?: string | null;
};

export default function CommercialLeadDetail({
  leadId,
  open,
  onOpenChange,
  onChanged,
}: {
  leadId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChanged: () => void;
}) {
  const [lead, setLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newTask, setNewTask] = useState({ title: "", priority: "normal", due_at: "" });
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!leadId) return;
    const [l, n, t, c, a] = await Promise.all([
      supabase.from("crm_leads" as any).select("*").eq("id", leadId).maybeSingle(),
      supabase.from("crm_notes" as any).select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
      supabase.from("crm_tasks" as any).select("*").eq("lead_id", leadId).order("due_at", { ascending: true, nullsFirst: false }),
      supabase.from("crm_calls" as any).select("*").eq("lead_id", leadId).order("called_at", { ascending: false }),
      supabase.from("crm_activity" as any).select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(200),
    ]);
    setLead((l.data as any) || null);
    setNotes((n.data as any[]) || []);
    setTasks((t.data as any[]) || []);
    setCalls((c.data as any[]) || []);
    setActivity((a.data as any[]) || []);
  };

  useEffect(() => {
    if (open && leadId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadId]);

  const uid = async () => (await supabase.auth.getUser()).data.user?.id ?? null;

  const logActivity = async (kind: string, summary: string, meta?: any) => {
    if (!leadId) return;
    await supabase.from("crm_activity" as any).insert({
      lead_id: leadId,
      kind,
      summary,
      meta,
      created_by: await uid(),
    });
  };

  const updateLead = async (patch: Partial<Lead>) => {
    if (!leadId) return;
    setBusy(true);
    const prevStage = lead?.pipeline_stage;
    const { error } = await supabase.from("crm_leads" as any).update(patch).eq("id", leadId);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (patch.pipeline_stage && patch.pipeline_stage !== prevStage) {
      const from = PIPELINE_STAGES.find((s) => s.value === prevStage)?.label ?? prevStage;
      const to = PIPELINE_STAGES.find((s) => s.value === patch.pipeline_stage)?.label ?? patch.pipeline_stage;
      await logActivity("stage_change", `Estado alterado: ${from} → ${to}`, {
        from: prevStage,
        to: patch.pipeline_stage,
      });
    }
    toast.success("Atualizado");
    load();
    onChanged();
  };

  const logCall = async (outcome: (typeof CALL_OUTCOMES)[number]["value"]) => {
    if (!leadId) return;
    setBusy(true);
    const { error } = await supabase.from("crm_calls" as any).insert({
      lead_id: leadId,
      outcome,
      created_by: await uid(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    const label = CALL_OUTCOMES.find((o) => o.value === outcome)?.label ?? outcome;
    await logActivity("call", `Chamada: ${label}`, { outcome });
    // Auto-move stage on first successful contact
    if (outcome === "answered" && lead?.pipeline_stage === "lead") {
      await updateLead({ pipeline_stage: "contacted" });
    }
    if (outcome === "callback") {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      await supabase
        .from("crm_leads" as any)
        .update({ next_contact_at: next.toISOString(), last_contact_at: new Date().toISOString() })
        .eq("id", leadId);
    }
    toast.success(label);
    load();
    onChanged();
  };

  const addNote = async () => {
    if (!newNote.trim() || !leadId) return;
    setBusy(true);
    const { error } = await supabase.from("crm_notes" as any).insert({
      lead_id: leadId,
      body: newNote.trim(),
      created_by: await uid(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("note", `Nota adicionada`, { preview: newNote.slice(0, 80) });
    setNewNote("");
    load();
  };

  const addTask = async () => {
    if (!newTask.title.trim() || !leadId) return;
    setBusy(true);
    const { error } = await supabase.from("crm_tasks" as any).insert({
      lead_id: leadId,
      title: newTask.title.trim(),
      priority: newTask.priority,
      status: "open",
      due_at: newTask.due_at ? new Date(newTask.due_at).toISOString() : null,
      created_by: await uid(),
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logActivity("task", `Tarefa criada: ${newTask.title}`);
    setNewTask({ title: "", priority: "normal", due_at: "" });
    load();
  };

  const toggleTask = async (t: any) => {
    const nextStatus = t.status === "done" ? "open" : "done";
    await supabase.from("crm_tasks" as any).update({ status: nextStatus }).eq("id", t.id);
    await logActivity("task", `Tarefa ${nextStatus === "done" ? "concluída" : "reaberta"}: ${t.title}`);
    load();
  };

  if (!open || !lead) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl" />
      </Sheet>
    );
  }

  const stage = PIPELINE_STAGES.find((s) => s.value === lead.pipeline_stage);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {lead.name}
          </SheetTitle>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            {stage && <Badge className={stage.tone}>{stage.label}</Badge>}
            {lead.shop_link_id && (
              <Badge variant="outline" className="gap-1">
                <User className="w-3 h-3" /> Cliente ativo
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* Quick call actions */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {CALL_OUTCOMES.map((o) => (
            <Button
              key={o.value}
              size="sm"
              variant="outline"
              className="flex-col h-auto py-2 gap-1"
              disabled={busy}
              onClick={() => logCall(o.value)}
            >
              <o.icon className="w-4 h-4" />
              <span className="text-[11px] leading-tight text-center">{o.label}</span>
            </Button>
          ))}
        </div>

        {/* Stage selector */}
        <div className="flex items-center gap-2 mb-4">
          <Label className="text-xs whitespace-nowrap">Estado:</Label>
          <Select
            value={lead.pipeline_stage}
            onValueChange={(v) => updateLead({ pipeline_stage: v })}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="info">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="info" className="text-xs">Info</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">
              <StickyNote className="w-3 h-3 mr-1" /> Notas ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs">
              <ListChecks className="w-3 h-3 mr-1" /> Tarefas ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="calls" className="text-xs">
              <Phone className="w-3 h-3 mr-1" /> Chamadas ({calls.length})
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs">
              <History className="w-3 h-3 mr-1" /> Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="space-y-2 mt-4 text-sm">
            <InfoRow icon={User} label="Responsável" value={lead.owner_name} />
            <InfoRow icon={Mail} label="Email" value={lead.email} />
            <InfoRow icon={Phone} label="Telefone" value={lead.phone} />
            <InfoRow icon={MapPin} label="Morada" value={[lead.address, lead.city, lead.district, lead.country].filter(Boolean).join(", ")} />
            <InfoRow icon={Globe} label="Website" value={lead.website} link />
          </TabsContent>

          <TabsContent value="notes" className="mt-4 space-y-3">
            <div className="flex gap-2">
              <Textarea
                placeholder="Adicionar uma nota…"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <Button size="sm" onClick={addNote} disabled={busy || !newNote.trim()}>
                <Save className="w-4 h-4" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {notes.map((n) => (
                <div key={n.id} className="border rounded p-2 text-sm">
                  <div className="text-xs text-muted-foreground mb-1">
                    {new Date(n.created_at).toLocaleString("pt-PT")}
                  </div>
                  <div className="whitespace-pre-wrap">{n.body}</div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem notas.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tasks" className="mt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <Input
                placeholder="Título da tarefa"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="sm:col-span-2"
              />
              <Select
                value={newTask.priority}
                onValueChange={(v) => setNewTask({ ...newTask, priority: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="datetime-local"
                value={newTask.due_at}
                onChange={(e) => setNewTask({ ...newTask, due_at: e.target.value })}
              />
              <Button size="sm" onClick={addTask} disabled={busy} className="sm:col-span-4">
                <Plus className="w-4 h-4 mr-1" /> Adicionar tarefa
              </Button>
            </div>
            <div className="space-y-2 max-h-[40vh] overflow-y-auto">
              {tasks.map((t) => (
                <div key={t.id} className="border rounded p-2 flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={t.status === "done"}
                    onChange={() => toggleTask(t)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className={`text-sm ${t.status === "done" ? "line-through opacity-60" : ""}`}>
                      {t.title}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      {t.due_at && <span>{new Date(t.due_at).toLocaleString("pt-PT")}</span>}
                      <Badge variant="outline" className="text-[10px] px-1 py-0">{t.priority}</Badge>
                    </div>
                  </div>
                </div>
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-muted-foreground">Sem tarefas.</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="calls" className="mt-4 space-y-2">
            {calls.map((c) => {
              const o = CALL_OUTCOMES.find((x) => x.value === c.outcome);
              return (
                <div key={c.id} className="border rounded p-2 text-sm flex items-center gap-2">
                  {o && <o.icon className="w-4 h-4 text-muted-foreground" />}
                  <span className="font-medium">{o?.label || c.outcome}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(c.called_at).toLocaleString("pt-PT")}
                  </span>
                </div>
              );
            })}
            {calls.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem chamadas registadas.</p>
            )}
          </TabsContent>

          <TabsContent value="history" className="mt-4 space-y-2">
            {activity.map((a) => (
              <div key={a.id} className="border-l-2 border-primary/40 pl-3 py-1 text-sm">
                <div className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("pt-PT")} · <Badge variant="outline" className="text-[10px]">{a.kind}</Badge>
                </div>
                <div>{a.summary}</div>
              </div>
            ))}
            {activity.length === 0 && (
              <p className="text-xs text-muted-foreground">Sem histórico.</p>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  link,
}: {
  icon: any;
  label: string;
  value?: string | null;
  link?: boolean;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-xs">{label}: —</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground w-24">{label}:</span>
      {link ? (
        <a
          href={value.startsWith("http") ? value : `https://${value}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-primary hover:underline truncate"
        >
          {value}
        </a>
      ) : (
        <span className="text-sm truncate">{value}</span>
      )}
    </div>
  );
}
