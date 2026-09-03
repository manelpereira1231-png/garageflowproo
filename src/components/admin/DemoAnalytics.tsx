/**
 * Analytics da experiência Demo (/demo e /demo-demonstracao).
 * Lê public.demo_events e agrega: sessões, origens, páginas, cliques,
 * pontos de saída e conversão no CTA. Admin only (RLS).
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, MousePointerClick, LogOut, Rocket, Monitor, Smartphone,
  Globe, FileText, RefreshCw,
} from "lucide-react";

type DemoEvent = {
  session_id: string;
  mode: string;
  event: string;
  path: string;
  label: string;
  source: string;
  device_type: string;
  created_at: string;
};

type RangeDays = 7 | 30 | 90;

function groupCount(rows: DemoEvent[], key: (r: DemoEvent) => string) {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const k = key(r) || "—";
    map.set(k, (map.get(k) || 0) + 1);
  });
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

function Bar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="h-1.5 rounded-full bg-muted overflow-hidden flex-1">
      <div className="h-full bg-primary/70 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function RankedList({ title, icon, rows, empty }: {
  title: string;
  icon: React.ReactNode;
  rows: [string, number][];
  empty: string;
}) {
  const max = rows[0]?.[1] ?? 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          {icon}{title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-muted-foreground">{empty}</p>}
        {rows.slice(0, 10).map(([label, count]) => (
          <div key={label} className="flex items-center gap-2 text-xs">
            <span className="truncate min-w-0 flex-1" title={label}>{label}</span>
            <Bar value={count} max={max} />
            <span className="tabular-nums text-muted-foreground w-8 text-right">{count}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function DemoAnalytics() {
  const [days, setDays] = useState<RangeDays>(30);
  const [events, setEvents] = useState<DemoEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - days * 86400_000).toISOString();
    const { data } = await (supabase as any)
      .from("demo_events")
      .select("session_id,mode,event,path,label,source,device_type,created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);
    setEvents((data as DemoEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [days]);

  const stats = useMemo(() => {
    const enters = events.filter((e) => e.event === "enter");
    const sessions = new Set(events.map((e) => e.session_id));
    const enterSessions = new Set(enters.map((e) => e.session_id));
    const selfSessions = new Set(enters.filter((e) => e.mode === "self").map((e) => e.session_id));
    const salesSessions = new Set(enters.filter((e) => e.mode === "sales").map((e) => e.session_id));
    const ctaSessions = new Set(events.filter((e) => e.event === "cta_signup").map((e) => e.session_id));
    const conversion = enterSessions.size > 0
      ? Math.round((ctaSessions.size / enterSessions.size) * 100)
      : 0;

    const pageViews = events.filter((e) => e.event === "page_view");
    const clicks = events.filter((e) => e.event === "click");
    const exits = events.filter((e) => e.event === "exit" || e.event === "demo_end");

    // Sessões recentes
    const bySession = new Map<string, DemoEvent[]>();
    events.forEach((e) => {
      const arr = bySession.get(e.session_id) || [];
      arr.push(e);
      bySession.set(e.session_id, arr);
    });
    const recentSessions = [...bySession.entries()]
      .map(([sid, evs]) => {
        const sorted = [...evs].sort((a, b) => a.created_at.localeCompare(b.created_at));
        const first = sorted[0];
        const last = sorted[sorted.length - 1];
        const lastPageView = [...sorted].reverse().find((e) => e.event === "page_view");
        return {
          sid,
          mode: first.mode,
          device: first.device_type,
          source: first.source || "Direto",
          startedAt: first.created_at,
          events: evs.length,
          lastPath: lastPageView?.path || last.path,
          converted: evs.some((e) => e.event === "cta_signup"),
        };
      })
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
      .slice(0, 25);

    return {
      totalSessions: sessions.size,
      enterSessions: enterSessions.size,
      self: selfSessions.size,
      sales: salesSessions.size,
      cta: ctaSessions.size,
      conversion,
      sources: groupCount(enters, (e) => e.source || "Direto"),
      devices: groupCount(enters, (e) => e.device_type || "—"),
      topPages: groupCount(pageViews, (e) => e.path),
      topClicks: groupCount(clicks, (e) => e.label),
      exitPoints: groupCount(exits, (e) => e.path),
      recentSessions,
    };
  }, [events]);

  const kpis = [
    { label: "Sessões na Demo", value: stats.enterSessions, icon: Users },
    { label: "/demo (autónoma)", value: stats.self, icon: Monitor },
    { label: "/demo-demonstracao", value: stats.sales, icon: Globe },
    { label: "Clicaram no CTA", value: stats.cta, icon: Rocket },
    { label: "Taxa de conversão", value: `${stats.conversion}%`, icon: MousePointerClick },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {([7, 30, 90] as RangeDays[]).map((d) => (
            <Button
              key={d}
              variant={days === d ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setDays(d)}
            >
              {d} dias
            </Button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground">
                <k.icon className="w-3.5 h-3.5" />
                <span className="text-[11px] uppercase tracking-wide">{k.label}</span>
              </div>
              <p className="text-2xl font-bold mt-1 tabular-nums">{loading ? "…" : k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <RankedList title="Origem das visitas" icon={<Globe className="w-4 h-4 text-primary" />} rows={stats.sources} empty="Sem dados de origem ainda." />
        <RankedList
          title="Dispositivos"
          icon={<Smartphone className="w-4 h-4 text-primary" />}
          rows={stats.devices}
          empty="Sem dados ainda."
        />
        <RankedList title="Páginas mais vistas na Demo" icon={<FileText className="w-4 h-4 text-primary" />} rows={stats.topPages} empty="Sem page views registados." />
        <RankedList title="Onde saíram da Demo" icon={<LogOut className="w-4 h-4 text-primary" />} rows={stats.exitPoints} empty="Sem saídas registadas." />
      </div>

      <RankedList title="Cliques mais frequentes (botões/links)" icon={<MousePointerClick className="w-4 h-4 text-primary" />} rows={stats.topClicks} empty="Sem cliques registados." />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Sessões recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentSessions.length === 0 && (
            <p className="text-xs text-muted-foreground">Ainda não há sessões de demo registadas neste período.</p>
          )}
          <div className="space-y-1.5">
            {stats.recentSessions.map((s) => (
              <div
                key={s.sid}
                className="flex items-center gap-2 text-xs border border-border/50 rounded-lg px-3 py-2 flex-wrap"
              >
                <Badge variant={s.mode === "sales" ? "default" : "secondary"} className="text-[10px]">
                  {s.mode === "sales" ? "Demonstração" : "Autónoma"}
                </Badge>
                <span className="text-muted-foreground flex items-center gap-1">
                  {s.device === "mobile" ? <Smartphone className="w-3 h-3" /> : <Monitor className="w-3 h-3" />}
                  {s.source}
                </span>
                <span className="text-muted-foreground">
                  {new Date(s.startedAt).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <span className="text-muted-foreground">{s.events} eventos</span>
                <span className="truncate min-w-0 flex-1" title={s.lastPath}>
                  Última página: <span className="font-mono">{s.lastPath}</span>
                </span>
                {s.converted && (
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0">
                    <Rocket className="w-3 h-3 mr-1" />Clicou no CTA
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
