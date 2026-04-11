import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Eye, Users, TrendingDown, MousePointerClick, Smartphone, Monitor,
  RotateCw, Globe, Megaphone, Clock, UserX, CheckCircle2, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

interface VisitRow {
  id: string;
  created_at: string;
  source: string;
  medium: string;
  campaign: string;
  gclid: string;
  landing_path: string;
  referrer: string;
  device_type: string;
  country_hint: string;
  session_id: string;
}

const COLORS = [
  "hsl(var(--primary))", "#22c55e", "#f59e0b",
  "#ef4444", "#3b82f6", "#8b5cf6",
];

export default function AdminTraffic() {
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [signups, setSignups] = useState<{ created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("30");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - parseInt(period));
    const sinceStr = since.toISOString();

    const [visitsRes, shopsRes] = await Promise.all([
      supabase.from("landing_visits").select("*")
        .gte("created_at", sinceStr)
        .order("created_at", { ascending: false })
        .limit(5000),
      supabase.from("shops").select("created_at")
        .gte("created_at", sinceStr)
        .order("created_at", { ascending: false }),
    ]);

    setVisits((visitsRes.data || []) as VisitRow[]);
    setSignups(shopsRes.data || []);
    setLoading(false);
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- KPIs ----
  const totalVisits = visits.length;
  const totalSignups = signups.length;
  // Só conta inscrições desde que o tracking começou para taxa real
  const firstVisitDate = visits.length > 0
    ? visits.reduce((min, v) => v.created_at < min ? v.created_at : min, visits[0].created_at)
    : null;
  const signupsSinceTracking = firstVisitDate
    ? signups.filter(s => s.created_at >= firstVisitDate).length
    : 0;
  const conversionRate = totalVisits > 0 ? Math.min(((signupsSinceTracking / totalVisits) * 100), 100) : 0;
  const dropOffs = Math.max(0, totalVisits - signupsSinceTracking);
  const adsVisits = visits.filter(v => v.gclid || v.source === "google" || v.medium === "cpc").length;
  const organicVisits = totalVisits - adsVisits;
  const mobileVisits = visits.filter(v => v.device_type === "mobile").length;
  const desktopVisits = visits.filter(v => v.device_type === "desktop").length;

  // ---- Daily chart ----
  const dailyMap = new Map<string, { visitas: number; inscrições: number }>();
  visits.forEach(v => {
    const day = v.created_at.slice(0, 10);
    const d = dailyMap.get(day) || { visitas: 0, inscrições: 0 };
    d.visitas++;
    dailyMap.set(day, d);
  });
  signups.forEach(s => {
    const day = s.created_at.slice(0, 10);
    const d = dailyMap.get(day) || { visitas: 0, inscrições: 0 };
    d.inscrições++;
    dailyMap.set(day, d);
  });
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, data]) => ({
      dia: new Date(day).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
      ...data,
    }));

  // ---- Source breakdown ----
  const sourceMap = new Map<string, number>();
  visits.forEach(v => {
    let src = "Direto";
    if (v.gclid || v.medium === "cpc") src = "Google Ads";
    else if (v.source === "google" && v.medium === "organic") src = "Google Orgânico";
    else if (v.source) src = v.source;
    else if (v.referrer) {
      try { src = new URL(v.referrer).hostname; } catch { src = v.referrer.slice(0, 30); }
    }
    sourceMap.set(src, (sourceMap.get(src) || 0) + 1);
  });
  const sourceData = Array.from(sourceMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));

  // ---- Campaign table ----
  const campaignMap = new Map<string, { visits: number; gclid: number }>();
  visits.forEach(v => {
    if (!v.campaign && !v.gclid) return;
    const key = v.campaign || "(sem nome)";
    const c = campaignMap.get(key) || { visits: 0, gclid: 0 };
    c.visits++;
    if (v.gclid) c.gclid++;
    campaignMap.set(key, c);
  });
  const campaignData = Array.from(campaignMap.entries())
    .sort((a, b) => b[1].visits - a[1].visits);

  // ---- Recent visits for table ----
  const recentVisits = visits.slice(0, 50);

  const formatSource = (v: VisitRow) => {
    if (v.gclid || v.medium === "cpc") return "Google Ads";
    if (v.source === "google" && v.medium === "organic") return "Google Orgânico";
    if (v.source) return v.source;
    if (v.referrer) {
      try { return new URL(v.referrer).hostname; } catch { return "Referral"; }
    }
    return "Direto";
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />
            Tráfego & Conversões
          </h1>
          <p className="text-sm text-muted-foreground">
            Cada pessoa que abre a sua página é registada. Veja quem entrou, de onde veio, e quem saiu sem se inscrever.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="14">Últimos 14 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="60">Últimos 60 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchData} variant="outline" size="sm" className="gap-2">
            <RotateCw className="w-4 h-4" /> Atualizar
          </Button>
        </div>
      </div>

      {/* Tracking status indicator */}
      <div className="flex items-center gap-2 text-xs">
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-muted-foreground">Tracking ativo — cada visita à landing page é registada automaticamente</span>
        {firstVisitDate && (
          <span className="text-muted-foreground">· A registar desde {new Date(firstVisitDate).toLocaleDateString("pt-PT")}</span>
        )}
      </div>

      {/* KPI Cards - Grandes e claros */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="stat-card p-5 border-l-4 border-l-primary">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Pessoas que Abriram a Página</span>
          </div>
          <p className="text-3xl font-bold">{totalVisits}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {desktopVisits} computador · {mobileVisits} telemóvel
          </p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-green-500">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span className="text-sm font-medium text-muted-foreground">Inscreveram-se</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{totalSignups}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {signupsSinceTracking} desde o tracking · {totalSignups} no período total
          </p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-red-500">
          <div className="flex items-center gap-2 mb-2">
            <UserX className="w-5 h-5 text-red-500" />
            <span className="text-sm font-medium text-muted-foreground">Viram e Saíram Sem Inscrição</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{dropOffs}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {totalVisits > 0 ? `${((dropOffs / totalVisits) * 100).toFixed(0)}% das visitas` : "Sem dados ainda"}
          </p>
        </div>

        <div className="stat-card p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center gap-2 mb-2">
            <MousePointerClick className="w-5 h-5 text-amber-500" />
            <span className="text-sm font-medium text-muted-foreground">Taxa de Conversão</span>
          </div>
          <p className={`text-3xl font-bold ${conversionRate > 5 ? "text-green-600" : "text-amber-600"}`}>
            {conversionRate.toFixed(1)}%
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            De cada 100 visitantes, {conversionRate.toFixed(0)} inscrevem-se
          </p>
        </div>
      </div>

      {/* Origem do tráfego - cards simples */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="stat-card p-4 text-center">
          <Megaphone className="w-6 h-6 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold">{adsVisits}</p>
          <p className="text-xs text-muted-foreground">Via Anúncios (Google Ads)</p>
        </div>
        <div className="stat-card p-4 text-center">
          <Globe className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
          <p className="text-2xl font-bold">{organicVisits}</p>
          <p className="text-xs text-muted-foreground">Orgânico / Direto</p>
        </div>
        <div className="stat-card p-4 text-center">
          <Monitor className="w-6 h-6 mx-auto text-slate-500 mb-1" />
          <p className="text-2xl font-bold">{desktopVisits}</p>
          <p className="text-xs text-muted-foreground">Computador</p>
          {totalVisits > 0 && <p className="text-xs text-primary">{((desktopVisits / totalVisits) * 100).toFixed(0)}%</p>}
        </div>
        <div className="stat-card p-4 text-center">
          <Smartphone className="w-6 h-6 mx-auto text-violet-500 mb-1" />
          <p className="text-2xl font-bold">{mobileVisits}</p>
          <p className="text-xs text-muted-foreground">Telemóvel</p>
          {totalVisits > 0 && <p className="text-xs text-violet-500">{((mobileVisits / totalVisits) * 100).toFixed(0)}%</p>}
        </div>
      </div>

      {/* Alerta de drop-off */}
      {dropOffs > 0 && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-400">
              ⚠️ {dropOffs} {dropOffs === 1 ? "pessoa abriu" : "pessoas abriram"} a página e {dropOffs === 1 ? "saiu" : "saíram"} sem se inscrever
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Isto significa que {totalVisits > 0 ? `${((dropOffs / totalVisits) * 100).toFixed(0)}%` : "—"} dos visitantes não converteram.
              {conversionRate < 5 && " Considere melhorar o título, o botão de ação ou adicionar mais provas sociais."}
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="stat-card lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">📊 Visitas vs Inscrições por Dia</h2>
          {dailyData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              <p>Sem dados para o período selecionado</p>
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  />
                  <Bar dataKey="visitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Visitas" />
                  <Bar dataKey="inscrições" fill="#22c55e" radius={[4, 4, 0, 0]} name="Inscrições" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">🌐 De Onde Vieram</h2>
          {sourceData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              <p>Sem dados</p>
            </div>
          ) : (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}>
                      {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {sourceData.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-1 text-xs">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-muted-foreground">{s.name} ({s.value})</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Campaigns */}
      <div className="stat-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-primary" /> Campanhas de Publicidade
        </h2>
        {campaignData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Megaphone className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Sem campanhas registadas</p>
            <p className="text-xs mt-1">Quando alguém clicar num anúncio do Google Ads ou link com UTM, aparece aqui automaticamente</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nome da Campanha</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Visitas</th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">Cliques Google Ads</th>
                </tr>
              </thead>
              <tbody>
                {campaignData.map(([name, data]) => (
                  <tr key={name} className="border-b border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{name}</td>
                    <td className="px-3 py-2 text-right font-mono">{data.visits}</td>
                    <td className="px-3 py-2 text-right">
                      {data.gclid > 0 ? (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">{data.gclid}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tabela de TODAS as visitas recentes */}
      <div className="stat-card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Últimas Visitas (detalhe)
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Cada linha = uma pessoa que abriu a sua página. Veja a origem, dispositivo e quando entrou.
        </p>
        {recentVisits.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Eye className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Ainda sem visitas registadas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Quando</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Origem</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Dispositivo</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Campanha</th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">Google Ads?</th>
                </tr>
              </thead>
              <tbody>
                {recentVisits.map(v => (
                  <tr key={v.id} className="border-b border-border hover:bg-muted/10">
                    <td className="px-3 py-2 text-xs font-mono whitespace-nowrap">{formatDate(v.created_at)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className="text-xs">{formatSource(v)}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 text-xs">
                        {v.device_type === "mobile" ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                        {v.device_type === "mobile" ? "Telemóvel" : "Computador"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {v.campaign || "—"}
                    </td>
                    <td className="px-3 py-2">
                      {v.gclid ? (
                        <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 text-xs">Sim</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Não</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Explicação */}
      <div className="stat-card bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">📌 Como funciona o tracking</p>
            <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
              <li><strong>Cada pessoa que abre a página</strong> é registada automaticamente (1 registo por sessão)</li>
              <li><strong>Origem:</strong> se veio do Google Ads, de pesquisa orgânica, de um link partilhado, ou direto</li>
              <li><strong>Dispositivo:</strong> se está no computador ou telemóvel</li>
              <li><strong>Campanha:</strong> se clicou num anúncio com UTM ou gclid (Google Ads), aparece aqui</li>
              <li><strong>"Viram e Saíram":</strong> pessoas que abriram a página mas NÃO criaram conta</li>
              <li>Se o tracking falhar (internet lenta, etc.), tenta automaticamente até 3 vezes</li>
              <li>Os dados são <strong>100% reais</strong> — sem estimativas nem aproximações</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
