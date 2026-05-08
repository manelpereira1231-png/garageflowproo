import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Car, ShieldCheck, ArrowRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import SEOHead from "@/components/SEOHead";

interface Dealer {
  user_id: string;
  dealer_slug: string;
  dealer_company_name: string;
  dealer_logo_url: string | null;
  dealer_city: string | null;
  dealer_description: string | null;
  active_listings: number;
  total_sold: number;
  dealer_plan: string;
}

export default function MarketStandsDirectory() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dealer_directory" as any)
        .select("*")
        .order("active_listings", { ascending: false })
        .limit(200);
      setDealers((data as any) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = dealers.filter(d =>
    !q || d.dealer_company_name?.toLowerCase().includes(q.toLowerCase()) ||
    d.dealer_city?.toLowerCase().includes(q.toLowerCase())
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: filtered.slice(0, 50).map((d, i) => ({
      "@type": "AutoDealer",
      position: i + 1,
      name: d.dealer_company_name,
      url: `https://www.garageflow.pt/market/stand/${d.dealer_slug}`,
      address: d.dealer_city ? { "@type": "PostalAddress", addressLocality: d.dealer_city } : undefined,
    })),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <SEOHead
        realm="market"
        title="Stands de carros usados verificados | GarageFlow Market"
        description="Diretório nacional de stands com inspeção independente garantida. Compre o seu carro usado com total transparência."
        jsonLd={jsonLd}
      />

      <div className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="text-center mb-10">
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-400/40 mb-3">Diretório de Stands</Badge>
          <h1 className="text-3xl md:text-5xl font-bold mb-3">Stands com inspeção independente</h1>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Cada carro destes stands é inspecionado por uma oficina <strong className="text-amber-300">independente</strong> da
            nossa rede — o stand não pode mexer no relatório.
          </p>
        </div>

        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome ou cidade…"
            className="pl-9 bg-slate-800/60 border-slate-700"
          />
        </div>

        {loading ? (
          <p className="text-center text-slate-500">A carregar…</p>
        ) : filtered.length === 0 ? (
          <Card className="bg-slate-800/40 border-slate-700 p-10 text-center">
            <Building2 className="h-10 w-10 mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400">Ainda sem stands verificados. Sê o primeiro!</p>
            <Link to="/auth?mode=signup&redirect=/market/profile">
              <Button className="mt-4 bg-amber-500 hover:bg-amber-400 text-slate-900">Registar stand</Button>
            </Link>
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((d) => (
              <Link key={d.user_id} to={`/market/stand/${d.dealer_slug}`}>
                <Card className="bg-slate-800/60 border-slate-700 hover:border-amber-400/60 transition-all p-5 h-full">
                  <div className="flex items-start gap-3 mb-3">
                    {d.dealer_logo_url ? (
                      <img src={d.dealer_logo_url} alt={d.dealer_company_name} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-amber-500/20 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-amber-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{d.dealer_company_name}</p>
                      {d.dealer_city && (
                        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="h-3 w-3" /> {d.dealer_city}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Car className="h-3.5 w-3.5 text-amber-400" /> {d.active_listings} ativos
                    </span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> Verificado
                    </span>
                  </div>
                  <div className="mt-3 text-amber-300 text-xs flex items-center gap-1">
                    Ver stand <ArrowRight className="h-3 w-3" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
