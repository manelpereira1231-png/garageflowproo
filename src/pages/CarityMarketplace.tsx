import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Search, ShieldCheck, Car, Fuel, Calendar, Gauge, ArrowRight, CheckCircle, Eye, Wrench, MapPin, FileCheck, TrendingUp, Heart, SlidersHorizontal, X, RotateCcw, Sparkles } from "lucide-react";
import { MarketListingGridSkeleton } from "@/components/MarketListingCardSkeleton";
import { formatRelativePT } from "@/lib/relativeTime";
import { useCountryPricing } from "@/hooks/useCountryPricing";
import { useLanguage } from "@/i18n/LanguageContext";
import SEOHead from "@/components/SEOHead";

const FUEL_LABELS: Record<string, string> = {
  'Gasóleo': 'Gasóleo',
  'Gasolina': 'Gasolina',
  'Híbrido': 'Híbrido',
  'Elétrico': 'Elétrico',
  'GPL': 'GPL',
};

const CURRENT_YEAR = new Date().getFullYear();
const PRICE_MIN = 0;
const PRICE_MAX = 100000;
const YEAR_MIN = 1990;
const YEAR_MAX = CURRENT_YEAR;
const KM_MIN = 0;
const KM_MAX = 400000;

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
  location_label?: string | null;
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
  const { pricing, formatPrice } = useCountryPricing();
  const { t } = useLanguage();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [makeFilter, setMakeFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [fuelFilter, setFuelFilter] = useState("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([PRICE_MIN, PRICE_MAX]);
  const [yearRange, setYearRange] = useState<[number, number]>([YEAR_MIN, YEAR_MAX]);
  const [kmRange, setKmRange] = useState<[number, number]>([KM_MIN, KM_MAX]);
  const [minScore, setMinScore] = useState<number>(0);
  const [inspectionStatus, setInspectionStatus] = useState<"all" | "approved" | "reserved">("all");
  const [certifiedOnly, setCertifiedOnly] = useState<boolean>(true); // ON by default
  const [freshness, setFreshness] = useState<"any" | "7d" | "30d">("any");
  const [sortBy, setSortBy] = useState("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [stats, setStats] = useState<RealStats>({ totalPublished: 0, totalInspections: 0, totalPartnerShops: 0 });


  const loadAll = useCallback(async () => {
    // Load visible listings + headline stats in parallel so the Market opens faster.
    const [listingsRes, publishedRes, inspectionsRes, shopsRes] = await Promise.all([
      supabase
        .from("carity_listings")
        .select("id, make, model, year, mileage, fuel, price, photos, description, status, created_at, published_at, boost_active, shop_id, location_label")
        .eq("status", "published")
        .order("published_at", { ascending: false }),
      supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "published"),
      supabase.from("carity_inspections").select("id", { count: "exact", head: true }).eq("status", "completed"),
      supabase.from("shops").select("id", { count: "exact", head: true }).eq("is_carity_partner", true),
    ]);

    const rawListings = (listingsRes.data || []).map((l: any) => ({
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : [],
    }));

    setStats({
      totalPublished: publishedRes.count || 0,
      totalInspections: inspectionsRes.count || 0,
      totalPartnerShops: shopsRes.count || 0,
    });

    // Get shop info + inspection scores in parallel for listings that are visible.
    const shopIds = [...new Set(rawListings.filter(l => l.shop_id).map(l => l.shop_id))];
    const listingIds = rawListings.map((l: any) => l.id);
    const [listingShopsRes, reportsRes] = await Promise.all([
      shopIds.length > 0
        ? supabase.from("shops").select("id, name, address").in("id", shopIds)
        : Promise.resolve({ data: [] as any[] }),
      listingIds.length > 0
        ? supabase.from("carity_inspection_reports").select("listing_id, overall_score, recommendation").in("listing_id", listingIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    let shopMap: Record<string, { name: string; address: string | null }> = {};
    (listingShopsRes.data || []).forEach((s: any) => { shopMap[s.id] = { name: s.name, address: s.address }; });
    let scoreMap: Record<string, { score: number; recommendation: string }> = {};
    (reportsRes.data || []).forEach((r: any) => { scoreMap[r.listing_id] = { score: r.overall_score, recommendation: r.recommendation }; });

    setListings(rawListings.map(l => ({
      ...l,
      shop_name: l.shop_id ? shopMap[l.shop_id]?.name : undefined,
      shop_location: l.shop_id ? shopMap[l.shop_id]?.address : undefined,
      inspection_score: scoreMap[l.id]?.score ?? null,
      inspection_recommendation: scoreMap[l.id]?.recommendation ?? null,
    })));

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

  // Derived filter options (only from real data)
  const availableMakes = useMemo(() => {
    const set = new Set(listings.map(l => l.make).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    listings.forEach(l => {
      const city = l.location_label || l.shop_location;
      if (city) set.add(city.split(",")[0].trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [listings]);

  const filtered = listings
    .filter(l => {
      const q = search.toLowerCase();
      const matchSearch = !q || `${l.make} ${l.model} ${l.year}`.toLowerCase().includes(q);
      const matchMake = makeFilter === "all" || l.make === makeFilter;
      const cityVal = (l.location_label || l.shop_location || "").split(",")[0].trim();
      const matchCity = cityFilter === "all" || cityVal === cityFilter;
      const matchFuel = fuelFilter === "all" || l.fuel === fuelFilter;
      const matchPrice = l.price >= priceRange[0] && l.price <= priceRange[1];
      const matchYear = l.year >= yearRange[0] && l.year <= yearRange[1];
      const matchKm = l.mileage >= kmRange[0] && l.mileage <= kmRange[1];
      const matchScore = !l.inspection_score ? minScore === 0 : l.inspection_score >= minScore;
      const matchInspection =
        inspectionStatus === "all" ? true :
        inspectionStatus === "approved" ? l.inspection_recommendation === "recommended" :
        l.inspection_recommendation === "acceptable";
      const matchCertified = !certifiedOnly || (!!l.inspection_score && !!l.inspection_recommendation && l.inspection_recommendation !== "not_recommended");
      const days = l.published_at ? Math.floor((Date.now() - new Date(l.published_at).getTime()) / 86400000) : 9999;
      const matchFreshness = freshness === "any" || (freshness === "7d" ? days <= 7 : days <= 30);
      return matchSearch && matchMake && matchCity && matchFuel && matchPrice && matchYear && matchKm && matchScore && matchInspection && matchCertified && matchFreshness;
    })
    .sort((a, b) => {
      const aBoost = a.boost_active ? 1 : 0;
      const bBoost = b.boost_active ? 1 : 0;
      if (bBoost !== aBoost) return bBoost - aBoost;
      if (sortBy === "price_asc") return a.price - b.price;
      if (sortBy === "price_desc") return b.price - a.price;
      if (sortBy === "year") return b.year - a.year;
      if (sortBy === "mileage_asc") return a.mileage - b.mileage;
      if (sortBy === "score_desc") return (b.inspection_score || 0) - (a.inspection_score || 0);
      return new Date(b.published_at || b.created_at).getTime() - new Date(a.published_at || a.created_at).getTime();
    });

  const activeFilterCount = [
    makeFilter !== "all",
    cityFilter !== "all",
    fuelFilter !== "all",
    priceRange[0] !== PRICE_MIN || priceRange[1] !== PRICE_MAX,
    yearRange[0] !== YEAR_MIN || yearRange[1] !== YEAR_MAX,
    kmRange[0] !== KM_MIN || kmRange[1] !== KM_MAX,
    minScore > 0,
    inspectionStatus !== "all",
    !certifiedOnly, // counts as active when user explicitly turned OFF default
    freshness !== "any",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setMakeFilter("all");
    setCityFilter("all");
    setFuelFilter("all");
    setPriceRange([PRICE_MIN, PRICE_MAX]);
    setYearRange([YEAR_MIN, YEAR_MAX]);
    setKmRange([KM_MIN, KM_MAX]);
    setMinScore(0);
    setInspectionStatus("all");
    setCertifiedOnly(true);
    setFreshness("any");
    setSearch("");
  };


  const hasAnyStats = stats.totalPublished > 0 || stats.totalInspections > 0 || stats.totalPartnerShops > 0;

  // SEO: generate slug for listing URL
  const listingUrl = (l: Listing) => {
    const slug = `${l.make}-${l.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
    return `/market/carros/${slug}-${l.id}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        realm="market"
        path="/market"
        breadcrumbs={[
          { name: "Home", url: "/" },
          { name: "Market", url: "/market" },
        ]}
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "GarageFlow Market",
          url: "https://garageflow.pt/market",
          description: "Trusted used-car marketplace with mandatory inspection by certified workshops. Secure escrow payment.",
          potentialAction: {
            "@type": "SearchAction",
            target: "https://garageflow.pt/market?search={search_term_string}",
            "query-input": "required name=search_term_string",
          },
        }}
      />
      {/* HERO */}
      <header className="relative bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white overflow-hidden">
        {/* Mesh accent */}
        <div className="pointer-events-none absolute inset-0 bg-mesh-amber opacity-90" />
        <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-amber-600/8 blur-3xl" />

        <nav className="relative max-w-7xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2.5 group">
            <div className="h-9 w-9 rounded-lg bg-amber-400/15 border border-amber-400/30 flex items-center justify-center group-hover:bg-amber-400/25 transition-colors">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
            </div>
            <span className="text-xl font-bold tracking-tight">GarageFlow <span className="text-amber-400">{t('market.brand')}</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/market/favoritos">
              <Button variant="ghost" size="icon" className="text-slate-300 hover:bg-white/10 hover:text-white" aria-label={t('market.nav.favorites')}>
                <Heart className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/market/sell" className="hidden sm:block">
              <Button variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white backdrop-blur-sm">
                {t('market.nav.sellCar')}
              </Button>
            </Link>
            <Link to="/market/auth">
              <Button className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold shadow-lg shadow-amber-500/20">
                {t('market.nav.signIn')}
              </Button>
            </Link>
          </div>
        </nav>

        <div className="relative max-w-7xl mx-auto px-4 pt-12 pb-24 text-center">
          <div className="inline-flex items-center gap-2 mb-7 px-3.5 py-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300 text-xs font-medium backdrop-blur-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t('market.hero.badge')}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-[1.05] tracking-[-0.03em] max-w-4xl mx-auto">
            {t('market.hero.title1')}<br className="hidden md:block" /> <span className="bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 bg-clip-text text-transparent">{t('market.hero.title2')}</span>
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            {t('market.hero.subtitle')}
          </p>

          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <Link to="#listings">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold text-base px-8 h-12 shadow-xl shadow-amber-500/25 btn-interactive">
                {t('market.hero.ctaBuy')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/market/sell">
              <Button size="lg" variant="outline" className="h-12 border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white font-medium backdrop-blur-sm btn-interactive">
                {t('market.hero.ctaSell')}
              </Button>
            </Link>
          </div>

          {/* Trust pillars */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-3xl mx-auto">
            {[
              { icon: ShieldCheck, title: t('market.trust.realInspection'), desc: t('market.trust.realInspectionDesc') },
              { icon: FileCheck, title: t('market.trust.report'), desc: t('market.trust.reportDesc') },
              { icon: Eye, title: t('market.trust.protectedPay'), desc: t('market.trust.protectedPayDesc') },
            ].map((p, i) => (
              <div key={i} className="flex items-start gap-3 text-left bg-white/[0.04] border border-white/10 rounded-xl p-4 backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300">
                <div className="h-9 w-9 rounded-lg bg-amber-400/15 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
                  <p.icon className="h-4 w-4 text-amber-400" />
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
            <div className="flex flex-wrap justify-center gap-12 mt-12 pt-10 border-t border-white/[0.08]">
              {stats.totalPublished > 0 && (
                <div className="text-center">
                  <p className="text-4xl font-bold text-white tracking-tight tabular-nums">{stats.totalPublished}</p>
                  <p className="text-[11px] text-slate-500 uppercase tracking-[0.15em] font-medium mt-1.5">{t('market.stats.published')}</p>
                </div>
              )}
              {stats.totalInspections > 0 && (
                <div className="text-center">
                  <p className="text-4xl font-bold text-white tracking-tight tabular-nums">{stats.totalInspections}</p>
                  <p className="text-[11px] text-slate-500 uppercase tracking-[0.15em] font-medium mt-1.5">{t('market.stats.inspections')}</p>
                </div>
              )}
              {stats.totalPartnerShops > 0 && (
                <div className="text-center">
                  <p className="text-4xl font-bold text-white tracking-tight tabular-nums">{stats.totalPartnerShops}</p>
                  <p className="text-[11px] text-slate-500 uppercase tracking-[0.15em] font-medium mt-1.5">{t('market.stats.partners')}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* How it works */}
      <section className="py-16 bg-muted/20 border-b border-border/60">
        <div className="max-w-7xl mx-auto px-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary text-center mb-3">{t('market.how.eyebrow')}</p>
          <h2 className="text-center text-3xl md:text-4xl font-bold mb-12 tracking-tight">{t('market.how.title')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            {[
              { step: "01", title: t('market.how.s1Title'), desc: t('market.how.s1Desc').replace('{price}', formatPrice(pricing.inspection_price)), icon: Car },
              { step: "02", title: t('market.how.s2Title'), desc: t('market.how.s2Desc'), icon: Wrench },
              { step: "03", title: t('market.how.s3Title'), desc: t('market.how.s3Desc'), icon: FileCheck },
              { step: "04", title: t('market.how.s4Title'), desc: t('market.how.s4Desc'), icon: ShieldCheck },
            ].map(s => (
              <div key={s.step} className="relative group">
                <div className="card-premium text-center h-full pt-9 pb-6 px-5">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold bg-gradient-to-br from-amber-400 to-amber-600 text-slate-900 px-3 py-1 rounded-full tracking-[0.1em] shadow-md">{s.step}</span>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 text-slate-700 dark:text-slate-300 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-semibold text-sm mb-1.5">{s.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Listings */}
      <section id="listings" className="max-w-7xl mx-auto px-4 py-8">
        {/* Top bar: search + sort + mobile filter trigger */}
        <div className="flex flex-col md:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar marca, modelo, versão…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10 h-11"
            />
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-56 h-11">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="price_asc">Preço: menor primeiro</SelectItem>
              <SelectItem value="price_desc">Preço: maior primeiro</SelectItem>
              <SelectItem value="score_desc">Melhor score técnico</SelectItem>
              <SelectItem value="mileage_asc">Menor quilometragem</SelectItem>
              <SelectItem value="year">Mais novos</SelectItem>
            </SelectContent>
          </Select>

          {/* Mobile filter trigger */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden h-11 gap-2 relative">
                <SlidersHorizontal className="h-4 w-4" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge className="ml-1 h-5 min-w-5 px-1.5 bg-amber-500 text-slate-900 hover:bg-amber-500">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" /> Filtros
                </SheetTitle>
              </SheetHeader>
              <FiltersBody
                makeFilter={makeFilter} setMakeFilter={setMakeFilter} availableMakes={availableMakes}
                cityFilter={cityFilter} setCityFilter={setCityFilter} availableCities={availableCities}
                fuelFilter={fuelFilter} setFuelFilter={setFuelFilter}
                priceRange={priceRange} setPriceRange={setPriceRange}
                yearRange={yearRange} setYearRange={setYearRange}
                kmRange={kmRange} setKmRange={setKmRange}
                minScore={minScore} setMinScore={setMinScore}
                inspectionStatus={inspectionStatus} setInspectionStatus={setInspectionStatus}
                certifiedOnly={certifiedOnly} setCertifiedOnly={setCertifiedOnly}
                freshness={freshness} setFreshness={setFreshness}
                formatPrice={formatPrice}
                onReset={resetFilters}
                onApply={() => setFiltersOpen(false)}
                resultCount={filtered.length}
                isMobile
              />
            </SheetContent>
          </Sheet>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
          {/* Desktop sidebar */}
          <aside className="hidden lg:block">
            <div className="sticky top-4 border rounded-xl p-5 bg-card shadow-premium-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <SlidersHorizontal className="h-4 w-4 text-amber-500" /> Filtros
                  {activeFilterCount > 0 && (
                    <Badge variant="outline" className="ml-1 text-[10px] h-5 px-1.5">{activeFilterCount}</Badge>
                  )}
                </h3>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 text-xs gap-1 text-muted-foreground">
                    <RotateCcw className="h-3 w-3" /> Limpar
                  </Button>
                )}
              </div>
              <FiltersBody
                makeFilter={makeFilter} setMakeFilter={setMakeFilter} availableMakes={availableMakes}
                cityFilter={cityFilter} setCityFilter={setCityFilter} availableCities={availableCities}
                fuelFilter={fuelFilter} setFuelFilter={setFuelFilter}
                priceRange={priceRange} setPriceRange={setPriceRange}
                yearRange={yearRange} setYearRange={setYearRange}
                kmRange={kmRange} setKmRange={setKmRange}
                minScore={minScore} setMinScore={setMinScore}
                inspectionStatus={inspectionStatus} setInspectionStatus={setInspectionStatus}
                certifiedOnly={certifiedOnly} setCertifiedOnly={setCertifiedOnly}
                freshness={freshness} setFreshness={setFreshness}
                formatPrice={formatPrice}
                onReset={resetFilters}
                onApply={() => {}}
                resultCount={filtered.length}
              />
            </div>
          </aside>

          {/* Results */}
          <div>
            {/* Result counter + active chips */}
            <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
              <span className="text-muted-foreground">
                <strong className="text-foreground tabular-nums">{filtered.length}</strong> {filtered.length === 1 ? "carro encontrado" : "carros encontrados"}
              </span>
              {certifiedOnly && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 gap-1">
                  <ShieldCheck className="h-3 w-3" /> Apenas certificados
                  <button onClick={() => setCertifiedOnly(false)} className="ml-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded p-0.5"><X className="h-3 w-3" /></button>
                </Badge>
              )}
            </div>

            {loading ? (
              <MarketListingGridSkeleton count={6} />
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 border rounded-xl bg-muted/20">
                <Car className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{t('market.empty.title')}</h3>
                <p className="text-muted-foreground mb-6 px-4">
                  {listings.length === 0
                    ? t('market.empty.firstSeller')
                    : "Nenhum carro corresponde aos filtros atuais. Experimente alargar os critérios."}
                </p>
                {listings.length > 0 ? (
                  <Button variant="outline" onClick={resetFilters} className="gap-2">
                    <RotateCcw className="h-4 w-4" /> Limpar filtros
                  </Button>
                ) : (
                  <Link to="/market/sell">
                    <Button className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold">
                      {t('market.hero.ctaSell')} <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {filtered.map(listing => {
                  const days = listing.published_at ? Math.floor((Date.now() - new Date(listing.published_at).getTime()) / 86400000) : 9999;
                  const isNew = days <= 3;
                  const inspBadge =
                    listing.inspection_recommendation === "recommended" ? { label: "Aprovado", color: "bg-green-600 text-white" } :
                    listing.inspection_recommendation === "acceptable" ? { label: "Com observações", color: "bg-amber-500 text-slate-900" } :
                    listing.inspection_recommendation === "not_recommended" ? { label: "Reprovado", color: "bg-red-600 text-white" } :
                    null;
                  return (
                    <Link key={listing.id} to={listingUrl(listing)} className="block">
                      <Card className="overflow-hidden cursor-pointer group border border-border/60 rounded-xl shadow-premium-sm hover:shadow-premium-lg hover:border-border hover:-translate-y-1 transition-all duration-300">
                        <div className="aspect-[16/10] bg-muted relative overflow-hidden">
                          {listing.photos[0] ? (
                            <img src={listing.photos[0] as string} alt={`${listing.make} ${listing.model} ${listing.year}`} className="w-full h-full object-cover group-hover:scale-[1.06] transition-transform duration-700 ease-out" loading="lazy" />
                          ) : (
                            <div className="flex items-center justify-center h-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900"><Car className="h-12 w-12 text-muted-foreground/20" /></div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                          <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                            {inspBadge && (
                              <Badge className={`${inspBadge.color} border-0 shadow-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md`}>
                                <ShieldCheck className="h-3 w-3 mr-1" /> {inspBadge.label}
                              </Badge>
                            )}
                            {isNew && (
                              <Badge className="bg-amber-400 text-slate-900 border-0 shadow-md text-[10px] font-bold uppercase tracking-wider backdrop-blur-md gap-1">
                                <Sparkles className="h-2.5 w-2.5" /> Novo
                              </Badge>
                            )}
                          </div>
                          {listing.inspection_score != null && (
                            <div className={`absolute top-3 right-3 h-11 w-11 rounded-full flex items-center justify-center font-bold text-sm shadow-lg ring-2 ring-white/40 ${
                              listing.inspection_score >= 80 ? 'bg-gradient-to-br from-green-500 to-green-600 text-white' :
                              listing.inspection_score >= 60 ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white' :
                              'bg-gradient-to-br from-red-500 to-red-600 text-white'
                            }`}>
                              {(listing.inspection_score / 10).toFixed(1)}
                            </div>
                          )}
                          {listing.boost_active && (
                            <Badge className="absolute bottom-3 left-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white border-0 backdrop-blur-sm text-[10px] shadow-md">{t('market.badge.featured')}</Badge>
                          )}
                          <div className="absolute bottom-3 right-3">
                            <span className="bg-white/95 backdrop-blur-md text-slate-900 font-bold text-lg px-3.5 py-1.5 rounded-lg shadow-lg tabular-nums">
                              {formatPrice(listing.price)}
                            </span>
                          </div>
                        </div>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-bold text-base leading-tight tracking-tight">{listing.make} {listing.model}</h3>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1.5">
                                <span className="tabular-nums">{listing.year}</span>
                                <span className="text-muted-foreground/40">·</span>
                                <span className="tabular-nums">{listing.mileage.toLocaleString()} km</span>
                                <span className="text-muted-foreground/40">·</span>
                                <span>{listing.fuel}</span>
                              </div>
                            </div>
                          </div>
                          {(listing.location_label || listing.shop_location) && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {(listing.location_label || listing.shop_location)?.split(",")[0]}
                            </p>
                          )}
                          {listing.shop_name && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1.5">
                              <Wrench className="h-3 w-3 text-slate-400" />
                              {t('market.fav.inspectedBy')} <span className="font-medium text-foreground">{listing.shop_name}</span>
                            </p>
                          )}
                          {listing.published_at && (
                            <p className={`text-[11px] ${isNew ? 'text-green-600 dark:text-green-400 font-medium' : 'text-muted-foreground'}`}>
                              Publicado {formatRelativePT(listing.published_at)}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>


      {/* SEO Internal Linking: Marcas, Cidades, Faixas de preço */}
      <section className="py-12 bg-muted/20 border-t">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <div>
              <h2 className="text-lg font-bold mb-4">{t('market.byMake')}</h2>
              <div className="flex flex-wrap gap-2">
                {['BMW', 'Audi', 'Mercedes-Benz', 'Volkswagen', 'Renault', 'Peugeot', 'Toyota', 'Citroën', 'Ford', 'Opel', 'Seat', 'Volvo', 'Fiat', 'Nissan', 'Hyundai', 'Kia'].map(m => (
                  <Link key={m} to={`/market/make/${encodeURIComponent(m)}`} className="px-3 py-1.5 text-xs font-medium bg-background border rounded-lg hover:border-amber-400 hover:text-amber-600 transition-colors">
                    {m}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold mb-4">{t('market.byCity')}</h2>
              <div className="flex flex-wrap gap-2">
                {['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Aveiro', 'Setúbal', 'Leiria', 'Viseu', 'Évora', 'Funchal', 'Guimarães'].map(c => (
                  <Link key={c} to={`/market/city/${encodeURIComponent(c)}`} className="px-3 py-1.5 text-xs font-medium bg-background border rounded-lg hover:border-amber-400 hover:text-amber-600 transition-colors">
                    {c}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-lg font-bold mb-4">{t('market.byPrice')}</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { url: 'ate-5000-euros', txt: 'até €5.000' },
                  { url: 'ate-10000-euros', txt: 'até €10.000' },
                  { url: '10000-a-20000-euros', txt: '€10k–€20k' },
                  { url: '20000-a-35000-euros', txt: '€20k–€35k' },
                  { url: 'acima-35000-euros', txt: 'acima de €35k' },
                ].map(p => (
                  <Link key={p.url} to={`/market/preco/${p.url}`} className="px-3 py-1.5 text-xs font-medium bg-background border rounded-lg hover:border-amber-400 hover:text-amber-600 transition-colors">
                    {p.txt}
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
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-3">{t('market.sellCta.eyebrow')}</p>
          <h2 className="text-3xl font-bold mb-4">{t('market.sellCta.title')}</h2>
          <p className="text-slate-400 mb-8 leading-relaxed">
            {t('market.sellCta.subtitle').replace('{price}', formatPrice(pricing.inspection_price))}
          </p>
          <Link to="/market/sell">
            <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-8">
              {t('market.sellCta.button')} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-slate-950 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col gap-4 text-sm">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-amber-400" />
              <span>GarageFlow Market by <Link to="/" className="text-amber-400 hover:underline">GarageFlow</Link></span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <Link to="/market/sell" className="hover:text-white transition-colors">{t('market.footer.sell')}</Link>
              <Link to="/market/auth" className="hover:text-white transition-colors">{t('market.footer.signIn')}</Link>
              <Link to="/" className="hover:text-white transition-colors">{t('market.footer.erp')}</Link>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-4 flex flex-col md:flex-row justify-between items-center gap-3 text-xs">
            <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <Link to="/legal/privacy" className="hover:text-white transition-colors">{t('market.footer.privacy')}</Link>
              <Link to="/legal/terms" className="hover:text-white transition-colors">{t('market.footer.terms')}</Link>
              <Link to="/legal/market-terms" className="hover:text-white transition-colors">{t('market.footer.marketTerms')}</Link>
              <Link to="/legal/cookies" className="hover:text-white transition-colors">{t('market.footer.cookies')}</Link>
              <Link to="/legal/dpa" className="hover:text-white transition-colors">{t('market.footer.dpa')}</Link>
              <Link to="/legal/my-data" className="hover:text-white transition-colors">{t('market.footer.myData')}</Link>
              <Link to="/support?context=market" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">Suporte</Link>
            </nav>
            <p>© {new Date().getFullYear()} GarageFlow. Todos os direitos reservados.</p>
          </div>
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
            "acceptedAnswer": { "@type": "Answer", "text": `A taxa de inspeção e publicação é de ${formatPrice(pricing.inspection_price)} (taxa única) em ${pricing.name || "Portugal"}. Este valor cobre a inspeção mecânica completa e a publicação do anúncio com relatório técnico certificado.` }
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
