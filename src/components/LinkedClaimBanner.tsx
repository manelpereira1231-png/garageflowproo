import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CLAIM_STATUS_LABELS } from "@/lib/claims";

/**
 * Shows the insurance claim linked to a quote or work order, with a link back
 * to it (two-way relation SIN ↔ ORC ↔ OS). Uses the real claims table only.
 */
export default function LinkedClaimBanner({ quoteId, workOrderId }: { quoteId?: string | null; workOrderId?: string | null }) {
  const navigate = useNavigate();
  const [claim, setClaim] = useState<{ id: string; ref: string | null; claim_number: string | null; status: string } | null>(null);

  useEffect(() => {
    const col = quoteId ? "quote_id" : workOrderId ? "work_order_id" : null;
    const val = quoteId || workOrderId;
    if (!col || !val) { setClaim(null); return; }
    let alive = true;
    supabase.from("claims").select("id, ref, claim_number, status").eq(col, val).limit(1).maybeSingle()
      .then(({ data }) => { if (alive) setClaim((data as any) || null); });
    return () => { alive = false; };
  }, [quoteId, workOrderId]);

  if (!claim) return null;
  return (
    <button
      type="button"
      onClick={() => navigate(`/claims/${claim.id}`)}
      className="w-full mb-4 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-left min-h-[44px] hover:bg-primary/15"
    >
      <ShieldAlert className="w-5 h-5 text-primary shrink-0" />
      <span className="text-sm">
        Ligado ao sinistro <strong>{claim.ref || "—"}</strong>
        {claim.claim_number ? <> · Processo {claim.claim_number}</> : null}
        {" · "}{CLAIM_STATUS_LABELS[claim.status] || claim.status}
      </span>
      <span className="ml-auto text-xs text-primary">Abrir sinistro</span>
    </button>
  );
}
