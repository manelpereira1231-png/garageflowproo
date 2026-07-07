import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Car, ArrowLeft, ArrowRight, CheckCircle, Wrench } from "lucide-react";
import { formatMarketPrice } from "@/lib/marketPrice";
import SEOHead from "@/components/SEOHead";

const FUEL_LABELS: Record<string, string> = {
  gasolina: "Gasolina",
  diesel: "Diesel",
  gasoleo: "Diesel",
  hibrido: "Híbrido",
  eletrico: "Elétrico",
  gpl: "GPL",
};

export default function CarityByFuel() {
  const { fuel } = useParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const decoded = decodeURIComponent(fuel || "").toLowerCase();
  const label = FUEL_LABELS[decoded] || (decoded.charAt(0).toUpperCase() + decoded.slice(1));

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos, status, published_at, boost_active, shop_id")
      .eq("status", "published")
      .ilike("fuel", `%${decoded}%`)
      .order("published_at", { ascending: false });

    const rawListings = (data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] }));
    const shopIds = [...new Set(rawListings.filter(l => l.shop_id).map(l => l.shop_id))];
    let shopMap: Record<string, string> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabase.from("shops").select("id, name").in("id", shopIds);
      (shops || []).forEach((s: any) => { shopMap[s.id] = s.name; });
    }
    const ids = rawListings.map(l => l.id);
    let scoreMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: reports } = await supabase.from("carity_inspection_reports_public" as any).select("listing_id, overall_score").in("listing_id", ids);
      (reports || []).forEach((r: any) => { scoreMap[r.listing_id] = r.overall_score; });
    }
    setListings(rawListings.map(l => ({
      ...l,
      shop_name: l.shop_id ? shopMap[l.shop_id] : undefined,
      inspection_score: scoreMap[l.id] ?? null,
    })));
    setLoading(false);
  }, [decoded]);

  useEffect(() => { loadData(); }, [decoded, loadData]);

  const seoTitle = `Carros ${label} Usados Inspecionados — GarageFlow Market`;
  const seoDesc = `Compre carros ${label.toLowerCase()} usados com inspeção mecânica certificada por oficinas. Relatório técnico, score 0-10 e pagamento protegido.`;

  const listingUrl = (l: any) => {
    const slug = `${l.make}-${l.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    return `/market/carros/${slug}-${l.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead realm="market" title={seoTitle} description={seoDesc} path={`/market/combustivel/${encodeURIComponent(decoded)}`} />
      <nav className="bg-gradient-to-r from-slate-950 to-slate-900 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-amber-400" />
            <span className="text-xl font-bold tracking-tight">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <Link to="/market"><Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-10">
        <nav className="text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/market" className="hover:text-foreground">GarageFlow Market</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{label}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">Carros {label} Inspecionados</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">Todos os veículos {label.toLowerCase()} publicados foram submetidos a inspeção mecânica presencial por oficinas certificadas.</p>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : listings.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <Car className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum {label} disponível</h3>
            <Link to="/market/sell"><Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">Vender o meu carro <ArrowRight className="ml-2 h-4 w-4" /></Button></Link>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => (
              <Link key={listing.id} to={listingUrl(listing)}>
                <Card className="overflow-hidden hover:shadow-xl transition-all cursor-pointer group border-0 shadow-sm">
                  <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                    {listing.photos[0] ? (
                      <img src={listing.photos[0]} alt={`${listing.make} ${listing.model} ${listing.year} ${label}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : <div className="flex items-center justify-center h-full bg-slate-100"><Car className="h-12 w-12 text-muted-foreground/20" /></div>}
                    <div className="absolute top-3 left-3">
                      <Badge className="bg-white/95 text-slate-800 border-0 text-[11px] font-semibold"><ShieldCheck className="h-3 w-3 mr-1 text-green-600" /> Inspecionado</Badge>
                    </div>
                    <div className="absolute bottom-3 right-3">
                      <span className="bg-white/95 text-slate-900 font-bold text-lg px-3 py-1 rounded-lg">{formatMarketPrice(listing.price)}</span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-base">{listing.make} {listing.model}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 mb-2">
                      <span>{listing.year}</span><span>·</span><span>{listing.mileage?.toLocaleString()} km</span><span>·</span><span>{listing.fuel}</span>
                    </div>
                    {listing.shop_name && <p className="text-[11px] text-muted-foreground flex items-center gap-1"><Wrench className="h-3 w-3" /> Inspecionado por <span className="font-medium text-foreground">{listing.shop_name}</span></p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "GarageFlow Market", "item": "https://garageflow.pt/market" },
          { "@type": "ListItem", "position": 2, "name": label, "item": `https://garageflow.pt/market/combustivel/${encodeURIComponent(decoded)}` },
        ]
      })}} />
    </div>
  );
}
