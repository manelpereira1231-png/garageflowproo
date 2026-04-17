import { useState, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
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
  FileText, AlertTriangle, RefreshCw, Filter, ArrowUpDown, BarChart3, Calendar, Wallet, Tag, BanknoteIcon, Shield, Mail,
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
  paused: "Pausado",
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
  paused: "bg-slate-100 text-slate-800",
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
  const [wallets, setWallets] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [saleConfirmations, setSaleConfirmations] = useState<any[]>([]);
  const [escrows, setEscrows] = useState<any[]>([]);
  const [riskFlags, setRiskFlags] = useState<any[]>([]);
  const [sellerEmails, setSellerEmails] = useState<Record<string, string>>({});
  const [scanningRisks, setScanningRisks] = useState(false);
  const [loading, setLoading] = useState(true);
  const [resolvingEscrow, setResolvingEscrow] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState("");
  const location = useLocation();
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get("tab") || "urgent");
  useEffect(() => {
    const t = new URLSearchParams(location.search).get("tab");
    if (t && t !== tab) setTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);
  const [updatingShop, setUpdatingShop] = useState<string | null>(null);
  const [sendingOffer, setSendingOffer] = useState<string | null>(null);
  const [togglingSeller, setTogglingSeller] = useState<string | null>(null);

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
    const [listingsRes, inspectionsRes, transactionsRes, shopsRes, offersRes, sellersRes, boostsRes, reportsRes, walletsRes, payoutsRes, confirmRes, escrowRes, riskFlagsRes] = await Promise.all([
      supabase.from("carity_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("carity_inspections").select("*, carity_listings(make, model, year, plate, seller_id)").order("assigned_at", { ascending: false }),
      supabase.from("carity_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("shops").select("id, name, is_carity_partner, carity_priority, carity_active, email, phone, carity_inspections_count, carity_approval_rate, carity_rating").order("name"),
      supabase.from("carity_inspection_offers").select("*, carity_listings(make, model, year, plate), shops(name)").order("offered_at", { ascending: false }).limit(100),
      supabase.from("carity_seller_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("carity_boosts").select("*, carity_listings(make, model, year, plate)").order("created_at", { ascending: false }),
      supabase.from("carity_inspection_reports").select("*, carity_listings(make, model, year, plate), shops(name)").order("created_at", { ascending: false }),
      supabase.from("shop_wallets").select("*, shops(name)").order("balance", { ascending: false }),
      supabase.from("shop_payouts").select("*, shops(name)").order("created_at", { ascending: false }).limit(100),
      supabase.from("sale_confirmations").select("*, carity_listings(make, model, year, plate, price)").order("created_at", { ascending: false }),
      supabase.from("market_escrow").select("*, carity_listings(make, model, year, plate, price)").order("created_at", { ascending: false }),
      supabase.from("audit_risk_flags" as any).select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    setListings((listingsRes.data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] })));
    setInspections(inspectionsRes.data || []);
    setTransactions(transactionsRes.data || []);
    setShops(shopsRes.data || []);
    setOffers(offersRes.data || []);
    setSellers(sellersRes.data || []);
    setBoosts(boostsRes.data || []);
    setReports(reportsRes.data || []);
    setWallets(walletsRes.data || []);
    setPayouts(payoutsRes.data || []);
    setSaleConfirmations(confirmRes.data || []);
    setEscrows(escrowRes.data || []);
    setRiskFlags((riskFlagsRes.data as any[]) || []);

    // Fetch seller emails via secure function
    const sellerUserIds = (sellersRes.data || []).map((s: any) => s.user_id).filter(Boolean);
    if (sellerUserIds.length > 0) {
      const { data: emailData } = await supabase.rpc("get_seller_emails", { seller_ids: sellerUserIds });
      if (emailData) {
        const emailMap: Record<string, string> = {};
        (emailData as any[]).forEach((e: any) => { emailMap[e.user_id] = e.email; });
        setSellerEmails(emailMap);
      }
    }

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

  const toggleSellerSuspension = async (seller: any, suspend: boolean) => {
    setTogglingSeller(seller.id);
    try {
      const { error } = await supabase
        .from("carity_seller_profiles")
        .update(
          suspend
            ? {
                suspended_at: new Date().toISOString(),
                suspension_reason: seller.suspension_reason || "Suspenso manualmente pelo administrador",
              }
            : {
                suspended_at: null,
                suspension_reason: null,
              }
        )
        .eq("id", seller.id);

      if (error) throw error;

      if (suspend) {
        const { error: listingsError } = await supabase
          .from("carity_listings")
          .update({ status: "paused" })
          .eq("seller_id", seller.user_id)
          .eq("status", "published");

        if (listingsError) throw listingsError;
      }

      toast.success(
        suspend
          ? "Vendedor suspenso e anúncios publicados pausados"
          : "Vendedor reativado"
      );
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar vendedor");
    } finally {
      setTogglingSeller(null);
    }
  };

  const deleteSellerProfile = async (id: string) => {
    if (!confirm("Eliminar perfil de vendedor?")) return;
    await supabase.from("carity_seller_profiles").delete().eq("id", id);
    toast.success("Perfil eliminado");
    loadData();
  };

  // Haversine distance in km
  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const sendOfferToPartners = async (listingId: string, gifted = false) => {
    setSendingOffer(listingId);
    const partnerShops = shops.filter(s => s.is_carity_partner && s.carity_active);
    if (partnerShops.length === 0) {
      toast.error("Nenhuma oficina parceira ativa.");
      setSendingOffer(null);
      return;
    }

    // Get the listing details for notification text
    const listing = listings.find(l => l.id === listingId);
    const listingLabel = listing
      ? `${listing.make} ${listing.model} (${listing.year}) - ${listing.plate}`
      : "Veículo";

    // Get seller profile for GPS-based sorting
    let sellerLat: number | null = null;
    let sellerLon: number | null = null;
    if (listing?.seller_id) {
      const { data: sellerProfile } = await supabase
        .from("carity_seller_profiles")
        .select("location")
        .eq("user_id", listing.seller_id)
        .single();
      // Try to parse location or use listing metadata if available
    }

    // Sort by GPS distance if shops have coordinates, fallback to priority
    let sorted = [...partnerShops];
    const shopsWithCoords = sorted.filter(s => s.latitude && s.longitude);
    const shopsWithoutCoords = sorted.filter(s => !s.latitude || !s.longitude);

    if (shopsWithCoords.length > 0) {
      // If we have seller coords, sort by distance; otherwise sort by priority then coords first
      shopsWithCoords.sort((a, b) => {
        if (sellerLat && sellerLon) {
          const distA = haversineKm(sellerLat, sellerLon, a.latitude, a.longitude);
          const distB = haversineKm(sellerLat, sellerLon, b.latitude, b.longitude);
          return distA - distB;
        }
        return (b.carity_priority || 5) - (a.carity_priority || 5);
      });
      // Prioritize shops with GPS, then the rest by priority
      shopsWithoutCoords.sort((a, b) => (b.carity_priority || 5) - (a.carity_priority || 5));
      sorted = [...shopsWithCoords, ...shopsWithoutCoords];
    } else {
      sorted.sort((a, b) => (b.carity_priority || 5) - (a.carity_priority || 5));
    }

    const topShops = sorted.slice(0, 5);

    // Create inspection record
    const { data: inspection } = await supabase.from("carity_inspections").insert({
      listing_id: listingId,
      shop_id: topShops[0].id,
      payment_status: gifted ? "gifted" : "paid",
       payment_amount: gifted ? 0 : 24.90,
       shop_share: gifted ? 0 : 16.18,
       platform_share: gifted ? 0 : 8.72,
      status: "pending",
      notes: gifted
        ? `Inspeção oferecida pelo administrador — ${listingLabel}`
        : `Inspeção paga — ${listingLabel}`,
    }).select().single();
    if (!inspection) { toast.error("Erro ao criar inspeção"); setSendingOffer(null); return; }

    // Create offers for all top shops
    await supabase.from("carity_inspection_offers").insert(
      topShops.map(s => ({ inspection_id: inspection.id, listing_id: listingId, shop_id: s.id, status: "pending" }))
    );

    // Update listing status
    await supabase.from("carity_listings").update({ status: "pending_inspection", shop_id: topShops[0].id }).eq("id", listingId);

    // Create in-app notifications for each shop
    await supabase.from("notifications").insert(
      topShops.map(s => ({
        shop_id: s.id,
        title: gifted ? "🎁 Inspeção Market oferecida!" : "🚗 Nova inspeção Market disponível",
        message: `Novo pedido de inspeção: ${listingLabel}. Aceite antes que outra oficina o faça!`,
        type: "carity_inspection",
        link: "/market/inspections",
      }))
    );

    // Send push notifications (non-blocking)
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    if (projectId) {
      for (const shop of topShops) {
        fetch(`https://${projectId}.supabase.co/functions/v1/send-push`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shop_id: shop.id,
            title: gifted ? "🎁 Inspeção oferecida!" : "🚗 Nova inspeção Market",
            body: `${listingLabel} — Aceite agora!`,
            url: "/market/inspections",
          }),
        }).catch(() => {});
      }
    }

    toast.success(gifted
      ? `Inspeção OFERECIDA e enviada a ${topShops.length} oficinas! 🎁`
      : `Pedido enviado a ${topShops.length} oficinas!`
    );
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

  // Escrow admin actions
  const handleEscrowResolve = async (escrowId: string, action: "release" | "refund") => {
    setResolvingEscrow(escrowId);
    try {
      const { data, error } = await supabase.functions.invoke("market-escrow-manage", {
        body: { escrow_id: escrowId, action: action === "release" ? "admin_release" : "admin_refund", resolution_notes: resolveNotes },
      });
      if (error) throw error;
      toast.success(action === "release" ? "Fundos libertados para o vendedor!" : "Reembolso processado!");
      setResolveNotes("");
      loadData();
    } catch (err: any) {
      toast.error(err.message || "Erro ao resolver escrow");
    }
    setResolvingEscrow(null);
  };

  // === STATS ===
  const totalListings = listings.length;
  const published = listings.filter(l => l.status === "published").length;
  const sold = listings.filter(l => l.status === "sold").length;
  const pendingApproval = listings.filter(l => l.status === "pending_approval").length;
  const pendingInspection = listings.filter(l => l.status === "pending_inspection").length;
  // REGRA: Apenas transações com pagamento Stripe verificado contam como receita
  const verifiedTx = transactions.filter(t => t.status === "paid" && t.stripe_verified === true);
  const unverifiedTx = transactions.filter(t => t.status === "paid" && !t.stripe_verified);
  const totalRevenue = verifiedTx.reduce((s, t) => s + Number(t.platform_amount || 0), 0);
  const inspectionRevenue = verifiedTx.filter(t => t.type === "inspection_fee").reduce((s, t) => s + Number(t.platform_amount || 0), 0);
  const commissionRevenue = verifiedTx.filter(t => t.type === "sale_commission").reduce((s, t) => s + Number(t.platform_amount || 0), 0);
  const verifiedBoosts = boosts.filter(b => (b.status === "active" || b.status === "completed") && b.stripe_verified === true);
  const boostRevenue = verifiedBoosts.reduce((s, b) => s + Number(b.price || 0), 0);
  const unverifiedBoostRevenue = boosts.filter(b => (b.status === "active" || b.status === "completed") && !b.stripe_verified).reduce((s, b) => s + Number(b.price || 0), 0);
  const partnerShops = shops.filter(s => s.is_carity_partner);
  const verifiedSellers = sellers.filter(s => s.verified).length;
  const activeBoosts = boosts.filter(b => b.status === "active").length;
  const completedInspections = inspections.filter(i => i.status === "completed").length;
  const pendingKyc = sellers.filter(s => s.kyc_status === "submitted").length;
  const urgentEscrows = escrows.filter(e => ["paid", "delivery_confirmed", "disputed"].includes(e.status));
  const disputedEscrows = escrows.filter(e => e.status === "disputed").length;
  const suspendedSellers = sellers.filter(s => !!s.suspended_at).length;
  const sellersNeedingAttention = sellers.filter(s => !s.verified || !!s.suspended_at || s.kyc_status === "submitted");
  const totalWalletBalance = wallets.reduce((sum, wallet) => sum + Number(wallet.balance || 0), 0);
  const pendingPayouts = payouts.filter(p => ["pending", "processing"].includes(p.status)).length;

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
    const email = sellerEmails[s.user_id] || "";
    return s.name?.toLowerCase().includes(q) || s.phone?.includes(q) || s.location?.toLowerCase().includes(q) || email.toLowerCase().includes(q);
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
          <p className="text-muted-foreground">Dinheiro, escrows, KYC, vendedores e operações críticas num só sítio</p>
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
            <p className="text-xs text-muted-foreground">Receita Stripe Verificada</p>
            {unverifiedTx.length > 0 && (
              <p className="text-[10px] text-destructive mt-1">⚠ €{unverifiedTx.reduce((s, t) => s + Number(t.platform_amount || 0), 0).toFixed(2)} não verificado</p>
            )}
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
            <p className="text-xs text-muted-foreground">Boosts (Stripe)</p>
            {unverifiedBoostRevenue > 0 && (
              <p className="text-[10px] text-destructive mt-1">⚠ €{unverifiedBoostRevenue.toFixed(2)} não verificado</p>
            )}
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
          <TabsTrigger value="urgent">⚡ Para Resolver</TabsTrigger>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="listings">Carros ({totalListings})</TabsTrigger>
          <TabsTrigger value="sellers">Vendedores ({sellers.length})</TabsTrigger>
          <TabsTrigger value="partners">Oficinas ({partnerShops.length})</TabsTrigger>
          <TabsTrigger value="inspections">Inspeções ({inspections.length})</TabsTrigger>
          <TabsTrigger value="reports">Relatórios ({reports.length})</TabsTrigger>
          <TabsTrigger value="boosts">Boosts ({boosts.length})</TabsTrigger>
          <TabsTrigger value="offers">Ofertas ({offers.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transações ({transactions.length})</TabsTrigger>
          <TabsTrigger value="wallets">💰 Wallets ({wallets.length})</TabsTrigger>
          <TabsTrigger value="sales">🏷️ Vendas ({saleConfirmations.length})</TabsTrigger>
          <TabsTrigger value="escrows">⚖️ Escrow ({escrows.length})</TabsTrigger>
          <TabsTrigger value="risk">🚨 Risco ({riskFlags.filter(f => !f.auto_resolved && !f.reviewed_by).length})</TabsTrigger>
        </TabsList>

        {/* === URGENT === */}
        <TabsContent value="urgent" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold">{urgentEscrows.length}</p>
                    <p className="text-xs text-muted-foreground">Escrows por resolver</p>
                  </div>
                  <Shield className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-xs text-muted-foreground">{disputedEscrows} disputa(s) abertas</p>
                <Button size="sm" className="w-full" onClick={() => setTab("escrows")}>Abrir escrows</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold">{pendingKyc}</p>
                    <p className="text-xs text-muted-foreground">KYC pendentes</p>
                  </div>
                  <User className="h-4 w-4 text-violet-600" />
                </div>
                <p className="text-xs text-muted-foreground">Identidades à espera de revisão</p>
                <Button size="sm" variant="outline" className="w-full" onClick={() => { window.location.href = "/admin/market-kyc"; }}>Abrir KYC</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold">€{totalWalletBalance.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Saldo em wallets</p>
                  </div>
                  <Wallet className="h-4 w-4 text-green-600" />
                </div>
                <p className="text-xs text-muted-foreground">{pendingPayouts} payout(s) pendentes</p>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setTab("wallets")}>Abrir dinheiro</Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-2xl font-bold">{sellersNeedingAttention.length}</p>
                    <p className="text-xs text-muted-foreground">Vendedores com ação</p>
                  </div>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </div>
                <p className="text-xs text-muted-foreground">{suspendedSellers} suspenso(s)</p>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setTab("sellers")}>Abrir vendedores</Button>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Escrows críticos</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {urgentEscrows.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem escrows urgentes.</p>
                ) : urgentEscrows.slice(0, 4).map((escrow: any) => (
                  <div key={escrow.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{escrow.carity_listings?.make} {escrow.carity_listings?.model} ({escrow.carity_listings?.year})</p>
                        <p className="text-xs text-muted-foreground">{escrow.carity_listings?.plate} · €{Number(escrow.amount || 0).toFixed(2)}</p>
                      </div>
                      <Badge className={escrow.status === "disputed" ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"}>{escrow.status}</Badge>
                    </div>
                    {escrow.buyer_dispute_reason && <p className="text-xs text-red-600">{escrow.buyer_dispute_reason}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => handleEscrowResolve(escrow.id, "release")} disabled={resolvingEscrow === escrow.id}>
                        {resolvingEscrow === escrow.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />} Libertar
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleEscrowResolve(escrow.id, "refund")} disabled={resolvingEscrow === escrow.id}>
                        {resolvingEscrow === escrow.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />} Reembolsar
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Vendedores a tratar</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {sellersNeedingAttention.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sem ações pendentes nos vendedores.</p>
                ) : sellersNeedingAttention.slice(0, 5).map((seller: any) => (
                  <div key={seller.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{seller.name || "Sem nome"}</p>
                      <p className="text-xs text-muted-foreground">
                        {seller.suspended_at ? "Suspenso" : seller.kyc_status === "submitted" ? "KYC pendente" : !seller.verified ? "Por verificar" : "Ativo"}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap justify-end">
                      {!seller.verified && (
                        <Button size="sm" variant="outline" onClick={() => toggleSellerVerified(seller.id, true)}>
                          Verificar
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={seller.suspended_at ? "outline" : "destructive"}
                        onClick={() => toggleSellerSuspension(seller, !seller.suspended_at)}
                        disabled={togglingSeller === seller.id}
                      >
                        {togglingSeller === seller.id ? <Loader2 className="h-3 w-3 animate-spin" /> : seller.suspended_at ? "Reativar" : "Suspender"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

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
                        {(listing.status === "pending_payment" || listing.status === "pending_inspection") && (
                          <Button size="sm" variant="outline" className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50" onClick={() => sendOfferToPartners(listing.id, true)} disabled={sendingOffer === listing.id}>
                            {sendingOffer === listing.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Euro className="h-3 w-3 mr-0.5" />} Oferecer
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
              <Card key={seller.id} className={seller.suspended_at ? "border-red-200" : seller.verified ? "border-green-200" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{seller.name || "Sem nome"}</h3>
                        {seller.verified && <Badge className="bg-green-100 text-green-800 border-0 text-xs">Verificado</Badge>}
                        {seller.kyc_status === "submitted" && <Badge className="bg-violet-100 text-violet-800 border-0 text-xs">KYC pendente</Badge>}
                        {seller.suspended_at && <Badge variant="destructive" className="text-xs">Suspenso</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-0.5 flex-wrap">
                        {sellerEmails[seller.user_id] && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {sellerEmails[seller.user_id]}</span>}
                        {seller.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {seller.phone}</span>}
                        {seller.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {seller.location}</span>}
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(seller.created_at).toLocaleDateString("pt-PT")}</span>
                      </div>
                      <div className="flex gap-3 text-xs mt-1">
                        <span>{sellerListings.length} anúncios</span>
                        <span className="text-green-600">{publishedCount} ativos</span>
                        <span className="text-blue-600">{soldCount} vendidos</span>
                      </div>
                      {seller.suspension_reason && <p className="text-xs text-red-600 mt-1">Motivo: {seller.suspension_reason}</p>}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <div className="flex items-center gap-2">
                        <Label className="text-xs">Verificado</Label>
                        <Switch checked={seller.verified} onCheckedChange={v => toggleSellerVerified(seller.id, v)} />
                      </div>
                      {seller.kyc_status === "submitted" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => { window.location.href = "/admin/market-kyc"; }}>
                          KYC
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={seller.suspended_at ? "outline" : "destructive"}
                        className="h-8"
                        onClick={() => toggleSellerSuspension(seller, !seller.suspended_at)}
                        disabled={togglingSeller === seller.id}
                      >
                        {togglingSeller === seller.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : seller.suspended_at ? "Reativar" : "Suspender"}
                      </Button>
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
          {inspections.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Sem inspeções</CardContent></Card> : inspections.map(insp => {
            const shopName = shops.find(s => s.id === insp.shop_id)?.name || "—";
            const assignedDate = new Date(insp.assigned_at);
            const contactedAt = insp.seller_contacted_at ? new Date(insp.seller_contacted_at) : null;
            const startedAt = insp.started_at ? new Date(insp.started_at) : null;
            const completedAt = insp.completed_at ? new Date(insp.completed_at) : null;
            const scheduledDate = (insp as any).scheduled_date;
            const scheduledTime = (insp as any).scheduled_time;

            // Time between steps
            const contactDelay = contactedAt ? Math.round((contactedAt.getTime() - assignedDate.getTime()) / 3600000) : null;
            const inspDuration = startedAt && completedAt ? Math.round((completedAt.getTime() - startedAt.getTime()) / 60000) : null;
            const noContact = !contactedAt && insp.status === "pending" && (Date.now() - assignedDate.getTime()) > 24 * 3600000;

            return (
              <Card key={insp.id} className={noContact ? "border-red-300" : ""}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-semibold">{insp.carity_listings?.make} {insp.carity_listings?.model} ({insp.carity_listings?.year})</h3>
                      <p className="text-sm text-muted-foreground">{insp.carity_listings?.plate} · Oficina: {shopName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={
                        insp.status === "pending" ? "bg-amber-100 text-amber-800" :
                        insp.status === "scheduled" ? "bg-blue-100 text-blue-800" :
                        insp.status === "in_progress" ? "bg-purple-100 text-purple-800" :
                        insp.status === "completed" ? "bg-green-100 text-green-800" :
                        "bg-gray-100 text-gray-800"
                      }>
                        {insp.status === "pending" ? "Aguarda contacto" : insp.status === "scheduled" ? "Agendada" : insp.status === "in_progress" ? "Em curso" : insp.status === "completed" ? "Concluída" : insp.status}
                      </Badge>
                      <Badge variant="outline">{insp.payment_status === "paid" ? "Pago" : insp.payment_status}</Badge>
                      <span className="text-sm font-medium">
                        <span className="text-amber-600">€{Number(insp.platform_share).toFixed(2)}</span>
                        {" / "}
                        <span className="text-green-600">€{Number(insp.shop_share).toFixed(2)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Timeline tracking */}
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-muted-foreground">📋 Atribuída: {assignedDate.toLocaleDateString("pt-PT")} {assignedDate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
                    {contactedAt && (
                      <span className="text-blue-600">📱 Contacto: {contactedAt.toLocaleDateString("pt-PT")} ({contactDelay}h depois)</span>
                    )}
                    {scheduledDate && (
                      <span className="text-indigo-600">📅 Agendada: {scheduledDate}{scheduledTime ? ` às ${scheduledTime}` : ""}</span>
                    )}
                    {startedAt && (
                      <span className="text-purple-600">🔧 Iniciada: {startedAt.toLocaleDateString("pt-PT")} {startedAt.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}</span>
                    )}
                    {completedAt && (
                      <span className="text-green-600">✅ Concluída: {completedAt.toLocaleDateString("pt-PT")} ({inspDuration}min)</span>
                    )}
                  </div>

                  {noContact && (
                    <p className="text-xs text-red-600 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      ⚠️ Oficina não contactou o vendedor há mais de 24h — considerar reatribuição
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
                    {boost.stripe_verified ? (
                      <Badge className="bg-green-100 text-green-800 border-0 text-[10px]">✓ Stripe</Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">⚠ Não verificado</Badge>
                    )}
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
                    <div className="text-right flex flex-col items-end gap-1">
                      <p className="font-bold text-lg">€{Number(tx.amount).toFixed(2)}</p>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{tx.status === "paid" ? "Pago" : tx.status}</Badge>
                        {tx.stripe_verified ? (
                          <Badge className="bg-green-100 text-green-800 border-0 text-[10px]">✓ Stripe</Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[10px]">⚠ Não verificado</Badge>
                        )}
                      </div>
                    </div>
                  </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* === WALLETS === */}
        <TabsContent value="wallets" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Wallet className="h-4 w-4" /> Wallets das Oficinas Parceiras</CardTitle></CardHeader>
            <CardContent>
              {wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma wallet criada. As wallets são criadas automaticamente quando uma oficina recebe o primeiro pagamento.</p>
              ) : (
                <div className="space-y-3">
                  {wallets.map(w => (
                    <div key={w.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{w.shops?.name || w.shop_id?.slice(0, 8)}</p>
                        <p className="text-xs text-muted-foreground">Ganho: €{Number(w.total_earned || 0).toFixed(2)} · Pago: €{Number(w.total_paid || 0).toFixed(2)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">€{Number(w.balance || 0).toFixed(2)}</p>
                        <Badge className={w.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>{w.status === "active" ? "Ativa" : "Bloqueada"}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BanknoteIcon className="h-4 w-4" /> Pedidos de Levantamento</CardTitle></CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Sem payouts registados</p>
              ) : (
                <div className="space-y-2">
                  {payouts.map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 border rounded gap-3 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{p.shops?.name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-PT")} · {p.method}</p>
                        {p.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line bg-muted p-1.5 rounded">{p.notes}</p>}
                        {p.reference && <p className="text-xs text-muted-foreground">Ref: {p.reference}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <p className="font-semibold">€{Number(p.amount || 0).toFixed(2)}</p>
                        <Badge variant="outline" className="text-xs">{p.status === "paid" ? "✅ Pago" : p.status === "rejected" ? "❌ Rejeitado" : p.status === "processing" ? "⏳ A processar" : "🕐 Pendente"}</Badge>
                        {p.status === "pending" && (
                          <div className="flex gap-1 mt-1">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={async () => {
                              const ref = window.prompt("Referência da transferência (opcional):") || "";
                              const { error } = await supabase.rpc("mark_shop_payout_paid" as any, { _payout_id: p.id, _reference: ref });
                              if (error) toast.error(error.message); else { toast.success("Marcado como pago"); loadData(); }
                            }}>✅ Marcar pago</Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs text-red-600" onClick={async () => {
                              const reason = window.prompt("Motivo da rejeição:") || "";
                              if (!reason) return;
                              const { error } = await supabase.rpc("reject_shop_payout" as any, { _payout_id: p.id, _reason: reason });
                              if (error) toast.error(error.message); else { toast.success("Rejeitado — saldo devolvido"); loadData(); }
                            }}>❌ Rejeitar</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === SALES CONFIRMATIONS === */}
        <TabsContent value="sales" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Tag className="h-4 w-4" /> Confirmações de Venda (Dupla Confirmação)</CardTitle></CardHeader>
            <CardContent>
              {saleConfirmations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma venda registada. As vendas aparecem aqui quando o vendedor marca um carro como vendido.</p>
              ) : (
                <div className="space-y-3">
                  {saleConfirmations.map(sc => (
                    <div key={sc.id} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">{sc.carity_listings?.make} {sc.carity_listings?.model} ({sc.carity_listings?.year})</p>
                          <p className="text-xs text-muted-foreground">{sc.carity_listings?.plate} · €{Number(sc.sale_price || sc.carity_listings?.price || 0).toLocaleString()}</p>
                        </div>
                        <div className="flex gap-2">
                          <Badge className={sc.seller_confirmed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            Vendedor: {sc.seller_confirmed ? "✅" : "⏳"}
                          </Badge>
                          <Badge className={sc.buyer_confirmed ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                            Comprador: {sc.buyer_confirmed ? "✅" : "⏳"}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Comprador: {sc.buyer_email || "—"} {sc.buyer_phone ? `· ${sc.buyer_phone}` : ""} · {new Date(sc.created_at).toLocaleDateString("pt-PT")}
                        {sc.confirmed_at && ` · Confirmado: ${new Date(sc.confirmed_at).toLocaleDateString("pt-PT")}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === ESCROW / DISPUTES === */}
        <TabsContent value="escrows" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4" /> Escrow &amp; Disputas</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="outline">{urgentEscrows.length} por resolver</Badge>
                <Badge variant="outline">{disputedEscrows} disputa(s)</Badge>
                <Badge variant="outline">{escrows.filter(e => e.status === "released").length} libertados</Badge>
                <Badge variant="outline">{escrows.filter(e => e.status === "refunded").length} reembolsados</Badge>
              </div>
              {escrows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma transação escrow</p>
              ) : (
                <div className="space-y-4">
                  {escrows.map((e: any) => {
                    const l = e.carity_listings;
                    const isDisputed = e.status === "disputed";
                    const isPaid = e.status === "paid";
                    const statusColor = isDisputed ? "bg-red-100 text-red-800" : e.status === "released" ? "bg-green-100 text-green-800" : e.status === "refunded" ? "bg-slate-100 text-slate-800" : isPaid ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800";
                    return (
                      <div key={e.id} className={`border rounded-lg p-4 space-y-3 ${isDisputed ? "border-red-300 bg-red-50/30 dark:bg-red-950/10" : ""}`}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <p className="font-semibold text-sm">{l?.make} {l?.model} ({l?.year}) — {l?.plate}</p>
                            <p className="text-xs text-muted-foreground">€{Number(e.amount).toLocaleString()} • Comissão: €{Number(e.platform_fee).toFixed(2)} • Vendedor: €{Number(e.seller_amount).toFixed(2)}</p>
                          </div>
                          <Badge className={statusColor}>{e.status}</Badge>
                        </div>

                        {isDisputed && (
                          <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg space-y-2 text-sm">
                            <p className="font-medium text-red-700 dark:text-red-300">🚨 Razão do comprador:</p>
                            <p className="text-red-600 dark:text-red-400">{e.buyer_dispute_reason || "Sem descrição"}</p>
                            {e.seller_dispute_response && (
                              <>
                                <p className="font-medium text-blue-700 dark:text-blue-300 mt-2">📝 Resposta do vendedor:</p>
                                <p className="text-blue-600 dark:text-blue-400">{e.seller_dispute_response}</p>
                              </>
                            )}
                          </div>
                        )}

                        {e.resolution_notes && (
                          <div className="bg-muted p-2 rounded text-xs">
                            <span className="font-medium">Resolução:</span> {e.resolution_notes}
                          </div>
                        )}

                        {(isDisputed || isPaid) && (
                          <div className="flex items-end gap-3 pt-2 border-t">
                            <div className="flex-1">
                              <Label className="text-xs">Notas de resolução</Label>
                              <Textarea
                                value={resolvingEscrow === e.id ? resolveNotes : ""}
                                onChange={ev => { setResolvingEscrow(e.id); setResolveNotes(ev.target.value); }}
                                placeholder="Notas para registo interno..."
                                rows={2}
                                className="text-sm"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                disabled={resolvingEscrow === e.id}
                                onClick={() => handleEscrowResolve(e.id, "release")}
                              >
                                {resolvingEscrow === e.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                                Libertar Fundos
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={resolvingEscrow === e.id}
                                onClick={() => handleEscrowResolve(e.id, "refund")}
                              >
                                {resolvingEscrow === e.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                Reembolsar
                              </Button>
                            </div>
                          </div>
                        )}

                        <p className="text-[10px] text-muted-foreground">ID: {e.id} • Criado: {new Date(e.created_at).toLocaleString("pt-PT")} {e.delivery_deadline ? `• Deadline: ${new Date(e.delivery_deadline).toLocaleDateString("pt-PT")}` : ""}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === RISK FLAGS TAB === */}
        <TabsContent value="risk">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Flags de Risco e Auditoria
                </CardTitle>
                <Button
                  onClick={async () => {
                    setScanningRisks(true);
                    try {
                      const { data, error } = await supabase.rpc("flag_suspicious_transactions");
                      if (error) throw error;
                      const result = data as any;
                      toast.success(`Scan concluído: ${result?.flagged || 0} nova(s) flag(s) criada(s)`);
                      loadData();
                    } catch (err: any) {
                      toast.error(err.message || "Erro ao executar scan");
                    } finally {
                      setScanningRisks(false);
                    }
                  }}
                  disabled={scanningRisks}
                  size="sm"
                >
                  {scanningRisks ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Search className="h-4 w-4 mr-1" />}
                  Executar Scan de Risco
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {riskFlags.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhuma flag de risco. Execute um scan para verificar.</p>
              ) : (
                <div className="space-y-3">
                  {riskFlags.map((flag: any) => {
                    const isReviewed = !!flag.reviewed_by;
                    const severityColors: Record<string, string> = {
                      critical: "bg-red-100 text-red-800 border-red-200",
                      high: "bg-orange-100 text-orange-800 border-orange-200",
                      medium: "bg-amber-100 text-amber-800 border-amber-200",
                      info: "bg-blue-100 text-blue-800 border-blue-200",
                    };
                    const flagTypeLabels: Record<string, string> = {
                      high_value_transaction: "💰 Alto Valor",
                      rapid_seller_activity: "⚡ Atividade Rápida",
                      stale_escrow: "⏰ Escrow Estagnado",
                      low_trust_active_seller: "🔻 Trust Baixo",
                      random_audit_sample: "🎲 Amostra Aleatória",
                      chat_evasion_repeat: "🚫 Evasão de Chat",
                    };

                    return (
                      <div key={flag.id} className={`p-4 rounded-lg border ${isReviewed ? 'opacity-60 bg-muted/30' : 'bg-background'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={severityColors[flag.severity] || severityColors.medium}>
                                {flag.severity?.toUpperCase()}
                              </Badge>
                              <Badge variant="outline">
                                {flagTypeLabels[flag.flag_type] || flag.flag_type}
                              </Badge>
                              {isReviewed && <Badge className="bg-green-100 text-green-800">✓ Revisto</Badge>}
                            </div>
                            <p className="text-sm font-medium">{flag.description}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(flag.created_at).toLocaleString("pt-PT")} • {flag.entity_type}: {flag.entity_id?.slice(0, 8)}...
                            </p>
                            {flag.review_notes && (
                              <p className="text-xs text-muted-foreground mt-1 p-2 bg-muted rounded">
                                📝 {flag.review_notes}
                              </p>
                            )}
                          </div>
                          {!isReviewed && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async () => {
                                const notes = prompt("Notas de revisão (opcional):");
                                const { data: { user } } = await supabase.auth.getUser();
                                await supabase.from("audit_risk_flags" as any).update({
                                  reviewed_by: user?.id,
                                  reviewed_at: new Date().toISOString(),
                                  review_notes: notes || "Revisto sem notas",
                                }).eq("id", flag.id);
                                toast.success("Flag marcada como revista");
                                loadData();
                              }}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" /> Marcar Revisto
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
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
                <div><Label className="text-muted-foreground">KYC</Label><p className="font-medium">{viewingSeller.kyc_status || "—"}</p></div>
                <div><Label className="text-muted-foreground">Suspensão</Label><p className="font-medium">{viewingSeller.suspended_at ? "✅ Suspenso" : "Ativo"}</p></div>
                <div><Label className="text-muted-foreground">Registo</Label><p className="font-medium">{new Date(viewingSeller.created_at).toLocaleDateString("pt-PT")}</p></div>
                <div><Label className="text-muted-foreground">User ID</Label><p className="font-mono text-xs">{viewingSeller.user_id?.slice(0, 12)}...</p></div>
                {viewingSeller.suspension_reason && <div className="col-span-2"><Label className="text-muted-foreground">Motivo da suspensão</Label><p className="font-medium">{viewingSeller.suspension_reason}</p></div>}
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
