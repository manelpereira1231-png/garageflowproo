import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { ShieldAlert, ChevronRight } from "lucide-react";
import { REPAIR_PHASES, REPAIR_PHASE_LABELS, computeRepairPhase, computeTotalLossPhase, ptDeadlines, deadlineState } from "@/lib/claimPhases";
import { useShopCountry } from "@/hooks/useShopCountry";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";

/**
 * Resumo de processos de seguradoras no Dashboard.
 * Cada número abre a lista /claims já filtrada pelo estado correspondente.
 */
export default function ClaimsSummaryCard() {
  const activeShopId = useActiveShopId();
  const [rows, setRows] = useState<any[] | null>(null);
  const { code } = useShopCountry();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  useRealtimeTable("claims", { shopId: activeShopId, onChange: refresh });
  useRealtimeTable("claim_supplements", { shopId: activeShopId, onChange: refresh });
  useRealtimeTable("invoices", { shopId: activeShopId, onChange: refresh });
  useRealtimeTable("payments", { shopId: activeShopId, onChange: refresh });

  useEffect(() => {
    if (!activeShopId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("claims")
        .select("*, work_orders(status), invoices!invoices_claim_id_fkey(total,status,payments(amount)), claim_supplements(*)")
        .eq("shop_id", activeShopId)
        .limit(1000);
      if (!cancelled) setRows(data || []);
    })();
    return () => { cancelled = true; };
  }, [activeShopId, version]);

  if (!rows || rows.length === 0) return null;

  const phaseOf = (c: any) => {
    const live = (c.invoices || []).filter((i: any) => !["draft", "cancelled"].includes(i.status));
    const billed = live.reduce((n: number, i: any) => n + Number(i.total || 0), 0);
    const paid = live.reduce((n: number, i: any) => n + (i.payments || []).reduce((t: number, p: any) => t + Number(p.amount || 0), 0), 0);
    const phase = c.total_loss || c.outcome === "perda_total" ? computeTotalLossPhase(c) : computeRepairPhase(c, { sups: c.claim_supplements || [], woDone: ["completed", "done", "delivered", "ready", "invoiced"].includes(c.work_orders?.status), billedAndPaid: billed > 0 && paid >= billed - 0.01 });
    return ["perda_total", "decisao", "encargos"].includes(phase) ? "autorizacao" : phase;
  };
  const items = [
    ...REPAIR_PHASES.map((phase) => ({ label: code === "BR" && phase === "faturacao" ? "Notas fiscais" : REPAIR_PHASE_LABELS[phase], value: rows.filter((c) => phaseOf(c) === phase).length, status: "p:" + phase })),
    ...(code === "BR" ? [] : [{ label: "Prazos em atraso", value: rows.filter((c) => phaseOf(c) !== "fechado" && ptDeadlines(c, c.claim_supplements || []).some((d) => deadlineState(d).overdue)).length, status: "overdue" }]),
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" /> Sinistros
        </h2>
        <Link to="/claims" className="text-sm text-primary hover:underline font-medium flex items-center">
          Ver todos <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {items.map((i) => (
          <Link
            key={i.label}
            to={`/claims?status=${i.status}`}
            className={`rounded-lg border border-border p-3 min-h-[44px] hover:border-primary/50 transition-colors ${i.status === "overdue" ? "text-destructive" : ""}`}
          >
            <p className="text-xl font-bold">{i.value}</p>
            <p className="text-xs text-muted-foreground">{i.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
