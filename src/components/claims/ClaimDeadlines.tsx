import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ptDeadlines, deadlineState, type Sup } from "@/lib/claimPhases";

const TONE: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40",
  red: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/40",
  gray: "bg-muted text-muted-foreground border-border",
};

/** Prazos da seguradora — DL 291/2007 (só para oficinas de Portugal). */
export function ClaimDeadlines({ claim, sups, onSaved }: { claim: any; sups: Sup[]; onSaved: () => void }) {
  const upd = async (patch: Record<string, any>) => {
    const { error } = await supabase.from("claims").update(patch as any).eq("id", claim.id);
    if (error) toast.error(error.message); else onSaved();
  };
  const list = ptDeadlines(claim, sups);
  return (
    <Card className="rounded-[14px]">
      <CardHeader><CardTitle className="text-base">Prazos da seguradora</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label className="flex items-center gap-2 text-sm min-h-[44px]">
          <Checkbox checked={!!claim.has_daaa} onCheckedChange={(v) => upd({ has_daaa: !!v })} />Há Declaração Amigável (prazos a metade)
        </label>
        <label className="flex items-center gap-2 text-sm min-h-[44px]">
          <Checkbox checked={!!claim.requires_disassembly} onCheckedChange={(v) => upd({ requires_disassembly: !!v })} />Peritagem com desmontagem
        </label>
        <ul className="space-y-2">
          {list.map((d) => {
            const st = deadlineState(d);
            return (
              <li key={d.id} className="rounded-md border border-border p-2 text-sm space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{d.name}</span>
                  <Badge variant="outline" className={`shrink-0 ${TONE[st.tone]}`}>{st.label}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{d.rule}{d.limit ? ` · limite ${d.limit.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit", timeZone: "UTC" })}` : ""}</p>
                {d.field && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Cumprido em</span>
                    <Input type="date" className="h-9 w-40" value={claim[d.field] || ""} onChange={(e) => upd({ [d.field!]: e.target.value || null })} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {!claim.report_date && !claim.claim_date && <p className="text-xs text-muted-foreground">Sem data de participação, conta-se a partir da criação do sinistro. Pode indicá-la em "Mais detalhes".</p>}
        <p className="text-xs text-muted-foreground">Contado em dias úteis a partir da participação.</p>
      </CardContent>
    </Card>
  );
}
