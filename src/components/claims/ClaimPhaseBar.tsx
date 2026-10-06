import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REPAIR_PHASES, REPAIR_PHASE_LABELS, TOTAL_LOSS_PHASES, TOTAL_LOSS_PHASE_LABELS } from "@/lib/claimPhases";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";

/** "Onde está o processo": 6 fases + seletor Reparar | Perda total + próximo passo. */
export function ClaimPhaseBar({ outcome, phase, cancelled, subs, next, onOutcome, isBR, action }: {
  outcome: "reparacao" | "perda_total"; phase: string; cancelled: boolean; subs: Record<string, string>;
  next: string; onOutcome: (o: "reparacao" | "perda_total") => void; isBR: boolean; action?: ReactNode;
}) {
  const list: string[] = outcome === "perda_total" ? [...TOTAL_LOSS_PHASES] : REPAIR_PHASES;
  const labels: Record<string, string> = outcome === "perda_total" ? TOTAL_LOSS_PHASE_LABELS : { ...REPAIR_PHASE_LABELS, faturacao: isBR ? "Nota fiscal" : "Faturação" };
  const cur = list.indexOf(phase);
  const [expanded, setExpanded] = useState(false);
  return (
    <Card className="rounded-[14px]">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 space-y-0 pb-3">
        <div><CardTitle className="text-base">{labels[phase] || "Onde está o processo"}</CardTitle><p className="text-xs text-muted-foreground mt-1">Etapa {Math.max(0, cur) + 1} de {list.length}</p></div>
        <div className="flex sm:inline-flex rounded-[12px] border border-border p-1" role="tablist" aria-label="Tipo de processo">
          {(["reparacao", "perda_total"] as const).map((o) => (
            <Button variant="ghost" key={o} type="button" role="tab" aria-selected={outcome === o} onClick={() => outcome !== o && onOutcome(o)}
              className={`flex-1 sm:flex-none whitespace-nowrap px-4 min-h-[44px] rounded-[9px] text-sm font-medium ${outcome === o ? (o === "perda_total" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground") : "text-muted-foreground"}`}>
              {o === "reparacao" ? "Reparar" : "Perda total"}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-3"><p className="text-sm"><span className="font-semibold">Próximo passo:</span> {next}</p>{action}</div>
        <Button variant="ghost" className="px-0 text-muted-foreground" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? "Ocultar etapas" : "Ver todas as etapas"}</Button>
        {expanded && <ol className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2">
          {list.map((p, i) => {
            const done = i < cur || (i === cur && p === "fechado");
            const current = i === cur && p !== "fechado";
            const loss = p === "perda_total" && i <= cur;
            const tone = loss ? "claim-tone-danger" : done ? "claim-tone-success" : current ? "claim-tone-warning" : "claim-phase-future border-border";
            const dot = loss ? "claim-dot-danger" : done ? "claim-dot-success" : current ? "claim-dot-warning" : "bg-muted text-muted-foreground";
            return (
              <li key={p} className={`rounded-[12px] border p-2.5 ${tone}`} aria-current={current ? "step" : undefined}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${dot}`}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className="text-sm font-semibold min-w-0 break-normal">{labels[p]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground truncate">{p === "fechado" && cancelled ? "Cancelado" : subs[p] || (current ? "Em curso" : done ? "Concluída" : "Por fazer")}</p>
              </li>
            );
          })}
        </ol>}
      </CardContent>
    </Card>
  );
}
