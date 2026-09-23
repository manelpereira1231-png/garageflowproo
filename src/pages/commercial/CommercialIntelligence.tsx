import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import { PIPELINE_STAGES } from "@/components/commercial/CommercialLeadDetail";

type Lead = {
  id: string; name: string; district?: string | null; city?: string | null; country?: string | null;
  source?: string | null; pipeline_stage: string; estimated_value?: number | null;
  next_contact_at?: string | null; created_at: string;
};

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.label]),
);

export default function CommercialIntelligence() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("crm_leads" as any)
        .select("id, name, district, city, country, source, pipeline_stage, estimated_value, next_contact_at, created_at");
      setLeads(((data as unknown) || []) as Lead[]);
      setLoading(false);
    })();
  }, []);

  const byRegion = useMemo(() => {
    const m: Record<string, number> = {};
    leads.forEach((l) => {
      const k = (l.district || l.city || l.country || "Sem localização").trim();
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [leads]);

  const byStage = useMemo(() => {
    const m: Record<string, number> = {};
    leads.forEach((l) => { m[l.pipeline_stage] = (m[l.pipeline_stage] || 0) + 1; });
    return PIPELINE_STAGES.map((s) => [s.label, m[s.value] || 0] as [string, number]).filter(([, n]) => n > 0);
  }, [leads]);

  const bySource = useMemo(() => {
    const m: Record<string, number> = {};
    leads.forEach((l) => { const k = l.source || "manual"; m[k] = (m[k] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [leads]);

  const suggestions = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    const overdue = leads.filter((l) => l.next_contact_at && new Date(l.next_contact_at) < now).length;
    const noNext = leads.filter((l) => !l.next_contact_at && !["customer", "lost"].includes(l.pipeline_stage)).length;
    const stale = leads.filter((l) => {
      const d = (now.getTime() - new Date(l.created_at).getTime()) / 86400000;
      return d > 30 && !["customer", "lost"].includes(l.pipeline_stage);
    }).length;
    const pipelineValue = leads
      .filter((l) => !["customer", "lost"].includes(l.pipeline_stage))
      .reduce((s, l) => s + Number(l.estimated_value || 0), 0);

    if (overdue > 0) out.push(`${overdue} contactos com data já ultrapassada — ligar hoje.`);
    if (noNext > 0) out.push(`${noNext} leads sem próximo contacto marcado — definir data.`);
    if (stale > 0) out.push(`${stale} leads parados há mais de 30 dias — reativar ou marcar como perdido.`);
    if (byRegion[0]) out.push(`Maior concentração: ${byRegion[0][0]} (${byRegion[0][1]} leads) — vale uma rota de visitas.`);
    if (pipelineValue > 0) out.push(`Valor estimado em curso: ${pipelineValue.toFixed(2)} €.`);
    if (out.length === 0) out.push("Sem alertas — pipeline em dia.");
    return out;
  }, [leads, byRegion]);

  if (loading) return <div className="text-sm text-muted-foreground">A analisar o pipeline…</div>;

  const List = ({ title, rows }: { title: string; rows: [string, number][] }) => (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        {rows.length === 0 && <div className="text-xs text-muted-foreground">Sem dados.</div>}
        {rows.map(([k, n]) => (
          <div key={k} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
            <span className="truncate">{k}</span>
            <Badge variant="secondary">{n}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Inteligência Comercial</h2>
        <p className="text-sm text-muted-foreground">Análise da prospecção: onde estão os leads e em que passo vão.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" /> Sugestões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {suggestions.map((s, i) => <div key={i}>• {s}</div>)}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <List title="Por zona" rows={byRegion} />
        <List title="Por etapa" rows={byStage} />
        <List title="Por origem" rows={bySource} />
      </div>
    </div>
  );
}
