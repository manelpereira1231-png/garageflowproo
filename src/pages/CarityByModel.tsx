import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Car, ArrowLeft, ArrowRight, CheckCircle, Wrench } from "lucide-react";
import { MarketListingGridSkeleton } from "@/components/MarketListingCardSkeleton";
import { formatMarketPrice } from "@/lib/marketPrice";
import SEOHead from "@/components/SEOHead";

/**
 * SEO route: /market/modelo/:make/:model
 * Example: /market/modelo/bmw/serie-3
 */
export default function CarityByModel() {
  const { make, model } = useParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgPrice: 0, avgYear: 0, avgKm: 0 });

  const decodedMake = decodeURIComponent(make || "");
  const decodedModel = decodeURIComponent(model || "").replace(/-/g, " ");
  const cap = (s: string) => s.replace(/\b\w/g, (c) => c.toUpperCase());
  const titleMake = cap(decodedMake);
  const titleModel = cap(decodedModel);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos, published_at, boost_active, shop_id")
      .eq("status", "published")
      .ilike("make", decodedMake)
      .ilike("model", `%${decodedModel}%`)
      .order("published_at", { ascending: false });

    const raw = (data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] }));

    if (raw.length > 0) {
      const totalPrice = raw.reduce((s: number, l: any) => s + (l.price || 0), 0);
      const totalYear = raw.reduce((s: number, l: any) => s + (l.year || 0), 0);
      const totalKm = raw.reduce((s: number, l: any) => s + (l.mileage || 0), 0);
      setStats({
        avgPrice: Math.round(totalPrice / raw.length),
        avgYear: Math.round(totalYear / raw.length),
        avgKm: Math.round(totalKm / raw.length),
      });
    }

    const shopIds = [...new Set(raw.filter((l: any) => l.shop_id).map((l: any) => l.shop_id))];
    let shopMap: Record<string, string> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabase.from("shops").select("id, name").in("id", shopIds);
      (shops || []).forEach((s: any) => { shopMap[s.id] = s.name; });
    }

    const ids = raw.map((l: any) => l.id);
    let scoreMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: reports } = await supabase.from("carity_inspection_reports_public" as any).select("listing_id, overall_score").in("listing_id", ids);
      (reports || []).forEach((r: any) => { scoreMap[r.listing_id] = r.overall_score; });
    }

    setListings(raw.map((l: any) => ({
      ...l,
      shop_name: l.shop_id ? shopMap[l.shop_id] : undefined,
      inspection_score: scoreMap[l.id] ?? null,
    })));
    setLoading(false);
  }, [decodedMake, decodedModel]);

  const seoTitle = `${titleMake} ${titleModel} usado com inspeção certificada — GarageFlow Market`;
  const seoDesc = `Compre ${titleMake} ${titleModel} usado com inspeção mecânica real, relatório técnico completo e pagamento protegido. Veículos certificados por oficinas parceiras GarageFlow.`;

  useEffect(() => {
    loadData();
  }, [decodedMake, decodedModel, loadData, titleMake, titleModel]);

  const listingUrl = (l: any) => {
    const slug = `${l.make}-${l.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    return `/market/carros/${slug}-${l.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead realm="market" title={seoTitle} description={seoDesc} path={`/market/modelo/${encodeURIComponent(decodedMake)}/${encodeURIComponent(decodedModel.replace(/\s+/g, "-"))}`} />
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
        <nav className="text-xs text-muted-foreground mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5 flex-wrap">
            <li><Link to="/market" className="hover:text-foreground transition-colors">GarageFlow Market</Link></li>
            <li>/</li>
            <li><Link to={`/market/make/${encodeURIComponent(decodedMake)}`} className="hover:text-foreground transition-colors">{titleMake}</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{titleModel}</li>
          </ol>
        </nav>

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{titleMake} {titleModel} Usados Inspecionados</h1>
        <p className="text-muted-foreground mb-6 max-w-2xl leading-relaxed">
          Veículos {titleMake} {titleModel} com inspeção presencial obrigatória, relatório mecânico de 0–10 e pagamento protegido por escrow.
        </p>

        {/* Stats bar */}
        {!loading && listings.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-8 max-w-2xl">
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Preço médio</p>
              <p className="text-lg font-bold">{formatMarketPrice(stats.avgPrice)}</p>
            </div>
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Ano médio</p>
              <p className="text-lg font-bold">{stats.avgYear}</p>
            </div>
            <div className="border rounded-lg p-3 bg-muted/30">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Km médios</p>
              <p className="text-lg font-bold">{stats.avgKm.toLocaleString()}</p>
            </div>
          </div>
        )}

        {loading ? (
          <MarketListingGridSkeleton count={6} />
        ) : listings.length === 0 ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Car className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum {titleMake} {titleModel} disponível</h3>
              <p className="text-muted-foreground mb-6">Crie um alerta para receber uma notificação assim que aparecer.</p>
              <div className="flex justify-center gap-2">
                <Link to={`/market/make/${encodeURIComponent(decodedMake)}`}>
                  <Button variant="outline">Ver todos os {titleMake}</Button>
                </Link>
                <Link to="/market">
                  <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                    Voltar ao marketplace <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <Link key={listing.id} to={listingUrl(listing)}>
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-0 shadow-sm">
                  <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                    {listing.photos[0] ? (
                      <img src={listing.photos[0]} alt={`${listing.make} ${listing.model} ${listing.year}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
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

      <footer className="py-8 border-t bg-slate-950 text-slate-400 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <span>GarageFlow Market by <a href="/" target="_blank" rel="noopener" className="text-amber-400 hover:underline">GarageFlow</a></span>
          </div>
          <p>© {new Date().getFullYear()} GarageFlow. Todos os direitos reservados.</p>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "GarageFlow Market", "item": "https://garageflow.pt/market" },
          { "@type": "ListItem", "position": 2, "name": titleMake, "item": `https://garageflow.pt/market/make/${encodeURIComponent(decodedMake)}` },
          { "@type": "ListItem", "position": 3, "name": titleModel, "item": `https://garageflow.pt/market/modelo/${encodeURIComponent(decodedMake)}/${encodeURIComponent(model || "")}` },
        ]
      })}} />
      {listings.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": `${titleMake} ${titleModel} Usados — GarageFlow Market`,
          "numberOfItems": listings.length,
          "itemListElement": listings.slice(0, 20).map((l: any, i: number) => ({
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
