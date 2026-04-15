import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ShieldCheck, Car, Fuel, Calendar, Gauge, ArrowRight, CheckCircle, Eye, Wrench, MapPin, FileCheck, TrendingUp } from "lucide-react";

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
  published_at: string | null;
  boost_active?: boolean;
  shop_id: string | null;
  shop_name?: string;
  shop_location?: string;
  inspection_score?: number | null;
  inspection_recommendation?: string | null;
}

interface RealStats {
  totalPublished: number;
  totalInspections: number;
  totalPartnerShops: number;
}

export default function CarityMarketplace() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");
  const [stats, setStats] = useState<RealStats>({ totalPublished: 0, totalInspections: 0, totalPartnerShops: 0 });

  const loadAll = useCallback(async () => {
    // Load listings with shop info
    const { data: listingsData } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos, description, status, created_at, published_at, boost_active, shop_id")
      .eq("status", "published")
      .order("published_at", { ascending: false });

    const rawListings = (listingsData || []).map((l: any) => ({
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : [],
    }));

    // Get shop info for listings that have shop_id
    const shopIds = [...new Set(rawListings.filter(l => l.shop_id).map(l => l.shop_id))];
    let shopMap: Record<string, { name: string; address: string | null }> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabase
        .from("shops")
        .select("id, name, address")
        .in("id", shopIds);
      (shops || []).forEach((s: any) => { shopMap[s.id] = { name: s.name, address: s.address }; });
    }

    // Get inspection scores for all listed IDs
    const listingIds = rawListings.map((l: any) => l.id);
    let scoreMap: Record<string, { score: number; recommendation: string }> = {};
    if (listingIds.length > 0) {
      const { data: reports } = await supabase
        .from("carity_inspection_reports")
        .select("listing_id, overall_score, recommendation")
        .in("listing_id", listingIds);
      (reports || []).forEach((r: any) => { scoreMap[r.listing_id] = { score: r.overall_score, recommendation: r.recommendation }; });
    }

    setListings(rawListings.map(l => ({
      ...l,
      shop_name: l.shop_id ? shopMap[l.shop_id]?.name : undefined,
      shop_location: l.shop_id ? shopMap[l.shop_id]?.address : undefined,
      inspection_score: scoreMap[l.id]?.score ?? null,
      inspection_recommendation: scoreMap[l.id]?.recommendation ?? null,
    })));

    // Load real stats in parallel
    const [publishedRes, inspectionsRes, shopsRes] = await Promise.all([
      supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("carity_inspections").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("shops").select("id", { count: "exact", head: true }).eq("is_carity_partner", true),
    ]);

    setStats({
      totalPublished: publishedRes.count || 0,
      totalInspections: inspectionsRes.count || 0,
      totalPartnerShops: shopsRes.count || 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Carros Usados Inspecionados — GarageFlow Market";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Compre carros usados com inspeção real feita por oficinas certificadas. Relatório técnico completo e auditável. Sem surpresas, sem riscos.");
    loadAll();

    // Real-time: listen for new published listings
    const channel = supabase
      .channel("market-listings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "carity_listings" }, () => {
        loadAll();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadAll]);

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

  const hasAnyStats = stats.totalPublished > 0 || stats.totalInspections > 0 || stats.totalPartnerShops > 0;

  // SEO: generate slug for listing URL
  const listingUrl = (l: Listing) => {
    const slug = `${l.make}-${l.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    return `/market/carros/${slug}-${l.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* HERO — Comunicar confiança em 3 segundos */}
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
            Inspeção real por oficinas certificadas
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            Carros usados com <span className="text-amber-400">inspeção real</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-300 max-w-2xl mx-auto mb-8">
            Cada veículo é verificado antes de ser publicado — dados técnicos completos e auditáveis.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-8">
            <Link to="#listings">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-lg px-8 shadow-lg shadow-amber-500/30 border-2 border-amber-400">
                Ver carros <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/market/sell">
              <Button size="lg" variant="outline" className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white font-semibold backdrop-blur-sm">
                Vender carro
              </Button>
            </Link>
          </div>

          {/* Trust layer — badges */}
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-300">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              Inspeção Real
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              Oficina Certificada
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-amber-400" />
              Relatório Técnico Incluído
            </div>
          </div>

          {/* REAL STATS — only shown when data exists */}
          {hasAnyStats && (
            <div className="flex flex-wrap justify-center gap-8 mt-8 pt-6 border-t border-white/10">
              {stats.totalPublished > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-400">{stats.totalPublished}</p>
                  <p className="text-xs text-slate-400">Carros publicados</p>
                </div>
              )}
              {stats.totalInspections > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-400">{stats.totalInspections}</p>
                  <p className="text-xs text-slate-400">Inspeções concluídas</p>
                </div>
              )}
              {stats.totalPartnerShops > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-amber-400">{stats.totalPartnerShops}</p>
                  <p className="text-xs text-slate-400">Oficinas certificadas</p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* How it works */}
      <section className="py-12 bg-muted/50 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-center text-2xl font-bold mb-8">Como funciona o GarageFlow Market?</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Vendedor submete", desc: "O vendedor cria o anúncio e paga a taxa de inspeção", icon: Car },
              { step: "2", title: "Oficina inspeciona", desc: "Uma oficina certificada GarageFlow faz a inspeção completa", icon: Wrench },
              { step: "3", title: "Relatório gerado", desc: "Checklist mecânico, fotos e classificação automática", icon: FileCheck },
              { step: "4", title: "Compre com confiança", desc: "Só carros aprovados aparecem no marketplace", icon: ShieldCheck },
            ].map(s => (
              <Card key={s.step} className="text-center border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto mb-3 dark:bg-amber-900/30 dark:text-amber-400">
                    <s.icon className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold mb-1">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Listings */}
      <section id="listings" className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Pesquisar marca, modelo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={fuelFilter} onValueChange={setFuelFilter}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Combustível" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(FUEL_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-44"><SelectValue placeholder="Ordenar" /></SelectTrigger>
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
                : "Nenhum resultado para os filtros selecionados."}
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
              <Link key={listing.id} to={listingUrl(listing)}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {listing.photos[0] ? (
                      <img src={listing.photos[0] as string} alt={`${listing.make} ${listing.model} ${listing.year}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                    ) : (
                      <div className="flex items-center justify-center h-full"><Car className="h-12 w-12 text-muted-foreground/30" /></div>
                    )}
                    <Badge className="absolute top-3 left-3 bg-green-600 text-white border-0 shadow-md">
                      <ShieldCheck className="h-3 w-3 mr-1" /> Inspecionado
                    </Badge>
                    {listing.inspection_score != null && (
                      <Badge className={`absolute top-3 right-3 border-0 shadow-md font-bold ${
                        listing.inspection_score >= 80 ? 'bg-green-600 text-white' :
                        listing.inspection_score >= 60 ? 'bg-amber-500 text-white' :
                        'bg-red-600 text-white'
                      }`}>
                        {(listing.inspection_score / 10).toFixed(1)}/10
                      </Badge>
                    )}
                    {listing.boost_active && (
                      <Badge className="absolute bottom-3 right-3 bg-purple-600 text-white border-0">⚡ Destaque</Badge>
                    )}
                  </div>
                  <CardContent className="p-4">
                    <h3 className="font-bold text-lg mb-1">{listing.make} {listing.model}</h3>
                    <div className="flex flex-wrap gap-3 text-sm text-muted-foreground mb-2">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{listing.year}</span>
                      <span className="flex items-center gap-1"><Gauge className="h-3.5 w-3.5" />{listing.mileage.toLocaleString()} km</span>
                      <span className="flex items-center gap-1"><Fuel className="h-3.5 w-3.5" />{listing.fuel}</span>
                    </div>
                    {/* Estado geral do veículo */}
                    {listing.inspection_score != null && (
                      <p className={`text-xs font-semibold mb-2 ${
                        listing.inspection_score >= 80 ? 'text-green-600 dark:text-green-400' :
                        listing.inspection_score >= 60 ? 'text-amber-600 dark:text-amber-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {listing.inspection_score >= 80 ? '● Excelente estado' :
                         listing.inspection_score >= 60 ? '● Bom estado' :
                         '● Necessita atenção'}
                      </p>
                    )}
                    {/* Oficina responsável */}
                    {listing.shop_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                        <Wrench className="h-3 w-3 text-amber-500" />
                        Inspecionado por <span className="font-medium text-foreground">{listing.shop_name}</span>
                      </p>
                    )}
                    {/* Publicado há X dias */}
                    {listing.published_at && (() => {
                      const days = Math.floor((Date.now() - new Date(listing.published_at!).getTime()) / 86400000);
                      return (
                        <p className={`text-xs mb-2 ${days <= 3 ? 'text-green-600 font-semibold' : 'text-muted-foreground'}`}>
                          {days === 0 ? '🔥 Publicado hoje' : days <= 3 ? `🆕 Publicado há ${days} dia${days > 1 ? 's' : ''}` : `Publicado há ${days} dias`}
                        </p>
                      );
                    })()}
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold text-slate-800 dark:text-amber-400">€{listing.price.toLocaleString()}</span>
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

      {/* CTA Sell */}
      <section className="py-16 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <h2 className="text-3xl font-bold mb-4">Quer vender o seu carro?</h2>
          <p className="text-slate-300 mb-6">
            Submeta o seu carro, pague apenas €24,90 pela inspeção oficial e venda com a confiança de um relatório técnico completo.
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
        "publisher": { "@type": "Organization", "name": "GarageFlow", "url": "https://garageflow.pt" }
      })}} />
    </div>
  );
}
