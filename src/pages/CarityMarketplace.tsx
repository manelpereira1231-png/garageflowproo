import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ShieldCheck, Car, Fuel, Calendar, Gauge, ArrowRight, CheckCircle, Eye, Wrench, MapPin, FileCheck, TrendingUp, Heart } from "lucide-react";
import { MarketListingGridSkeleton } from "@/components/MarketListingCardSkeleton";
import { formatRelativePT } from "@/lib/relativeTime";

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
      {/* HERO */}
      <header className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <nav className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-amber-400" />
            <span className="text-2xl font-bold tracking-tight">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/market/favoritos">
              <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-slate-800" aria-label="Os meus favoritos">
                <Heart className="h-4 w-4" />
              </Button>
            </Link>
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

        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-sm font-medium">
            <ShieldCheck className="h-4 w-4" />
            Cada veículo é inspecionado antes de ser publicado
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-5 tracking-tight leading-tight">
            Carros usados com<br className="hidden md:block" /> <span className="text-amber-400">inspeção certificada</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Relatório técnico completo, classificação mecânica e pagamento protegido. Compre com total transparência.
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <Link to="#listings">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-lg px-8 shadow-lg shadow-amber-500/20">
                Ver veículos disponíveis <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link to="/market/sell">
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white font-medium backdrop-blur-sm">
                Vender o meu carro
              </Button>
            </Link>
          </div>

          {/* Trust pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              { icon: ShieldCheck, title: "Inspeção Real", desc: "Verificação mecânica presencial por oficina parceira" },
              { icon: FileCheck, title: "Relatório Técnico", desc: "Classificação 0–10, anomalias e documentação fotográfica" },
              { icon: Eye, title: "Pagamento Protegido", desc: "Fundos retidos até confirmação de entrega" },
            ].map((p, i) => (
              <div key={i} className="flex items-start gap-3 text-left bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="h-9 w-9 rounded-lg bg-amber-400/15 flex items-center justify-center flex-shrink-0">
                  <p.icon className="h-4.5 w-4.5 text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-white">{p.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Stats */}
          {hasAnyStats && (
            <div className="flex flex-wrap justify-center gap-10 mt-10 pt-8 border-t border-white/10">
              {stats.totalPublished > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{stats.totalPublished}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mt-1">Veículos publicados</p>
                </div>
              )}
              {stats.totalInspections > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{stats.totalInspections}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mt-1">Inspeções realizadas</p>
                </div>
              )}
              {stats.totalPartnerShops > 0 && (
                <div className="text-center">
                  <p className="text-3xl font-bold text-white">{stats.totalPartnerShops}</p>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mt-1">Oficinas parceiras</p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* How it works */}
      <section className="py-14 bg-muted/30 border-b">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center mb-2">Como funciona</p>
          <h2 className="text-center text-2xl font-bold mb-10">Processo transparente em 4 etapas</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Submissão", desc: "O vendedor cria o anúncio com fotos estruturadas e paga €24,90 de taxa de inspeção.", icon: Car },
              { step: "02", title: "Inspeção Técnica", desc: "Uma oficina certificada GarageFlow realiza a verificação mecânica completa.", icon: Wrench },
              { step: "03", title: "Relatório & Classificação", desc: "Checklist de 7 sistemas, documentação fotográfica e classificação de 0 a 10.", icon: FileCheck },
              { step: "04", title: "Compra Protegida", desc: "Pagamento retido em segurança. Fundos libertados apenas após confirmação.", icon: ShieldCheck },
            ].map(s => (
              <div key={s.step} className="relative">
                <Card className="text-center border shadow-none hover:shadow-md transition-shadow h-full">
                  <CardContent className="pt-8 pb-6 px-5">
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-amber-500 text-slate-900 px-2.5 py-0.5 rounded-full tracking-wider">{s.step}</span>
                    <div className="w-11 h-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center mx-auto mb-3">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1.5">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>
              </div>
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
                <Card className="overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border-0 shadow-sm">
                  <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                    {listing.photos[0] ? (
                      <img src={listing.photos[0] as string} alt={`${listing.make} ${listing.model} ${listing.year}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                    ) : (
                      <div className="flex items-center justify-center h-full bg-slate-100 dark:bg-slate-800"><Car className="h-12 w-12 text-muted-foreground/20" /></div>
                    )}
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <div className="absolute top-3 left-3 flex gap-2">
                      <Badge className="bg-white/95 text-slate-800 border-0 shadow-sm text-[11px] font-semibold backdrop-blur-sm">
                        <ShieldCheck className="h-3 w-3 mr-1 text-green-600" /> Inspecionado
                      </Badge>
                    </div>
                    {listing.inspection_score != null && (
                      <div className={`absolute top-3 right-3 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm shadow-lg ${
                        listing.inspection_score >= 80 ? 'bg-green-500 text-white' :
                        listing.inspection_score >= 60 ? 'bg-amber-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {(listing.inspection_score / 10).toFixed(1)}
                      </div>
                    )}
                    {listing.boost_active && (
                      <Badge className="absolute bottom-3 left-3 bg-purple-600/90 text-white border-0 backdrop-blur-sm text-[10px]">Destaque</Badge>
                    )}
                    {/* Price overlay */}
                    <div className="absolute bottom-3 right-3">
                      <span className="bg-white/95 backdrop-blur-sm text-slate-900 font-bold text-lg px-3 py-1 rounded-lg shadow-sm">
                        €{listing.price.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-bold text-base leading-tight">{listing.make} {listing.model}</h3>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{listing.year}</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{listing.mileage.toLocaleString()} km</span>
                          <span className="text-muted-foreground/40">·</span>
                          <span>{listing.fuel}</span>
                        </div>
                      </div>
                    </div>
                    {/* Estado geral */}
                    {listing.inspection_score != null && (
                      <div className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full mb-2 ${
                        listing.inspection_score >= 80 ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
                        listing.inspection_score >= 60 ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                        'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                      }`}>
                        <CheckCircle className="h-3 w-3" />
                        {listing.inspection_score >= 80 ? 'Excelente estado mecânico' :
                         listing.inspection_score >= 60 ? 'Bom estado geral' :
                         'Necessita intervenção'}
                      </div>
                    )}
                    {/* Oficina */}
                    {listing.shop_name && (
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
                        <Wrench className="h-3 w-3 text-slate-400" />
                        Inspecionado por <span className="font-medium text-foreground">{listing.shop_name}</span>
                      </p>
                    )}
                    {/* Publicado há X dias — sem emojis */}
                    {listing.published_at && (() => {
                      const days = Math.floor((Date.now() - new Date(listing.published_at!).getTime()) / 86400000);
                      return (
                        <p className={`text-[11px] ${days <= 3 ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>
                          {days === 0 ? 'Publicado hoje' : `Publicado há ${days} dia${days > 1 ? 's' : ''}`}
                        </p>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* SEO Internal Linking: Popular Makes & Cities */}
      <section className="py-12 bg-muted/20 border-t">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <h2 className="text-lg font-bold mb-4">Carros usados por marca</h2>
              <div className="flex flex-wrap gap-2">
                {['BMW', 'Audi', 'Mercedes-Benz', 'Volkswagen', 'Renault', 'Peugeot', 'Toyota', 'Citroën', 'Ford', 'Opel', 'Seat', 'Volvo', 'Fiat', 'Nissan', 'Hyundai', 'Kia'].map(m => (
                  <Link key={m} to={`/market/make/${encodeURIComponent(m)}`} className="px-3 py-1.5 text-xs font-medium bg-background border rounded-lg hover:border-amber-400 hover:text-amber-600 transition-colors">
                    {m}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold mb-4">Carros usados por cidade</h2>
              <div className="flex flex-wrap gap-2">
                {['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro', 'Setúbal', 'Leiria', 'Viseu', 'Évora', 'Funchal', 'Guimarães'].map(c => (
                  <Link key={c} to={`/market/city/${encodeURIComponent(c)}`} className="px-3 py-1.5 text-xs font-medium bg-background border rounded-lg hover:border-amber-400 hover:text-amber-600 transition-colors">
                    {c}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Sell */}
      <section className="py-20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="max-w-3xl mx-auto text-center px-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">Para vendedores</p>
          <h2 className="text-3xl font-bold mb-4">Venda com relatório de inspeção profissional</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            Taxa única de €24,90. Uma oficina certificada inspeciona o veículo, gera o relatório técnico e o anúncio é publicado com total credibilidade.
          </p>
          <Link to="/market/sell">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8">
              Publicar veículo <ArrowRight className="ml-2 h-5 w-5" />
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
          <div className="flex items-center gap-4 text-xs">
            <Link to="/market/sell" className="hover:text-white transition-colors">Vender</Link>
            <Link to="/market/auth" className="hover:text-white transition-colors">Entrar</Link>
            <Link to="/" className="hover:text-white transition-colors">GarageFlow ERP</Link>
          </div>
          <p>© {new Date().getFullYear()} GarageFlow. Todos os direitos reservados.</p>
        </div>
      </footer>

      {/* JSON-LD: WebSite */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "GarageFlow Market",
        "url": "https://garageflow.pt/market",
        "description": "Marketplace de carros usados com inspeção mecânica obrigatória por oficinas certificadas em Portugal. Relatório técnico, classificação e pagamento protegido.",
        "publisher": { "@type": "Organization", "name": "GarageFlow", "url": "https://garageflow.pt" },
        "potentialAction": {
          "@type": "SearchAction",
          "target": "https://garageflow.pt/market?q={search_term_string}",
          "query-input": "required name=search_term_string"
        }
      })}} />
      {/* JSON-LD: ItemList for current listings */}
      {filtered.length > 0 && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Carros Usados Inspecionados — GarageFlow Market",
          "numberOfItems": filtered.length,
          "itemListElement": filtered.slice(0, 30).map((l, i) => ({
            "@type": "ListItem",
            "position": i + 1,
            "url": `https://garageflow.pt/market/carros/${l.make.toLowerCase()}-${l.model.toLowerCase().replace(/\s+/g, "-")}-${l.id}`,
            "name": `${l.make} ${l.model} ${l.year}`,
          })),
        })}} />
      )}
      {/* JSON-LD: FAQ */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
          {
            "@type": "Question",
            "name": "Como funciona a inspeção de carros no GarageFlow Market?",
            "acceptedAnswer": { "@type": "Answer", "text": "Cada veículo publicado no GarageFlow Market é inspecionado presencialmente por uma oficina parceira certificada. A inspeção inclui 7 sistemas mecânicos, documentação fotográfica e um relatório com classificação de 0 a 10." }
          },
          {
            "@type": "Question",
            "name": "Quanto custa publicar um carro no GarageFlow Market?",
            "acceptedAnswer": { "@type": "Answer", "text": "A taxa de inspeção e publicação é de €24,90 (taxa única). Este valor cobre a inspeção mecânica completa e a publicação do anúncio com relatório técnico certificado." }
          },
          {
            "@type": "Question",
            "name": "O pagamento é seguro?",
            "acceptedAnswer": { "@type": "Answer", "text": "Sim. Utilizamos pagamento protegido (escrow) via Stripe. O dinheiro fica retido até o comprador confirmar a receção do veículo. Em caso de problema, pode abrir uma disputa." }
          },
          {
            "@type": "Question",
            "name": "Posso contactar o vendedor antes de comprar?",
            "acceptedAnswer": { "@type": "Answer", "text": "O chat é ativado automaticamente após o pagamento em escrow, garantindo segurança para ambas as partes. Os contactos pessoais são protegidos para evitar fraudes." }
          }
        ]
      })}} />
    </div>
  );
}
