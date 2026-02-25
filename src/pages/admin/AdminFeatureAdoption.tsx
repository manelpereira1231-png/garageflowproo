import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, Users, Activity, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
  const [features, setFeatures] = useState<FeatureUsage[]>([]);
  const [cohorts, setCohorts] = useState<CohortRow[]>([]);
  const [nrr, setNrr] = useState(0);
  const [dailyActive, setDailyActive] = useState(0);
  const [weeklyActive, setWeeklyActive] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // Feature usage from audit_logs
      const { data: usageData } = await supabase
        .from("audit_logs")
        .select("details")
        .eq("entity_type", "feature_usage")
        .order("created_at", { ascending: false })
        .limit(500);

      // Count features
      const featureMap = new Map<string, number>();
      (usageData || []).forEach(row => {
        const d = row.details as any;
        const feature = d?.feature || "unknown";
        featureMap.set(feature, (featureMap.get(feature) || 0) + 1);
      });
      const featureList = Array.from(featureMap.entries())
        .map(([feature, count]) => ({ feature, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);
      setFeatures(featureList);

      // DAU / WAU from audit_logs (unique user_ids)
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const { data: dayLogs } = await supabase
        .from("audit_logs")
        .select("user_id")
        .gte("created_at", dayAgo);
      const dauSet = new Set((dayLogs || []).map(l => l.user_id).filter(Boolean));
      setDailyActive(dauSet.size);

      const { data: weekLogs } = await supabase
        .from("audit_logs")
        .select("user_id")
        .gte("created_at", weekAgo);
      const wauSet = new Set((weekLogs || []).map(l => l.user_id).filter(Boolean));
      setWeeklyActive(wauSet.size);

      // Cohort analysis from subscriptions
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("plan, status, created_at")
        .order("created_at", { ascending: true });

      const cohortMap = new Map<string, { total: number; active: number[] }>();
      (subs || []).forEach(s => {
        const d = new Date(s.created_at);
        const cohortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (!cohortMap.has(cohortKey)) {
          cohortMap.set(cohortKey, { total: 0, active: [0, 0, 0, 0] });
        }
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

      // NRR simplified: active paid revenue / previous period paid revenue
      const PRICES: Record<string, number> = { free: 0, pro: 49, garage: 99 };
      const activePaid = (subs || []).filter(s => s.status === "active" && s.plan !== "free");
      const currentMRR = activePaid.reduce((sum, s) => sum + (PRICES[s.plan] || 0), 0);
      // Previous month (simplified)
      const prevMonthSubs = (subs || []).filter(s => {
        const d = new Date(s.created_at);
        return d < new Date(now.getFullYear(), now.getMonth(), 1);
      });
      const prevPaid = prevMonthSubs.filter(s => s.plan !== "free");
      const prevMRR = prevPaid.reduce((sum, s) => sum + (PRICES[s.plan] || 0), 0);
      setNrr(prevMRR > 0 ? Math.round((currentMRR / prevMRR) * 100) : 100);

      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const kpis = [
    { label: "NRR (Net Revenue Retention)", value: `${nrr}%`, icon: TrendingUp, color: nrr >= 100 ? "text-success" : "text-warning" },
    { label: "DAU (Utilizadores Diários)", value: String(dailyActive), icon: Activity, color: "text-primary" },
    { label: "WAU (Utilizadores Semanais)", value: String(weeklyActive), icon: Users, color: "text-info" },
    { label: "Features Tracked", value: String(features.length), icon: Zap, color: "text-primary" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Activity className="w-6 h-6 text-primary" /> Feature Adoption & Cohorts
        </h1>
        <p className="text-sm text-muted-foreground">Métricas de adoção, retenção e engagement</p>
      </div>

      {/* KPIs */}
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

      {/* Feature Usage Chart */}
      {features.length > 0 && (
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Top Features Utilizadas</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={features} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" className="text-xs" />
                <YAxis dataKey="feature" type="category" width={150} className="text-xs" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Utilizações" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Cohort Table */}
      {cohorts.length > 0 && (
        <div className="stat-card">
          <h2 className="text-lg font-semibold mb-4">Análise de Cohorts (Retenção %)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Cohort</th>
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
                        <span
                          className="inline-block px-2.5 py-1 rounded-md text-xs font-medium mono"
                          style={{
                            background: `hsl(var(--success) / ${Math.max(0.05, v / 100)})`,
                            color: v > 50 ? "hsl(var(--success-foreground))" : "hsl(var(--foreground))",
                          }}
                        >
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
        <div className="stat-card text-center py-12">
          <Zap className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold mb-1">Sem dados de feature tracking</h3>
          <p className="text-sm text-muted-foreground">
            O tracking de funcionalidades começará a registar dados à medida que os utilizadores interagirem com o sistema.
          </p>
        </div>
      )}
    </div>
  );
}
