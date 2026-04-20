import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Car, MessageCircle, Clock, CheckCircle, Plus, ArrowRight,
  ShieldCheck, Star, TrendingUp, Eye, Rocket, AlertTriangle,
  CreditCard, FileCheck, Users, Package
} from "lucide-react";
import MarketLayout from "@/components/MarketLayout";
import { useCountryPricing } from "@/hooks/useCountryPricing";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Aguarda Pagamento",
  pending_inspection: "Aguarda Inspeção",
  inspecting: "Em Inspeção",
  published: "Publicado",
  sold: "Vendido",
  rejected: "Rejeitado",
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "text-amber-600",
  pending_inspection: "text-blue-600",
  inspecting: "text-purple-600",
  published: "text-green-600",
  sold: "text-muted-foreground",
  rejected: "text-destructive",
};

export default function MarketDashboard() {
  const navigate = useNavigate();
  const { formatPrice } = useCountryPricing();
  const [loading, setLoading] = useState(true);
  const [sellerName, setSellerName] = useState("");
  const [verified, setVerified] = useState(false);

  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    pendingInspection: 0,
    sold: 0,
    unreadMessages: 0,
    pendingOffers: 0,
    totalViews: 0,
    activeBoosts: 0,
    trustScore: 0,
    trustLevel: "new",
  });

  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [activeInspections, setActiveInspections] = useState<any[]>([]);
  const [recentOffers, setRecentOffers] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth"); return; }

    // Seller profile
    const { data: profile } = await supabase
      .from("carity_seller_profiles")
      .select("name, verified")
      .eq("user_id", user.id)
      .maybeSingle();

    setSellerName(profile?.name || user.user_metadata?.name || "Vendedor");
    setVerified(profile?.verified || false);

    // Trust score
    const { data: trust } = await supabase
      .from("seller_trust_scores")
      .select("score_points, trust_level, successful_sales, total_inspections, avg_rating")
      .eq("user_id", user.id)
      .maybeSingle();

    // All listings
    const { data: listings } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, price, status, photos, created_at, boost_active")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    const all = (listings || []).map((l: any) => ({
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : [],
    }));

    // Unread messages
    const { count: unread } = await supabase
      .from("carity_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("read", false);

    // Pending offers (as seller)
    const { data: offers } = await supabase
      .from("carity_offers")
      .select("id, amount, listing_id, created_at, status")
      .eq("seller_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(5);

    // Active inspections
    const listingIds = all.map((l: any) => l.id);
    let inspections: any[] = [];
    if (listingIds.length > 0) {
      const { data: insp } = await supabase
        .from("carity_inspections")
        .select("id, listing_id, status, scheduled_date, scheduled_time, shop_id")
        .in("listing_id", listingIds)
        .in("status", ["pending", "in_progress", "scheduled"]);
      inspections = insp || [];
    }

    // Enrich inspections with listing info
    const listingsMap: Record<string, any> = {};
    all.forEach((l: any) => { listingsMap[l.id] = l; });

    const enrichedInspections = inspections.map(i => ({
      ...i,
      listing: listingsMap[i.listing_id],
    }));

    setStats({
      total: all.length,
      published: all.filter(l => l.status === "published").length,
      pendingInspection: all.filter(l => ["pending_payment", "pending_inspection", "inspecting"].includes(l.status)).length,
      sold: all.filter(l => l.status === "sold").length,
      unreadMessages: unread || 0,
      pendingOffers: (offers || []).length,
      totalViews: 0,
      activeBoosts: all.filter(l => l.boost_active).length,
      trustScore: trust?.score_points || 0,
      trustLevel: trust?.trust_level || "new",
    });

    setRecentListings(all.slice(0, 5));
    setActiveInspections(enrichedInspections.slice(0, 3));
    setRecentOffers((offers || []).map(o => ({
      ...o,
      listing: listingsMap[o.listing_id],
    })));

    setLoading(false);
  };

  const trustLevelLabel: Record<string, { label: string; color: string }> = {
    new: { label: "Novo", color: "bg-muted text-muted-foreground" },
    bronze: { label: "Bronze", color: "bg-amber-100 text-amber-800" },
    silver: { label: "Prata", color: "bg-slate-200 text-slate-700" },
    gold: { label: "Ouro", color: "bg-yellow-100 text-yellow-800" },
    platinum: { label: "Platina", color: "bg-purple-100 text-purple-800" },
  };

  if (loading) {
    return (
      <MarketLayout>
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </MarketLayout>
    );
  }

  const trustInfo = trustLevelLabel[stats.trustLevel] || trustLevelLabel.new;

  return (
    <MarketLayout>
      {/* Welcome header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Olá, {sellerName} 👋</h1>
          <p className="text-sm text-muted-foreground">Painel de vendedor — GarageFlow Market</p>
        </div>
        <div className="flex items-center gap-2">
          {verified ? (
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              <ShieldCheck className="h-3 w-3 mr-1" /> Verificado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground">Não verificado</Badge>
          )}
          <Badge className={trustInfo.color}>
            <Star className="h-3 w-3 mr-1" /> {trustInfo.label}
          </Badge>
        </div>
      </div>

      {/* Primary stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Car className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Anúncios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-xl font-bold">{stats.published}</p>
                <p className="text-xs text-muted-foreground">Publicados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <div>
                <p className="text-xl font-bold">{stats.pendingInspection}</p>
                <p className="text-xs text-muted-foreground">Em Processo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-slate-500" />
              <div>
                <p className="text-xl font-bold">{stats.sold}</p>
                <p className="text-xs text-muted-foreground">Vendidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2 md:col-span-1">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4 text-purple-500" />
              <div>
                <p className="text-xl font-bold">{stats.unreadMessages}</p>
                <p className="text-xs text-muted-foreground">Mensagens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts / actionable items */}
      {(stats.pendingOffers > 0 || stats.unreadMessages > 0 || stats.pendingInspection > 0) && (
        <div className="grid sm:grid-cols-3 gap-3 mb-6">
          {stats.pendingOffers > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
              <CardContent className="py-3 flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-amber-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{stats.pendingOffers} oferta(s) pendente(s)</p>
                  <p className="text-xs text-muted-foreground">Compradores interessados</p>
                </div>
                <Link to="/market/messages">
                  <Button size="sm" variant="outline" className="text-xs">Ver</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {stats.unreadMessages > 0 && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10">
              <CardContent className="py-3 flex items-center gap-3">
                <MessageCircle className="h-5 w-5 text-blue-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{stats.unreadMessages} mensagem(ns) nova(s)</p>
                  <p className="text-xs text-muted-foreground">Responda rapidamente</p>
                </div>
                <Link to="/market/messages">
                  <Button size="sm" variant="outline" className="text-xs">Abrir</Button>
                </Link>
              </CardContent>
            </Card>
          )}
          {stats.pendingInspection > 0 && (
            <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10">
              <CardContent className="py-3 flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-purple-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold">{stats.pendingInspection} inspeção(ões) ativa(s)</p>
                  <p className="text-xs text-muted-foreground">Acompanhe o progresso</p>
                </div>
                <Link to="/market/my-listings">
                  <Button size="sm" variant="outline" className="text-xs">Ver</Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {/* Trust score card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500" /> Reputação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end gap-2">
              <span className="text-3xl font-bold">{stats.trustScore}</span>
              <span className="text-sm text-muted-foreground mb-1">pontos</span>
            </div>
            <Progress value={Math.min(stats.trustScore, 100)} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Nível: <span className="font-medium text-foreground">{trustInfo.label}</span></span>
              <span>Próximo: {stats.trustScore < 25 ? "Bronze (25)" : stats.trustScore < 50 ? "Prata (50)" : stats.trustScore < 75 ? "Ouro (75)" : "Platina (100)"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              A reputação é calculada automaticamente com base nas vendas concluídas, inspeções aprovadas e avaliações dos compradores.
            </p>
          </CardContent>
        </Card>

        {/* Quick actions */}
        <Card className="border-dashed border-amber-300 dark:border-amber-700">
          <CardContent className="py-6 text-center">
            <Plus className="h-8 w-8 mx-auto text-amber-500 mb-2" />
            <h3 className="font-semibold mb-1">Vender um carro</h3>
            <p className="text-sm text-muted-foreground mb-3">Inspeção certificada incluída</p>
            <Link to="/market/sell">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                Criar Anúncio
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Boosts */}
        <Card>
          <CardContent className="py-6 text-center">
            <Rocket className="h-8 w-8 mx-auto text-purple-500 mb-2" />
            <h3 className="font-semibold mb-1">Destaques ativos</h3>
            <p className="text-3xl font-bold mb-1">{stats.activeBoosts}</p>
            <p className="text-sm text-muted-foreground mb-3">anúncio(s) em destaque</p>
            <Link to="/market/my-listings">
              <Button variant="outline" size="sm">Gerir destaques</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Active inspections */}
      {activeInspections.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileCheck className="h-5 w-5" /> Inspeções em Curso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeInspections.map(insp => (
              <div key={insp.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className="w-12 h-9 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {insp.listing?.photos?.[0] ? (
                    <img src={insp.listing.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Car className="h-4 w-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {insp.listing?.make} {insp.listing?.model} ({insp.listing?.year})
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {insp.scheduled_date ? `Agendada: ${insp.scheduled_date}${insp.scheduled_time ? ` às ${insp.scheduled_time}` : ""}` : `Estado: ${insp.status}`}
                  </p>
                </div>
                <Link to="/market/my-listings">
                  <Button size="sm" variant="ghost"><Eye className="h-3 w-3" /></Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent offers */}
      {recentOffers.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> Ofertas Recebidas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentOffers.map(offer => (
              <div key={offer.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                <div className="w-12 h-9 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {offer.listing?.photos?.[0] ? (
                    <img src={offer.listing.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Car className="h-4 w-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {offer.listing?.make} {offer.listing?.model}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Oferta: <span className="font-semibold text-foreground">{formatPrice(Number(offer.amount) || 0)}</span>
                  </p>
                </div>
                <Badge className="bg-amber-100 text-amber-800 text-xs">Pendente</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent listings */}
      {recentListings.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Anúncios Recentes</CardTitle>
              <Link to="/market/my-listings">
                <Button variant="ghost" size="sm" className="text-sm">
                  Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentListings.map(listing => (
              <div key={listing.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition">
                <div className="w-14 h-10 rounded bg-muted flex-shrink-0 overflow-hidden">
                  {listing.photos[0] ? (
                    <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Car className="h-4 w-4 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{listing.make} {listing.model} ({listing.year})</p>
                  <p className="text-xs text-muted-foreground">{formatPrice(Number(listing.price) || 0)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {listing.boost_active && (
                    <Rocket className="h-3 w-3 text-purple-500" />
                  )}
                  <span className={`text-xs font-medium ${STATUS_COLOR[listing.status] || ""}`}>
                    {STATUS_LABEL[listing.status] || listing.status}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {stats.total === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="font-semibold mb-2">Comece a vender</h3>
            <p className="text-muted-foreground mb-4">Publique o seu primeiro carro com inspeção certificada.</p>
            <Link to="/market/sell">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                <Plus className="h-4 w-4 mr-1" /> Criar Anúncio
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </MarketLayout>
  );
}
