import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ShieldAlert } from "lucide-react";
import { CLAIM_STATUS_LABELS, claimStatusTone } from "@/lib/claims";

/**
 * Histórico de sinistros de um cliente ou de uma viatura.
 * Reutilizado na ficha do cliente e no passaporte da viatura.
 */
export default function ClaimsHistory({
  clientId,
  vehicleId,
  title = "Histórico de sinistros",
}: {
  clientId?: string;
  vehicleId?: string;
  title?: string;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<any[] | null>(null);

  useEffect(() => {
    if (!clientId && !vehicleId) return;
    let cancelled = false;
    (async () => {
      let q = supabase
        .from("claims")
        .select("id, claim_number, status, claim_date, insurers(name), vehicles(plate)")
        .order("created_at", { ascending: false })
        .limit(50);
      if (vehicleId) q = q.eq("vehicle_id", vehicleId);
      else if (clientId) q = q.eq("client_id", clientId);
      const { data } = await q;
      if (!cancelled) setRows(data || []);
    })();
    return () => { cancelled = true; };
  }, [clientId, vehicleId]);

  if (!rows) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-semibold flex items-center gap-2 text-sm">
        <ShieldAlert className="w-4 h-4 text-primary" /> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem sinistros registados.</p>
      ) : (
        rows.map((c) => (
          <button
            key={c.id}
            onClick={() => navigate(`/claims/${c.id}`)}
            className="w-full text-left rounded-lg border border-border p-3 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-sm">{c.claim_number || "Sem nº"}</span>
              <Badge variant="outline" className={claimStatusTone(c.status)}>
                {CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS] || c.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {[c.insurers?.name, c.vehicles?.plate, c.claim_date].filter(Boolean).join(" · ")}
            </p>
          </button>
        ))
      )}
    </div>
  );
}
