import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Eye, Users, TrendingDown, MousePointerClick, Smartphone, Monitor,
  RotateCw, Globe, ArrowRight, Megaphone,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
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
}

const COLORS = [
  "hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))",
  "hsl(var(--destructive))", "hsl(var(--info))", "hsl(var(--muted-foreground))",
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
  // Only count signups that happened AFTER first tracked visit for accurate conversion
  const firstVisitDate = visits.length > 0
    ? visits.reduce((min, v) => v.created_at < min ? v.created_at : min, visits[0].created_at)
    : null;
  const relevantSignups = firstVisitDate
    ? signups.filter(s => s.created_at >= firstVisitDate).length
    : 0;
  const conversionRate = totalVisits > 0 ? Math.min(((relevantSignups / totalVisits) * 100), 100) : 0;
  const dropOffs = Math.max(0, totalVisits - relevantSignups);
  const adsVisits = visits.filter(v => v.gclid || v.source === "google" || v.medium === "cpc").length;
  const organicVisits = visits.filter(v => !v.gclid && v.medium !== "cpc").length;
  const mobileVisits = visits.filter(v => v.device_type === "mobile").length;
  const desktopVisits = visits.filter(v => v.device_type === "desktop").length;

  // ---- Daily chart ----
  const dailyMap = new Map<string, { visits: number; signups: number }>();
  visits.forEach(v => {
    const day = v.created_at.slice(0, 10);
    const d = dailyMap.get(day) || { visits: 0, signups: 0 };
    d.visits++;
    dailyMap.set(day, d);
  });
  signups.forEach(s => {
    const day = s.created_at.slice(0, 10);
    const d = dailyMap.get(day) || { visits: 0, signups: 0 };
    d.signups++;
    dailyMap.set(day, d);
  });
  const dailyData = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, data]) => ({
      day: new Date(day).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" }),
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

  // ---- Device breakdown ----
  const deviceData = [
    { name: "Desktop", value: desktopVisits },
    { name: "Telemóvel", value: mobileVisits },
  ].filter(d => d.value > 0);

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
            Visitas à página principal, origens, anúncios e quem não se inscreveu
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { icon: Eye, label: "Visitas Totais", value: totalVisits, color: "text-primary" },
          { icon: Users, label: "Inscrições", value: totalSignups, color: "text-success" },
          { icon: TrendingDown, label: "Não se Inscreveram", value: dropOffs, color: "text-destructive" },
          { icon: MousePointerClick, label: "Taxa Conversão", value: `${conversionRate.toFixed(1)}%`, color: conversionRate > 5 ? "text-success" : "text-warning" },
          { icon: Megaphone, label: "Via Anúncios", value: adsVisits, color: "text-primary" },
          { icon: Globe, label: "Orgânico / Direto", value: organicVisits, color: "text-info" },
          { icon: Monitor, label: "Desktop", value: desktopVisits, color: "text-muted-foreground" },
          { icon: Smartphone, label: "Telemóvel", value: mobileVisits, color: "text-muted-foreground" },
        ].map(kpi => (
          <div key={kpi.label} className="stat-card flex flex-col items-center text-center p-3">
            <kpi.icon className={`w-5 h-5 ${kpi.color} mb-1`} />
            <p className="text-lg font-bold mono">{kpi.value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Alerta de drop-off */}
      {dropOffs > 0 && totalVisits > 10 && conversionRate < 5 && (
        <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 flex items-start gap-3">
          <TrendingDown className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {dropOffs} pessoas visitaram a página e não se inscreveram ({(100 - conversionRate).toFixed(1)}%)
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Considere melhorar o copy, o CTA ou a proposta de valor da landing page para aumentar a conversão.
            </p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily trend */}
        <div className="stat-card lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">Visitas vs Inscrições por Dia</h2>
          {dailyData.length === 0 ? (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              <p>Sem dados para o período selecionado</p>
            </div>
          ) : (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  />
                  <Bar dataKey="visits" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Visitas" />
                  <Bar dataKey="signups" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Inscrições" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Source pie */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Origem do Tráfego</h2>
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
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Device split */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Dispositivos</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Monitor className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold mono">{desktopVisits}</p>
              <p className="text-xs text-muted-foreground">Desktop</p>
              {totalVisits > 0 && (
                <p className="text-xs font-medium text-primary mt-1">
                  {((desktopVisits / totalVisits) * 100).toFixed(0)}%
                </p>
              )}
            </div>
            <div className="text-center p-4 rounded-lg bg-muted/50">
              <Smartphone className="w-8 h-8 mx-auto text-warning mb-2" />
              <p className="text-2xl font-bold mono">{mobileVisits}</p>
              <p className="text-xs text-muted-foreground">Telemóvel</p>
              {totalVisits > 0 && (
                <p className="text-xs font-medium text-warning mt-1">
                  {((mobileVisits / totalVisits) * 100).toFixed(0)}%
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Campaigns table */}
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-primary" /> Campanhas
          </h2>
          {campaignData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Megaphone className="w-8 h-8 mb-2 opacity-50" />
              <p className="text-sm">Sem campanhas registadas</p>
              <p className="text-xs mt-1">Os dados aparecem quando visitantes chegam com parâmetros UTM ou gclid</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-2 font-medium text-muted-foreground">Campanha</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">Visitas</th>
                    <th className="text-right px-2 py-2 font-medium text-muted-foreground">Google Ads</th>
                  </tr>
                </thead>
                <tbody>
                  {campaignData.map(([name, data]) => (
                    <tr key={name} className="border-b border-border hover:bg-muted/20">
                      <td className="px-2 py-2 font-medium">{name}</td>
                      <td className="px-2 py-2 text-right mono">{data.visits}</td>
                      <td className="px-2 py-2 text-right">
                        {data.gclid > 0 ? (
                          <Badge variant="outline" className="bg-primary/10 text-primary text-xs">{data.gclid}</Badge>
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
      </div>

      {/* Info box */}
      <div className="stat-card bg-muted/30 border-dashed">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Como funciona</p>
            <p className="text-xs text-muted-foreground mt-1">
              Cada visita à página principal é registada automaticamente com a origem (Google Ads, orgânico, direto),
              dispositivo e campanha UTM. Compare com as inscrições para perceber a eficácia dos seus anúncios.
              Os dados do Google Ads são identificados pelo parâmetro <code className="bg-muted px-1 rounded">gclid</code>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
