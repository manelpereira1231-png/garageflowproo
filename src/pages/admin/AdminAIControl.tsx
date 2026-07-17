// AdminAIControl — Painel Super Admin de Controlo de Custos IA
// Mostra: orçamento global, consumo do mês, top oficinas/funções, rate limits, cache
// Permite: editar orçamento, margem de segurança, rate limits, custo por crédito
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
  cost_per_credit_eur: number;
  month_spend_eur: number;
  month_calls: number;
  cached_calls: number;
  cache_hit_rate_pct: number;
  by_function: Array<{ function_name: string; calls: number; credits: number; cost_eur: number }>;
  by_shop: Array<{ shop_id: string | null; shop_name: string | null; calls: number; credits: number; cost_eur: number }>;
  blocked: boolean;
  spend_pct_of_budget: number;
}

const SETTING_KEYS = [
  { key: "ai_monthly_budget_eur", label: "Orçamento mensal (€)", suffix: "€" },
  { key: "ai_safety_margin_pct", label: "Margem de segurança (%)", suffix: "%" },
  { key: "ai_cost_per_credit_eur", label: "Custo estimado por crédito (€)", suffix: "€" },
  { key: "ai_rate_per_min_user", label: "Rate limit por utilizador / min", suffix: "" },
  { key: "ai_rate_per_min_shop", label: "Rate limit por oficina / min", suffix: "" },
];

export default function AdminAIControl() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [{ data: s }, { data: cfg }] = await Promise.all([
      supabase.rpc("get_ai_admin_stats"),
      supabase.from("platform_settings").select("key,value").in("key", SETTING_KEYS.map(k => k.key)),
    ]);
    if (s) setStats(s as unknown as Stats);
    const cfgMap: Record<string, string> = {};
    (cfg || []).forEach((r: any) => { cfgMap[r.key] = String(r.value ?? ""); });
    setSettings(cfgMap);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const saveSetting = async (key: string) => {
    setSaving(true);
    const { error } = await supabase.from("platform_settings").upsert({ key, value: settings[key] });
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

      {/* Budget overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Orçamento Mensal
            {stats.blocked && (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Bloqueado</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Consumido este mês</span>
            <span className="font-mono">{stats.month_spend_eur.toFixed(2)} € / {stats.budget_eur.toFixed(2)} €</span>
          </div>
          <Progress value={Math.min(100, stats.spend_pct_of_budget)} className={stats.spend_pct_of_budget > 90 ? "[&>div]:bg-red-500" : ""} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <Stat label="Chamadas IA" value={stats.month_calls.toString()} />
            <Stat label="Cache hits" value={`${stats.cache_hit_rate_pct.toFixed(1)}%`} />
            <Stat label="Cached calls" value={stats.cached_calls.toString()} />
            <Stat label="Margem segurança" value={`${stats.safety_margin_pct}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader><CardTitle>Definições</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {SETTING_KEYS.map(({ key, label, suffix }) => (
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
              {suffix && <p className="text-xs text-muted-foreground">Unidade: {suffix}</p>}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top functions */}
      <Card>
        <CardHeader><CardTitle>Consumo por Função (mês atual)</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2">Função</th><th className="text-right">Chamadas</th><th className="text-right">Créditos</th><th className="text-right">Custo (€)</th></tr>
            </thead>
            <tbody>
              {stats.by_function.map((r) => (
                <tr key={r.function_name} className="border-b">
                  <td className="py-2 font-mono text-xs">{r.function_name}</td>
                  <td className="text-right">{r.calls}</td>
                  <td className="text-right">{r.credits}</td>
                  <td className="text-right font-mono">{r.cost_eur.toFixed(2)}</td>
                </tr>
              ))}
              {stats.by_function.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Sem dados este mês</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Top shops */}
      <Card>
        <CardHeader><CardTitle>Top Oficinas por Consumo</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2">Oficina</th><th className="text-right">Chamadas</th><th className="text-right">Créditos</th><th className="text-right">Custo (€)</th></tr>
            </thead>
            <tbody>
              {stats.by_shop.map((r) => (
                <tr key={r.shop_id ?? "platform"} className="border-b">
                  <td className="py-2">{r.shop_name ?? <span className="text-muted-foreground italic">Plataforma (admin)</span>}</td>
                  <td className="text-right">{r.calls}</td>
                  <td className="text-right">{r.credits}</td>
                  <td className="text-right font-mono">{r.cost_eur.toFixed(2)}</td>
                </tr>
              ))}
              {stats.by_shop.length === 0 && <tr><td colSpan={4} className="text-center py-6 text-muted-foreground">Sem dados este mês</td></tr>}
            </tbody>
          </table>
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
