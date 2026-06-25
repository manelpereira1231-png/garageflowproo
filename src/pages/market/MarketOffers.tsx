import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Loader2, Tag } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";

type Offer = {
  id: string;
  status: string;
  offered_at: string;
  listing: {
    id: string;
    make: string | null;
    model: string | null;
    year: number | null;
  } | null;
};

const STATUS_LABEL: Record<string, { label: string; variant: any }> = {
  pending: { label: "Pendente", variant: "secondary" },
  offered: { label: "Enviada", variant: "default" },
  accepted: { label: "Aceite", variant: "default" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  expired: { label: "Expirada", variant: "outline" },
};

export default function MarketOffers() {
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Offer[]>([]);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("carity_inspection_offers")
        .select("id, status, offered_at, listing:carity_listings(id, make, model, year)")
        .eq("shop_id", shopId)
        .order("offered_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      if (error) console.error("[MarketOffers]", error);
      setItems((data as any) || []);
      setLoading(false);
    };
    setLoading(true);
    load();
    const ch = supabase
      .channel(`market-offers-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carity_inspection_offers", filter: `shop_id=eq.${shopId}` }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); clearInterval(iv); };
  }, [shopId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Propostas Market</h1>
        <p className="text-sm text-muted-foreground">Propostas de inspeção enviadas pela tua oficina.</p>
      </div>

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> A carregar propostas…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="📨"
          title="Sem propostas ainda"
          description="As tuas propostas a pedidos de inspeção do Market aparecem aqui."
        />
      ) : (
        <div className="grid gap-2">
          {items.map((it) => {
            const meta = STATUS_LABEL[it.status] || { label: it.status, variant: "outline" };
            return (
              <div key={it.id} className="card-premium p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                    <Tag className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {it.listing?.make || "Veículo"} {it.listing?.model || ""} {it.listing?.year ? `(${it.listing.year})` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(it.offered_at).toLocaleDateString("pt-PT")}
                    </div>
                  </div>
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
