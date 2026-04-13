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
import { toast } from "sonner";
import { ShieldCheck, Car, Euro, CheckCircle, XCircle, Clock, Building2, Users, TrendingUp, Star, Loader2, Send } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Aguarda Pagamento",
  pending_inspection: "Aguarda Inspeção",
  inspecting: "Em Inspeção",
  pending_approval: "Aguarda Aprovação",
  published: "Publicado",
  sold: "Vendido",
  rejected: "Rejeitado",
};

export default function AdminCarity() {
  const [listings, setListings] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [offers, setOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("listings");
  const [updatingShop, setUpdatingShop] = useState<string | null>(null);
  const [sendingOffer, setSendingOffer] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [listingsRes, inspectionsRes, transactionsRes, shopsRes, offersRes] = await Promise.all([
      supabase.from("carity_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("carity_inspections").select("*, carity_listings(make, model, year, plate)").order("assigned_at", { ascending: false }),
      supabase.from("carity_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("shops").select("id, name, is_carity_partner, carity_priority, carity_active, email, phone").order("name"),
      supabase.from("carity_inspection_offers").select("*, carity_listings(make, model, year, plate), shops(name)").order("offered_at", { ascending: false }).limit(50),
    ]);

    setListings((listingsRes.data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] })));
    setInspections(inspectionsRes.data || []);
    setTransactions(transactionsRes.data || []);
    setShops(shopsRes.data || []);
    setOffers(offersRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const approveListing = async (id: string) => {
    await supabase.from("carity_listings").update({ status: "published", published_at: new Date().toISOString() }).eq("id", id);
    toast.success("Carro aprovado e publicado!");
    loadData();
  };

  const rejectListing = async (id: string) => {
    await supabase.from("carity_listings").update({ status: "rejected" }).eq("id", id);
    toast.success("Carro rejeitado.");
    loadData();
  };

  // Toggle Carity partner
  const togglePartner = async (shopId: string, value: boolean) => {
    setUpdatingShop(shopId);
    await supabase.from("shops").update({ is_carity_partner: value }).eq("id", shopId);
    setShops(prev => prev.map(s => s.id === shopId ? { ...s, is_carity_partner: value } : s));
    toast.success(value ? "Oficina marcada como parceira Carity" : "Oficina removida da rede Carity");
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

  // Send inspection offer to partner shops
  const sendOfferToPartners = async (listingId: string) => {
    setSendingOffer(listingId);
    const partnerShops = shops.filter(s => s.is_carity_partner && s.carity_active);

    if (partnerShops.length === 0) {
      toast.error("Nenhuma oficina parceira ativa. Marque oficinas como parceiras primeiro.");
      setSendingOffer(null);
      return;
    }

    // Create a placeholder inspection for tracking
    const { data: inspection } = await supabase.from("carity_inspections").insert({
      listing_id: listingId,
      shop_id: partnerShops[0].id, // placeholder, will be updated when accepted
      payment_status: "paid",
      status: "pending",
    }).select().single();

    if (!inspection) {
      toast.error("Erro ao criar inspeção");
      setSendingOffer(null);
      return;
    }

    // Sort by priority (higher = first)
    const sorted = [...partnerShops].sort((a, b) => (b.carity_priority || 5) - (a.carity_priority || 5));

    // Send offers to top 5 shops
    const topShops = sorted.slice(0, 5);
    const offerRows = topShops.map(s => ({
      inspection_id: inspection.id,
      listing_id: listingId,
      shop_id: s.id,
      status: "pending",
    }));

    await supabase.from("carity_inspection_offers").insert(offerRows);

    // Update listing status
    await supabase.from("carity_listings").update({ status: "pending_inspection" }).eq("id", listingId);

    toast.success(`Pedido enviado a ${topShops.length} oficinas parceiras!`);
    setSendingOffer(null);
    loadData();
  };

  // Stats
  const totalListings = listings.length;
  const published = listings.filter(l => l.status === "published").length;
  const pendingApproval = listings.filter(l => l.status === "pending_approval").length;
  const totalRevenue = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + Number(t.platform_amount || 0), 0);
  const partnerShops = shops.filter(s => s.is_carity_partner);

  // Shop performance
  const getShopPerformance = (shopId: string) => {
    const shopInspections = inspections.filter(i => i.shop_id === shopId);
    const completed = shopInspections.filter(i => i.status === 'completed').length;
    const total = shopInspections.length;
    const shopOffers = offers.filter(o => o.shop_id === shopId);
    const accepted = shopOffers.filter(o => o.status === 'accepted').length;
    const totalOffers = shopOffers.length;
    const earnings = shopInspections.filter(i => i.status === 'completed').reduce((sum, i) => sum + Number(i.shop_share || 0), 0);
    return { completed, total, acceptRate: totalOffers > 0 ? Math.round((accepted / totalOffers) * 100) : 0, earnings };
  };

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          Carity — Gestão Completa
        </h1>
        <p className="text-muted-foreground">Controlo total: carros, inspeções, oficinas parceiras e receita</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Car className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
          <p className="text-2xl font-bold">{totalListings}</p>
          <p className="text-xs text-muted-foreground">Total Carros</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
          <p className="text-2xl font-bold">{published}</p>
          <p className="text-xs text-muted-foreground">Publicados</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Clock className="h-5 w-5 mx-auto text-amber-500 mb-1" />
          <p className="text-2xl font-bold">{pendingApproval}</p>
          <p className="text-xs text-muted-foreground">Aguardam Aprovação</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Building2 className="h-5 w-5 mx-auto text-blue-500 mb-1" />
          <p className="text-2xl font-bold">{partnerShops.length}</p>
          <p className="text-xs text-muted-foreground">Oficinas Parceiras</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-4 text-center">
          <Euro className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
          <p className="text-2xl font-bold">€{totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground">Receita Plataforma</p>
        </CardContent></Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="listings">Carros ({totalListings})</TabsTrigger>
          <TabsTrigger value="partners">Oficinas Parceiras ({partnerShops.length})</TabsTrigger>
          <TabsTrigger value="inspections">Inspeções ({inspections.length})</TabsTrigger>
          <TabsTrigger value="offers">Ofertas ({offers.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transações ({transactions.length})</TabsTrigger>
        </TabsList>

        {/* LISTINGS */}
        <TabsContent value="listings" className="space-y-3 mt-4">
          {listings.map(listing => (
            <Card key={listing.id}>
              <CardContent className="p-4">
                <div className="flex gap-4 items-center">
                  <div className="w-20 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
                    {listing.photos[0] ? <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><Car className="h-5 w-5 text-muted-foreground/30" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{listing.make} {listing.model} ({listing.year})</h3>
                    <p className="text-sm text-muted-foreground">{listing.plate} · €{listing.price?.toLocaleString()}</p>
                  </div>
                  <Badge>{STATUS_LABELS[listing.status] || listing.status}</Badge>
                  <div className="flex gap-2">
                    {listing.status === 'pending_approval' && (
                      <>
                        <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => approveListing(listing.id)}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => rejectListing(listing.id)}>
                          <XCircle className="h-3.5 w-3.5 mr-1" /> Rejeitar
                        </Button>
                      </>
                    )}
                    {(listing.status === 'pending_payment' || listing.status === 'pending_inspection') && !listing.shop_id && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => sendOfferToPartners(listing.id)}
                        disabled={sendingOffer === listing.id}
                        className="border-emerald-200 text-emerald-700"
                      >
                        {sendingOffer === listing.id ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                        Enviar a oficinas
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* PARTNER SHOPS */}
        <TabsContent value="partners" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-emerald-600" />
                Gestão de Oficinas Carity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground mb-4">
                Apenas oficinas marcadas como "Parceira Carity" recebem pedidos de inspeção. Defina a prioridade (1-10) para controlar a distribuição.
              </p>
              {shops.map(shop => {
                const perf = getShopPerformance(shop.id);
                return (
                  <div key={shop.id} className={`p-4 rounded-lg border ${shop.is_carity_partner ? 'border-emerald-200 bg-emerald-50/30 dark:bg-emerald-900/5' : 'border-border'}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold flex items-center gap-2">
                          {shop.name}
                          {shop.is_carity_partner && <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">Parceira</Badge>}
                          {shop.is_carity_partner && !shop.carity_active && <Badge variant="destructive" className="text-xs">Bloqueada</Badge>}
                        </h3>
                        {shop.is_carity_partner && (
                          <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                            <span>{perf.completed} inspeções feitas</span>
                            <span>Taxa aceitação: {perf.acceptRate}%</span>
                            <span>Ganhos: €{perf.earnings.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-4">
                        {shop.is_carity_partner && (
                          <>
                            <div className="flex items-center gap-2 min-w-[160px]">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">Prioridade: {shop.carity_priority}</Label>
                              <Slider
                                value={[shop.carity_priority || 5]}
                                onValueChange={([v]) => updatePriority(shop.id, v)}
                                min={1} max={10} step={1}
                                className="w-24"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground">Ativa</Label>
                              <Switch
                                checked={shop.carity_active}
                                onCheckedChange={v => toggleActive(shop.id, v)}
                                disabled={updatingShop === shop.id}
                              />
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-muted-foreground">Parceira</Label>
                          <Switch
                            checked={shop.is_carity_partner}
                            onCheckedChange={v => togglePartner(shop.id, v)}
                            disabled={updatingShop === shop.id}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INSPECTIONS */}
        <TabsContent value="inspections" className="space-y-3 mt-4">
          {inspections.map(insp => (
            <Card key={insp.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{insp.carity_listings?.make} {insp.carity_listings?.model} ({insp.carity_listings?.year})</h3>
                    <p className="text-sm text-muted-foreground">{insp.carity_listings?.plate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge>{insp.status === 'pending' ? 'Pendente' : insp.status === 'in_progress' ? 'Em curso' : insp.status === 'completed' ? 'Concluída' : insp.status}</Badge>
                    <Badge variant="outline">{insp.payment_status === 'paid' ? 'Pago' : insp.payment_status}</Badge>
                    <span className="text-sm text-emerald-600 font-medium">€{Number(insp.shop_share).toFixed(2)} oficina</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* OFFERS */}
        <TabsContent value="offers" className="space-y-3 mt-4">
          {offers.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Sem ofertas de inspeção registadas</CardContent></Card>
          ) : (
            offers.map(offer => (
              <Card key={offer.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">
                        {offer.carity_listings?.make} {offer.carity_listings?.model} ({offer.carity_listings?.year})
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Oficina: {offer.shops?.name || '—'} · {offer.carity_listings?.plate}
                      </p>
                    </div>
                    <Badge className={
                      offer.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      offer.status === 'accepted' ? 'bg-green-100 text-green-800' :
                      'bg-red-100 text-red-800'
                    }>
                      {offer.status === 'pending' ? 'Pendente' : offer.status === 'accepted' ? 'Aceite' : 'Recusada'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* TRANSACTIONS */}
        <TabsContent value="transactions" className="space-y-3 mt-4">
          {transactions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Sem transações registadas</CardContent></Card>
          ) : (
            transactions.map(tx => (
              <Card key={tx.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{tx.type === 'inspection_fee' ? 'Taxa de Inspeção' : 'Comissão de Venda'}</p>
                      <p className="text-sm text-muted-foreground">Plataforma: €{Number(tx.platform_amount).toFixed(2)} · Oficina: €{Number(tx.shop_amount).toFixed(2)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">€{Number(tx.amount).toFixed(2)}</p>
                      <Badge variant="outline">{tx.status === 'paid' ? 'Pago' : tx.status}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
