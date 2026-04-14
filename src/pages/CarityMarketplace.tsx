import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ShieldCheck, Car, Fuel, Calendar, Gauge, Star, ArrowRight, CheckCircle, Eye } from "lucide-react";

const FUEL_LABELS: Record<string, string> = {
  'Gasóleo': 'Gasóleo',
  'Gasolina': 'Gasolina',
  'Híbrido': 'Híbrido',
  'Elétrico': 'Elétrico',
  'GPL': 'GPL',
};

interface Listing {
  id: string;
  make: string;
  model: string;
  year: number;
  mileage: number;
  fuel: string;
  price: number;
  photos: string[];
  description: string;
  status: string;
  created_at: string;
  boost_active?: boolean;
  boost_expires_at?: string;
}

export default function CarityMarketplace() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [totalVerified, setTotalVerified] = useState(0);
  const [partnerShops, setPartnerShops] = useState(0);

  useEffect(() => {
    document.title = "GarageFlow Market — Carros Usados Inspecionados";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Compre carros usados com confiança. Todos os veículos no GarageFlow Market são inspecionados por oficinas certificadas com relatório técnico completo.");

    loadListings();
    loadStats();
  }, []);

  const loadListings = async () => {
    const { data } = await supabase
      .from("carity_listings")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false });
    
    setListings((data || []).map((l: any) => ({
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : [],
    })));
    setLoading(false);
  };

  const filtered = listings
    .filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q || `${l.make} ${l.model} ${l.year}`.toLowerCase().includes(q);
      const matchFuel = fuelFilter === "all" || l.fuel === fuelFilter;
      return matchSearch && matchFuel;
    })
    .sort((a, b) => {
      const aBoost = a.boost_active ? 1 : 0;
      const bBoost = b.boost_active ? 1 : 0;
      if (bBoost !== aBoost) return bBoost - aBoost;
      
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "year") return b.year - a.year;
      if (sortBy === "mileage") return a.mileage - b.mileage;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-amber-400" />
            <span className="text-2xl font-bold tracking-tight">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/market/sell">
              <Button variant="outline" className="border-amber-400/40 text-amber-300 hover:bg-amber-400/10">
                Vender Carro
              </Button>
            </Link>
            <Link to="/market/auth">
              <Button className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold">
                Entrar
              </Button>
            </Link>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto px-4 py-16 text-center">
          <Badge className="mb-4 bg-amber-400/20 text-amber-300 border-amber-400/30 text-sm">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" />
            Todos os carros inspecionados por oficinas certificadas
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            Carros usados com <span className="text-amber-400">confiança total</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
            Cada carro no GarageFlow Market passa por uma inspeção técnica obrigatória numa oficina certificada. 
            Sem surpresas. Sem riscos.
          </p>
          
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              Inspeção obrigatória
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              Relatório técnico completo
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              Oficinas certificadas GarageFlow
            </div>
          </div>
        </div>
      </header>

      {/* How it works */}
      <section className="py-12 bg-muted/50 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-2xl font-bold mb-8">Como funciona o GarageFlow Market?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Vendedor submete", desc: "O vendedor cria o anúncio e paga a taxa de inspeção" },
              { step: "2", title: "Oficina inspeciona", desc: "Uma oficina GarageFlow faz a inspeção completa" },
              { step: "3", title: "Relatório gerado", desc: "Checklist mecânico, fotos e classificação automática" },
              { step: "4", title: "Compre com confiança", desc: "Só carros aprovados aparecem no marketplace" },
            ].map(s => (
              <Card key={s.step} className="text-center border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 font-bold flex items-center justify-center mx-auto mb-3 text-lg dark:bg-amber-900/30 dark:text-amber-400">
                    {s.step}
                  </div>
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar marca, modelo..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={fuelFilter} onValueChange={setFuelFilter}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Combustível" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(FUEL_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-44">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="price_asc">Preço: menor</SelectItem>
              <SelectItem value="price_desc">Preço: maior</SelectItem>
              <SelectItem value="year">Ano: mais novo</SelectItem>
              <SelectItem value="mileage">Km: menos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Car className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum carro disponível</h3>
            <p className="text-muted-foreground mb-6">
              {listings.length === 0 
                ? "Ainda não há carros publicados no GarageFlow Market. Seja o primeiro a vender!"
                : "Nenhum resultado para os filtros selecionados."
              }
            </p>
            <Link to="/market/sell">
              <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                Vender o meu carro <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(listing => (
              <Link key={listing.id} to={`/market/car/${listing.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {listing.photos[0] ? (
                      <img
                        src={listing.photos[0] as string}
                        alt={`${listing.make} ${listing.model}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Car className="h-12 w-12 text-muted-foreground/30" />
                      </div>
                    )}
                    <Badge className="absolute top-3 left-3 bg-slate-900 text-amber-400 border-0">
                      <ShieldCheck className="h-3 w-3 mr-1" />
                      Inspecionado
                    </Badge>
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-1">
                      {listing.make} {listing.model}
                    </h3>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {listing.year}
                      </span>
                      <span className="flex items-center gap-1">
                        <Gauge className="h-3.5 w-3.5" />
                        {listing.mileage.toLocaleString()} km
                      </span>
                      <span className="flex items-center gap-1">
                        <Fuel className="h-3.5 w-3.5" />
                        {listing.fuel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-slate-800 dark:text-amber-400">
                        €{listing.price.toLocaleString()}
                      </span>
                      <Button size="sm" variant="ghost" className="text-amber-600 dark:text-amber-400">
                        Ver detalhes <Eye className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">Quer vender o seu carro?</h2>
          <p className="text-slate-300 mb-6">
            Submeta o seu carro, pague apenas €19,90 pela inspeção oficial e venda com a confiança de um relatório técnico completo.
          </p>
          <Link to="/market/sell">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
              Começar a vender <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-slate-950 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-amber-400" />
            <span>GarageFlow Market by <Link to="/" className="text-amber-400 hover:underline">GarageFlow</Link></span>
          </div>
          <p>© {new Date().getFullYear()} GarageFlow. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "GarageFlow Market",
        "url": "https://garageflow.pt/market",
        "description": "Marketplace de carros usados com inspeção técnica obrigatória por oficinas certificadas.",
        "publisher": {
          "@type": "Organization",
          "name": "GarageFlow",
          "url": "https://garageflow.pt"
        }
      })}} />
    </div>
  );
}
