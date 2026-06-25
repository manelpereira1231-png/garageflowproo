import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const STAGES: { key: string; label: string }[] = [
  { key: "lead", label: "Lead" },
  { key: "contacted", label: "Contactado" },
  { key: "meeting_scheduled", label: "Reunião marcada" },
  { key: "demo_scheduled", label: "Demo agendada" },
  { key: "demo_done", label: "Demo realizada" },
  { key: "proposal_sent", label: "Proposta enviada" },
  { key: "negotiation", label: "Negociação" },
  { key: "won", label: "Cliente ativo" },
  { key: "lost", label: "Perdido" },
];

type Lead = { id: string; name: string; email?: string; estimated_value?: number; pipeline_stage: string };

export default function CommercialPipeline() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase.from("crm_leads" as any).select("id, name, email, estimated_value, pipeline_stage").order("updated_at", { ascending: false });
    setLeads((data || []) as Lead[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const onDragStart = (e: React.DragEvent, id: string) => e.dataTransfer.setData("text/plain", id);
  const onDrop = async (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, pipeline_stage: stage } : l)));
    const { error } = await supabase.from("crm_leads" as any).update({ pipeline_stage: stage }).eq("id", id);
    if (error) toast.error("Falha ao guardar"); else toast.success("Etapa atualizada");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Pipeline de Vendas</h2>
        <p className="text-sm text-muted-foreground">Arraste cartões para alterar a etapa. Guarda automaticamente.</p>
      </div>
      {loading ? <div className="text-sm text-muted-foreground">A carregar…</div> : (
        <div className="grid grid-flow-col auto-cols-[260px] gap-3 overflow-x-auto pb-3">
          {STAGES.map((stage) => {
            const items = leads.filter((l) => l.pipeline_stage === stage.key);
            const total = items.reduce((s, i) => s + Number(i.estimated_value || 0), 0);
            return (
              <div key={stage.key} className="bg-muted/40 rounded-lg p-2 min-h-[400px]"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, stage.key)}>
                <div className="flex items-center justify-between px-2 py-1 mb-2">
                  <span className="font-semibold text-sm">{stage.label}</span>
                  <Badge variant="secondary">{items.length}</Badge>
                </div>
                {total > 0 && <div className="text-[10px] text-muted-foreground px-2 mb-2">{total.toFixed(2)} €</div>}
                <div className="space-y-2">
                  {items.map((l) => (
                    <Card key={l.id} draggable onDragStart={(e) => onDragStart(e, l.id)} className="cursor-move">
                      <CardContent className="p-3">
                        <div className="font-medium text-sm">{l.name}</div>
                        {l.email && <div className="text-[11px] text-muted-foreground">{l.email}</div>}
                        {l.estimated_value && <div className="text-xs mt-1 font-semibold">{Number(l.estimated_value).toFixed(2)} €</div>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
