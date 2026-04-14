import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Car, Fuel, Calendar, Gauge, ArrowLeft } from "lucide-react";

export default function CarityByCity() {
  const { city } = useParams();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const decodedCity = decodeURIComponent(city || "");

  useEffect(() => {
    document.title = `Carros Usados em ${decodedCity} — Carity`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", `Carros usados certificados em ${decodedCity}. Todos inspecionados por oficinas profissionais. Compre com confiança no Carity.`);

    const load = async () => {
      // City filtering uses seller profile location
      const { data: sellers } = await supabase
        .from("carity_seller_profiles")
        .select("user_id")
        .ilike("location", `%${decodedCity}%`);

      const sellerIds = (sellers || []).map(s => s.user_id);

      if (sellerIds.length === 0) {
        setListings([]);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("carity_listings")
        .select("*")
        .eq("status", "published")
        .in("seller_id", sellerIds)
        .order("published_at", { ascending: false });

      setListings((data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] })));
      setLoading(false);
    };
    load();
  }, [decodedCity]);

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link to="/carity" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">Carity</span>
          </Link>
          <Link to="/carity"><Button variant="ghost" size="sm" className="text-slate-300"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button></Link>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">Carros Usados em {decodedCity}</h1>
        <p className="text-muted-foreground mb-8">Veículos certificados por oficinas na zona de {decodedCity}.</p>

        {loading ? (
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>
        ) : listings.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <Car className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Ainda não existem carros certificados em {decodedCity}. <Link to="/carity/vender" className="text-amber-500 hover:underline">Seja o primeiro!</Link></p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map(listing => (
              <Link key={listing.id} to={`/carity/carro/${listing.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow group cursor-pointer">
                  <div className="aspect-[16/10] bg-muted overflow-hidden relative">
                    {listing.photos[0] ? <img src={listing.photos[0]} alt={`${listing.make} ${listing.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" /> : <div className="flex items-center justify-center h-full"><Car className="h-10 w-10 text-muted-foreground/30" /></div>}
                    {listing.boost_active && <Badge className="absolute top-2 left-2 bg-purple-500 text-white">⚡ Destaque</Badge>}
                    <Badge className="absolute top-2 right-2 bg-green-600 text-white border-0">✓ Certificado</Badge>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg">{listing.make} {listing.model}</h3>
                    <div className="flex gap-3 text-xs text-muted-foreground mt-1 mb-3">
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{listing.year}</span>
                      <span className="flex items-center gap-1"><Gauge className="h-3 w-3" />{listing.mileage?.toLocaleString()} km</span>
                      <span className="flex items-center gap-1"><Fuel className="h-3 w-3" />{listing.fuel}</span>
                    </div>
                    <p className="text-xl font-bold text-amber-500">€{listing.price?.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
