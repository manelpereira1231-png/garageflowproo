import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ArrowLeft, Calendar, Gauge, Fuel, Car, CheckCircle, AlertTriangle, XCircle, MapPin, Star, Clock, Lock, CreditCard, Loader2, Shield, MessageCircle, PackageCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import CarityChat from "@/components/CarityChat";

const STATUS_ICON: Record<string, any> = {
  ok: { icon: CheckCircle, color: "text-green-600", label: "OK" },
  problems: { icon: AlertTriangle, color: "text-amber-500", label: "Problemas" },
  critical: { icon: XCircle, color: "text-red-600", label: "Crítico" },
};

const CHECKLIST_LABELS: Record<string, string> = {
  engine_status: "Motor",
  transmission_status: "Transmissão",
  brakes_status: "Travões",
  suspension_status: "Suspensão",
  steering_status: "Direção",
  tires_status: "Pneus",
  electrical_status: "Sistema Elétrico",
};

const RECOMMENDATION_LABELS: Record<string, { label: string; color: string }> = {
  recommended: { label: "Recomendado", color: "bg-green-100 text-green-800" },
  acceptable: { label: "Aceitável", color: "bg-amber-100 text-amber-800" },
  not_recommended: { label: "Não Recomendado", color: "bg-red-100 text-red-800" },
};

const ESCROW_STATUS_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pagamento pendente", color: "bg-amber-100 text-amber-800", icon: Clock },
  paid: { label: "Fundos em escrow — a aguardar entrega", color: "bg-blue-100 text-blue-800", icon: Shield },
  delivery_confirmed: { label: "Entrega confirmada — fundos a libertar", color: "bg-green-100 text-green-800", icon: PackageCheck },
  disputed: { label: "Disputa aberta — em análise", color: "bg-red-100 text-red-800", icon: AlertCircle },
  released: { label: "Transação concluída", color: "bg-green-100 text-green-800", icon: CheckCircle },
  refunded: { label: "Reembolsado", color: "bg-slate-100 text-slate-800", icon: CreditCard },
};

