import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, ArrowLeft, Calendar, Gauge, Fuel, Car, CheckCircle, AlertTriangle, XCircle, MapPin, Star, Clock, Lock, CreditCard, Loader2, Shield, MessageCircle, PackageCheck, AlertCircle, Hash, FileCheck, Eye, EyeOff, Download, Heart, TrendingUp, Ban, BellRing, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import CarityChat from "@/components/CarityChat";
import ShopReviews from "@/components/ShopReviews";
import PhotoLightbox from "@/components/PhotoLightbox";
import MarketLocationMap from "@/components/MarketLocationMap";
import MarketPriceCompare from "@/components/MarketPriceCompare";
import MarketContractSigning from "@/components/MarketContractSigning";
import MarketSatisfactionWindow from "@/components/MarketSatisfactionWindow";
import MarketAlertSubscribe from "@/components/MarketAlertSubscribe";
import VehicleTrustBadge from "@/components/market/VehicleTrustBadge";
import { generateInspectionPDF } from "@/lib/inspectionPdf";
import { generateContractPDF } from "@/lib/contractPdf";
import { trackListingView, getListingViewCount, isFavorite, toggleFavorite } from "@/lib/listingTracking";
import { formatMarketPrice, getMarketCurrency, formatLocalDate, formatListingPrice, formatMileage, getDistanceUnit } from "@/lib/marketPrice";
import { getCountryConfig } from "@/lib/regionConfig";
import { useMarketT } from "@/i18n/marketTranslations";
import SEOHead from "@/components/SEOHead";

const CHECKLIST_KEYS = [
  ["engine_status", "ld.checklist.engine"],
  ["transmission_status", "ld.checklist.transmission"],
  ["brakes_status", "ld.checklist.brakes"],
  ["suspension_status", "ld.checklist.suspension"],
  ["steering_status", "ld.checklist.steering"],
  ["tires_status", "ld.checklist.tires"],
  ["electrical_status", "ld.checklist.electrical"],
] as const;

const STATUS_META: Record<string, { icon: any; color: string; labelKey: string }> = {
  ok: { icon: CheckCircle, color: "text-green-600", labelKey: "ld.status.ok" },
  problems: { icon: AlertTriangle, color: "text-amber-500", labelKey: "ld.status.problems" },
  critical: { icon: XCircle, color: "text-red-600", labelKey: "ld.status.critical" },
};

