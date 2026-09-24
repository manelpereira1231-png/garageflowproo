import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { ShieldAlert, ChevronRight } from "lucide-react";
import { CLAIM_GROUPS } from "@/lib/claims";

/**
 * Resumo de processos de seguradoras no Dashboard.
 * Cada número abre a lista /claims já filtrada pelo estado correspondente.
 */
export default function ClaimsSummaryCard() {
  const activeShopId = useActiveShopId();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    if (!activeShopId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("claims")
        .select("id, status, next_action_date")
        .eq("shop_id", activeShopId)
        .limit(1000);
      if (!cancelled) setRows(data || []);
    })();
    return () => { cancelled = true; };
  }, [activeShopId]);

  if (!rows || rows.length === 0) return null;

  const open = rows.filter((c) => !["done", "cancelled"].includes(c.status));
  const today = new Date().toISOString().slice(0, 10);
  const items = [
    { label: "Ativos", value: open.length, status: "all" },
    ...CLAIM_GROUPS.slice(0, 6).map((g) => ({ label: g.label, value: rows.filter((c) => g.statuses.includes(c.status)).length, status: "g:" + g.key })),
    { label: "Atrasados", value: open.filter((c) => c.next_action_date && c.next_action_date < today).length, status: "late" },
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
            className="rounded-lg border border-border p-3 hover:border-primary/50 transition-colors"
          >
            <p className="text-xl font-bold">{i.value}</p>
            <p className="text-xs text-muted-foreground">{i.label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
