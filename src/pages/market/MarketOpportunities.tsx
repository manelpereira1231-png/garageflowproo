import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Loader2, Clock, MapPin, Car, ChevronRight } from "lucide-react";
import EmptyState from "@/components/EmptyState";

type Opportunity = {
  id: string;
  status: string;
  created_at: string;
  listing: {
    id: string;
    make: string | null;
    model: string | null;
    year: number | null;
    city: string | null;
  } | null;
};

export default function MarketOpportunities() {
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Opportunity[]>([]);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      // Inspection offers addressed to this shop, still pending acceptance.
      const { data } = await supabase
        .from("carity_inspection_offers")
        .select("id, status, created_at, listing:carity_listings(id, make, model, year, city)")
        .eq("shop_id", shopId)
        .in("status", ["pending", "offered"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (cancelled) return;
      setItems((data as any) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Oportunidades Market</h1>
        <p className="text-sm text-muted-foreground">Pedidos de inspeção em aberto para a tua oficina.</p>
      </div>

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> A carregar oportunidades…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Sem oportunidades neste momento"
          description="Assim que houver pedidos de inspeção compatíveis com a tua oficina, aparecem aqui."
        />
      ) : (
        <div className="grid gap-3">
          {items.map((it) => (
            <Link
              key={it.id}
              to="/market/inspections"
              className="card-premium p-4 flex items-center justify-between hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Car className="w-5 h-5 text-amber-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {it.listing?.make || "Veículo"} {it.listing?.model || ""} {it.listing?.year ? `(${it.listing.year})` : ""}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                    {it.listing?.city && (
                      <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {it.listing.city}</span>
                    )}
                    <span>{new Date(it.created_at).toLocaleDateString("pt-PT")}</span>
                  </div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
