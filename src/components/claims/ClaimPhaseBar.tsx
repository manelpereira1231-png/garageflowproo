import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { REPAIR_PHASES, REPAIR_PHASE_LABELS, TOTAL_LOSS_PHASES, TOTAL_LOSS_PHASE_LABELS } from "@/lib/claimPhases";
import { Check } from "lucide-react";

/** "Onde está o processo": 6 fases + seletor Reparar | Perda total + próximo passo. */
export function ClaimPhaseBar({ outcome, phase, cancelled, subs, next, onOutcome, isBR }: {
  outcome: "reparacao" | "perda_total"; phase: string; cancelled: boolean; subs: Record<string, string>;
  next: string; onOutcome: (o: "reparacao" | "perda_total") => void; isBR: boolean;
}) {
  const list: string[] = outcome === "perda_total" ? [...TOTAL_LOSS_PHASES] : REPAIR_PHASES;
  const labels: Record<string, string> = outcome === "perda_total" ? TOTAL_LOSS_PHASE_LABELS : { ...REPAIR_PHASE_LABELS, faturacao: isBR ? "Nota fiscal" : "Faturação" };
  const cur = list.indexOf(phase);
  return (
    <Card className="rounded-[14px]">
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="text-base">Onde está o processo</CardTitle>
        <div className="inline-flex rounded-[12px] border border-border p-1" role="tablist" aria-label="Tipo de processo">
          {(["reparacao", "perda_total"] as const).map((o) => (
            <button key={o} type="button" role="tab" aria-selected={outcome === o} onClick={() => outcome !== o && onOutcome(o)}
              className={`px-3 min-h-[40px] rounded-[9px] text-sm font-medium ${outcome === o ? (o === "perda_total" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground") : "text-muted-foreground"}`}>
              {o === "reparacao" ? "Reparar" : "Perda total"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ol className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {list.map((p, i) => {
            const done = i < cur || (i === cur && p === "fechado");
            const current = i === cur && p !== "fechado";
            const loss = p === "perda_total" && i <= cur;
            const tone = loss ? "bg-red-500/10 border-red-500/40" : done ? "bg-emerald-500/10 border-emerald-500/30" : current ? "bg-amber-500/10 border-amber-500" : "bg-muted/40 border-border";
            const dot = loss ? "bg-red-700 text-primary-foreground" : done ? "bg-emerald-700 text-primary-foreground" : current ? "bg-amber-500 text-foreground" : "bg-muted text-muted-foreground";
            return (
              <li key={p} className={`rounded-[12px] border p-2.5 ${tone}`} aria-current={current ? "step" : undefined}>
                <div className="flex items-center gap-2">
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${dot}`}>{done ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className="text-sm font-semibold">{labels[p]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground truncate">{p === "fechado" && cancelled ? "Cancelado" : subs[p] || (current ? "Em curso" : done ? "Concluída" : "Por fazer")}</p>
              </li>
            );
          })}
        </ol>
        <div className="rounded-[12px] border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm">
          <span className="font-semibold">Próximo passo:</span> {next}
        </div>
      </CardContent>
    </Card>
  );
}
