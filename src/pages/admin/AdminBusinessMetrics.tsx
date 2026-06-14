import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  TrendingUp, Users, DollarSign, AlertTriangle, RefreshCw,
  Sparkles, Loader2, ChevronRight,
} from "lucide-react";

type Metric = {
  snapshot_date: string;
  mrr_eur: number | null;
  arr_eur: number | null;
  arpu_eur: number | null;
  ltv_eur: number | null;
  churn_rate: number | null;
  paying_customers: number | null;
  trial_customers: number | null;
  new_signups: number | null;
  market_gmv_eur: number | null;
};

type Health = {
  entity_type: string;
  entity_id: string;
  score: number;
  risk_level: string;
  signals: any;
  updated_at: string;
};

const fmtEUR = (v: number | null | undefined) =>
  v == null ? "—" : new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number | null | undefined) =>
  v == null ? "—" : `${(v * 100).toFixed(1)}%`;

export default function AdminBusinessMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [health, setHealth] = useState<Health[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Forecast state
  const [fcLoading, setFcLoading] = useState(false);
  const [forecast, setForecast] = useState<any>(null);
  const [advanced, setAdvanced] = useState(false);
  const [inputs, setInputs] = useState({
    market: "Portugal",
    targetSegment: "Oficinas independentes 1-5 mecânicos",
    monthlyAdSpendEur: 1500,
    horizonMonths: 12,
    startingPayingCustomers: 0,
    // advanced overrides (only sent if advanced=true)
    cplEur: 12,
    trialToPayConversionPct: 25,
    monthlyChurnPct: 4,
    starter: 30, pro: 45, garage: 20, enterprise: 5,
  });

  const load = async () => {
    setLoading(true);
    const [m, h] = await Promise.all([
      supabase.from("business_metrics_daily" as any).select("*").order("snapshot_date", { ascending: false }).limit(30),
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

  const runForecast = async () => {
    setFcLoading(true);
    setForecast(null);
    try {
      const body: any = {
        market: inputs.market,
        targetSegment: inputs.targetSegment,
        monthlyAdSpendEur: Number(inputs.monthlyAdSpendEur),
        horizonMonths: Number(inputs.horizonMonths),
        startingPayingCustomers: Number(inputs.startingPayingCustomers),
      };
      if (advanced) {
        body.cplEur = Number(inputs.cplEur);
        body.trialToPayConversionPct = Number(inputs.trialToPayConversionPct);
        body.monthlyChurnPct = Number(inputs.monthlyChurnPct);
        body.planMixPct = {
          starter: inputs.starter, pro: inputs.pro,
          garage: inputs.garage, enterprise: inputs.enterprise,
        };
      }
      const { data, error } = await supabase.functions.invoke("ai-business-forecast", { body });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setForecast((data as any).forecast);
      toast.success("Previsão gerada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar previsão");
    } finally {
      setFcLoading(false);
    }
  };

  const latest = metrics[0];

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Métricas de Negócio</h1>
          <p className="text-sm text-muted-foreground">
            MRR, ARR, Churn, LTV, Customer Health + Previsões IA realistas.
          </p>
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
            <div className="text-2xl font-bold mt-1">{fmtEUR(latest.mrr_eur)}</div>
            <div className="text-xs text-muted-foreground">ARR {fmtEUR(latest.arr_eur)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Users className="h-3 w-3" />Oficinas pagantes</div>
            <div className="text-2xl font-bold mt-1">{latest.paying_customers ?? 0}</div>
            <div className="text-xs text-muted-foreground">{latest.trial_customers ?? 0} em trial</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><TrendingUp className="h-3 w-3" />ARPU / LTV</div>
            <div className="text-2xl font-bold mt-1">{fmtEUR(latest.arpu_eur)}</div>
            <div className="text-xs text-muted-foreground">LTV {fmtEUR(latest.ltv_eur)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><AlertTriangle className="h-3 w-3" />Churn (30d)</div>
            <div className="text-2xl font-bold mt-1">{fmtPct(latest.churn_rate)}</div>
            <div className="text-xs text-muted-foreground">{latest.new_signups ?? 0} novos hoje</div>
          </Card>
        </div>
      )}

      {/* ==================== AI FORECAST ==================== */}
      <Card className="p-5 border-primary/30">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Previsão IA do Negócio</h2>
          <Badge variant="outline" className="ml-2">google/gemini-3-flash-preview</Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Funciona mesmo sem oficinas reais. Combina projeção matemática determinística com análise qualitativa da IA (cenários pessimista/esperado/otimista, riscos, ações).
        </p>

        <div className="grid gap-3 md:grid-cols-3 mb-4">
          <Field label="Mercado">
            <Input value={inputs.market} onChange={(e) => setInputs({ ...inputs, market: e.target.value })} />
          </Field>
          <Field label="Segmento-alvo">
            <Input value={inputs.targetSegment} onChange={(e) => setInputs({ ...inputs, targetSegment: e.target.value })} />
          </Field>
          <Field label="Horizonte (meses)">
            <Input type="number" value={inputs.horizonMonths} onChange={(e) => setInputs({ ...inputs, horizonMonths: +e.target.value })} />
          </Field>

          <Field label="Orçamento ads / mês (€)">
            <Input type="number" value={inputs.monthlyAdSpendEur} onChange={(e) => setInputs({ ...inputs, monthlyAdSpendEur: +e.target.value })} />
          </Field>
          <Field label="CPL — custo por lead (€)">
            <Input type="number" step="0.5" value={inputs.cplEur} onChange={(e) => setInputs({ ...inputs, cplEur: +e.target.value })} />
          </Field>
          <Field label="Conversão trial → pago (%)">
            <Input type="number" step="0.5" value={inputs.trialToPayConversionPct} onChange={(e) => setInputs({ ...inputs, trialToPayConversionPct: +e.target.value })} />
          </Field>

          <Field label="Churn mensal (%)">
            <Input type="number" step="0.5" value={inputs.monthlyChurnPct} onChange={(e) => setInputs({ ...inputs, monthlyChurnPct: +e.target.value })} />
          </Field>
          <Field label="Pagantes iniciais">
            <Input type="number" value={inputs.startingPayingCustomers} onChange={(e) => setInputs({ ...inputs, startingPayingCustomers: +e.target.value })} />
          </Field>
          <div />

          <Field label="Mix Starter (19€) %">
            <Input type="number" value={inputs.starter} onChange={(e) => setInputs({ ...inputs, starter: +e.target.value })} />
          </Field>
          <Field label="Mix Pro (39€) %">
            <Input type="number" value={inputs.pro} onChange={(e) => setInputs({ ...inputs, pro: +e.target.value })} />
          </Field>
          <Field label="Mix Garage (99€) %">
            <Input type="number" value={inputs.garage} onChange={(e) => setInputs({ ...inputs, garage: +e.target.value })} />
          </Field>
          <Field label="Mix Enterprise (299€) %">
            <Input type="number" value={inputs.enterprise} onChange={(e) => setInputs({ ...inputs, enterprise: +e.target.value })} />
          </Field>
        </div>

        <Button onClick={runForecast} disabled={fcLoading}>
          {fcLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Gerar previsão IA
        </Button>

        {forecast && (
          <div className="mt-6 space-y-5">
            {/* Headline KPIs */}
            <div className="grid gap-3 md:grid-cols-4">
              <Kpi label={`MRR mês ${inputs.horizonMonths}`} value={fmtEUR(forecast.baseline.finalMrrEur)} />
              <Kpi label={`ARR mês ${inputs.horizonMonths}`} value={fmtEUR(forecast.baseline.finalArrEur)} />
              <Kpi label="Pagantes" value={String(forecast.baseline.finalPayingCustomers)} />
              <Kpi label="LTV:CAC" value={forecast.baseline.ltvCacRatio ? `${forecast.baseline.ltvCacRatio}x` : "—"}
                hint={`CAC ${fmtEUR(forecast.baseline.cacEur)} · Payback ${forecast.baseline.paybackMonths ?? "—"}m`} />
            </div>

            {/* AI verdict */}
            {forecast.ai?.verdict && (
              <Card className="p-4 bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={
                    forecast.ai.verdict === "realista" ? "default" :
                    forecast.ai.verdict === "conservador" ? "secondary" :
                    forecast.ai.verdict === "otimista" ? "outline" : "destructive"
                  }>
                    {forecast.ai.verdict}
                  </Badge>
                  {typeof forecast.ai.realismScore === "number" && (
                    <span className="text-xs text-muted-foreground">
                      Realismo: <strong>{forecast.ai.realismScore}/100</strong>
                    </span>
                  )}
                </div>
                <p className="text-sm">{forecast.ai.summary}</p>
              </Card>
            )}

            {/* Scenarios */}
            {forecast.ai?.scenarios && (
              <div className="grid gap-3 md:grid-cols-3">
                {["pessimistic", "expected", "optimistic"].map((k) => {
                  const s = forecast.ai.scenarios[k];
                  if (!s) return null;
                  const label = k === "pessimistic" ? "Pessimista" : k === "expected" ? "Esperado" : "Otimista";
                  return (
                    <Card key={k} className="p-4">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="text-xl font-bold mt-1">{fmtEUR(s.mrrMonth12Eur)}/mês</div>
                      <div className="text-xs text-muted-foreground">{s.payingMonth12} pagantes</div>
                      <p className="text-xs mt-2 text-muted-foreground">{s.explanation}</p>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Monthly trajectory */}
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-2">Trajetória mensal (baseline)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground border-b">
                    <tr>
                      <th className="text-left py-1">Mês</th>
                      <th className="text-right">Novos</th>
                      <th className="text-right">Churn</th>
                      <th className="text-right">Pagantes</th>
                      <th className="text-right">MRR</th>
                      <th className="text-right">ARR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forecast.baseline.months.map((m: any) => (
                      <tr key={m.month} className="border-b border-border/30">
                        <td className="py-1">M{m.month}</td>
                        <td className="text-right">+{m.newPaying}</td>
                        <td className="text-right text-destructive">-{m.churned}</td>
                        <td className="text-right font-semibold">{m.paying}</td>
                        <td className="text-right">{fmtEUR(m.mrrEur)}</td>
                        <td className="text-right text-muted-foreground">{fmtEUR(m.arrEur)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Risks + Opportunities */}
            <div className="grid gap-3 md:grid-cols-2">
              {forecast.ai?.risks?.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" /> Riscos
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {forecast.ai.risks.map((r: any, i: number) => (
                      <li key={i} className="border-l-2 pl-2"
                        style={{ borderColor: r.severity === "high" ? "hsl(var(--destructive))" : r.severity === "medium" ? "orange" : "hsl(var(--muted-foreground))" }}>
                        <div className="font-medium">{r.risk} <Badge variant="outline" className="ml-1 text-xs">{r.severity}</Badge></div>
                        <div className="text-xs text-muted-foreground">→ {r.mitigation}</div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              {forecast.ai?.opportunities?.length > 0 && (
                <Card className="p-4">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Oportunidades
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {forecast.ai.opportunities.map((o: any, i: number) => (
                      <li key={i}>
                        <div className="font-medium">{o.opportunity}</div>
                        <div className="text-xs text-muted-foreground">+{fmtEUR(o.potentialMrrEurMonth12)}/mês potencial</div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>

            {forecast.ai?.actionableSteps?.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-sm mb-2">Passos acionáveis</h3>
                <ol className="space-y-1 text-sm">
                  {forecast.ai.actionableSteps.map((s: string, i: number) => (
                    <li key={i} className="flex gap-2">
                      <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
          </div>
        )}
      </Card>

      {/* ==================== HISTORY ==================== */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Histórico (30 dias)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground border-b">
              <tr>
                <th className="text-left py-2">Data</th>
                <th className="text-right">MRR</th>
                <th className="text-right">Pagantes</th>
                <th className="text-right">Trials</th>
                <th className="text-right">Signups</th>
                <th className="text-right">Churn</th>
                <th className="text-right">GMV Market</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map(m => (
                <tr key={m.snapshot_date} className="border-b border-border/50">
                  <td className="py-2">{m.snapshot_date}</td>
                  <td className="text-right">{fmtEUR(m.mrr_eur)}</td>
                  <td className="text-right">{m.paying_customers ?? 0}</td>
                  <td className="text-right">{m.trial_customers ?? 0}</td>
                  <td className="text-right">{m.new_signups ?? 0}</td>
                  <td className="text-right">{fmtPct(m.churn_rate)}</td>
                  <td className="text-right">{fmtEUR(m.market_gmv_eur)}</td>
                </tr>
              ))}
              {metrics.length === 0 && !loading && (
                <tr><td colSpan={7} className="py-4 text-center text-muted-foreground">Sem snapshots ainda. Clica em "Recalcular agora".</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ==================== CUSTOMER HEALTH ==================== */}
      <Card className="p-4">
        <h2 className="font-semibold mb-3">Customer Health — Risco de Churn</h2>
        <p className="text-xs text-muted-foreground mb-3">Top 50 entidades por score (mais baixo = maior risco).</p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </Card>
  );
}
