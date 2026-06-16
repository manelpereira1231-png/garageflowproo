import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Store, ShieldCheck, Wrench, Tag, ChevronRight, Loader2 } from "lucide-react";

type Stats = {
  activeListings: number;
  soldListings: number;
  pendingOffers: number;
  activeEscrows: number;
  escrowVolume: number;
  pendingInspections: number;
};

export default function MarketActivityCard({ shopId, userId }: { shopId: string | null; userId: string | null }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMarket, setHasMarket] = useState(false);

  useEffect(() => {
    if (!shopId || !userId) { setLoading(false); return; }
    (async () => {
      const myListings = await supabase.from("carity_listings").select("id, status").eq("shop_id", shopId);
      const listingIds = (myListings.data || []).map((l: any) => l.id);
      const active = (myListings.data || []).filter((l: any) => l.status === "published").length;
      const sold = (myListings.data || []).filter((l: any) => l.status === "sold").length;

      const [offers, escrowList, insp, sellerProfile] = await Promise.all([
        listingIds.length
          ? supabase.from("carity_offers" as any).select("id", { count: "exact", head: true }).eq("status", "pending").in("listing_id", listingIds)
          : Promise.resolve({ count: 0 } as any),
        supabase.from("market_escrow").select("amount, status").eq("seller_id", userId).in("status", ["paid", "delivery_confirmed"]),
        supabase.from("carity_inspection_offers").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", "offered"),
        supabase.from("carity_seller_profiles" as any).select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);

      const isSeller = (sellerProfile.count || 0) > 0 || active > 0 || sold > 0 || (insp.count || 0) > 0;
      setHasMarket(isSeller);

      const escrows = (escrowList.data || []) as any[];
      setStats({
        activeListings: active,
        soldListings: sold,
        pendingOffers: offers.count || 0,
        activeEscrows: escrows.length,
        escrowVolume: escrows.reduce((s, r) => s + Number(r.amount || 0), 0),
        pendingInspections: insp.count || 0,
      });
      setLoading(false);
    })();
  }, [shopId, userId]);

  if (loading) {
    return (
      <div className="card-premium p-5 flex items-center gap-3 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> A carregar atividade Market…
      </div>
    );
  }

  if (!hasMarket) {
    return (
      <div className="card-premium p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Store className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <h3 className="font-semibold text-base">GarageFlow Market — Ganha dinheiro extra</h3>
              <p className="text-sm text-muted-foreground">Aceita pedidos de inspeção pagos de vendedores particulares ou vende viaturas em escrow protegido.</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link to="/market/inspections" className="text-sm font-medium text-amber-500 hover:underline flex items-center gap-1">
              Aceitar inspeções <ChevronRight className="w-4 h-4" />
            </Link>
            <Link to="/market" className="text-xs text-muted-foreground hover:underline flex items-center gap-1">
              Ver Market
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const s = stats!;
  const items = [
    { icon: Tag, label: "Anúncios ativos", value: s.activeListings, link: "/market/my-listings", color: "text-amber-500" },
    { icon: Store, label: "Vendidos", value: s.soldListings, link: "/market/my-listings", color: "text-emerald-500" },
    { icon: ShieldCheck, label: "Escrow ativo", value: `€${s.escrowVolume.toFixed(0)}`, sub: `${s.activeEscrows} transação(ões)`, link: "/market/sales", color: "text-blue-500" },
    { icon: Wrench, label: "Inspeções pendentes", value: s.pendingInspections, link: "/market/inspections", color: "text-purple-500", badge: s.pendingInspections > 0 },
    { icon: Tag, label: "Ofertas a aguardar", value: s.pendingOffers, link: "/market/offers", color: "text-rose-500", badge: s.pendingOffers > 0 },
  ];

  return (
    <div className="card-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Store className="w-5 h-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Atividade Market</h2>
            <p className="text-xs text-muted-foreground">Anúncios, vendas, escrow e inspeções</p>
          </div>
        </div>
        <Link to="/market/dashboard" className="text-xs text-amber-500 hover:underline flex items-center gap-1">
          Abrir Market <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {items.map((it) => (
          <Link
            key={it.label}
            to={it.link}
            className="relative rounded-lg border border-border/60 bg-card/60 hover:bg-muted/40 transition-colors p-3"
          >
            <it.icon className={`w-5 h-5 mb-2 ${it.color}`} />
            <div className="text-xl font-bold tabular-nums">{it.value}</div>
            <div className="text-[11px] text-muted-foreground">{it.label}</div>
            {it.sub && <div className="text-[10px] text-muted-foreground mt-0.5">{it.sub}</div>}
            {it.badge && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
