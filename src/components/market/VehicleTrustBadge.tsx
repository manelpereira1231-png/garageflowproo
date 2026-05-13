import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle, History } from "lucide-react";

interface Props {
  vin?: string | null;
  plate?: string | null;
  listingKm?: number | null;
}

interface TrustData {
  trust_level: "none" | "partial" | "verified" | "high" | "flagged";
  visits: number;
  distinct_shops: number;
  has_inspection: boolean;
  last_verified_km?: number | null;
  last_verified_at?: string | null;
  km_inconsistency: boolean;
  km_diff?: number | null;
  timeline: Array<{ date: string; km: number | null; type: string; source: string }>;
}

const LEVELS = {
  high: { color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400", icon: ShieldCheck, label: "Histórico verificado", desc: "Veículo com inspeção certificada e visitas em oficinas." },
  verified: { color: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400", icon: ShieldCheck, label: "Histórico verificado", desc: "Veículo com várias visitas registadas em oficinas." },
  partial: { color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400", icon: ShieldQuestion, label: "Histórico parcial", desc: "Encontradas algumas visitas em oficinas." },
  none: { color: "bg-muted text-muted-foreground border-border", icon: ShieldQuestion, label: "Sem histórico verificado", desc: "Sem registos de oficinas para este veículo." },
  flagged: { color: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400", icon: ShieldAlert, label: "Inconsistência detetada", desc: "Os km do anúncio são inferiores ao último valor verificado." },
} as const;

export const VehicleTrustBadge = ({ vin, plate, listingKm }: Props) => {
  const [data, setData] = useState<TrustData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!vin && !plate) { setLoading(false); return; }
      const { data: r, error } = await supabase.rpc("market_vehicle_trust_check", {
        _vin: vin || null,
        _plate: plate || null,
        _km_listing: listingKm ?? null,
      });
      if (!cancel) {
        if (!error && r) setData(r as unknown as TrustData);
        setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [vin, plate, listingKm]);

  if (loading || !data) return null;

  const meta = LEVELS[data.trust_level] || LEVELS.none;
  const Icon = meta.icon;

  return (
    <Card className={`p-4 border ${meta.color.replace('text-', 'border-l-4 border-l-current text-')}`}>
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{meta.label}</span>
            <Badge variant="outline" className="text-[10px]">
              <History className="h-3 w-3 mr-1" />
              {data.visits} {data.visits === 1 ? "visita" : "visitas"}
              {data.distinct_shops > 1 && ` · ${data.distinct_shops} oficinas`}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{meta.desc}</p>

          {data.km_inconsistency && data.last_verified_km != null && (
            <div className="mt-2 flex items-start gap-2 p-2 rounded bg-red-100/50 dark:bg-red-900/30 text-red-700 dark:text-red-300 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                Último km verificado: <strong>{data.last_verified_km.toLocaleString()} km</strong>
                {data.last_verified_at && <> em {new Date(data.last_verified_at).toLocaleDateString("pt-PT")}</>}
                . Anúncio indica <strong>{listingKm?.toLocaleString()} km</strong>
                {data.km_diff != null && data.km_diff > 0 && <> (diferença de {data.km_diff.toLocaleString()} km abaixo).</>}
              </div>
            </div>
          )}

          {!data.km_inconsistency && data.last_verified_km != null && (
            <p className="text-xs text-muted-foreground mt-2">
              Último km verificado em oficina: <strong>{data.last_verified_km.toLocaleString()} km</strong>
              {data.last_verified_at && <> ({new Date(data.last_verified_at).toLocaleDateString("pt-PT")})</>}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
};

export default VehicleTrustBadge;
