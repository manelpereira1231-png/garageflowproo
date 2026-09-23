import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Target } from "lucide-react";
import { toast } from "sonner";

type Objective = {
  id: string; title: string; metric: string; target_value: number;
  period: string; period_start: string; period_end: string;
};

const fmtMoney = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(v || 0);

async function actualFor(o: Objective): Promise<number> {
  const start = o.period_start;
  const endNext = new Date(new Date(o.period_end).getTime() + 86400000).toISOString().slice(0, 10);
  if (o.metric === "new_leads") {
    const { count } = await supabase.from("crm_leads" as any).select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", endNext);
    return count || 0;
  }
  if (o.metric === "conversions") {
    const { count } = await supabase.from("crm_leads" as any).select("id", { count: "exact", head: true }).eq("pipeline_stage", "customer").gte("updated_at", start).lt("updated_at", endNext);
    return count || 0;
  }
  if (o.metric === "pipeline_value") {
    const { data } = await supabase.from("crm_leads" as any).select("estimated_value, pipeline_stage, created_at").gte("created_at", start).lt("created_at", endNext);
    return ((data as any[]) || [])
      .filter((l) => !["lost"].includes(l.pipeline_stage))
      .reduce((s: number, l: any) => s + Number(l.estimated_value || 0), 0);
  }
  if (o.metric === "meetings") {
    const { count } = await supabase.from("crm_meetings" as any).select("id", { count: "exact", head: true }).gte("created_at", start).lt("created_at", endNext);
    return count || 0;
  }
  return 0;
}

export default function CommercialObjectives() {
  const [objectives, setObjectives] = useState<(Objective & { actual: number })[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", metric: "new_leads", target_value: "", period: "month", period_start: "", period_end: "" });

  const load = async () => {
    const { data } = await supabase.from("crm_objectives" as any).select("*").order("period_start", { ascending: false });
    const list = ((data as unknown) || []) as Objective[];
    const enriched = await Promise.all(list.map(async (o) => ({ ...o, actual: await actualFor(o) })));
    setObjectives(enriched);
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.title.trim() || !form.target_value || !form.period_start || !form.period_end) {
      toast.error("Preencha todos os campos");
      return;
    }
    const { error } = await supabase.from("crm_objectives" as any).insert({
      title: form.title.trim(),
      metric: form.metric,
      target_value: Number(form.target_value),
      period: form.period,
      period_start: form.period_start,
      period_end: form.period_end,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Objetivo criado");
    setOpen(false);
    setForm({ title: "", metric: "new_leads", target_value: "", period: "month", period_start: "", period_end: "" });
    load();
  };

  const label = (m: string) => ({ new_leads: "Novos Leads", conversions: "Conversões", pipeline_value: "Valor do Pipeline", meetings: "Reuniões" }[m] || m);
  const fmt = (m: string, v: number) => m === "pipeline_value" ? fmtMoney(v) : String(Math.round(v));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Objetivos</h2>
          <p className="text-sm text-muted-foreground">Metas comerciais com progresso calculado em tempo real.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" /> Novo Objetivo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo objetivo</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Título *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Métrica</Label>
                  <Select value={form.metric} onValueChange={(v) => setForm({ ...form, metric: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_leads">Novos Leads</SelectItem>
                      <SelectItem value="conversions">Conversões</SelectItem>
                      <SelectItem value="pipeline_value">Valor do Pipeline (€)</SelectItem>
                      <SelectItem value="meetings">Reuniões</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Meta *</Label><Input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: e.target.value })} /></div>
              </div>
              <div>
                <Label>Período</Label>
                <Select value={form.period} onValueChange={(v) => setForm({ ...form, period: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Mês</SelectItem>
                    <SelectItem value="quarter">Trimestre</SelectItem>
                    <SelectItem value="year">Ano</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Início *</Label><Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} /></div>
                <div><Label>Fim *</Label><Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} /></div>
              </div>
              <Button className="w-full" onClick={create}>Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {objectives.length === 0 ? (
        <Card><CardContent className="p-6 text-sm text-muted-foreground text-center">Sem objetivos definidos. Crie o primeiro acima.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {objectives.map((o) => {
            const pct = o.target_value > 0 ? Math.min(100, (o.actual / o.target_value) * 100) : 0;
            return (
              <Card key={o.id}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> {o.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-xs text-muted-foreground">{label(o.metric)} · {o.period} · {o.period_start} → {o.period_end}</div>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{fmt(o.metric, o.actual)}</span>
                    <span className="text-muted-foreground">de {fmt(o.metric, o.target_value)}</span>
                  </div>
                  <Progress value={pct} />
                  <div className="text-xs text-right text-muted-foreground">{pct.toFixed(1)}%</div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
