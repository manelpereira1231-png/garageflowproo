import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Workflow, AlertTriangle } from "lucide-react";

type Action = {
  id: string;
  entity_type: string;
  entity_id: string | null;
  action_type: string;
  status: string;
  attempts: number | null;
  last_error: string | null;
  scheduled_at: string;
  updated_at: string;
};

type Failed = {
  id: string;
  job_type: string;
  payload: any;
  error: string | null;
  resolved: boolean;
  created_at: string;
};

export default function AdminActionQueue() {
  const [queue, setQueue] = useState<Action[]>([]);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [q, f, c] = await Promise.all([
      supabase.from("action_queue" as any).select("*").order("scheduled_at", { ascending: false }).limit(100),
      supabase.from("failed_jobs" as any).select("*").eq("resolved", false).order("created_at", { ascending: false }).limit(50),
      supabase.from("action_queue" as any).select("status"),
    ]);
    setQueue((q.data as any) ?? []);
    setFailed((f.data as any) ?? []);
    const counter: Record<string, number> = {};
    ((c.data as any) ?? []).forEach((r: any) => { counter[r.status] = (counter[r.status] || 0) + 1; });
    setCounts(counter);
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  const runWorker = async () => {
    const { error } = await supabase.functions.invoke("process-action-queue");
    if (error) return;
    load();
  };

  const runMaintenance = async () => {
    const { error } = await supabase.functions.invoke("system-maintenance");
    if (error) return;
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Workflow className="h-6 w-6" />Action Queue</h1>
          <p className="text-sm text-muted-foreground">Worker: <code>process-action-queue</code> (cron 1min). Manutenção: <code>system-maintenance</code> (cron horário).</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={runWorker}><RefreshCw className="h-4 w-4 mr-2" />Executar worker</Button>
          <Button size="sm" variant="outline" onClick={runMaintenance}>Executar manutenção</Button>
          <Button size="sm" variant="ghost" onClick={load}>Refresh</Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        {["pending", "running", "retrying", "done", "failed"].map(s => (
          <Card key={s} className="p-4">
            <div className="text-xs text-muted-foreground capitalize">{s}</div>
            <div className="text-2xl font-bold">{counts[s] ?? 0}</div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Últimas 100 ações</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="text-left py-2">Quando</th><th className="text-left">Tipo</th><th className="text-left">Entidade</th><th className="text-left">Status</th><th className="text-right">Tentativas</th><th className="text-left">Erro</th></tr>
            </thead>
            <tbody>
              {queue.map(a => (
                <tr key={a.id} className="border-b border-border/50">
                  <td className="py-2 text-xs">{new Date(a.scheduled_at).toLocaleString("pt-PT")}</td>
                  <td className="font-mono text-xs">{a.action_type}</td>
                  <td className="text-xs">{a.entity_type} · {a.entity_id?.slice(0, 8) ?? "—"}</td>
                  <td><Badge variant={a.status === "failed" ? "destructive" : a.status === "done" ? "outline" : "secondary"}>{a.status}</Badge></td>
                  <td className="text-right">{a.attempts ?? 0}</td>
                  <td className="text-xs text-destructive max-w-xs truncate">{a.last_error ?? ""}</td>
                </tr>
              ))}
              {queue.length === 0 && !loading && (
                <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">Sem ações.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />Failed Jobs (não resolvidos)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="text-left py-2">Quando</th><th className="text-left">Tipo</th><th className="text-left">Erro</th></tr>
            </thead>
            <tbody>
              {failed.map(f => (
                <tr key={f.id} className="border-b border-border/50">
                  <td className="py-2 text-xs">{new Date(f.created_at).toLocaleString("pt-PT")}</td>
                  <td className="font-mono text-xs">{f.job_type}</td>
                  <td className="text-xs text-destructive">{f.error}</td>
                </tr>
              ))}
              {failed.length === 0 && !loading && (
                <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">Nenhum job falhado pendente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
