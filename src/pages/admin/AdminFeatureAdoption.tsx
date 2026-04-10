import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, Users, Activity, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";

interface FeatureUsage {
  feature: string;
  count: number;
}

interface CohortRow {
  cohort: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
}

export default function AdminFeatureAdoption() {
  const { t } = useLanguage();
  const [features, setFeatures] = useState<FeatureUsage[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [nrr, setNrr] = useState(0);
  const [dailyActive, setDailyActive] = useState(0);
  const [weeklyActive, setWeeklyActive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: usageData } = await supabase
        .from("audit_logs").select("details").eq("entity_type", "feature_usage")
        .order("created_at", { ascending: false }).limit(500);

      const featureMap = new Map<string, number>();
      (usageData || []).forEach(row => {
        const d = row.details as any;
        const feature = d?.feature || "unknown";
        featureMap.set(feature, (featureMap.get(feature) || 0) + 1);
      });
      const featureList = Array.from(featureMap.entries())
        .map(([feature, count]) => ({ feature, count }))
        .sort((a, b) => b.count - a.count).slice(0, 15);
      setFeatures(featureList);

      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: dayLogs } = await supabase.from("audit_logs").select("user_id").gte("created_at", dayAgo);
      setDailyActive(new Set((dayLogs || []).map(l => l.user_id).filter(Boolean)).size);

      const { data: weekLogs } = await supabase.from("audit_logs").select("user_id").gte("created_at", weekAgo);
      setWeeklyActive(new Set((weekLogs || []).map(l => l.user_id).filter(Boolean)).size);

      const { data: subs } = await supabase.from("subscriptions").select("plan, status, created_at").order("created_at", { ascending: true });

      const cohortMap = new Map<string, { total: number; active: number[] }>();
      (subs || []).forEach(s => {
        const d = new Date(s.created_at);
        const cohortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!cohortMap.has(cohortKey)) cohortMap.set(cohortKey, { total: 0, active: [0, 0, 0, 0] });
        const c = cohortMap.get(cohortKey)!;
        c.total++;
        const monthsAlive = Math.min(3, Math.floor((now.getTime() - d.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        if (s.status === "active") {
          for (let i = 0; i <= monthsAlive; i++) c.active[i]++;
        }
      });

      const cohortRows: CohortRow[] = [];
      cohortMap.forEach((v, k) => {
        cohortRows.push({
          cohort: k,
          month0: v.total > 0 ? Math.round((v.active[0] / v.total) * 100) : 0,
          month1: v.total > 0 ? Math.round((v.active[1] / v.total) * 100) : 0,
          month2: v.total > 0 ? Math.round((v.active[2] / v.total) * 100) : 0,
          month3: v.total > 0 ? Math.round((v.active[3] / v.total) * 100) : 0,
        });
      });
      setCohorts(cohortRows.slice(-6));

      const PRICES: Record<string, number> = { free: 0, pro: 49, garage: 99 };
      const activePaid = (subs || []).filter(s => s.status === "active" && s.plan !== "free");
      const currentMRR = activePaid.reduce((sum, s) => sum + (PRICES[s.plan] || 0), 0);
      const prevMonthSubs = (subs || []).filter(s => new Date(s.created_at) < new Date(now.getFullYear(), now.getMonth(), 1));
      const prevMRR = prevMonthSubs.filter(s => s.plan !== "free").reduce((sum, s) => sum + (PRICES[s.plan] || 0), 0);
      setNrr(prevMRR > 0 ? Math.round((currentMRR / prevMRR) * 100) : 100);

      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="stat-card h-20 animate-pulse bg-muted/30" />)}
        </div>
        <div className="stat-card h-64 animate-pulse bg-muted/30" />
      </div>
    );
  }

  const kpis = [
    { label: "Retenção Líquida (NRR)", value: `${nrr}%`, icon: TrendingUp, color: nrr >= 100 ? "text-success" : "text-warning" },
    { label: "Utilizadores Hoje", value: String(dailyActive), icon: Activity, color: "text-primary" },
    { label: "Utilizadores Semana", value: String(weeklyActive), icon: Users, color: "text-info" },
    { label: "Funcionalidades", value: String(features.length), icon: Zap, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> {t('admin.features.title')}
        </h1>
        <p className="text-sm text-muted-foreground">{t('admin.features.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className="stat-card flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${kpi.color}`}>
              <kpi.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-xl font-bold mono">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {features.length > 0 && (
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">{t('admin.features.topFeatures')}</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={features} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="feature" type="category" width={150} className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {cohorts.length > 0 && (
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">{t('admin.features.cohortTitle')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Período</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Mês 0</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Mês 1</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Mês 2</th>
                  <th className="text-center px-4 py-2 font-medium text-muted-foreground">Mês 3</th>
                </tr>
              </thead>
              <tbody>
                {cohorts.map(c => (
                  <tr key={c.cohort} className="border-b border-border">
                    <td className="px-4 py-2.5 font-medium mono">{c.cohort}</td>
                    {[c.month0, c.month1, c.month2, c.month3].map((v, i) => (
                      <td key={i} className="px-4 py-2.5 text-center">
                        <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium mono"
                          style={{
                            background: `hsl(var(--success) / ${Math.max(0.05, v / 100)})`,
                            color: v > 50 ? "hsl(var(--success-foreground))" : "hsl(var(--foreground))",
                          }}>
                          {v}%
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {features.length === 0 && (
        <div className="stat-card text-center py-16">
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">{t('admin.features.noData')}</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{t('admin.features.noDataDesc')}</p>
        </div>
      )}
    </div>
  );
}
