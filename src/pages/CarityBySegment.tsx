import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Car, ArrowLeft, ArrowRight, Wrench } from "lucide-react";
import { formatMarketPrice } from "@/lib/marketPrice";
import SEOHead from "@/components/SEOHead";

// Segment -> list of model keywords commonly matching that body type (PT/EU market focus)
const SEGMENTS: Record<string, { label: string; keywords: string[] }> = {
  suv: { label: "SUV", keywords: ["qashqai", "captur", "kuga", "tucson", "sportage", "x-trail", "rav4", "cr-v", "tiguan", "x1", "x3", "x5", "q3", "q5", "q7", "gla", "glc", "gle", "macan", "evoque", "discovery", "duster", "kadjar", "arkana", "yeti", "kodiaq", "karoq", "ateca", "tarraco", "3008", "5008", "2008"] },
  citadino: { label: "Citadino", keywords: ["clio", "208", "polo", "fiesta", "corsa", "ibiza", "fabia", "yaris", "jazz", "micra", "swift", "panda", "500", "twingo", "up", "i10", "i20", "picanto", "aygo", "c1"] },
  carrinha: { label: "Carrinha (Station)", keywords: ["passat variant", "octavia combi", "a4 avant", "a6 avant", "3 series touring", "c-class estate", "e-class estate", "v60", "v70", "v90", "megane sw", "308 sw", "leon st"] },
  monovolume: { label: "Monovolume", keywords: ["scenic", "touran", "sharan", "alhambra", "verso", "c4 picasso", "c4 spacetourer", "grand scenic", "5008", "zafira"] },
  comercial: { label: "Comercial / Carrinha", keywords: ["partner", "berlingo", "kangoo", "caddy", "transporter", "vito", "trafic", "vivaro", "expert", "jumpy", "talento", "doblo", "combo"] },
  desportivo: { label: "Desportivo / Coupé", keywords: ["m3", "m4", "m5", "rs3", "rs4", "rs6", "amg", "tt", "cayman", "boxster", "911", "supra", "gtr", "type r", "golf r", "golf gti", "leon cupra", "megane rs", "civic type r"] },
};

export default function CarityBySegment() {
  const { segment } = useParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const seg = (segment || "").toLowerCase();
  const config = SEGMENTS[seg];
  const label = config?.label || seg;

  const loadData = useCallback(async () => {
    if (!config) { setListings([]); setLoading(false); return; }
    const orFilter = config.keywords.map(k => `model.ilike.%${k}%`).join(",");
    const { data } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos, status, published_at, boost_active, shop_id")
      .eq("status", "published")
      .or(orFilter)
      .order("published_at", { ascending: false });

    const rawListings = (data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] }));
    const shopIds = [...new Set(rawListings.filter(l => l.shop_id).map(l => l.shop_id))];
    let shopMap: Record<string, string> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabase.from("shops").select("id, name").in("id", shopIds);
      (shops || []).forEach((s: any) => { shopMap[s.id] = s.name; });
    }
    setListings(rawListings.map(l => ({ ...l, shop_name: l.shop_id ? shopMap[l.shop_id] : undefined })));
    setLoading(false);
  }, [seg, config]);

  useEffect(() => { loadData(); }, [seg, loadData]);

  const seoTitle = `${label} Usados Inspecionados — GarageFlow Market`;
  const seoDesc = `Compre ${label.toLowerCase()} usados com inspeção mecânica real por oficinas certificadas. Relatório técnico completo e pagamento protegido.`;

  const listingUrl = (l: any) => {
    const slug = `${l.make}-${l.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    return `/market/carros/${slug}-${l.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead realm="market" title={seoTitle} description={seoDesc} path={`/market/segmento/${seg}`} />
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

        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-2">{label} Inspecionados</h1>
        <p className="text-muted-foreground mb-8 max-w-2xl">Veículos do segmento {label.toLowerCase()} submetidos a inspeção mecânica certificada por oficinas parceiras.</p>

        {!config ? (
          <Card><CardContent className="py-16 text-center"><p className="text-muted-foreground">Segmento não reconhecido.</p></CardContent></Card>
        ) : loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : listings.length === 0 ? (
          <Card><CardContent className="py-16 text-center">
            <Car className="h-14 w-14 mx-auto text-muted-foreground/20 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Sem {label.toLowerCase()} disponíveis</h3>
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
          { "@type": "ListItem", "position": 2, "name": label, "item": `https://garageflow.pt/market/segmento/${seg}` },
        ]
      })}} />
    </div>
  );
}
