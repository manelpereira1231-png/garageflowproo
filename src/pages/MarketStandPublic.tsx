import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Car, ShieldCheck, ArrowLeft, Phone } from "lucide-react";
import SEOHead from "@/components/SEOHead";

interface Dealer {
  user_id: string;
  dealer_company_name: string;
  dealer_logo_url: string | null;
  dealer_city: string | null;
  dealer_description: string | null;
  phone?: string | null;
}

interface Listing {
  id: string; make: string; model: string; year: number; price: number;
  mileage: number; photos: any; location_label: string | null; fuel: string;
}

export default function MarketStandPublic() {
  const { slug } = useParams();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    (async () => {
      const { data: d } = await supabase
        .from("carity_seller_profiles_public" as any)
        .select("user_id, dealer_company_name, dealer_logo_url, dealer_city, dealer_description, phone")
        .eq("dealer_slug", slug)
        .eq("account_type", "dealer")
        .maybeSingle();

      if (d) {
        setDealer(d as any);
        const { data: l } = await supabase
          .from("carity_listings")
          .select("id, make, model, year, price, mileage, photos, location_label, fuel")
          .eq("seller_id", (d as any).user_id)
          .eq("status", "published")
          .order("created_at", { ascending: false });
        setListings((l as any) || []);
      }
      setLoading(false);
    })();
  }, [slug]);

  if (loading) {
    return <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">A carregar…</div>;
  }
  if (!dealer) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center flex-col gap-4">
        <p>Stand não encontrado.</p>
        <Link to="/market/stands"><Button variant="outline">Ver outros stands</Button></Link>
      </div>
    );
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: dealer.dealer_company_name,
    image: dealer.dealer_logo_url,
    address: dealer.dealer_city ? { "@type": "PostalAddress", addressLocality: dealer.dealer_city, addressCountry: "PT" } : undefined,
    description: dealer.dealer_description || `Stand de carros usados com inspeção independente garantida pela GarageFlow.`,
    url: `https://www.garageflow.pt/market/stand/${slug}`,
    makesOffer: listings.slice(0, 20).map(l => ({
      "@type": "Offer", itemOffered: { "@type": "Car", name: `${l.make} ${l.model}`, modelDate: l.year },
      price: l.price, priceCurrency: "EUR",
    })),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <SEOHead
        realm="market"
        title={`${dealer.dealer_company_name} — Carros usados${dealer.dealer_city ? ` em ${dealer.dealer_city}` : ""} | GarageFlow Market`}
        description={`${listings.length} carros usados ${dealer.dealer_city ? `em ${dealer.dealer_city} ` : ""}com inspeção independente verificada. ${dealer.dealer_company_name} no GarageFlow Market.`}
        jsonLd={jsonLd}
      />

      <div className="max-w-6xl mx-auto px-4 py-6">
        <Link to="/market/stands" className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-amber-300 mb-6">
          <ArrowLeft className="h-4 w-4" /> Todos os stands
        </Link>

        {/* Hero */}
        <Card className="bg-slate-800/60 border-slate-700 p-6 md:p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {dealer.dealer_logo_url ? (
              <img src={dealer.dealer_logo_url} alt={dealer.dealer_company_name} className="h-24 w-24 rounded-xl object-cover" />
            ) : (
              <div className="h-24 w-24 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Building2 className="h-10 w-10 text-amber-400" />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold mb-2">{dealer.dealer_company_name}</h1>
              <div className="flex flex-wrap gap-3 mb-3">
                {dealer.dealer_city && (
                  <span className="text-sm text-slate-300 flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-amber-400" /> {dealer.dealer_city}
                  </span>
                )}
                <span className="text-sm text-slate-300 flex items-center gap-1">
                  <Car className="h-4 w-4 text-amber-400" /> {listings.length} carros disponíveis
                </span>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-400/40">
                  <ShieldCheck className="h-3 w-3 mr-1" /> Inspeções independentes
                </Badge>
              </div>
              {dealer.dealer_description && (
                <p className="text-slate-400 text-sm">{dealer.dealer_description}</p>
              )}
            </div>
          </div>
          <div className="mt-5 p-4 rounded-lg bg-amber-500/10 border border-amber-400/30 text-sm text-amber-100">
            <strong>Garantia GarageFlow:</strong> todos os carros deste stand são inspecionados por uma oficina <strong>independente</strong>
            da nossa rede. O stand não tem acesso ao relatório e não pode mentir sobre o estado do veículo.
          </div>
        </Card>

        {/* Listings */}
        <h2 className="text-xl font-semibold mb-4">Carros à venda</h2>
        {listings.length === 0 ? (
          <Card className="bg-slate-800/40 border-slate-700 p-8 text-center text-slate-400">
            Sem carros publicados de momento.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => {
              const photos = Array.isArray(l.photos) ? l.photos : [];
              return (
                <Link key={l.id} to={`/market/car/${l.id}`}>
                  <Card className="bg-slate-800/60 border-slate-700 hover:border-amber-400/60 overflow-hidden transition-all">
                    <div className="aspect-video bg-slate-900 relative">
                      {photos[0] ? (
                        <img src={photos[0]} alt={`${l.make} ${l.model}`} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <Car className="h-10 w-10" />
                        </div>
                      )}
                      <Badge className="absolute top-2 right-2 bg-emerald-500/90 text-emerald-950 border-0">
                        <ShieldCheck className="h-3 w-3 mr-1" /> Inspeção independente
                      </Badge>
                    </div>
                    <div className="p-4">
                      <p className="font-semibold truncate">{l.make} {l.model}</p>
                      <p className="text-xs text-slate-400">{l.year} · {l.mileage.toLocaleString()} km · {l.fuel}</p>
                      <p className="text-amber-400 font-bold text-lg mt-2">{l.price.toLocaleString()} €</p>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
