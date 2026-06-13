import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Gauge, RefreshCw } from "lucide-react";

type Row = { identifier: string; action_type: string; total: number; last_window: string };

export default function AdminRateLimits() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { data } = await supabase
      .from("rate_limits" as any)
      .select("identifier, action_type, count, window_start")
      .gte("window_start", since)
      .order("window_start", { ascending: false })
      .limit(2000);

    const agg = new Map<string, Row>();
    for (const r of (data as any[]) ?? []) {
      const key = `${r.identifier}::${r.action_type}`;
      const cur = agg.get(key);
      if (cur) { cur.total += r.count; if (r.window_start > cur.last_window) cur.last_window = r.window_start; }
      else agg.set(key, { identifier: r.identifier, action_type: r.action_type, total: r.count, last_window: r.window_start });
    }
    setRows([...agg.values()].sort((a, b) => b.total - a.total).slice(0, 100));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Gauge className="h-6 w-6" />Rate Limits</h1>
          <p className="text-sm text-muted-foreground">Top identifiers na última hora (agregado por identifier + ação).</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-left">
              <th className="p-3">Identifier</th>
              <th className="p-3">Ação</th>
              <th className="p-3 text-right">Pedidos (1h)</th>
              <th className="p-3">Última janela</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.identifier}-${r.action_type}`} className="border-t">
                <td className="p-3 font-mono text-xs">{r.identifier}</td>
                <td className="p-3"><Badge variant="outline">{r.action_type}</Badge></td>
                <td className="p-3 text-right font-semibold">
                  <span className={r.total > 500 ? "text-red-500" : r.total > 100 ? "text-amber-500" : ""}>{r.total}</span>
                </td>
                <td className="p-3 text-xs text-muted-foreground">{new Date(r.last_window).toLocaleString("pt-PT")}</td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Sem atividade na última hora.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
