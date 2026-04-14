import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Car, Eye, MessageCircle, TrendingUp, Clock, CheckCircle, Plus, ArrowRight, ShieldCheck } from "lucide-react";
import MarketLayout from "@/components/MarketLayout";

export default function MarketDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    pendingInspection: 0,
    sold: 0,
    unreadMessages: 0,
  });
  const [recentListings, setRecentListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth"); return; }

    // Fetch all listings
    const { data: listings } = await supabase
      .from("carity_listings")
      .select("id, make, model, year, price, status, photos, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    const all = listings || [];

    // Unread messages
    const { count: unread } = await supabase
      .from("carity_chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("receiver_id", user.id)
      .eq("read", false);

    setStats({
      total: all.length,
      published: all.filter(l => l.status === "published").length,
      pendingInspection: all.filter(l => ["pending_payment", "pending_inspection", "inspecting"].includes(l.status)).length,
      sold: all.filter(l => l.status === "sold").length,
      unreadMessages: unread || 0,
    });

    setRecentListings(all.slice(0, 5).map((l: any) => ({
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : [],
    })));
    setLoading(false);
  };

  const STATUS_LABEL: Record<string, string> = {
    pending_payment: "Aguarda Pagamento",
    pending_inspection: "Aguarda Inspeção",
    inspecting: "Em Inspeção",
    published: "Publicado",
    sold: "Vendido",
    rejected: "Rejeitado",
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

  return (
    <MarketLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Painel do Vendedor</h1>
        <p className="text-sm text-muted-foreground">Visão geral da sua conta no GarageFlow Market</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Car className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Anúncios</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.published}</p>
                <p className="text-xs text-muted-foreground">Publicados</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingInspection}</p>
                <p className="text-xs text-muted-foreground">Em Processo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <MessageCircle className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.unreadMessages}</p>
                <p className="text-xs text-muted-foreground">Mensagens</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Card className="border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10">
          <CardContent className="py-6 text-center">
            <Plus className="h-8 w-8 mx-auto text-amber-500 mb-2" />
            <h3 className="font-semibold mb-1">Vender um carro</h3>
            <p className="text-sm text-muted-foreground mb-3">Crie um anúncio com inspeção certificada</p>
            <Link to="/market/sell">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                Criar Anúncio
              </Button>
            </Link>
          </CardContent>
        </Card>
        <Card className="border-dashed">
          <CardContent className="py-6 text-center">
            <ShieldCheck className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <h3 className="font-semibold mb-1">Explorar Marketplace</h3>
            <p className="text-sm text-muted-foreground mb-3">Veja carros certificados à venda</p>
            <Link to="/market">
              <Button variant="outline">Ver Marketplace</Button>
            </Link>
          </CardContent>
        </Card>
      </div>

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
          <CardContent className="space-y-3">
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
                  <p className="text-xs text-muted-foreground">€{listing.price?.toLocaleString()}</p>
                </div>
                <Badge variant="outline" className="text-xs flex-shrink-0">
                  {STATUS_LABEL[listing.status] || listing.status}
                </Badge>
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