export default function CarityListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

    document.title = `${listingData.make} ${listingData.model} ${listingData.year} — GarageFlow Market`;

    const [reportRes, sellerRes, countRes] = await Promise.all([
      supabase.from("carity_inspection_reports").select("*").eq("listing_id", id).single(),
      supabase.from("carity_seller_profiles").select("*").eq("user_id", listingData.seller_id).single(),
      supabase.from("carity_listings").select("id", { count: "exact", head: true }).eq("status", "published"),
    ]);
    
    if (reportRes.data) {
      setReport({
        ...reportRes.data,
        defects: Array.isArray(reportRes.data.defects) ? reportRes.data.defects : [],
        exterior_photos: Array.isArray(reportRes.data.exterior_photos) ? reportRes.data.exterior_photos : [],
        interior_photos: Array.isArray(reportRes.data.interior_photos) ? reportRes.data.interior_photos : [],
        engine_photos: Array.isArray(reportRes.data.engine_photos) ? reportRes.data.engine_photos : [],
        damage_photos: Array.isArray(reportRes.data.damage_photos) ? reportRes.data.damage_photos : [],
      });
      if (reportRes.data.shop_id) {
        const { data: shop } = await supabase.from("shops").select("name, carity_inspections_count, carity_approval_rate, carity_rating").eq("id", reportRes.data.shop_id).single();
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
      if (escrowData) setEscrow(escrowData);
    }

    setLoading(false);
  };

  const handleBuyNow = async () => {
    if (!currentUserId) {
      toast.error("Precisa de uma conta para comprar.");
      navigate(`/market/auth?mode=signup&redirect=/market/car/${id}`);
      return;
    }
    if (listing?.seller_id === currentUserId) {
      toast.error("Não pode comprar o seu próprio carro.");
      return;
    }
    if (escrow && ["paid", "delivery_confirmed"].includes(escrow.status)) {
      toast.error("Já existe uma transação ativa para este carro.");
      return;
    }
    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-escrow-checkout", {
        body: { listing_id: id },
      });
      if (error) throw error;
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
      toast.success(data?.message || "Ação processada!");
      setDisputeOpen(false);
      loadData(); // Reload to update state
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar ação");
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

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/market" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">GarageFlow <span className="text-amber-400">Market</span></span>
          </Link>
          <Link to="/market">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Photo gallery */}
            <Card className="overflow-hidden">
              <div className="aspect-video bg-muted relative">
                {allPhotos[selectedPhoto] ? (
                  <img src={allPhotos[selectedPhoto]} alt={`${listing.make} ${listing.model}`} className="w-full h-full object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full"><Car className="h-16 w-16 text-muted-foreground/30" /></div>
                )}
                <div className="absolute top-4 left-4 flex gap-2">
                  <Badge className="bg-slate-900 text-amber-400 border-0">
                    <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Inspecionado
                  </Badge>
                  {listing.boost_active && (
                    <Badge className="bg-purple-600 text-white border-0">⭐ Destaque</Badge>
                  )}
                </div>
              </div>
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
                <CardTitle className="text-2xl">{listing.make} {listing.model}</CardTitle>
                <div className="flex flex-wrap gap-2 mt-2">
                  {daysSincePublished <= 3 && <Badge variant="outline" className="text-green-600 border-green-200">🆕 Publicado há {daysSincePublished || 1} dia{daysSincePublished !== 1 ? 's' : ''}</Badge>}
                  {daysSincePublished > 3 && daysSincePublished <= 14 && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" /> Publicado há {daysSincePublished} dias</Badge>}
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
                    <ShieldCheck className="h-5 w-5 mx-auto mb-1 text-amber-500" /><p className="font-semibold text-amber-600 dark:text-amber-400">{report?.overall_score || '-'}/100</p><p className="text-xs text-muted-foreground">Classificação</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  <Badge className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">
                    <CheckCircle className="h-3 w-3 mr-1" /> Inspeção feita
                  </Badge>
                  <Badge className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
                    <Shield className="h-3 w-3 mr-1" /> Proteção Escrow
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
              </CardContent>
            </Card>

            {/* Inspection report */}
            {report && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-amber-500" />
                      Relatório de Inspeção GarageFlow Market
                    </CardTitle>
                    {report.recommendation && RECOMMENDATION_LABELS[report.recommendation] && (
                      <Badge className={RECOMMENDATION_LABELS[report.recommendation].color}>
                        {RECOMMENDATION_LABELS[report.recommendation].label}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {shopInfo && (
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                      <p className="text-sm font-medium mb-1">Inspecionado por <span className="text-amber-700 dark:text-amber-400 font-semibold">{shopInfo.name}</span></p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                        {shopInfo.carity_inspections_count > 0 && <span>📋 {shopInfo.carity_inspections_count} inspeções</span>}
                        {shopInfo.carity_approval_rate > 0 && <span>✅ {shopInfo.carity_approval_rate}% aprovação</span>}
                        {shopInfo.carity_rating > 0 && <span>⭐ {shopInfo.carity_rating}/5</span>}
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Oficina certificada GarageFlow</span>
                      </div>
                    </div>
                  )}

                  <div className="text-center py-4">
                    <div className={`inline-flex items-center gap-2 rounded-xl px-6 py-3 ${
                      report.overall_score >= 80 ? 'bg-green-50 dark:bg-green-900/20' :
                      report.overall_score >= 60 ? 'bg-amber-50 dark:bg-amber-900/20' :
                      'bg-red-50 dark:bg-red-900/20'
                    }`}>
                      <Star className={`h-8 w-8 ${report.overall_score >= 80 ? 'text-green-500 fill-green-500' : report.overall_score >= 60 ? 'text-amber-500 fill-amber-500' : 'text-red-500 fill-red-500'}`} />
                      <span className={`text-4xl font-bold ${
                        report.overall_score >= 80 ? 'text-green-700 dark:text-green-400' :
                        report.overall_score >= 60 ? 'text-amber-700 dark:text-amber-400' :
                        'text-red-700 dark:text-red-400'
                      }`}>{report.overall_score}</span>
                      <span className="text-xl text-muted-foreground">/100</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {report.overall_score >= 80 ? '🟢 Premium — Excelente estado' :
                       report.overall_score >= 60 ? '🟡 Bom estado geral' :
                       '🔴 Necessita atenção'}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold mb-3">Checklist Mecânico</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                        const status = report[key] || 'ok';
                        const config = STATUS_ICON[status] || STATUS_ICON.ok;
                        const Icon = config.icon;
                        return (
                          <div key={key} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <span className="font-medium">{label}</span>
                            <div className={`flex items-center gap-1.5 ${config.color}`}>
                              <Icon className="h-4 w-4" />
                              <span className="text-sm font-medium">{config.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {report.defects.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">Problemas Identificados</h3>
                        <div className="space-y-2">
                          {report.defects.map((defect: any, i: number) => (
                            <div key={i} className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 rounded-lg">
                              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="font-medium text-sm">{defect.description || defect}</p>
                                {defect.severity && (
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    {defect.severity === 'grave' ? '⚠️ Grave' : defect.severity === 'medio' ? '⚡ Médio' : '💡 Leve'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {report.damage_photos.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-3">Fotos de Danos</h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {report.damage_photos.map((photo: string, i: number) => (
                            <img key={i} src={photo} alt="Dano" className="rounded-lg w-full aspect-square object-cover" />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {report.inspector_notes && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="font-semibold mb-2">Notas do Inspetor</h3>
                        <p className="text-muted-foreground whitespace-pre-line">{report.inspector_notes}</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="sticky top-4">
              <CardContent className="pt-6 space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold text-slate-800 dark:text-amber-400">€{listing.price.toLocaleString()}</p>
                </div>

                {/* Escrow status banner */}
                {escrow && ESCROW_STATUS_LABELS[escrow.status] && (
                  <div className={`flex items-center gap-2 p-3 rounded-lg text-sm font-medium ${ESCROW_STATUS_LABELS[escrow.status].color}`}>
                    {(() => { const Icon = ESCROW_STATUS_LABELS[escrow.status].icon; return <Icon className="h-4 w-4 flex-shrink-0" />; })()}
                    {ESCROW_STATUS_LABELS[escrow.status].label}
                  </div>
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
                        <><CreditCard className="h-5 w-5 mr-2" /> Comprar com Escrow — €{listing.price.toLocaleString()}</>
                      )}
                    </Button>
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <div className="flex items-start gap-2">
                        <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                          <p className="font-semibold">Proteção Escrow GarageFlow</p>
                          <p>O seu dinheiro fica retido até confirmar a entrega do veículo. Sem surpresas.</p>
                        </div>
                      </div>
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
                    <p className="font-medium text-amber-800 dark:text-amber-300">💰 Comprador pagou €{escrow.amount?.toLocaleString()}</p>
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Os fundos estão em escrow. Serão libertados quando o comprador confirmar a entrega.</p>
                  </div>
                )}

                {/* Dispute info for seller */}
                {isSellerInEscrow && escrow?.status === "disputed" && (
                  <div className="bg-red-50 dark:bg-red-900/10 p-3 rounded-lg text-sm space-y-2">
                    <p className="font-medium text-red-800 dark:text-red-300">⚠️ Disputa aberta pelo comprador</p>
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
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted p-2 rounded">
                        <Lock className="h-3 w-3" />
                        Contactos protegidos — comunique pela plataforma
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-center text-muted-foreground">🛡️ Escrow seguro via Stripe • Comissão de 2% incluída</p>
              </CardContent>
            </Card>

            {/* Chat — ONLY active when escrow is paid */}
            {isChatActive ? (
              <CarityChat
                listingId={id!}
                sellerId={listing.seller_id}
                listingPrice={listing.price}
                listingLabel={`${listing.make} ${listing.model}`}
                currentUserId={currentUserId}
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-6 space-y-3">
                    <MessageCircle className="h-10 w-10 mx-auto text-muted-foreground/30" />
                    <div>
                      <p className="font-medium text-sm">Chat indisponível</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {escrow?.status === "released" || escrow?.status === "refunded"
                          ? "Esta transação foi concluída."
                          : "O chat é ativado automaticamente após o pagamento em escrow."}
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
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* JSON-LD */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Vehicle",
        "name": `${listing.make} ${listing.model} ${listing.year}`,
        "brand": { "@type": "Brand", "name": listing.make },
        "model": listing.model,
        "modelDate": String(listing.year),
        "mileageFromOdometer": { "@type": "QuantitativeValue", "value": listing.mileage, "unitCode": "KMT" },
        "fuelType": listing.fuel,
        "offers": {
          "@type": "Offer",
          "price": listing.price,
          "priceCurrency": "EUR",
          "availability": "https://schema.org/InStock",
          "url": `https://garageflow.pt/market/car/${listing.id}`
        },
        "image": listing.photos[0] || undefined,
        "description": listing.description || `${listing.make} ${listing.model} ${listing.year} com inspeção certificada GarageFlow Market`,
      })}} />
    </div>
  );
}
