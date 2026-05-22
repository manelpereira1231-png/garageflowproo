import { useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Download, RefreshCw, Search, AlertTriangle, TrendingUp, MousePointerClick, Eye, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAdminSeoAutoRefresh } from "@/hooks/useAdminSeoAutoRefresh";

interface Visit {
  id: string;
  created_at: string;
  source: string;
  medium: string;
  campaign: string;
  landing_path: string;
  referrer: string;
  device_type: string;
  is_internal: boolean;
  internal_reason: string;
  confidence: string;
  scroll_depth: number;
  time_on_page: number;
  first_touch_source: string;
  hostname: string;
}
interface Conv {
  id: string;
  created_at: string;
  landing_path: string;
  first_touch_source: string;
  last_touch_source: string;
  utm_campaign: string;
  conversion_type: string;
}

const RANGE_DAYS = 30;

export default function AdminSeo() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [conversions, setConversions] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - RANGE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    try {
      const [{ data: v, error: ve }, { data: c, error: ce }] = await Promise.all([
        supabase
          .from("landing_visits")
          .select("*")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("seo_conversions")
          .select("*")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (ve) throw ve;
      if (ce) throw ce;
      setVisits((v || []) as Visit[]);
      setConversions((c || []) as Conv[]);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Falha a carregar dados");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const { refreshing, lastRefresh } = useAdminSeoAutoRefresh(load);

  const real = useMemo(() => visits.filter((v) => !v.is_internal && v.confidence === "real"), [visits]);
  const internal = useMemo(() => visits.filter((v) => v.is_internal), [visits]);

  const kpis = useMemo(() => {
    const total = real.length;
    const mobile = real.filter((v) => v.device_type === "mobile").length;
    const google = real.filter((v) => /google/i.test(v.source) || /google/i.test(v.referrer)).length;
    const bing = real.filter((v) => /bing/i.test(v.source) || /bing/i.test(v.referrer)).length;
    const conv = conversions.length;
    const rate = total > 0 ? ((conv / total) * 100).toFixed(2) : "0.00";
    return { total, mobile, google, bing, conv, rate };
  }, [real, conversions]);

  const topPages = useMemo(() => {
    const map = new Map<string, number>();
    real.forEach((v) => map.set(v.landing_path, (map.get(v.landing_path) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  }, [real]);

  const topSources = useMemo(() => {
    const map = new Map<string, number>();
    real.forEach((v) => {
      const s = v.source || (v.referrer ? new URL(v.referrer.startsWith("http") ? v.referrer : `https://${v.referrer}`).hostname : "direct");
      map.set(s || "direct", (map.get(s || "direct") || 0) + 1);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [real]);

  const conversionsByPage = useMemo(() => {
    const map = new Map<string, number>();
    conversions.forEach((c) => map.set(c.landing_path || "/", (map.get(c.landing_path || "/") || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [conversions]);

  const exportCsv = () => {
    const headers = ["data", "fonte", "campanha", "página", "device", "interno", "motivo", "scroll", "tempo_s"];
    const rows = visits.map((v) =>
      [
        v.created_at,
        v.source,
        v.campaign,
        v.landing_path,
        v.device_type,
        v.is_internal ? "sim" : "não",
        v.internal_reason,
        v.scroll_depth,
        v.time_on_page,
      ]
        .map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `seo-portugal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Helmet><title>SEO Portugal — Admin GarageFlow</title></Helmet>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Search className="w-6 h-6 text-primary" /> SEO Portugal
          </h1>
          <p className="text-sm text-muted-foreground">
            Tráfego orgânico real · últimos {RANGE_DAYS} dias · exclui tráfego interno
            {lastRefresh && <> · atualizado {lastRefresh.toLocaleTimeString()}</>}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" /> Exportar CSV
          </Button>
        </div>
      </div>

      {error && (
        <Card className="p-4 border-destructive/50 bg-destructive/5 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Falha a carregar — dados podem estar desatualizados</p>
            <p className="text-muted-foreground">{error}</p>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi icon={<Eye className="w-4 h-4" />} label="Visitas reais" value={kpis.total} />
        <Kpi icon={<MousePointerClick className="w-4 h-4" />} label="Conversões" value={kpis.conv} />
        <Kpi icon={<TrendingUp className="w-4 h-4" />} label="Taxa conv." value={`${kpis.rate}%`} />
        <Kpi icon={<Search className="w-4 h-4" />} label="Google" value={kpis.google} />
        <Kpi icon={<Bot className="w-4 h-4" />} label="Excluído (interno)" value={internal.length} />
      </div>

      <Tabs defaultValue="pages">
        <TabsList>
          <TabsTrigger value="pages">Páginas</TabsTrigger>
          <TabsTrigger value="sources">Fontes</TabsTrigger>
          <TabsTrigger value="conversions">Conversões</TabsTrigger>
          <TabsTrigger value="internal">Tráfego interno</TabsTrigger>
        </TabsList>

        <TabsContent value="pages">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Páginas com mais visitas reais</h2>
            <Table rows={topPages} headers={["Página", "Visitas"]} />
          </Card>
        </TabsContent>

        <TabsContent value="sources">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Origens do tráfego</h2>
            <Table rows={topSources} headers={["Fonte", "Visitas"]} />
          </Card>
        </TabsContent>

        <TabsContent value="conversions">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Conversões por página de entrada</h2>
            <Table rows={conversionsByPage} headers={["Página", "Conversões"]} />
            <h3 className="font-semibold mt-6 mb-3">Últimas conversões (first-touch → last-touch)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Data</th>
                    <th className="text-left py-2">Página</th>
                    <th className="text-left py-2">First touch</th>
                    <th className="text-left py-2">Last touch</th>
                    <th className="text-left py-2">Campanha</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.slice(0, 30).map((c) => (
                    <tr key={c.id} className="border-b border-border/50">
                      <td className="py-1.5">{new Date(c.created_at).toLocaleDateString("pt-PT")}</td>
                      <td className="py-1.5">{c.landing_path}</td>
                      <td className="py-1.5">{c.first_touch_source || "—"}</td>
                      <td className="py-1.5">{c.last_touch_source || "—"}</td>
                      <td className="py-1.5">{c.utm_campaign || "—"}</td>
                    </tr>
                  ))}
                  {conversions.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem conversões neste período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="internal">
          <Card className="p-4">
            <h2 className="font-semibold mb-3">Tráfego classificado como interno ou suspeito</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Estas visitas <strong>não contam</strong> para as métricas SEO. Cada uma tem motivo e nível de confiança.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground border-b">
                  <tr>
                    <th className="text-left py-2">Data</th>
                    <th className="text-left py-2">Página</th>
                    <th className="text-left py-2">Motivo</th>
                    <th className="text-left py-2">Confiança</th>
                    <th className="text-left py-2">Host</th>
                  </tr>
                </thead>
                <tbody>
                  {internal.slice(0, 50).map((v) => (
                    <tr key={v.id} className="border-b border-border/50">
                      <td className="py-1.5">{new Date(v.created_at).toLocaleString("pt-PT")}</td>
                      <td className="py-1.5">{v.landing_path}</td>
                      <td className="py-1.5">{v.internal_reason}</td>
                      <td className="py-1.5">{v.confidence}</td>
                      <td className="py-1.5">{v.hostname}</td>
                    </tr>
                  ))}
                  {internal.length === 0 && (
                    <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Sem tráfego interno detetado.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {loading && <p className="text-sm text-muted-foreground">A carregar…</p>}
    </div>
  );
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Card>
  );
}

function Table({ rows, headers }: { rows: [string, number][]; headers: [string, string] }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4">Sem dados.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b">
          <tr>
            <th className="text-left py-2">{headers[0]}</th>
            <th className="text-right py-2">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([k, n]) => (
            <tr key={k} className="border-b border-border/50">
              <td className="py-1.5 truncate max-w-md">{k}</td>
              <td className="py-1.5 text-right font-semibold">{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
