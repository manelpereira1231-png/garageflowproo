// AdminAIControl — Painel Super Admin de Controlo de Custos IA
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Zap, AlertTriangle } from "lucide-react";

interface Stats {
  budget_eur: number;
  safety_margin_pct: number;
  month_spend_eur: number;
  month_pct: number;
  month_calls: number;
  today_calls: number;
  blocked_globally: boolean;
  top_shops: Array<{ shop_id: string | null; shop_name: string | null; calls: number; cost: number }>;
  top_functions: Array<{ function_name: string; calls: number; cost: number }>;
  by_plan: Array<{ plan_slug: string; calls: number; cost: number }>;
}

const SETTING_KEYS = [
  { key: "ai_monthly_budget_eur", label: "Orçamento mensal (€)" },
  { key: "ai_safety_margin_pct", label: "Margem de segurança (%)" },
  { key: "ai_cost_per_credit_eur", label: "Custo estimado por crédito (€)" },
  { key: "ai_rate_per_min_user", label: "Rate limit por utilizador / min" },
  { key: "ai_rate_per_min_shop", label: "Rate limit por oficina / min" },
];

export default function AdminAIControl() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [cacheCount, setCacheCount] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [{ data: s }, { data: cfg }, { count }] = await Promise.all([
      supabase.rpc("get_ai_admin_stats"),
      supabase.from("platform_settings").select("key,value").in("key", SETTING_KEYS.map(k => k.key)),
      supabase.from("ai_response_cache").select("*", { count: "exact", head: true }),
    ]);
    if (s && !(s as any).error) setStats(s as unknown as Stats);
    const cfgMap: Record<string, string> = {};
    (cfg || []).forEach((r: any) => { cfgMap[r.key] = String(r.value?.value ?? r.value ?? ""); });
    setSettings(cfgMap);
    setCacheCount(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const saveSetting = async (key: string) => {
    setSaving(true);
    const num = Number(settings[key]);
    const value = isFinite(num) ? { value: num } : { value: settings[key] };
    const { error } = await supabase.from("platform_settings").upsert({ key, value });
    setSaving(false);
    if (error) { toast.error(`Erro: ${error.message}`); return; }
    toast.success("Definição guardada");
    refresh();
  };

  if (loading || !stats) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin" /></div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Zap className="text-amber-500" /> Controlo de IA</h1>
        <p className="text-muted-foreground mt-1">Orçamento global, cache, rate limits e consumo por oficina.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Orçamento Mensal
            {stats.blocked_globally && (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Limite atingido — IA bloqueada</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Consumido este mês</span>
            <span className="font-mono">{stats.month_spend_eur.toFixed(2)} € / {stats.budget_eur.toFixed(2)} €</span>
          </div>
          <Progress value={Math.min(100, stats.month_pct)} className={stats.month_pct > 90 ? "[&>div]:bg-red-500" : ""} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <Stat label="Chamadas (mês)" value={stats.month_calls.toString()} />
            <Stat label="Chamadas (hoje)" value={stats.today_calls.toString()} />
            <Stat label="Cache entries" value={cacheCount.toString()} />
            <Stat label="Margem" value={`${stats.safety_margin_pct}%`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Definições</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {SETTING_KEYS.map(({ key, label }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <div className="flex gap-2">
                <Input
                  value={settings[key] ?? ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                  type="number"
                  step="0.01"
                />
                <Button size="sm" onClick={() => saveSetting(key)} disabled={saving}>
                  <Save className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Consumo por Função (mês atual)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2">Função</th><th className="text-right">Chamadas</th><th className="text-right">Custo (€)</th></tr>
            </thead>
            <tbody>
              {(stats.top_functions ?? []).map((r) => (
                <tr key={r.function_name} className="border-b">
                  <td className="py-2 font-mono text-xs">{r.function_name}</td>
                  <td className="text-right">{r.calls}</td>
                  <td className="text-right font-mono">{Number(r.cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {(!stats.top_functions || stats.top_functions.length === 0) && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Sem dados este mês</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top Oficinas por Consumo</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2">Oficina</th><th className="text-right">Chamadas</th><th className="text-right">Custo (€)</th></tr>
            </thead>
            <tbody>
              {(stats.top_shops ?? []).map((r) => (
                <tr key={r.shop_id ?? "platform"} className="border-b">
                  <td className="py-2">{r.shop_name ?? <span className="text-muted-foreground italic">Plataforma (admin)</span>}</td>
                  <td className="text-right">{r.calls}</td>
                  <td className="text-right font-mono">{Number(r.cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {(!stats.top_shops || stats.top_shops.length === 0) && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Sem dados este mês</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Consumo por Plano</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-3">
            {(stats.by_plan ?? []).map((r) => (
              <div key={r.plan_slug} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground uppercase">{r.plan_slug}</div>
                <div className="text-lg font-bold">{r.calls} chamadas</div>
                <div className="text-xs">{Number(r.cost ?? 0).toFixed(2)} €</div>
              </div>
            ))}
            {(!stats.by_plan || stats.by_plan.length === 0) && <p className="text-muted-foreground text-sm">Sem dados</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
    </div>
  );
}
