// AdminAIControl — Painel Super Admin de Controlo de Custos IA
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Save, Zap, AlertTriangle, RefreshCw } from "lucide-react";

interface Stats {
  budget_eur: number;
  safety_margin_pct: number;
  month_spend_eur: number;
  month_pct: number;
  month_calls: number;
  today_calls: number;
  cache_entries?: number;
  blocked_globally: boolean;
  top_shops: Array<{ shop_id: string | null; shop_name: string | null; calls: number; cost: number }>;
  top_functions: Array<{ function_name: string; calls: number; cost: number }>;
  by_plan: Array<{ plan_slug: string; calls: number; cost: number }>;
  by_day?: Array<{ day: string; calls: number; cost: number }>;
}

const SETTING_KEYS = [
  {
    key: "ai_monthly_budget_eur",
    label: "Orçamento mensal (€)",
    hint: "Teto de custo de IA por mês para toda a plataforma.",
  },
  {
    key: "ai_safety_margin_pct",
    label: "Margem de segurança (%)",
    hint: "A IA é bloqueada quando o consumo atinge esta percentagem do orçamento.",
  },
  {
    key: "ai_cost_per_credit_eur",
    label: "Custo estimado por crédito (€)",
    hint: "Valor usado para estimar o custo de cada chamada de IA.",
  },
  {
    key: "ai_rate_per_min_user",
    label: "Limite por utilizador / minuto",
    hint: "Número máximo de chamadas de IA por utilizador em cada minuto.",
  },
  {
    key: "ai_rate_per_min_shop",
    label: "Limite por oficina / minuto",
    hint: "Número máximo de chamadas de IA por oficina em cada minuto.",
  },
];

export default function AdminAIControl() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setLoadError(null);
    const [statsRes, cfgRes] = await Promise.all([
      supabase.rpc("get_ai_admin_stats"),
      supabase.from("platform_settings").select("key,value").in("key", SETTING_KEYS.map(k => k.key)),
    ]);

    if (statsRes.error) {
      setLoadError(statsRes.error.message);
      setStats(null);
    } else if (statsRes.data && (statsRes.data as any).error) {
      setLoadError("Sem permissões para consultar os dados de IA.");
      setStats(null);
    } else {
      setStats(statsRes.data as unknown as Stats);
    }

    if (cfgRes.error) {
      setLoadError((prev) => prev ?? cfgRes.error!.message);
    }
    const cfgMap: Record<string, string> = {};
    (cfgRes.data || []).forEach((r: any) => { cfgMap[r.key] = String(r.value?.value ?? r.value ?? ""); });
    setSettings(cfgMap);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const saveSetting = async (key: string) => {
    setSaving(key);
    const raw = settings[key];
    const num = Number(raw);
    const value = raw !== "" && isFinite(num) ? { value: num } : { value: raw };
    const { error } = await supabase
      .from("platform_settings")
      .upsert({ key, value }, { onConflict: "key" });
    setSaving(null);
    if (error) { toast.error(`Não foi possível guardar: ${error.message}`); return; }
    toast.success("Definição guardada");
    refresh();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader2 className="animate-spin" /></div>;
  }

  if (loadError || !stats) {
    return (
      <div className="p-6 max-w-3xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold flex items-center gap-2"><Zap className="text-amber-500" /> Controlo de IA</h1>
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-4 h-4" /> Não foi possível carregar os dados
            </CardTitle>
            <CardDescription>{loadError ?? "Resposta vazia do servidor."}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refresh} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const maxDay = Math.max(1, ...(stats.by_day ?? []).map(d => Number(d.calls) || 0));

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2"><Zap className="text-amber-500" /> Controlo de IA</h1>
          <p className="text-muted-foreground mt-1">Orçamento global, cache, limites de utilização e consumo por oficina.</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-2">
          <RefreshCw className="w-4 h-4" /> Atualizar
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            Orçamento mensal
            {stats.blocked_globally && (
              <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" /> Limite atingido — IA bloqueada</Badge>
            )}
          </CardTitle>
          <CardDescription>Consumo estimado do mês atual face ao teto definido em baixo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Consumido este mês</span>
            <span className="font-mono">{stats.month_spend_eur.toFixed(2)} € / {stats.budget_eur.toFixed(2)} €</span>
          </div>
          <Progress value={Math.min(100, stats.month_pct)} className={stats.month_pct > 90 ? "[&>div]:bg-red-500" : ""} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
            <Stat label="Chamadas (mês)" value={String(stats.month_calls)} />
            <Stat label="Chamadas (hoje)" value={String(stats.today_calls)} />
            <Stat label="Respostas em cache" value={String(stats.cache_entries ?? 0)} />
            <Stat label="Margem de segurança" value={`${stats.safety_margin_pct}%`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Definições</CardTitle>
          <CardDescription>Alterações entram em vigor de imediato em todas as funções de IA.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          {SETTING_KEYS.map(({ key, label, hint }) => (
            <div key={key} className="space-y-2">
              <Label>{label}</Label>
              <div className="flex gap-2">
                <Input
                  value={settings[key] ?? ""}
                  onChange={(e) => setSettings(prev => ({ ...prev, [key]: e.target.value }))}
                  type="number"
                  step="0.01"
                  className="min-h-[44px]"
                />
                <Button
                  className="min-h-[44px]"
                  onClick={() => saveSetting(key)}
                  disabled={saving === key}
                  aria-label={`Guardar ${label}`}
                >
                  {saving === key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {(stats.by_day ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Evolução (últimos 30 dias)</CardTitle>
            <CardDescription>Chamadas de IA por dia.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-32">
              {(stats.by_day ?? []).map((d) => (
                <div key={d.day} className="flex-1 flex flex-col justify-end" title={`${d.day}: ${d.calls} chamadas · ${Number(d.cost ?? 0).toFixed(2)} €`}>
                  <div className="bg-amber-500/70 rounded-t" style={{ height: `${(Number(d.calls) / maxDay) * 100}%`, minHeight: 2 }} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Consumo por função (mês atual)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2 px-2">Função</th><th className="text-right px-2">Chamadas</th><th className="text-right px-2">Custo (€)</th></tr>
            </thead>
            <tbody>
              {(stats.top_functions ?? []).map((r) => (
                <tr key={r.function_name} className="border-b">
                  <td className="py-2 px-2 font-mono text-xs whitespace-nowrap">{r.function_name}</td>
                  <td className="text-right px-2">{r.calls}</td>
                  <td className="text-right px-2 font-mono">{Number(r.cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {(!stats.top_functions || stats.top_functions.length === 0) && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Sem dados este mês</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Oficinas com maior consumo</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground border-b">
              <tr><th className="py-2 px-2">Oficina</th><th className="text-right px-2">Chamadas</th><th className="text-right px-2">Custo (€)</th></tr>
            </thead>
            <tbody>
              {(stats.top_shops ?? []).map((r) => (
                <tr key={r.shop_id ?? "platform"} className="border-b">
                  <td className="py-2 px-2">{r.shop_name ?? <span className="text-muted-foreground italic">Plataforma (admin)</span>}</td>
                  <td className="text-right px-2">{r.calls}</td>
                  <td className="text-right px-2 font-mono">{Number(r.cost ?? 0).toFixed(2)}</td>
                </tr>
              ))}
              {(!stats.top_shops || stats.top_shops.length === 0) && <tr><td colSpan={3} className="text-center py-6 text-muted-foreground">Sem dados este mês</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Consumo por plano</CardTitle></CardHeader>
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
