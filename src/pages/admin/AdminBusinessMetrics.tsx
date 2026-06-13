import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TrendingUp, Users, DollarSign, AlertTriangle, RefreshCw } from "lucide-react";

type Metric = {
  date: string;
  mrr: number | null;
  arr: number | null;
  arpu: number | null;
  ltv: number | null;
  churn_rate: number | null;
  active_shops: number | null;
  paying_shops: number | null;
  new_signups: number | null;
  gmv: number | null;
};

type Health = {
  entity_type: string;
  entity_id: string;
  score: number;
  risk_level: string;
  signals: any;
  updated_at: string;
};

const fmtEUR = (v: number | null) =>
  v == null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);

export default function AdminBusinessMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const [m, h] = await Promise.all([
      supabase.from("business_metrics_daily" as any).select("*").order("date", { ascending: false }).limit(30),
      supabase.from("customer_health_scores" as any).select("*").order("score", { ascending: true }).limit(50),
    ]);
    setMetrics((m.data as any) ?? []);
    setHealth((h.data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const recompute = async () => {
    setRunning(true);
    const [a, b] = await Promise.all([
      supabase.rpc("compute_business_metrics_snapshot" as any),
      supabase.rpc("compute_customer_health" as any),
    ]);
    setRunning(false);
    if (a.error || b.error) {
      toast.error("Erro ao recalcular: " + (a.error?.message || b.error?.message));
    } else {
      toast.success("Métricas recalculadas");
      load();
    }
  };

  const latest = metrics[0];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Métricas de Negócio</h1>
          <p className="text-sm text-muted-foreground">MRR, ARR, Churn, LTV, Customer Health — gerado por <code>compute_business_metrics_snapshot()</code> e <code>compute_customer_health()</code>.</p>
        </div>
        <Button onClick={recompute} disabled={running} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          Recalcular agora
        </Button>
      </div>

      {loading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      {latest && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><DollarSign className="h-3 w-3" />MRR</div>
            <div className="text-2xl font-bold mt-1">{fmtEUR(latest.mrr)}</div>
            <div className="text-xs text-muted-foreground">ARR {fmtEUR(latest.arr)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" />Oficinas pagantes</div>
            <div className="text-2xl font-bold mt-1">{latest.paying_shops ?? 0}</div>
            <div className="text-xs text-muted-foreground">{latest.active_shops ?? 0} ativas</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" />ARPU / LTV</div>
            <div className="text-2xl font-bold mt-1">{fmtEUR(latest.arpu)}</div>
            <div className="text-xs text-muted-foreground">LTV {fmtEUR(latest.ltv)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3 w-3" />Churn (30d)</div>
            <div className="text-2xl font-bold mt-1">{fmtPct(latest.churn_rate)}</div>
            <div className="text-xs text-muted-foreground">{latest.new_signups ?? 0} novos signups</div>
          </Card>
        </div>
      )}

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Histórico (30 dias)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="text-left py-2">Data</th><th className="text-right">MRR</th><th className="text-right">Pagantes</th><th className="text-right">Ativas</th><th className="text-right">Signups</th><th className="text-right">Churn</th><th className="text-right">GMV</th></tr>
            </thead>
            <tbody>
              {metrics.map(m => (
                <tr key={m.date} className="border-b border-border/50">
                  <td className="py-2">{m.date}</td>
                  <td className="text-right">{fmtEUR(m.mrr)}</td>
                  <td className="text-right">{m.paying_shops ?? 0}</td>
                  <td className="text-right">{m.active_shops ?? 0}</td>
                  <td className="text-right">{m.new_signups ?? 0}</td>
                  <td className="text-right">{fmtPct(m.churn_rate)}</td>
                  <td className="text-right">{fmtEUR(m.gmv)}</td>
                </tr>
              ))}
              {metrics.length === 0 && !loading && (
                <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">Sem snapshots ainda. Clica em "Recalcular agora".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold mb-3">Customer Health — Risco de Churn</h2>
        <p className="text-xs text-muted-foreground mb-3">Top 50 entidades ordenadas por score (mais baixo = maior risco). Drops ≥80% geram <code>growth_opportunities_v2</code> automaticamente.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr><th className="text-left py-2">Entidade</th><th className="text-left">ID</th><th className="text-right">Score</th><th className="text-left">Risco</th><th className="text-left">Atualizado</th></tr>
            </thead>
            <tbody>
              {health.map(h => (
                <tr key={`${h.entity_type}-${h.entity_id}`} className="border-b border-border/50">
                  <td className="py-2">{h.entity_type}</td>
                  <td className="font-mono text-xs">{h.entity_id.slice(0, 8)}…</td>
                  <td className="text-right font-semibold">{h.score}</td>
                  <td>
                    <Badge variant={h.risk_level === "high" ? "destructive" : h.risk_level === "medium" ? "secondary" : "outline"}>
                      {h.risk_level}
                    </Badge>
                  </td>
                  <td className="text-xs text-muted-foreground">{new Date(h.updated_at).toLocaleString("pt-PT")}</td>
                </tr>
              ))}
              {health.length === 0 && !loading && (
                <tr><td colSpan={5} className="py-4 text-center text-muted-foreground">Sem dados de health ainda.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
