import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ShieldCheck, Car, Euro, CheckCircle, XCircle, Clock, Building2, Users, TrendingUp, Star,
  Loader2, Send, ClipboardCheck, User, MapPin, Phone, Eye, Edit, Trash2, Zap, Search,
  FileText, AlertTriangle, RefreshCw, Filter, ArrowUpDown, BarChart3, Calendar,
} from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Aguarda Pagamento",
  pending_inspection: "Aguarda Inspeção",
  inspecting: "Em Inspeção",
  pending_approval: "Aguarda Aprovação",
  published: "Publicado",
  sold: "Vendido",
  rejected: "Rejeitado",
  draft: "Rascunho",
};

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-800",
  pending_inspection: "bg-blue-100 text-blue-800",
  inspecting: "bg-indigo-100 text-indigo-800",
  pending_approval: "bg-orange-100 text-orange-800",
  published: "bg-green-100 text-green-800",
  sold: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  draft: "bg-gray-100 text-gray-800",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

export default function AdminCarity() {
  const [listings, setListings] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [updatingShop, setUpdatingShop] = useState<string | null>(null);
  const [sendingOffer, setSendingOffer] = useState<string | null>(null);

  // Filters
  const [listingStatusFilter, setListingStatusFilter] = useState("all");
  const [sellerSearch, setSellerSearch] = useState("");
  const [listingSearch, setListingSearch] = useState("");

  // Dialogs
  const [editingListing, setEditingListing] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [viewingSeller, setViewingSeller] = useState<any | null>(null);
  const [viewingReport, setViewingReport] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    const [listingsRes, inspectionsRes, transactionsRes, shopsRes, offersRes, sellersRes, boostsRes, reportsRes] = await Promise.all([
      supabase.from("carity_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("carity_inspections").select("*, carity_listings(make, model, year, plate, seller_id)").order("assigned_at", { ascending: false }),
      supabase.from("carity_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("shops").select("id, name, is_carity_partner, carity_priority, carity_active, email, phone").order("name"),
      supabase.from("carity_inspection_offers").select("*, carity_listings(make, model, year, plate), shops(name)").order("offered_at", { ascending: false }).limit(100),
      supabase.from("carity_seller_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("carity_boosts").select("*, carity_listings(make, model, year, plate)").order("created_at", { ascending: false }),
      supabase.from("carity_inspection_reports").select("*, carity_listings(make, model, year, plate), shops(name)").order("created_at", { ascending: false }),
    ]);

    setListings((listingsRes.data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] })));
    setInspections(inspectionsRes.data || []);
    setTransactions(transactionsRes.data || []);
    setShops(shopsRes.data || []);
    setOffers(offersRes.data || []);
    setSellers(sellersRes.data || []);
    setBoosts(boostsRes.data || []);
    setReports(reportsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // === ACTIONS ===

  const updateListingStatus = async (id: string, status: string) => {
    const updates: any = { status };
    if (status === "published") updates.published_at = new Date().toISOString();
    if (status === "sold") updates.sold_at = new Date().toISOString();
    await supabase.from("carity_listings").update(updates).eq("id", id);
    toast.success(`Estado alterado para: ${STATUS_LABELS[status]}`);
    loadData();
  };

  const updateListingPrice = async (id: string, price: number) => {
    await supabase.from("carity_listings").update({ price }).eq("id", id);
    toast.success("Preço atualizado");
    loadData();
  };

  const deleteListing = async (id: string) => {
    if (!confirm("Tem a certeza que quer eliminar este anúncio? Esta ação é irreversível.")) return;
    await supabase.from("carity_listings").delete().eq("id", id);
    toast.success("Anúncio eliminado");
    loadData();
  };

  const togglePartner = async (shopId: string, value: boolean) => {
    setUpdatingShop(shopId);
    await supabase.from("shops").update({ is_carity_partner: value }).eq("id", shopId);
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, is_carity_partner: value } : s));
    toast.success(value ? "Oficina marcada como parceira" : "Oficina removida da rede");
    setUpdatingShop(null);
  };

  const toggleActive = async (shopId: string, value: boolean) => {
    setUpdatingShop(shopId);
    await supabase.from("shops").update({ carity_active: value }).eq("id", shopId);
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, carity_active: value } : s));
    toast.success(value ? "Oficina ativada" : "Oficina bloqueada");
    setUpdatingShop(null);
  };

  const updatePriority = async (shopId: string, priority: number) => {
    await supabase.from("shops").update({ carity_priority: priority }).eq("id", shopId);
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, carity_priority: priority } : s));
  };

  const toggleSellerVerified = async (sellerId: string, verified: boolean) => {
    await supabase.from("carity_seller_profiles").update({ verified }).eq("id", sellerId);
    setSellers(prev => prev.map(s => s.id === sellerId ? { ...s, verified } : s));
    toast.success(verified ? "Vendedor verificado ✓" : "Verificação removida");
  };

  const deleteSellerProfile = async (id: string) => {
    if (!confirm("Eliminar perfil de vendedor?")) return;
    await supabase.from("carity_seller_profiles").delete().eq("id", id);
    toast.success("Perfil eliminado");
    loadData();
  };

  const sendOfferToPartners = async (listingId: string) => {
    setSendingOffer(listingId);
    const partnerShops = shops.filter(s => s.is_carity_partner && s.carity_active);
    if (partnerShops.length === 0) {
      toast.error("Nenhuma oficina parceira ativa.");
      setSendingOffer(null);
      return;
    }
    const { data: inspection } = await supabase.from("carity_inspections").insert({
      listing_id: listingId, shop_id: partnerShops[0].id, payment_status: "paid", status: "pending",
    }).select().single();
    if (!inspection) { toast.error("Erro"); setSendingOffer(null); return; }

    const sorted = [...partnerShops].sort((a, b) => (b.carity_priority || 5) - (a.carity_priority || 5));
    const topShops = sorted.slice(0, 5);
    await supabase.from("carity_inspection_offers").insert(
      topShops.map(s => ({ inspection_id: inspection.id, listing_id: listingId, shop_id: s.id, status: "pending" }))
    );
    await supabase.from("carity_listings").update({ status: "pending_inspection" }).eq("id", listingId);
    toast.success(`Pedido enviado a ${topShops.length} oficinas!`);
    setSendingOffer(null);
    loadData();
  };

  const cancelBoost = async (boostId: string) => {
    await supabase.from("carity_boosts").update({ status: "cancelled" }).eq("id", boostId);
    // Also update listing
    const boost = boosts.find(b => b.id === boostId);
    if (boost) {
      await supabase.from("carity_listings").update({ boost_active: false, boost_expires_at: null }).eq("id", boost.listing_id);
    }
    toast.success("Boost cancelado");
    loadData();
  };

  // === STATS ===
  const totalListings = listings.length;
  const published = listings.filter(l => l.status === "published").length;
  const sold = listings.filter(l => l.status === "sold").length;
  const pendingApproval = listings.filter(l => l.status === "pending_approval").length;
  const pendingInspection = listings.filter(l => l.status === "pending_inspection").length;
  const paidTx = transactions.filter(t => t.status === "paid");
  const totalRevenue = paidTx.reduce((s, t) => s + Number(t.platform_amount || 0), 0);
  const inspectionRevenue = paidTx.filter(t => t.type === "inspection_fee").reduce((s, t) => s + Number(t.platform_amount || 0), 0);
  const commissionRevenue = paidTx.filter(t => t.type === "sale_commission").reduce((s, t) => s + Number(t.platform_amount || 0), 0);
  const boostRevenue = boosts.filter(b => b.status === "active" || b.status === "completed").reduce((s, b) => s + Number(b.price || 0), 0);
  const partnerShops = shops.filter(s => s.is_carity_partner);
  const verifiedSellers = sellers.filter(s => s.verified).length;
  const activeBoosts = boosts.filter(b => b.status === "active").length;
  const completedInspections = inspections.filter(i => i.status === "completed").length;

  // Filtered data
  const filteredListings = listings
    .filter(l => listingStatusFilter === "all" || l.status === listingStatusFilter)
    .filter(l => {
      if (!listingSearch) return true;
      const q = listingSearch.toLowerCase();
      return `${l.make} ${l.model} ${l.plate}`.toLowerCase().includes(q);
    });

  const filteredSellers = sellers.filter(s => {
    if (!sellerSearch) return true;
    const q = sellerSearch.toLowerCase();
    return s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.location?.toLowerCase().includes(q);
  });

  const getShopPerformance = (shopId: string) => {
    const si = inspections.filter(i => i.shop_id === shopId);
    const completed = si.filter(i => i.status === "completed").length;
    const so = offers.filter(o => o.shop_id === shopId);
    const accepted = so.filter(o => o.status === "accepted").length;
    const earnings = si.filter(i => i.status === "completed").reduce((s, i) => s + Number(i.shop_share || 0), 0);
    return { completed, total: si.length, acceptRate: so.length > 0 ? Math.round((accepted / so.length) * 100) : 0, earnings };
  };

  const getSellerListings = (userId: string) => listings.filter(l => l.seller_id === userId);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-500" />
            GarageFlow Market — Controlo Total
          </h1>
          <p className="text-muted-foreground">Carros, vendedores, inspeções, oficinas, boosts, relatórios e receita</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); loadData(); }}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* === OVERVIEW KPIs === */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {[
          { icon: Car, label: "Carros", value: totalListings, color: "text-muted-foreground" },
          { icon: CheckCircle, label: "Publicados", value: published, color: "text-green-600" },
          { icon: TrendingUp, label: "Vendidos", value: sold, color: "text-blue-600" },
          { icon: Clock, label: "Aguardam", value: pendingApproval + pendingInspection, color: "text-orange-500" },
          { icon: Users, label: "Vendedores", value: `${verifiedSellers}/${sellers.length}`, color: "text-violet-600" },
          { icon: Building2, label: "Parceiras", value: partnerShops.length, color: "text-indigo-600" },
          { icon: ClipboardCheck, label: "Inspeções", value: `${completedInspections}/${inspections.length}`, color: "text-cyan-600" },
          { icon: Zap, label: "Boosts", value: activeBoosts, color: "text-amber-500" },
        ].map(({ icon: Icon, label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-3 pb-3 text-center">
              <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
              <p className="text-xl font-bold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-950/10">
          <CardContent className="pt-4 pb-4 text-center">
            <Euro className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold text-amber-600">€{totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Receita Plataforma</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <ClipboardCheck className="h-5 w-5 mx-auto text-blue-500 mb-1" />
            <p className="text-2xl font-bold">€{inspectionRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Inspeções (30%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Star className="h-5 w-5 mx-auto text-purple-500 mb-1" />
            <p className="text-2xl font-bold">€{commissionRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Comissões (2%)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Zap className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">€{boostRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Boosts</p>
          </CardContent>
        </Card>
      </div>

      {/* Funnel */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center justify-between text-sm">
            {[
              { label: "Submetidos", value: totalListings },
              { label: "Em Inspeção", value: inspections.length },
              { label: "Aprovados", value: published + sold },
              { label: "Publicados", value: published },
              { label: "Vendidos", value: sold, highlight: true },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center flex-1">
                <div className="text-center flex-1">
                  <p className={`text-2xl font-bold ${step.highlight ? "text-green-600" : ""}`}>{step.value}</p>
                  <p className="text-xs text-muted-foreground">{step.label}</p>
                </div>
                {i < arr.length - 1 && <span className="text-muted-foreground mx-1">→</span>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* === TABS === */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="listings">Carros ({totalListings})</TabsTrigger>
          <TabsTrigger value="sellers">Vendedores ({sellers.length})</TabsTrigger>
          <TabsTrigger value="partners">Oficinas ({partnerShops.length})</TabsTrigger>
          <TabsTrigger value="inspections">Inspeções ({inspections.length})</TabsTrigger>
          <TabsTrigger value="reports">Relatórios ({reports.length})</TabsTrigger>
          <TabsTrigger value="boosts">Boosts ({boosts.length})</TabsTrigger>
          <TabsTrigger value="offers">Ofertas ({offers.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transações ({transactions.length})</TabsTrigger>
        </TabsList>

        {/* === OVERVIEW === */}
        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Recent activity */}
            <Card>
              <CardHeader><CardTitle className="text-base">Atividade Recente</CardTitle></CardHeader>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {listings.slice(0, 10).map(l => (
                  <div key={l.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium">{l.make} {l.model} ({l.year})</p>
                      <p className="text-xs text-muted-foreground">{l.plate} · €{l.price?.toLocaleString()}</p>
                    </div>
                    <Badge className={STATUS_COLORS[l.status]}>{STATUS_LABELS[l.status] || l.status}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-500" /> Alertas</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {pendingApproval > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-200">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm"><strong>{pendingApproval}</strong> carros aguardam aprovação</span>
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setTab("listings"); setListingStatusFilter("pending_approval"); }}>Ver</Button>
                  </div>
                )}
                {pendingInspection > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200">
                    <ClipboardCheck className="h-4 w-4 text-blue-500" />
                    <span className="text-sm"><strong>{pendingInspection}</strong> carros aguardam inspeção</span>
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => { setTab("listings"); setListingStatusFilter("pending_inspection"); }}>Ver</Button>
                  </div>
                )}
                {sellers.filter(s => !s.verified).length > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-violet-50 dark:bg-violet-950/20 border border-violet-200">
                    <User className="h-4 w-4 text-violet-500" />
                    <span className="text-sm"><strong>{sellers.filter(s => !s.verified).length}</strong> vendedores por verificar</span>
                    <Button size="sm" variant="outline" className="ml-auto" onClick={() => setTab("sellers")}>Ver</Button>
                  </div>
                )}
                {partnerShops.filter(s => !s.carity_active).length > 0 && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200">
                    <Building2 className="h-4 w-4 text-red-500" />
                    <span className="text-sm"><strong>{partnerShops.filter(s => !s.carity_active).length}</strong> oficinas parceiras bloqueadas</span>
                  </div>
                )}
                {pendingApproval === 0 && pendingInspection === 0 && sellers.every(s => s.verified) && (
                  <p className="text-sm text-muted-foreground text-center py-4">✅ Tudo em ordem!</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === LISTINGS === */}
        <TabsContent value="listings" className="space-y-4 mt-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar marca, modelo, matrícula..." value={listingSearch} onChange={e => setListingSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={listingStatusFilter} onValueChange={setListingStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-3.5 w-3.5 mr-1" />
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Badge variant="outline">{filteredListings.length} resultados</Badge>
          </div>

          {filteredListings.map(listing => {
            const seller = sellers.find(s => s.user_id === listing.seller_id);
            return (
              <Card key={listing.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4 items-start">
                    <div className="w-24 h-16 rounded-lg bg-muted flex-shrink-0 overflow-hidden">
                      {listing.photos[0] ? <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Car className="h-5 w-5 text-muted-foreground/30" /></div>}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{listing.make} {listing.model} ({listing.year})</h3>
                        <Badge className={STATUS_COLORS[listing.status]}>{STATUS_LABELS[listing.status] || listing.status}</Badge>
                        {listing.boost_active && <Badge className="bg-amber-100 text-amber-800 border-0"><Zap className="h-3 w-3 mr-0.5" />Boost</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {listing.plate} · {listing.fuel} · {listing.mileage?.toLocaleString()} km · €{listing.price?.toLocaleString()}
                      </p>
                      {seller && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" /> {seller.name} {seller.verified && <CheckCircle className="h-3 w-3 text-green-500" />}
                          {seller.phone && <><Phone className="h-3 w-3 ml-2" /> {seller.phone}</>}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground">ID: {listing.id.slice(0, 8)}... · Criado: {new Date(listing.created_at).toLocaleDateString("pt-PT")}</p>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {/* Quick status change */}
                      <Select value={listing.status} onValueChange={(v) => updateListingStatus(listing.id, v)}>
                        <SelectTrigger className="h-8 text-xs w-[150px]">
                          <ArrowUpDown className="h-3 w-3 mr-1" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>

                      <div className="flex gap-1">
                        {listing.status === "pending_approval" && (
                          <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => updateListingStatus(listing.id, "published")}>
                            <CheckCircle className="h-3 w-3 mr-0.5" /> Aprovar
                          </Button>
                        )}
                        {(listing.status === "pending_payment" || listing.status === "pending_inspection") && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => sendOfferToPartners(listing.id)} disabled={sendingOffer === listing.id}>
                            {sendingOffer === listing.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3 mr-0.5" />} Oficinas
                          </Button>
                        )}
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingListing(listing); setEditStatus(listing.status); setEditPrice(String(listing.price)); }}>
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteListing(listing.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filteredListings.length === 0 && <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum carro encontrado</CardContent></Card>}
        </TabsContent>

        {/* === SELLERS === */}
        <TabsContent value="sellers" className="space-y-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar vendedor..." value={sellerSearch} onChange={e => setSellerSearch(e.target.value)} className="pl-9" />
            </div>
            <Badge variant="outline">{filteredSellers.length} vendedores</Badge>
          </div>

          {filteredSellers.map(seller => {
            const sellerListings = getSellerListings(seller.user_id);
            const publishedCount = sellerListings.filter(l => l.status === "published").length;
            const soldCount = sellerListings.filter(l => l.status === "sold").length;
            return (
              <Card key={seller.id} className={seller.verified ? "border-green-200" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{seller.name || "Sem nome"}</h3>
                        {seller.verified && <Badge className="bg-green-100 text-green-800 border-0 text-xs">Verificado</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5">
                        {seller.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {seller.phone}</span>}
                        {seller.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {seller.location}</span>}
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(seller.created_at).toLocaleDateString("pt-PT")}</span>
                      </div>
                      <div className="flex gap-3 text-xs mt-1">
                        <span>{sellerListings.length} anúncios</span>
                        <span className="text-green-600">{publishedCount} ativos</span>
                        <span className="text-blue-600">{soldCount} vendidos</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Verificado</Label>
                        <Switch checked={seller.verified} onCheckedChange={v => toggleSellerVerified(seller.id, v)} />
                      </div>
                      <Button size="sm" variant="outline" className="h-8" onClick={() => setViewingSeller(seller)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="destructive" className="h-8" onClick={() => deleteSellerProfile(seller.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* === PARTNER SHOPS === */}
        <TabsContent value="partners" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-amber-600" /> Oficinas Parceiras GarageFlow Market
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {shops.map(shop => {
                const perf = getShopPerformance(shop.id);
                return (
                  <div key={shop.id} className={`p-4 rounded-lg border ${shop.is_carity_partner ? "border-amber-200 bg-amber-50/30 dark:bg-amber-900/5" : "border-border"}`}>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold flex items-center gap-2 flex-wrap">
                          {shop.name}
                          {shop.is_carity_partner && <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Parceira</Badge>}
                          {shop.is_carity_partner && !shop.carity_active && <Badge variant="destructive" className="text-xs">Bloqueada</Badge>}
                        </h3>
                        <p className="text-xs text-muted-foreground">{shop.email} · {shop.phone}</p>
                        {shop.is_carity_partner && (
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span>{perf.completed}/{perf.total} inspeções</span>
                            <span>Aceitação: {perf.acceptRate}%</span>
                            <span className="text-green-600 font-medium">€{perf.earnings.toFixed(2)} ganhos</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        {shop.is_carity_partner && (
                          <>
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">Prioridade: {shop.carity_priority}</Label>
                              <Slider value={[shop.carity_priority || 5]} onValueChange={([v]) => updatePriority(shop.id, v)} min={1} max={10} step={1} className="w-24" />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs">Ativa</Label>
                              <Switch checked={shop.carity_active} onCheckedChange={v => toggleActive(shop.id, v)} disabled={updatingShop === shop.id} />
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs">Parceira</Label>
                          <Switch checked={shop.is_carity_partner} onCheckedChange={v => togglePartner(shop.id, v)} disabled={updatingShop === shop.id} />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === INSPECTIONS === */}
        <TabsContent value="inspections" className="space-y-3 mt-4">
          {inspections.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Sem inspeções</CardContent></Card> : inspections.map(insp => (
            <Card key={insp.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold">{insp.carity_listings?.make} {insp.carity_listings?.model} ({insp.carity_listings?.year})</h3>
                    <p className="text-sm text-muted-foreground">{insp.carity_listings?.plate} · Atribuída: {new Date(insp.assigned_at).toLocaleDateString("pt-PT")}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge>{insp.status === "pending" ? "Pendente" : insp.status === "in_progress" ? "Em curso" : insp.status === "completed" ? "Concluída" : insp.status}</Badge>
                    <Badge variant="outline">{insp.payment_status === "paid" ? "Pago" : insp.payment_status}</Badge>
                    <span className="text-sm font-medium">
                      <span className="text-amber-600">€{Number(insp.platform_share).toFixed(2)}</span>
                      {" / "}
                      <span className="text-green-600">€{Number(insp.shop_share).toFixed(2)}</span>
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* === REPORTS === */}
        <TabsContent value="reports" className="space-y-3 mt-4">
          {reports.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Sem relatórios de inspeção</CardContent></Card> : reports.map(report => (
            <Card key={report.id} className={report.overall_score >= 60 ? "border-green-200" : "border-red-200"}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold">{report.carity_listings?.make} {report.carity_listings?.model} ({report.carity_listings?.year})</h3>
                    <p className="text-sm text-muted-foreground">
                      Oficina: {report.shops?.name || "—"} · {report.carity_listings?.plate}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className={`text-center px-3 py-1 rounded-lg ${report.overall_score >= 60 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      <p className="text-xl font-bold">{report.overall_score}</p>
                      <p className="text-[10px]">Score</p>
                    </div>
                    <Badge>{report.recommendation === "approved" ? "Aprovado" : report.recommendation === "rejected" ? "Rejeitado" : "Pendente"}</Badge>
                    <Button size="sm" variant="outline" onClick={() => setViewingReport(report)}>
                      <Eye className="h-3.5 w-3.5 mr-1" /> Detalhes
                    </Button>
                  </div>
                </div>
                {/* Quick status overview */}
                <div className="flex gap-2 mt-2 text-xs flex-wrap">
                  {[
                    { label: "Motor", status: report.engine_status },
                    { label: "Travões", status: report.brakes_status },
                    { label: "Suspensão", status: report.suspension_status },
                    { label: "Pneus", status: report.tires_status },
                    { label: "Elétrica", status: report.electrical_status },
                    { label: "Direção", status: report.steering_status },
                    { label: "Transmissão", status: report.transmission_status },
                  ].map(item => (
                    <Badge key={item.label} variant="outline" className={item.status === "ok" ? "border-green-300 text-green-700" : item.status === "warning" ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}>
                      {item.label}: {item.status === "ok" ? "OK" : item.status === "warning" ? "⚠️" : "❌"}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* === BOOSTS === */}
        <TabsContent value="boosts" className="space-y-3 mt-4">
          {boosts.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Sem boosts registados</CardContent></Card> : boosts.map(boost => (
            <Card key={boost.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{boost.carity_listings?.make} {boost.carity_listings?.model} ({boost.carity_listings?.year})</h3>
                    <p className="text-sm text-muted-foreground">
                      Tipo: {boost.boost_type} · €{Number(boost.price).toFixed(2)}
                      {boost.started_at && ` · Início: ${new Date(boost.started_at).toLocaleDateString("pt-PT")}`}
                      {boost.expires_at && ` · Expira: ${new Date(boost.expires_at).toLocaleDateString("pt-PT")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={boost.status === "active" ? "bg-green-100 text-green-800" : boost.status === "completed" ? "bg-blue-100 text-blue-800" : boost.status === "cancelled" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800"}>
                      {boost.status === "active" ? "Ativo" : boost.status === "completed" ? "Concluído" : boost.status === "cancelled" ? "Cancelado" : boost.status}
                    </Badge>
                    {boost.status === "active" && (
                      <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => cancelBoost(boost.id)}>Cancelar</Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* === OFFERS === */}
        <TabsContent value="offers" className="space-y-3 mt-4">
          {offers.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Sem ofertas</CardContent></Card> : offers.map(offer => (
            <Card key={offer.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{offer.carity_listings?.make} {offer.carity_listings?.model} ({offer.carity_listings?.year})</h3>
                    <p className="text-sm text-muted-foreground">Oficina: {offer.shops?.name || "—"} · {offer.carity_listings?.plate}</p>
                    {offer.rejection_reason && <p className="text-xs text-red-500 mt-0.5">Motivo: {offer.rejection_reason}</p>}
                  </div>
                  <Badge className={offer.status === "pending" ? "bg-amber-100 text-amber-800" : offer.status === "accepted" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {offer.status === "pending" ? "Pendente" : offer.status === "accepted" ? "Aceite" : "Recusada"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* === TRANSACTIONS === */}
        <TabsContent value="transactions" className="space-y-3 mt-4">
          {transactions.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Sem transações</CardContent></Card> : transactions.map(tx => (
            <Card key={tx.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{tx.type === "inspection_fee" ? "Taxa de Inspeção" : tx.type === "sale_commission" ? "Comissão de Venda" : tx.type === "boost" ? "Boost" : tx.type}</p>
                    <p className="text-sm text-muted-foreground">
                      Plataforma: €{Number(tx.platform_amount).toFixed(2)} · Oficina: €{Number(tx.shop_amount).toFixed(2)}
                      · {new Date(tx.created_at).toLocaleDateString("pt-PT")}
                    </p>
                    {tx.stripe_payment_id && <p className="text-[10px] text-muted-foreground">Stripe: {tx.stripe_payment_id}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">€{Number(tx.amount).toFixed(2)}</p>
                    <Badge variant="outline">{tx.status === "paid" ? "Pago" : tx.status}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* === EDIT LISTING DIALOG === */}
      <Dialog open={!!editingListing} onOpenChange={() => setEditingListing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Anúncio</DialogTitle>
          </DialogHeader>
          {editingListing && (
            <div className="space-y-4">
              <p className="font-semibold">{editingListing.make} {editingListing.model} ({editingListing.year}) — {editingListing.plate}</p>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Preço (€)</Label>
                <Input type="number" value={editPrice} onChange={e => setEditPrice(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingListing(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!editingListing) return;
              await updateListingStatus(editingListing.id, editStatus);
              if (editPrice && Number(editPrice) !== editingListing.price) {
                await updateListingPrice(editingListing.id, Number(editPrice));
              }
              setEditingListing(null);
            }}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* === SELLER DETAIL DIALOG === */}
      <Dialog open={!!viewingSeller} onOpenChange={() => setViewingSeller(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Perfil do Vendedor</DialogTitle>
          </DialogHeader>
          {viewingSeller && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><Label className="text-muted-foreground">Nome</Label><p className="font-medium">{viewingSeller.name || "—"}</p></div>
                <div><Label className="text-muted-foreground">Telefone</Label><p className="font-medium">{viewingSeller.phone || "—"}</p></div>
                <div><Label className="text-muted-foreground">Localização</Label><p className="font-medium">{viewingSeller.location || "—"}</p></div>
                <div><Label className="text-muted-foreground">Verificado</Label><p className="font-medium">{viewingSeller.verified ? "✅ Sim" : "❌ Não"}</p></div>
                <div><Label className="text-muted-foreground">Registo</Label><p className="font-medium">{new Date(viewingSeller.created_at).toLocaleDateString("pt-PT")}</p></div>
                <div><Label className="text-muted-foreground">User ID</Label><p className="font-mono text-xs">{viewingSeller.user_id?.slice(0, 12)}...</p></div>
              </div>
              <div>
                <Label className="text-muted-foreground">Anúncios deste vendedor</Label>
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {getSellerListings(viewingSeller.user_id).map(l => (
                    <div key={l.id} className="flex items-center justify-between p-2 rounded border">
                      <span className="text-sm">{l.make} {l.model} ({l.year}) — €{l.price?.toLocaleString()}</span>
                      <Badge className={STATUS_COLORS[l.status]}>{STATUS_LABELS[l.status]}</Badge>
                    </div>
                  ))}
                  {getSellerListings(viewingSeller.user_id).length === 0 && <p className="text-sm text-muted-foreground">Sem anúncios</p>}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* === REPORT DETAIL DIALOG === */}
      <Dialog open={!!viewingReport} onOpenChange={() => setViewingReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relatório de Inspeção</DialogTitle>
          </DialogHeader>
          {viewingReport && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-lg">{viewingReport.carity_listings?.make} {viewingReport.carity_listings?.model} ({viewingReport.carity_listings?.year})</h3>
                  <p className="text-sm text-muted-foreground">Oficina: {viewingReport.shops?.name} · {viewingReport.carity_listings?.plate}</p>
                </div>
                <div className={`text-center px-4 py-2 rounded-xl ${viewingReport.overall_score >= 60 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  <p className="text-3xl font-bold">{viewingReport.overall_score}</p>
                  <p className="text-xs">Score</p>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Motor", status: viewingReport.engine_status },
                  { label: "Travões", status: viewingReport.brakes_status },
                  { label: "Suspensão", status: viewingReport.suspension_status },
                  { label: "Pneus", status: viewingReport.tires_status },
                  { label: "Elétrica", status: viewingReport.electrical_status },
                  { label: "Direção", status: viewingReport.steering_status },
                  { label: "Transmissão", status: viewingReport.transmission_status },
                ].map(item => (
                  <div key={item.label} className={`p-3 rounded-lg border text-center ${item.status === "ok" ? "border-green-200 bg-green-50" : item.status === "warning" ? "border-amber-200 bg-amber-50" : "border-red-200 bg-red-50"}`}>
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-lg">{item.status === "ok" ? "✅" : item.status === "warning" ? "⚠️" : "❌"}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.status}</p>
                  </div>
                ))}
              </div>

              {viewingReport.inspector_notes && (
                <div>
                  <Label className="text-muted-foreground">Notas do Inspetor</Label>
                  <p className="text-sm mt-1 p-3 bg-muted rounded-lg">{viewingReport.inspector_notes}</p>
                </div>
              )}

              {viewingReport.defects && Array.isArray(viewingReport.defects) && viewingReport.defects.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">Defeitos Encontrados</Label>
                  <ul className="mt-1 space-y-1">
                    {(viewingReport.defects as any[]).map((d: any, i: number) => (
                      <li key={i} className="text-sm flex items-start gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                        <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                        <span>{typeof d === "string" ? d : d.description || JSON.stringify(d)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <Label className="text-muted-foreground">Recomendação</Label>
                <Badge className={`mt-1 ${viewingReport.recommendation === "approved" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  {viewingReport.recommendation === "approved" ? "✅ Aprovado para publicação" : viewingReport.recommendation === "rejected" ? "❌ Rejeitado" : viewingReport.recommendation}
                </Badge>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
