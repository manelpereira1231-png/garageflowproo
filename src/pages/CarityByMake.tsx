import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Car, Fuel, Calendar, Gauge, ArrowLeft, ArrowRight, CheckCircle, Wrench } from "lucide-react";
import { formatMarketPrice } from "@/lib/marketPrice";
import SEOHead from "@/components/SEOHead";

export default function CarityByMake() {
  const { make } = useParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const decodedMake = decodeURIComponent(make || "");
  const capitalMake = decodedMake.charAt(0).toUpperCase() + decodedMake.slice(1);

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos, status, published_at, boost_active, shop_id")
      .eq("status", "published")
      .ilike("make", decodedMake)
      .order("published_at", { ascending: false });

    const rawListings = (data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] }));

    // Get shop names
    const shopIds = [...new Set(rawListings.filter(l => l.shop_id).map(l => l.shop_id))];
    let shopMap: Record<string, string> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabase.from("shops").select("id, name").in("id", shopIds);
      (shops || []).forEach((s: any) => { shopMap[s.id] = s.name; });
    }

    // Get inspection scores
    const ids = rawListings.map(l => l.id);
    let scoreMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: reports } = await supabase.from("carity_inspection_reports").select("listing_id, overall_score").in("listing_id", ids);
      (reports || []).forEach((r: any) => { scoreMap[r.listing_id] = r.overall_score; });
    }

    setListings(rawListings.map(l => ({
      ...l,
      shop_name: l.shop_id ? shopMap[l.shop_id] : undefined,
      inspection_score: scoreMap[l.id] ?? null,
    })));
    setLoading(false);
  }, [decodedMake]);

  const seoTitle = `${capitalMake} Usados com Inspeção Certificada — GarageFlow Market`;
  const seoDesc = `Compre ${capitalMake} usados com inspeção mecânica real por oficinas certificadas. Relatório técnico completo, classificação de 0 a 10 e pagamento protegido. GarageFlow Market.`;

  useEffect(() => {
    loadData();
  }, [decodedMake, loadData]);

  const listingUrl = (l: any) => {
    const slug = `${l.make}-${l.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    return `/market/carros/${slug}-${l.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead realm="market" title={seoTitle} description={seoDesc} path={`/market/make/${encodeURIComponent(decodedMake)}`} />
      <nav className="bg-gradient-to-r from-slate-950 to-slate-900 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-7 w-7 text-amber-400" />
            <span className="text-xl font-bold tracking-tight">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <Link to="/market">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-10">
        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/market" className="hover:text-foreground transition-colors">GarageFlow Market</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{capitalMake}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{capitalMake} Usados Inspecionados</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl leading-relaxed">
          Todos os veículos {capitalMake} publicados no GarageFlow Market foram submetidos a inspeção mecânica presencial por oficinas parceiras certificadas.
        </p>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : listings.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Car className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum {capitalMake} disponível</h3>
              <p className="text-muted-foreground mb-6">Ainda não há veículos {capitalMake} certificados no marketplace.</p>
              <Link to="/market/sell">
                <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                  Vender o meu {capitalMake} <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => (
              <Link key={listing.id} to={listingUrl(listing)}>
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-0 shadow-sm">
                  <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                    {listing.photos[0] ? (
                      <img src={listing.photos[0]} alt={`${listing.make} ${listing.model} ${listing.year} — carro usado inspecionado`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800"><Car className="h-12 w-12 text-muted-foreground/20" /></div>
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
                    {listing.boost_active && (
                      <Badge className="absolute bottom-3 left-3 bg-purple-600/90 text-white border-0 backdrop-blur-sm text-[10px]">Destaque</Badge>
                    )}
                    <div className="absolute bottom-3 right-3">
                      <span className="bg-white/95 backdrop-blur-sm text-slate-900 font-bold text-lg px-3 py-1 rounded-lg shadow-sm">
                        {formatMarketPrice(listing.price)}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-base leading-tight">{listing.make} {listing.model}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 mb-2">
                      <span>{listing.year}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{listing.mileage?.toLocaleString()} km</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{listing.fuel}</span>
                    </div>
                    {listing.inspection_score != null && (
                      <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2 ${
                        listing.inspection_score >= 80 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        listing.inspection_score >= 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                        'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        <CheckCircle className="h-3 w-3" />
                        {listing.inspection_score >= 80 ? 'Excelente estado mecânico' : listing.inspection_score >= 60 ? 'Bom estado geral' : 'Necessita intervenção'}
                      </div>
                    )}
                    {listing.shop_name && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <Wrench className="h-3 w-3 text-slate-400" />
                        Inspecionado por <span className="font-medium text-foreground">{listing.shop_name}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="py-8 border-t bg-slate-950 text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <span>GarageFlow Market by <a href="/" target="_blank" rel="noopener" className="text-amber-400 hover:underline">GarageFlow</a></span>
          </div>
          <p>© {new Date().getFullYear()} GarageFlow. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* JSON-LD BreadcrumbList + ItemList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "GarageFlow Market", "item": "https://garageflow.pt/market" },
          { "@type": "ListItem", "position": 2, "name": capitalMake, "item": `https://garageflow.pt/market/make/${encodeURIComponent(decodedMake)}` },
        ]
      })}} />
      {listings.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": `${capitalMake} Usados — GarageFlow Market`,
          "numberOfItems": listings.length,
          "itemListElement": listings.slice(0, 20).map((l, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "url": `https://garageflow.pt/market/carros/${l.make.toLowerCase()}-${l.model.toLowerCase().replace(/\s+/g, "-")}-${l.id}`,
            "name": `${l.make} ${l.model} ${l.year}`,
          })),
        })}} />
      )}
    </div>
  );
}
