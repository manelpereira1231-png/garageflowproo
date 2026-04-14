import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ShieldCheck, Plus, Car, Clock, CheckCircle, Eye, XCircle, Rocket, Loader2 } from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending_payment: { label: "Aguarda Pagamento", color: "bg-amber-100 text-amber-800", icon: Clock },
  pending_inspection: { label: "Aguarda Inspeção", color: "bg-blue-100 text-blue-800", icon: Clock },
  inspecting: { label: "Em Inspeção", color: "bg-purple-100 text-purple-800", icon: Eye },
  pending_approval: { label: "Aguarda Aprovação", color: "bg-orange-100 text-orange-800", icon: Clock },
  published: { label: "Publicado", color: "bg-green-100 text-green-800", icon: CheckCircle },
  sold: { label: "Vendido", color: "bg-slate-100 text-slate-800", icon: CheckCircle },
  rejected: { label: "Rejeitado", color: "bg-red-100 text-red-800", icon: XCircle },
};

const BOOST_OPTIONS = [
  { type: "7d", label: "Destaque 7 dias", price: "5,99", description: "O seu anúncio aparece em destaque durante 7 dias" },
  { type: "14d", label: "Destaque 14 dias", price: "9,99", description: "Maior visibilidade durante 14 dias" },
  { type: "top", label: "Topo do marketplace", price: "12,99", description: "O seu anúncio aparece sempre no topo" },
];

export default function CaritySellerDashboard() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [boostingId, setBoostingId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth?from=carity"); return; }
    const { data } = await supabase.from("carity_listings").select("*").eq("seller_id", user.id).order("created_at", { ascending: false });
    setListings((data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] })));
    setLoading(false);
  };

  const handleBoost = async (listingId: string, boostType: string) => {
    setBoostingId(listingId);
    try {
      const res = await supabase.functions.invoke("carity-pay-inspection", {
        body: { listing_id: listingId, type: "boost", boost_type: boostType },
      });
      if (res.error) throw new Error(res.error.message);
      const { url } = res.data;
      if (url) window.location.href = url;
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar boost");
    } finally {
      setBoostingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-slate-900 text-white px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/carity" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">Carity</span>
          </Link>
          <Link to="/carity/vender">
            <Button size="sm" className="bg-amber-500 text-slate-900 hover:bg-amber-400 font-semibold">
              <Plus className="h-4 w-4 mr-1" /> Novo Anúncio
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Os meus anúncios</h1>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Car className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold mb-2">Ainda não tem anúncios</h3>
              <p className="text-muted-foreground mb-4">Comece a vender o seu carro com a confiança de uma inspeção oficial.</p>
              <Link to="/carity/vender">
                <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                  <Plus className="h-4 w-4 mr-1" /> Criar anúncio
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {listings.map(listing => {
              const statusConfig = STATUS_MAP[listing.status] || STATUS_MAP.pending_payment;
              const StatusIcon = statusConfig.icon;
              const canBoost = listing.status === "published" && !listing.boost_active;

              return (
                <Card key={listing.id} className="overflow-hidden">
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="w-24 h-16 rounded bg-muted flex-shrink-0 overflow-hidden">
                        {listing.photos[0] ? <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Car className="h-6 w-6 text-muted-foreground/30" /></div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-semibold">{listing.make} {listing.model} ({listing.year})</h3>
                            <p className="text-sm text-muted-foreground">{listing.plate} · {listing.mileage?.toLocaleString()} km · €{listing.price?.toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {listing.boost_active && <Badge className="bg-purple-100 text-purple-800"><Rocket className="h-3 w-3 mr-1" />Destaque</Badge>}
                            <Badge className={statusConfig.color}><StatusIcon className="h-3 w-3 mr-1" />{statusConfig.label}</Badge>
                          </div>
                        </div>

                        {listing.status === 'pending_payment' && (
                          <Link to={`/carity/pagar/${listing.id}`}>
                            <Button size="sm" className="mt-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">Pagar inspeção (€24,90)</Button>
                          </Link>
                        )}

                        {canBoost && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {BOOST_OPTIONS.map(opt => (
                              <Button
                                key={opt.type}
                                size="sm"
                                variant="outline"
                                className="border-purple-200 text-purple-700 hover:bg-purple-50"
                                disabled={boostingId === listing.id}
                                onClick={() => handleBoost(listing.id, opt.type)}
                              >
                                {boostingId === listing.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Rocket className="h-3 w-3 mr-1" />}
                                {opt.label} — €{opt.price}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
