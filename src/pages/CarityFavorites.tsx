import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MarketLayout from "@/components/MarketLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Car, ShieldCheck, ArrowRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MarketListingGridSkeleton } from "@/components/MarketListingCardSkeleton";

export default function CarityFavorites() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth?redirect=/market/favoritos"); return; }

    const { data: favs } = await supabase
      .from("listing_favorites" as any)
      .select("listing_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    const ids = (favs || []).map((f: any) => f.listing_id);
    if (ids.length === 0) { setItems([]); setLoading(false); return; }

    const { data: listings } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos, status, shop_id")
      .in("id", ids);

    const shopIds = [...new Set((listings || []).filter((l: any) => l.shop_id).map((l: any) => l.shop_id))];
    let shopMap: Record<string, string> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabase.from("shops").select("id, name").in("id", shopIds);
      (shops || []).forEach((s: any) => { shopMap[s.id] = s.name; });
    }

    let scoreMap: Record<string, number> = {};
    const { data: reports } = await supabase.from("carity_inspection_reports").select("listing_id, overall_score").in("listing_id", ids);
    (reports || []).forEach((r: any) => { scoreMap[r.listing_id] = r.overall_score; });

    setItems((listings || []).map((l: any) => ({
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : [],
      shop_name: l.shop_id ? shopMap[l.shop_id] : undefined,
      inspection_score: scoreMap[l.id] ?? null,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const remove = async (listingId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("listing_favorites" as any).delete().eq("listing_id", listingId).eq("user_id", user.id);
    setItems((prev) => prev.filter((i) => i.id !== listingId));
    toast.success("Removido dos favoritos");
  };

  return (
    <MarketLayout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Heart className="h-5 w-5 text-red-500 fill-red-500" /> Os meus favoritos
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Carros guardados para acompanhar.</p>
        </div>
        <Badge variant="outline">{items.length} {items.length === 1 ? "carro" : "carros"}</Badge>
      </div>

      {loading ? (
        <MarketListingGridSkeleton count={3} />
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Heart className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Ainda não tem favoritos</h3>
            <p className="text-muted-foreground mb-6">Toque no coração nos anúncios que lhe interessam para os guardar aqui.</p>
            <Link to="/market">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                Explorar marketplace <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((listing) => (
            <Card key={listing.id} className="overflow-hidden border-0 shadow-sm hover:shadow-xl transition-all duration-300 group">
              <Link to={`/market/car/${listing.id}`}>
                <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                  {listing.photos[0] ? (
                    <img src={listing.photos[0]} alt={`${listing.make} ${listing.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Car className="h-12 w-12 text-muted-foreground/20" /></div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-white/95 text-slate-800 border-0 shadow-sm text-[11px] font-semibold backdrop-blur-sm">
                      <ShieldCheck className="h-3 w-3 mr-1 text-green-600" /> Inspecionado
                    </Badge>
                  </div>
                  {listing.inspection_score != null && (
                    <div className={`absolute top-3 right-3 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shadow-lg ${
                      listing.inspection_score >= 80 ? 'bg-green-500 text-white' :
                      listing.inspection_score >= 60 ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {(listing.inspection_score / 10).toFixed(1)}
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3">
                    <span className="bg-white/95 backdrop-blur-sm text-slate-900 font-bold text-lg px-3 py-1 rounded-lg shadow-sm">
                      €{listing.price?.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-bold text-base leading-tight">{listing.make} {listing.model}</h3>
                  <button
                    onClick={() => remove(listing.id)}
                    className="text-muted-foreground hover:text-red-500 transition-colors"
                    aria-label="Remover dos favoritos"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{listing.year} · {listing.mileage?.toLocaleString()} km · {listing.fuel}</p>
                {listing.shop_name && (
                  <p className="text-[11px] text-muted-foreground mt-1">Inspecionado por <span className="font-medium text-foreground">{listing.shop_name}</span></p>
                )}
                {listing.status !== "published" && (
                  <Badge variant="outline" className="mt-2 text-[10px] text-amber-600 border-amber-200">
                    {listing.status === "sold" ? "Vendido" : "Não disponível"}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </MarketLayout>
  );
}
