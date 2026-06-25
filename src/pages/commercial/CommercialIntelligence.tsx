import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";

export default function CommercialIntelligence() {
  const [districts, setDistricts] = useState<{ name: string; count: number }[]>([]);
  const [plans, setPlans] = useState<{ name: string; count: number }[]>([]);
  const [topActive, setTopActive] = useState<{ id: string; name: string; days: number }[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [shopsRes, subsRes] = await Promise.all([
        supabase.from("shops").select("id, name, country, address, last_seen_at, created_at"),
        supabase.from("subscriptions").select("plan, status, shop_id"),
      ]);
      const shops = shopsRes.data || [];
      const subs = subsRes.data || [];

      // Districts — best-effort extract from address (last token), fallback to country
      const distCounts: Record<string, number> = {};
      shops.forEach((s: any) => {
        const raw = (s.address || s.country || "—").toString();
        const parts = raw.split(",").map((p: string) => p.trim()).filter(Boolean);
        const key = parts[parts.length - 1] || raw;
        distCounts[key] = (distCounts[key] || 0) + 1;
      });
      const distArr = Object.entries(distCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
      setDistricts(distArr);

      // Plans
      const planCounts: Record<string, number> = {};
      subs.forEach((s: any) => {
        const k = s.plan || "free";
        planCounts[k] = (planCounts[k] || 0) + 1;
      });
      setPlans(Object.entries(planCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count));

      // Top active = most recent last_seen
      const top = shops
        .filter((s: any) => s.last_seen_at)
        .sort((a: any, b: any) => new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime())
        .slice(0, 10)
        .map((s: any) => ({
          id: s.id, name: s.name,
          days: Math.max(0, Math.floor((Date.now() - new Date(s.last_seen_at).getTime()) / 86400000)),
        }));
      setTopActive(top);

      // Suggestions
      const inactiveCount = shops.filter((s: any) => !s.last_seen_at || (Date.now() - new Date(s.last_seen_at).getTime()) > 30 * 86400000).length;
      const freeCount = subs.filter((s: any) => (s.plan || 'free') === 'free').length;
      const lostCount = subs.filter((s: any) => s.status === 'canceled').length;
      const sugg: string[] = [];
      if (inactiveCount > 0) sugg.push(`Contactar ${inactiveCount} oficinas inativas há mais de 30 dias.`);
      if (freeCount > 0) sugg.push(`Propor upgrade a ${freeCount} oficinas no plano Free.`);
      if (lostCount > 0) sugg.push(`Tentar recuperar ${lostCount} oficinas que cancelaram.`);
      if (distArr.length > 0) sugg.push(`Distrito com mais oficinas: ${distArr[0].name} (${distArr[0].count}). Reforçar campanhas locais.`);
      if (distArr.length > 3) sugg.push(`Distritos com menor presença: ${distArr.slice(-3).map(d => d.name).join(", ")}. Avaliar expansão.`);
      setSuggestions(sugg);

      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">A processar inteligência comercial…</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Inteligência Comercial</h2>
        <p className="text-sm text-muted-foreground">Análise automática baseada nos dados reais da plataforma.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Sugestões automáticas</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {suggestions.map((s, i) => <li key={i} className="text-sm flex items-start gap-2"><span className="text-primary">•</span>{s}</li>)}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Top distritos / regiões</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {districts.slice(0, 10).map((d) => (
              <div key={d.name} className="flex justify-between text-sm py-1 border-b last:border-0">
                <span className="truncate">{d.name}</span><Badge variant="outline">{d.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Planos mais vendidos</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {plans.map((p) => (
              <div key={p.name} className="flex justify-between text-sm py-1 border-b last:border-0">
                <span className="truncate capitalize">{p.name}</span><Badge variant="outline">{p.count}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Clientes mais ativos</CardTitle></CardHeader>
          <CardContent className="space-y-1">
            {topActive.map((t) => (
              <div key={t.id} className="flex justify-between text-sm py-1 border-b last:border-0">
                <span className="truncate">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.days === 0 ? "Hoje" : `${t.days}d`}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