const RECOMMENDATION_META: Record<string, { color: string; labelKey: string }> = {
  recommended: { labelKey: "ld.rec.recommended", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  acceptable: { labelKey: "ld.rec.acceptable", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  not_recommended: { labelKey: "ld.rec.not_recommended", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const ESCROW_STATUS_META: Record<string, { color: string; icon: any; labelKey: string }> = {
  pending: { labelKey: "ld.escrow.pending", color: "bg-amber-100 text-amber-800", icon: Clock },
  paid: { labelKey: "ld.escrow.paid", color: "bg-blue-100 text-blue-800", icon: Shield },
  delivery_confirmed: { labelKey: "ld.escrow.delivery_confirmed", color: "bg-green-100 text-green-800", icon: PackageCheck },
  disputed: { labelKey: "ld.escrow.disputed", color: "bg-red-100 text-red-800", icon: AlertCircle },
  released: { labelKey: "ld.escrow.released", color: "bg-green-100 text-green-800", icon: CheckCircle },
  refunded: { labelKey: "ld.escrow.refunded", color: "bg-slate-100 text-slate-800", icon: CreditCard },
};

export default function CarityListingDetail({ overrideId }: { overrideId?: string } = {}) {
  const { id: paramId } = useParams();
  const id = overrideId || paramId;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const t = useMarketT();
  const [listing, setListing] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [shopInfo, setShopInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [totalVerified, setTotalVerified] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);
  const [escrow, setEscrow] = useState<any>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [trustScore, setTrustScore] = useState<any>(null);
  const [similarListings, setSimilarListings] = useState<any[]>([]);
  const [viewStats, setViewStats] = useState<{ today: number; total: number }>({ today: 0, total: 0 });
  const [favorited, setFavorited] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [canReviewShop, setCanReviewShop] = useState(false);
  const [activeInspectionId, setActiveInspectionId] = useState<string | null>(null);
  const [contractLoading, setContractLoading] = useState(false);
  const [contract, setContract] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id || null));
  }, []);

  // Show escrow result
  useEffect(() => {
    const escrowStatus = searchParams.get("escrow");
    if (escrowStatus === "success") {
      toast.success("🎉 Pagamento em escrow realizado! Os fundos estão protegidos até confirmar a entrega.");
    } else if (escrowStatus === "cancelled") {
      toast.info("Pagamento cancelado.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (id) loadData();
  }, [id, currentUserId]);

  const loadData = async () => {
    const { data: listingData } = await supabase
      .from("carity_listings")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .single();

    if (!listingData) { setLoading(false); return; }
    setListing({ ...listingData, photos: Array.isArray(listingData.photos) ? listingData.photos : [] });

    const titleText = `${listingData.make} ${listingData.model} ${listingData.year} usado com inspeção certificada — GarageFlow Market`;
    document.title = titleText;
    // Dynamic meta description with real data
    const descText = `${listingData.make} ${listingData.model} ${listingData.year} — ${formatListingPrice(listingData.price, listingData.country_code, listingData.currency)}, ${formatMileage(listingData.mileage, listingData.country_code)}, ${listingData.fuel}. Inspeção certificada por oficina GarageFlow.`;
    const setMeta = (selector: string, attr: "name" | "property", key: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) { el = document.createElement("meta"); el.setAttribute(attr, key); document.head.appendChild(el); }
      el.setAttribute("content", content);
    };
    setMeta('meta[name="description"]', "name", "description", descText);
    // Open Graph + Twitter (WhatsApp/Facebook/X preview)
    const projectId = (import.meta as any).env.VITE_SUPABASE_PROJECT_ID;
    const ogUrl = `https://${projectId}.supabase.co/functions/v1/market-og-image?listing_id=${listingData.id}`;
    const pageUrl = `https://garageflow.pt/market/car/${listingData.id}`;
    setMeta('meta[property="og:title"]', "property", "og:title", titleText);
    setMeta('meta[property="og:description"]', "property", "og:description", descText);
    setMeta('meta[property="og:image"]', "property", "og:image", ogUrl);
    setMeta('meta[property="og:url"]', "property", "og:url", pageUrl);
    setMeta('meta[property="og:type"]', "property", "og:type", "product");
    setMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", titleText);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", descText);
    setMeta('meta[name="twitter:image"]', "name", "twitter:image", ogUrl);

    const [reportRes, sellerRes, countRes] = await Promise.all([
      supabase.from("carity_inspection_reports_public" as any).select("id, listing_id, shop_id, inspection_id, overall_score, recommendation, defects, exterior_photos, interior_photos, engine_photos, tire_photos, brakes_photos, suspension_photos, damage_photos, inspector_notes, technician_name, mileage_at_inspection, is_locked, engine_status, transmission_status, brakes_status, suspension_status, steering_status, tires_status, electrical_status, inspection_city, inspection_country, inspection_lat, inspection_lng, completed_at, created_at").eq("listing_id", id).maybeSingle(),
      supabase.from("carity_seller_profiles").select("*").eq("user_id", listingData.seller_id).single(),
      supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "published"),
    ]);
    
    if (reportRes.data) {
      const rd = reportRes.data as any;
      setReport({
        ...rd,
        defects: Array.isArray(rd.defects) ? rd.defects : [],
        exterior_photos: Array.isArray(rd.exterior_photos) ? rd.exterior_photos : [],
        interior_photos: Array.isArray(rd.interior_photos) ? rd.interior_photos : [],
        engine_photos: Array.isArray(rd.engine_photos) ? rd.engine_photos : [],
        damage_photos: Array.isArray(rd.damage_photos) ? rd.damage_photos : [],
      });
      if (rd.shop_id) {
        const { data: shop } = await supabase.from("shops").select("name, carity_inspections_count, carity_approval_rate, carity_rating").eq("id", rd.shop_id).single();
        if (shop) setShopInfo(shop);
      }
    }
    if (sellerRes.data) {
      setSeller(sellerRes.data);
      // Load trust score
      const { data: ts } = await supabase
        .from("seller_trust_scores" as any)
        .select("*")
        .eq("user_id", listingData.seller_id)
        .maybeSingle();
      if (ts) setTrustScore(ts);
    }

    // Load escrow status for this listing (if buyer or seller)
    if (currentUserId) {
      const { data: escrowData } = await supabase
        .from("market_escrow" as any)
        .select("*")
        .eq("listing_id", id)
        .in("status", ["pending", "paid", "delivery_confirmed", "disputed", "released"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (escrowData) {
        setEscrow(escrowData);
        // Auto-load contract if escrow is paid
        if (["paid", "delivery_confirmed", "released"].includes((escrowData as any).status)) {
          const { data: contractData } = await supabase
            .from("market_contracts" as any)
            .select("*")
            .eq("escrow_id", (escrowData as any).id)
            .maybeSingle();
          if (contractData) setContract(contractData);
        }
      }
    }

    // Load similar cars (same make or similar price range, exclude current)
    const { data: similar } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, mileage, fuel, price, photos")
      .eq("status", "published")
      .neq("id", id!)
      .or(`make.eq.${listingData.make},price.gte.${Math.max(0, listingData.price - 5000)}.price.lte.${listingData.price + 5000}`)
      .limit(6);
    setSimilarListings((similar || []).map((s: any) => ({ ...s, photos: Array.isArray(s.photos) ? s.photos : [] })));

    // Track view + load view stats (in parallel)
    trackListingView(id!);
    import("@/lib/trackEvent").then(({ trackEvent }) => trackEvent("listing_view", { listing_id: id }));

    const stats = await getListingViewCount(id!);
    setViewStats(stats);

    // Favorite state + review eligibility
    if (currentUserId) {
      isFavorite(id!, currentUserId).then(setFavorited);
      // Check if user is a verified buyer of this listing's workshop
      if ((reportRes.data as any)?.shop_id) {
        const { data: completedEscrow } = await supabase
          .from("market_escrow" as any)
          .select("id")
          .eq("buyer_id", currentUserId)
          .eq("listing_id", id!)
          .in("status", ["released", "delivery_confirmed"])
          .maybeSingle();
        if (completedEscrow) {
          setCanReviewShop(true);
          const { data: insp } = await supabase
            .from("carity_inspections")
            .select("id")
            .eq("listing_id", id!)
            .eq("shop_id", (reportRes.data as any).shop_id)
            .maybeSingle();
          if (insp) setActiveInspectionId(insp.id);
        }
      }
    }

    setLoading(false);
  };

  const handleDownloadPDF = () => {
    if (!report) return;
    generateInspectionPDF({ listing, report, shop: shopInfo, seller });
    toast.success("PDF do certificado descarregado");
  };

  const handleDownloadContract = async () => {
    if (!escrow) return;
    setContractLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-sale-contract", {
        body: { escrow_id: escrow.id },
      });
      if (error) throw new Error((error as any)?.context?.error || error.message);
      if (data?.error) throw new Error(data.error);
      const contract = data?.contract;
      if (!contract) throw new Error("Contrato indisponível");
      generateContractPDF({
        contract,
        listing: contract.listing || listing,
        buyer: contract.buyer_snapshot || {},
        seller: contract.seller_snapshot || seller || {},
        amount: Number(contract.amount || escrow.amount),
      });
      toast.success("Contrato de compra/venda descarregado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar contrato");
    } finally {
      setContractLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!currentUserId) {
      toast.error(t("ld.toast.loginFav"));
      navigate(`/market/auth?mode=signup&redirect=/market/car/${id}`);
      return;
    }
    const next = await toggleFavorite(id!, currentUserId);
    setFavorited(next);
    toast.success(next ? "Adicionado aos favoritos" : "Removido dos favoritos");
  };

  const handleBuyNow = async () => {
    if (!currentUserId) {
      toast.error("Precisa de uma conta para comprar.");
      navigate(`/market/auth?mode=signup&redirect=/market/car/${id}`);
      return;
    }
    if (listing?.seller_id === currentUserId) {
      toast.error(t("ld.toast.cantBuyOwn"));
      return;
    }
    if (escrow && ["paid", "delivery_confirmed"].includes(escrow.status)) {
      toast.error(t("ld.toast.activeTx"));
      return;
    }
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-escrow-checkout", {
        body: { listing_id: id },
      });

      const functionMessage = (error as any)?.context?.error || (error as any)?.context?.message || data?.error;
      if (error) throw new Error(functionMessage || error.message || "Erro ao iniciar pagamento");
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data?.error || "URL de pagamento não recebida");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar compra");
      setBuying(false);
    }
  };

  const handleEscrowAction = async (action: string, extra: any = {}) => {
    if (!escrow) return;
    setActionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-escrow-manage", {
        body: { action, escrow_id: escrow.id, ...extra },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || t("ld.toast.processed"));
      setDisputeOpen(false);
      loadData(); // Reload to update state
    } catch (err: any) {
      toast.error(err.message || t("ld.toast.actionError"));
    } finally {
      setActionLoading(false);
    }
  };

  // Determine if chat should be active (only when escrow is paid/active)
  const isChatActive = escrow && ["paid", "disputed"].includes(escrow.status);
  const isBuyerInEscrow = currentUserId === escrow?.buyer_id;
  const isSellerInEscrow = currentUserId === escrow?.seller_id;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <Car className="h-16 w-16 text-muted-foreground/30" />
        <h2 className="text-xl font-semibold">Carro não encontrado</h2>
        <Link to="/market"><Button>Voltar ao marketplace</Button></Link>
      </div>
    );
  }

  const allPhotos = [...listing.photos, ...(report?.exterior_photos || []), ...(report?.interior_photos || []), ...(report?.engine_photos || [])];
  const daysSincePublished = listing.published_at ? Math.floor((Date.now() - new Date(listing.published_at).getTime()) / 86400000) : 0;

  const listingCountryCfg = getCountryConfig(listing.country_code);
  const listingPriceStr = formatListingPrice(listing.price, listing.country_code, listing.currency);
  const listingMileageStr = formatMileage(listing.mileage, listing.country_code);
  const locationLine = [listing.city, listing.region, listingCountryCfg.name].filter(Boolean).join(", ");
  const seoTitle = `${listing.make} ${listing.model} ${listing.year} — ${listingPriceStr}${listing.city ? ` em ${listing.city}` : ""} | GarageFlow Market`;
  const seoDesc = `${listing.make} ${listing.model} ${listing.year}, ${listingMileageStr}, ${listing.fuel}${locationLine ? `. ${locationLine}` : ""}. Inspeção mecânica certificada por oficina, pagamento protegido em escrow. GarageFlow Market.`;
  const seoSlug = `${listing.make}-${listing.model}`.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const seoPath = `/market/carros/${seoSlug}-${listing.id}`;

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        realm="market"
        title={seoTitle}
        description={seoDesc}
        path={seoPath}
        image={listing.photos?.[0]}
      />
      <nav className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-300 hover:bg-slate-800"
              onClick={handleToggleFavorite}
              aria-label="Guardar favorito"
            >
              <Heart className={`h-4 w-4 ${favorited ? "fill-red-500 text-red-500" : ""}`} />
            </Button>
            <Link to="/market">
              <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="text-xs text-muted-foreground mb-5" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1.5">
            <li><Link to="/market" className="hover:text-foreground transition-colors">GarageFlow Market</Link></li>
            <li>/</li>
            <li><Link to={`/market/make/${encodeURIComponent(listing.make)}`} className="hover:text-foreground transition-colors">{listing.make}</Link></li>
            <li>/</li>
            <li className="text-foreground font-medium">{listing.make} {listing.model} {listing.year}</li>
          </ol>
        </nav>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Photo gallery */}
            <Card className="overflow-hidden">
              <button
                type="button"
                className="aspect-video bg-muted relative w-full block group"
                onClick={() => allPhotos[selectedPhoto] && setLightboxOpen(true)}
                aria-label="Ampliar fotografia"
              >
                {allPhotos[selectedPhoto] ? (
                  <img src={allPhotos[selectedPhoto]} alt={`${listing.make} ${listing.model}`} className="w-full h-full object-cover transition-transform group-hover:scale-[1.01]" />
                ) : (
                  <div className="flex items-center justify-center h-full"><Car className="h-16 w-16 text-muted-foreground/30" /></div>
                )}
                <div className="absolute top-4 left-4 flex flex-wrap gap-2 max-w-[calc(100%-2rem)]">
                  <Badge className="bg-white/95 backdrop-blur-sm text-slate-800 border-0 shadow-sm font-semibold">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1 text-green-600" /> Veículo Inspecionado
                  </Badge>
                  {report?.report_hash && report?.is_locked && (
                    <Badge className="bg-emerald-600/95 backdrop-blur-sm text-white border-0 shadow-sm font-semibold">
                      <Lock className="h-3 w-3 mr-1" /> {t("ld.report.sha")}
                    </Badge>
                  )}
                  {listing.boost_active && (
                    <Badge className="bg-purple-600/90 backdrop-blur-sm text-white border-0">Destaque</Badge>
                  )}
                </div>
                {viewStats.today > 0 && (
                  <Badge className="absolute top-4 right-4 bg-slate-900/80 backdrop-blur-sm text-white border-0 font-medium">
                    <TrendingUp className="h-3 w-3 mr-1" /> {viewStats.today} visualizações hoje
                  </Badge>
                )}
              </button>
              {allPhotos.length > 1 && (
                <div className="flex gap-2 p-3 overflow-x-auto">
                  {allPhotos.map((photo: string, i: number) => (
                    <button key={i} onClick={() => setSelectedPhoto(i)}
                      className={`w-20 h-14 rounded overflow-hidden flex-shrink-0 border-2 ${i === selectedPhoto ? 'border-amber-500' : 'border-transparent'}`}>
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </Card>

            {/* Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">{listing.make} {listing.model} <span className="text-muted-foreground font-normal text-lg ml-1">{listing.year}</span></CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  {daysSincePublished <= 3 && <Badge variant="outline" className="text-green-600 border-green-200 text-[11px]">Novo — publicado há {daysSincePublished || 1} dia{daysSincePublished !== 1 ? 's' : ''}</Badge>}
                  {daysSincePublished > 3 && daysSincePublished <= 14 && <Badge variant="outline" className="text-[11px]"><Clock className="h-3 w-3 mr-1" /> Publicado há {daysSincePublished} dias</Badge>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Calendar className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="font-semibold">{listing.year}</p><p className="text-xs text-muted-foreground">Ano</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Gauge className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="font-semibold">{listing.mileage.toLocaleString()} km</p><p className="text-xs text-muted-foreground">Quilometragem</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <Fuel className="h-5 w-5 mx-auto mb-1 text-muted-foreground" /><p className="font-semibold">{listing.fuel}</p><p className="text-xs text-muted-foreground">Combustível</p>
                  </div>
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <ShieldCheck className="h-5 w-5 mx-auto mb-1 text-amber-500" /><p className="font-semibold text-amber-600 dark:text-amber-400">{report?.overall_score ? (report.overall_score / 10).toFixed(1) : '-'}/10</p><p className="text-xs text-muted-foreground">Classificação</p>
                  </div>
                </div>

                <div className="mb-4">
                  <VehicleTrustBadge vin={listing.vin} plate={listing.plate} listingKm={listing.mileage} />
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" /> Inspeção feita
                  </Badge>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
                    <Shield className="h-3 w-3 mr-1" /> Pagamento Protegido
                  </Badge>
                  {totalVerified > 0 && (
                    <Badge className="bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300">
                      <Car className="h-3 w-3 mr-1" /> {totalVerified} carros verificados
                    </Badge>
                  )}
                </div>

                {listing.description && (
                  <>
                    <Separator className="my-4" />
                    <h3 className="font-semibold mb-2">Descrição</h3>
                    <p className="text-muted-foreground whitespace-pre-line">{listing.description}</p>
                  </>
                )}

                {/* Market price comparison */}
                <Separator className="my-4" />
                <MarketPriceCompare
                  listingId={listing.id}
                  make={listing.make}
                  model={listing.model}
                  year={listing.year}
                  price={listing.price}
                />

                {/* Location map */}
                <Separator className="my-4" />
                <MarketLocationMap
                  lat={listing.location_lat}
                  lng={listing.location_lng}
                  label={listing.location_label}
                  fallbackCity={seller?.location}
                />
              </CardContent>
            </Card>

            {/* Inspection report — PROFESSIONAL CERTIFIED VIEW */}
            {report && (() => {
              // Derive REAL coherence (anti-facilitação) from the actual checklist + defects
              const checklistEntries = CHECKLIST_KEYS.map(([k, lk]) => ({
                key: k,
                label: t(lk),
                status: (report as any)[k] || "ok",
              }));
              const criticalCount = checklistEntries.filter(e => e.status === "critical").length;
              const problemCount = checklistEntries.filter(e => e.status === "problems").length;
              const conformCount = checklistEntries.filter(e => e.status === "ok").length;
              const totalAnomalies = (report.defects?.length || 0) + criticalCount + problemCount;
              const hasCritical = criticalCount > 0;
              const hasProblems = problemCount > 0 || (report.defects?.length || 0) > 0;
              // Coerência: a oficina marcou "recommended" mas há críticos? Mostrar override público.
              const recommendationOverride = hasCritical && report.recommendation === "recommended";
              const effectiveRecommendation = hasCritical ? "not_recommended" : report.recommendation;
              // {t("ld.report.risk")}
              const realRisk = hasCritical ? "Elevado" : (hasProblems || report.overall_score < 60) ? "Moderado" : "Baixo";
              const realRiskColor = hasCritical ? "text-red-600" : (hasProblems || report.overall_score < 60) ? "text-amber-600" : "text-green-600";
              // Ordenar checklist: críticos -> problemas -> conformes
              const sortedChecklist = [...checklistEntries].sort((a, b) => {
                const order: Record<string, number> = { critical: 0, problems: 1, ok: 2 };
                return (order[a.status] ?? 3) - (order[b.status] ?? 3);
              });

              return (
              <Card className="border-2 border-amber-200/60 dark:border-amber-900/40 shadow-md">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-amber-50/40 dark:from-slate-900/60 dark:to-amber-950/20 border-b">
                  <div className="flex items-start justify-between flex-wrap gap-3">
                    <div className="space-y-1">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="h-9 w-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                          <ShieldCheck className="h-5 w-5 text-amber-600" />
                        </div>
                        Certificado de Inspeção Independente
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground pl-11 flex items-center gap-1.5">
                        <Lock className="h-3 w-3" /> Documento técnico emitido por oficina parceira · selado e imutável
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {effectiveRecommendation && RECOMMENDATION_META[effectiveRecommendation] && (
                        <Badge className={`${RECOMMENDATION_META[effectiveRecommendation].color} text-xs px-3 py-1`}>
                          {t(RECOMMENDATION_META[effectiveRecommendation].labelKey)}
                        </Badge>
                      )}
                      <Button size="sm" variant="outline" onClick={handleDownloadPDF} className="text-xs">
                        <Download className="h-3.5 w-3.5 mr-1.5" /> PDF Oficial
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  {/* PUBLIC ANTI-FACILITATION ALERT */}
                  {recommendationOverride && (
                    <div className="border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded-lg p-4 flex items-start gap-3">
                      <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-red-800 dark:text-red-300">Atenção — incoerência detetada pelo sistema GarageFlow</p>
                        <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                          A oficina classificou este veículo como recomendado, mas o checklist regista <strong>{criticalCount} componente{criticalCount > 1 ? "s" : ""} crítico{criticalCount > 1 ? "s" : ""} reprovado{criticalCount > 1 ? "s" : ""}</strong>. O sistema obriga a marcar como <strong>"Não recomendado"</strong> até justificação adicional. Reveja o relatório técnico antes de avançar.
                        </p>
                      </div>
                    </div>
                  )}
                  {hasCritical && !recommendationOverride && (
                    <div className="border-2 border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 rounded-lg p-4 flex items-start gap-3">
                      <ShieldAlert className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-sm text-red-800 dark:text-red-300">Componentes críticos reprovados — leitura obrigatória</p>
                        <p className="text-xs text-red-700 dark:text-red-400 leading-relaxed">
                          Este veículo apresenta <strong>{criticalCount} reprovação{criticalCount > 1 ? "ões" : ""} no checklist mecânico</strong>. Consulte o relatório técnico completo abaixo antes de qualquer decisão de compra.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* SCORE PANEL — refletindo coerência */}
                  <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-5 items-center border rounded-xl p-5 bg-gradient-to-br from-background to-muted/30">
                    <div className={`flex flex-col items-center justify-center w-full md:w-auto md:px-8 py-3 rounded-lg border-2 ${
                      hasCritical ? 'border-red-300 bg-red-50/70 dark:border-red-800/60 dark:bg-red-950/20' :
                      report.overall_score >= 80 ? 'border-green-300 bg-green-50/70 dark:border-green-800/60 dark:bg-green-950/20' :
                      report.overall_score >= 60 ? 'border-amber-300 bg-amber-50/70 dark:border-amber-800/60 dark:bg-amber-950/20' :
                      'border-red-300 bg-red-50/70 dark:border-red-800/60 dark:bg-red-950/20'
                    }`}>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-5xl font-bold tracking-tight ${
                          hasCritical ? 'text-red-700 dark:text-red-400' :
                          report.overall_score >= 80 ? 'text-green-700 dark:text-green-400' :
                          report.overall_score >= 60 ? 'text-amber-700 dark:text-amber-400' :
                          'text-red-700 dark:text-red-400'
                        }`}>{(report.overall_score / 10).toFixed(1)}</span>
                        <span className="text-base text-muted-foreground font-medium">/10</span>
                      </div>
                      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">{t("ld.report.score")}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3 rounded-lg bg-background border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("ld.report.risk")}</p>
                        <p className={`font-bold text-sm ${realRiskColor}`}>{realRisk}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("ld.report.anomalies")}</p>
                        <p className={`font-bold text-sm ${totalAnomalies > 0 ? "text-amber-600" : ""}`}>{totalAnomalies} registada{totalAnomalies !== 1 ? "s" : ""}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background border">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("ld.report.rejected")}</p>
                        <p className={`font-bold text-sm ${criticalCount > 0 ? "text-red-600" : "text-green-600"}`}>{criticalCount} de {checklistEntries.length}</p>
                      </div>
                    </div>
                  </div>

                  {/* Workshop credentials */}
                  {shopInfo && (
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-9 w-9 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <FileCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">Inspeção realizada por <span className="text-amber-700 dark:text-amber-400">{shopInfo.name}</span></p>
                          <p className="text-xs text-muted-foreground">Oficina parceira certificada GarageFlow · responsabilidade técnica</p>
                        </div>
                      </div>
                      <Separator className="my-3" />
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                        {shopInfo.carity_inspections_count > 0 && (
                          <span className="flex items-center gap-1.5"><FileCheck className="h-3.5 w-3.5" /> {shopInfo.carity_inspections_count} inspeções realizadas</span>
                        )}
                        {shopInfo.carity_approval_rate > 0 && (
                          <span className="flex items-center gap-1.5"><CheckCircle className="h-3.5 w-3.5" /> {shopInfo.carity_approval_rate}% taxa de aprovação</span>
                        )}
                        {shopInfo.carity_rating > 0 && (
                          <span className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> {shopInfo.carity_rating}/5 classificação</span>
                        )}
                      </div>
                      {(report as any).technician_name && (
                        <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5 pt-2 border-t">
                          <Lock className="h-3 w-3" />
                          Técnico responsável: <strong>{(report as any).technician_name}</strong>
                        </p>
                      )}
                    </div>
                  )}

                  {/* MECHANICAL CHECKLIST — sempre visível, ordenado por gravidade */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground">
                        <div className="h-1 w-4 bg-primary rounded-full" /> {t("ld.report.checklist")}
                      </h3>
                      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> {conformCount} conformes</span>
                        {problemCount > 0 && <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> {problemCount} anomalias</span>}
                        {criticalCount > 0 && <span className="flex items-center gap-1 font-semibold text-red-600"><span className="h-2 w-2 rounded-full bg-red-500" /> {criticalCount} reprovados</span>}
                      </div>
                    </div>
                    <div className="rounded-lg border overflow-hidden divide-y">
                      {sortedChecklist.map(({ key, label, status }) => {
                        const config = STATUS_META[status] || STATUS_META.ok;
                        const Icon = config.icon;
                        const sideColor = status === "critical" ? "bg-red-500" : status === "problems" ? "bg-amber-500" : "bg-green-500";
                        return (
                          <div key={key} className="flex items-stretch">
                            <div className={`w-1 ${sideColor} flex-shrink-0`} />
                            <div className="flex-1 flex items-center justify-between py-3 px-4 bg-background hover:bg-muted/30 transition-colors">
                              <div className="flex items-center gap-2.5">
                                <span className="font-medium text-sm">{label}</span>
                                {status === "critical" && (
                                  <Badge variant="outline" className="text-[9px] uppercase tracking-wider border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-950/40">Segurança</Badge>
                                )}
                              </div>
                              <div className={`flex items-center gap-1.5 ${config.color} text-xs font-semibold`}>
                                <Icon className="h-4 w-4" />
                                <span>{t(config.labelKey)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* TECHNICAL DETAILS — collapsible (open by default if críticos) */}
                  <details className="border rounded-lg group" open={hasCritical}>
                    <summary className="w-full p-4 flex items-center justify-between hover:bg-muted/50 rounded-t-lg transition-colors cursor-pointer list-none">
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <Eye className="h-4 w-4" /> Relatório Técnico Completo
                      </span>
                      <span className="text-[11px] text-muted-foreground hidden sm:inline">{t("ld.report.fullDesc")}</span>
                    </summary>

                    <div className="border-t p-5 space-y-6">
                      {report.defects.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                            <div className="h-1 w-4 bg-destructive rounded-full" /> {t("ld.report.anomaliesIdentified", { count: report.defects.length })}
                          </h3>
                          <div className="space-y-2">
                            {report.defects.map((defect: any, i: number) => (
                              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${
                                defect.severity === 'grave' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/10' :
                                defect.severity === 'medio' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/10' :
                                'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-900/10'
                              }`}>
                                <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                                  defect.severity === 'grave' ? 'text-red-500' :
                                  defect.severity === 'medio' ? 'text-amber-500' : 'text-blue-500'
                                }`} />
                                <div>
                                  <p className="font-medium text-sm">{defect.description || defect}</p>
                                  {defect.severity && (
                                    <Badge variant="outline" className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider">
                                      {defect.severity === 'grave' ? 'Gravidade: Alta — Segurança / Estrutural' : defect.severity === 'medio' ? 'Gravidade: Média — Funcional' : 'Gravidade: Baixa — Cosmético'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {report.damage_photos.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-foreground">
                            <div className="h-1 w-4 bg-amber-500 rounded-full" /> {t("ld.report.photoDocs")}
                          </h3>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {report.damage_photos.map((photo: string, i: number) => (
                              <img key={i} src={photo} alt={`Anomalia documentada ${i + 1}`} className="rounded-lg w-full aspect-square object-cover border" />
                            ))}
                          </div>
                        </div>
                      )}

                      {report.inspector_notes && (
                        <div>
                          <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-foreground">
                            <div className="h-1 w-4 bg-primary rounded-full" /> Observações do Técnico
                          </h3>
                          <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                            <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">{report.inspector_notes}</p>
                          </div>
                        </div>
                      )}

                      <div className="bg-muted/40 rounded-lg p-4 border">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
                          <Hash className="h-3.5 w-3.5" /> {t("ld.report.digitalCert")}
                        </p>
                        <div className="space-y-2 text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground/70 w-20 flex-shrink-0">Referência</span>
                            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{report.id?.slice(0, 8)}...</code>
                          </div>
                          {(report as any).technician_name && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/70 w-20 flex-shrink-0">Técnico</span>
                              <strong>{(report as any).technician_name}</strong>
                            </div>
                          )}
                          {shopInfo && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/70 w-20 flex-shrink-0">Oficina</span>
                              <strong>{shopInfo.name}</strong>
                            </div>
                          )}
                          {report.completed_at && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/70 w-20 flex-shrink-0">Data</span>
                              <strong>{formatLocalDate(report.completed_at, true)}</strong>
                            </div>
                          )}
                          {(report as any).report_hash && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground/70 w-20 flex-shrink-0">Hash</span>
                              <code className="bg-muted px-1.5 py-0.5 rounded text-[10px] break-all font-mono">{(report as any).report_hash?.slice(0, 32)}...</code>
                            </div>
                          )}
                          {(report as any).is_locked && (
                            <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold mt-2 pt-2 border-t border-border/50">
                              <Lock className="h-3 w-3" /> {t("ld.report.sealed")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                </CardContent>
              </Card>
              );
            })()}

            {/* Shop reviews */}
            {report?.shop_id && (
              <ShopReviews
                shopId={report.shop_id}
                shopName={shopInfo?.name}
                inspectionId={activeInspectionId || undefined}
                currentUserId={currentUserId}
                canReview={canReviewShop}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="text-center space-y-1">
                  <p className="text-3xl font-bold text-slate-800 dark:text-amber-400">{formatMarketPrice(listing.price)}</p>
                  <p className="text-[11px] text-muted-foreground">Preço final · sem comissões ocultas</p>
                  {(viewStats.total > 0 || viewStats.today > 0) && (
                    <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1 pt-1">
                      <Eye className="h-3 w-3" />
                      {viewStats.today > 0 ? `${viewStats.today} hoje · ` : ""}{viewStats.total} visualizações totais
                    </p>
                  )}
                </div>

                {/* Escrow status banner */}
                {escrow && ESCROW_STATUS_META[escrow.status] && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${ESCROW_STATUS_META[escrow.status].color}`}>
                    {(() => { const Icon = ESCROW_STATUS_META[escrow.status].icon; return <Icon className="h-4 w-4 flex-shrink-0" />; })()}
                    {t(ESCROW_STATUS_META[escrow.status].labelKey)}
                  </div>
                )}

                {/* 48h Satisfaction window — buyer only */}
                {escrow && escrow.status === "paid" && currentUserId === escrow.buyer_id && (
                  <MarketSatisfactionWindow escrow={escrow} onCancelled={loadData} />
                )}

                {/* Digital contract signing — both parties */}
                {contract && currentUserId && (currentUserId === contract.buyer_id || currentUserId === contract.seller_id) && (
                  <MarketContractSigning
                    contract={contract}
                    listing={listing}
                    isBuyer={currentUserId === contract.buyer_id}
                    isSeller={currentUserId === contract.seller_id}
                    userId={currentUserId}
                    onSigned={loadData}
                  />
                )}

                {/* Sale Contract — available once escrow is paid (buyer or seller) */}
                {escrow && ["paid", "delivery_confirmed", "released"].includes(escrow.status) &&
                 (currentUserId === escrow.buyer_id || currentUserId === escrow.seller_id) && (
                  <Button
                    onClick={handleDownloadContract}
                    disabled={contractLoading}
                    variant="outline"
                    className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-900/20"
                  >
                    {contractLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileCheck className="h-4 w-4 mr-2" />}
                    Descarregar Contrato Compra/Venda
                  </Button>
                )}

                {/* Buy Now — only if no active escrow */}
                {(!escrow || !["paid", "delivery_confirmed", "released"].includes(escrow.status)) && 
                 (!currentUserId || listing.seller_id !== currentUserId) && (
                  <div className="space-y-3">
                    <Button
                      onClick={handleBuyNow}
                      disabled={buying}
                      className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6 font-bold"
                      size="lg"
                    >
                      {buying ? (
                        <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> A processar...</>
                      ) : (
                      <><Shield className="h-5 w-5 mr-2" /> Reservar com Proteção — {formatMarketPrice(listing.price)}</>
                      )}
                    </Button>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                          <p className="font-semibold">Pagamento Protegido GarageFlow</p>
                          <p>O valor fica retido em segurança. Só é libertado quando confirmar a receção do veículo. Se algo correr mal, pode abrir disputa.</p>
                          <ol className="list-decimal list-inside mt-1 space-y-0.5 text-[10px]">
                            <li>Paga com segurança (Stripe)</li>
                            <li>Dinheiro retido até entrega</li>
                            <li>Confirma receção → vendedor recebe</li>
                          </ol>
                        </div>
                      </div>
                    </div>
                    <div className="bg-muted/40 border border-border rounded-lg p-2.5 flex items-start gap-2">
                      <Ban className="h-3.5 w-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">
                        <strong className="text-foreground">Sem financiamento próprio.</strong> O GarageFlow Market é uma plataforma de transação direta — não é instituição financeira nem oferece crédito. Compre apenas com valores que tem disponíveis ou recorra ao seu banco.
                      </p>
                    </div>
                  </div>
                )}

                {/* Buyer actions: confirm delivery or open dispute */}
                {isBuyerInEscrow && escrow?.status === "paid" && (
                  <div className="space-y-2">
                    <Button
                      onClick={() => handleEscrowAction("confirm_delivery")}
                      disabled={actionLoading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white"
                    >
                      {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <PackageCheck className="h-4 w-4 mr-2" />}
                      Confirmar Entrega
                    </Button>
                    <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full text-red-600 border-red-200 hover:bg-red-50">
                          <AlertCircle className="h-4 w-4 mr-2" /> Abrir Disputa
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Abrir Disputa</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <p className="text-sm text-muted-foreground">
                            Descreva o problema encontrado. A equipa GarageFlow irá analisar e mediar a situação.
                          </p>
                          <Textarea
                            value={disputeReason}
                            onChange={e => setDisputeReason(e.target.value)}
                            placeholder="Ex: O veículo apresenta danos não reportados na inspeção..."
                            rows={4}
                          />
                          <Button
                            onClick={() => handleEscrowAction("open_dispute", { reason: disputeReason })}
                            disabled={!disputeReason.trim() || actionLoading}
                            className="w-full bg-red-600 hover:bg-red-700 text-white"
                          >
                            {actionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Submeter Disputa
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}

                {/* Seller sees escrow notification */}
                {isSellerInEscrow && escrow?.status === "paid" && (
                  <div className="bg-amber-50 dark:bg-amber-900/10 p-3 rounded-lg text-sm">
                    <p className="font-medium text-amber-800 dark:text-amber-300">Comprador pagou {formatMarketPrice(escrow.amount)}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Os fundos estão retidos em segurança. Serão libertados quando o comprador confirmar a receção do veículo.</p>
                  </div>
                )}

                {/* Dispute info for seller */}
                {isSellerInEscrow && escrow?.status === "disputed" && (
                  <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg text-sm space-y-2">
                    <p className="font-medium text-red-800 dark:text-red-300">Disputa aberta pelo comprador</p>
                    <p className="text-xs text-red-600 dark:text-red-400">{escrow.buyer_dispute_reason}</p>
                    {!escrow.seller_dispute_response && (
                      <Textarea
                        placeholder="Escreva a sua resposta..."
                        className="mt-2"
                        onChange={e => setDisputeReason(e.target.value)}
                      />
                    )}
                    {!escrow.seller_dispute_response && (
                      <Button
                        size="sm"
                        onClick={() => handleEscrowAction("respond_dispute", { response_text: disputeReason })}
                        disabled={actionLoading}
                      >
                        Responder à Disputa
                      </Button>
                    )}
                  </div>
                )}

                <Separator />

                {/* Seller info - CONTACTS HIDDEN */}
                {seller && (
                  <div>
                    <h3 className="font-semibold mb-2 text-sm uppercase text-muted-foreground">Vendedor</h3>
                    <div className="space-y-2">
                      <p className="font-medium">{seller.name}</p>
                      {seller.location && <p className="text-sm text-muted-foreground flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {seller.location}</p>}
                      
                      {/* Trust Score Badge */}
                      {trustScore && (
                        <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
                          trustScore.trust_level === 'platinum' ? 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' :
                          trustScore.trust_level === 'gold' ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' :
                          trustScore.trust_level === 'silver' ? 'bg-slate-50 dark:bg-slate-800/30 text-slate-700 dark:text-slate-300' :
                          'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300'
                        }`}>
                          <ShieldCheck className="h-4 w-4" />
                          <div>
                            <span className="font-semibold capitalize">{trustScore.trust_level}</span>
                            <span className="mx-1">•</span>
                            <span>{trustScore.score_points} pts</span>
                            {trustScore.successful_sales > 0 && (
                              <span className="ml-1 text-xs">• {trustScore.successful_sales} venda{trustScore.successful_sales > 1 ? 's' : ''} ✓</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted p-2 rounded">
                        <Lock className="h-3 w-3" />
                        Contactos protegidos — comunique pela plataforma
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-[10px] text-center text-muted-foreground flex items-center justify-center gap-1.5"><Shield className="h-3 w-3" /> Pagamento protegido via Stripe · Comissão de 2% incluída</p>
              </CardContent>
            </Card>

            {/* Communication & Alerts — unified tabs (no overlap, professional) */}
            <Card>
              <CardContent className="pt-5">
                <Tabs defaultValue={isChatActive ? "chat" : "alerts"} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 h-9">
                    <TabsTrigger value="chat" className="text-xs gap-1.5">
                      <MessageCircle className="h-3.5 w-3.5" /> {t("ld.actions.messages")}
                    </TabsTrigger>
                    <TabsTrigger value="alerts" className="text-xs gap-1.5">
                      <BellRing className="h-3.5 w-3.5" /> Alertas
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="chat" className="mt-4">
                    {isChatActive ? (
                      <CarityChat
                        listingId={id!}
                        sellerId={listing.seller_id}
                        listingPrice={listing.price}
                        listingLabel={`${listing.make} ${listing.model}`}
                        currentUserId={currentUserId}
                      />
                    ) : (
                      <div className="text-center py-8 space-y-3 border rounded-lg bg-muted/20">
                        <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30" />
                        <div>
                          <p className="font-medium text-sm">Chat indisponível</p>
                          <p className="text-xs text-muted-foreground mt-1 px-4">
                            {escrow?.status === "released" || escrow?.status === "refunded"
                              ? t("ld.chat.completed")
                              : t("ld.chat.escrowGate")}
                          </p>
                        </div>
                        {!escrow && !currentUserId && (
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/market/auth?mode=login&redirect=/market/car/${id}`}>
                              Entrar para comprar
                            </Link>
                          </Button>
                        )}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="alerts" className="mt-4">
                    <MarketAlertSubscribe make={listing.make} model={listing.model} maxPrice={listing.price} />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Similar cars */}
        {similarListings.length > 0 && (
          <section className="mt-8 border-t pt-8">
            <h2 className="text-2xl font-bold mb-6">Carros semelhantes</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {similarListings.slice(0, 3).map((s: any) => (
                <Link key={s.id} to={`/market/car/${s.id}`}>
                  <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {s.photos[0] ? (
                        <img src={s.photos[0]} alt={`${s.make} ${s.model}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Car className="h-10 w-10 text-muted-foreground/30" /></div>
                      )}
                      <Badge className="absolute top-2 left-2 bg-green-600 text-white border-0 text-xs">
                        <ShieldCheck className="h-3 w-3 mr-0.5" /> Inspecionado
                      </Badge>
                    </div>
                    <CardContent className="p-3">
                      <h3 className="font-bold">{s.make} {s.model}</h3>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-1 mb-2">
                        <span>{s.year}</span><span>•</span>
                        <span>{s.mileage?.toLocaleString()} km</span><span>•</span>
                        <span>{s.fuel}</span>
                      </div>
                      <p className="text-lg font-bold text-amber-500">{formatMarketPrice(s.price)}</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* JSON-LD: BreadcrumbList */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "GarageFlow Market", "item": "https://garageflow.pt/market" },
          { "@type": "ListItem", "position": 2, "name": listing.make, "item": `https://garageflow.pt/market/make/${encodeURIComponent(listing.make)}` },
          { "@type": "ListItem", "position": 3, "name": `${listing.make} ${listing.model} ${listing.year}` },
        ]
      })}} />
      {/* JSON-LD: Vehicle + Product */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Vehicle",
        "name": `${listing.make} ${listing.model} ${listing.year}`,
        "brand": { "@type": "Brand", "name": listing.make },
        "model": listing.model,
        "modelDate": String(listing.year),
        "vehicleConfiguration": listing.fuel,
        "mileageFromOdometer": { "@type": "QuantitativeValue", "value": listing.mileage, "unitCode": "KMT" },
        "fuelType": listing.fuel,
        "itemCondition": "https://schema.org/UsedCondition",
        "offers": {
          "@type": "Offer",
          "price": listing.price,
          "priceCurrency": getMarketCurrency(),
          "availability": "https://schema.org/InStock",
          "url": `https://garageflow.pt/market/carros/${listing.make.toLowerCase()}-${listing.model.toLowerCase().replace(/\s+/g, "-")}-${listing.id}`,
          ...(seller ? { "seller": { "@type": "Person", "name": seller.name } } : {}),
        },
        "image": listing.photos[0] || undefined,
        "description": `${listing.make} ${listing.model} ${listing.year} — ${formatMarketPrice(listing.price)}, ${listing.mileage?.toLocaleString()} km, ${listing.fuel}. Inspeção certificada GarageFlow Market.`,
        ...(shopInfo ? { "provider": { "@type": "AutoRepair", "name": shopInfo.name } } : {}),
        ...(report ? {
          "additionalProperty": [
            { "@type": "PropertyValue", "name": "Classificação de Inspeção", "value": `${(report.overall_score / 10).toFixed(1)}/10` },
            { "@type": "PropertyValue", "name": "Recomendação", "value": report.recommendation === 'recommended' ? 'Recomendado' : report.recommendation === 'acceptable' ? 'Aceitável' : 'Não recomendado' },
            { "@type": "PropertyValue", "name": "Anomalias", "value": `${report.defects?.length || 0} registadas` },
          ]
        } : {}),
      })}} />

      <PhotoLightbox
        photos={allPhotos}
        open={lightboxOpen}
        initialIndex={selectedPhoto}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
