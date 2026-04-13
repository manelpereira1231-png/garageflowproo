import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ShieldCheck, Car, Euro, CheckCircle, XCircle, Eye, Clock, Building2, Users, TrendingUp } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("listings");

  const loadData = useCallback(async () => {
    const [listingsRes, inspectionsRes, transactionsRes, shopsRes] = await Promise.all([
      supabase.from("carity_listings").select("*").order("created_at", { ascending: false }),
      supabase.from("carity_inspections").select("*, carity_listings(make, model, year, plate)").order("assigned_at", { ascending: false }),
      supabase.from("carity_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("shops").select("id, name").limit(100),
    ]);

    setListings((listingsRes.data || []).map((l: any) => ({ ...l, photos: Array.isArray(l.photos) ? l.photos : [] })));
    setInspections(inspectionsRes.data || []);
    setTransactions(transactionsRes.data || []);
    setShops(shopsRes.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const approveListing = async (id: string) => {
    await supabase.from("carity_listings")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", id);
    toast.success("Carro aprovado e publicado!");
    loadData();
  };

  const rejectListing = async (id: string) => {
    await supabase.from("carity_listings")
      .update({ status: "rejected" })
      .eq("id", id);
    toast.success("Carro rejeitado.");
    loadData();
  };

  const assignShop = async (listingId: string, shopId: string) => {
    // Create inspection assignment
    const { error } = await supabase.from("carity_inspections").insert({
      listing_id: listingId,
      shop_id: shopId,
      payment_status: 'paid', // Admin can force-assign
    });

    if (!error) {
      await supabase.from("carity_listings")
        .update({ status: "pending_inspection", shop_id: shopId })
        .eq("id", listingId);
      toast.success("Oficina atribuída com sucesso!");
      loadData();
    }
  };

  // Stats
  const totalListings = listings.length;
  const published = listings.filter(l => l.status === "published").length;
  const pendingApproval = listings.filter(l => l.status === "pending_approval").length;
  const totalRevenue = transactions.filter(t => t.status === 'paid').reduce((sum, t) => sum + Number(t.platform_amount || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-20"><div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-emerald-600" />
          Carity — Gestão do Marketplace
        </h1>
        <p className="text-muted-foreground">Controlo total sobre carros, inspeções e receita</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Car className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{totalListings}</p>
            <p className="text-xs text-muted-foreground">Total de Carros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <CheckCircle className="h-5 w-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold">{published}</p>
            <p className="text-xs text-muted-foreground">Publicados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Clock className="h-5 w-5 mx-auto text-amber-500 mb-1" />
            <p className="text-2xl font-bold">{pendingApproval}</p>
            <p className="text-xs text-muted-foreground">Aguardam Aprovação</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <Euro className="h-5 w-5 mx-auto text-emerald-600 mb-1" />
            <p className="text-2xl font-bold">€{totalRevenue.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Receita Plataforma</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="listings">Carros ({totalListings})</TabsTrigger>
          <TabsTrigger value="inspections">Inspeções ({inspections.length})</TabsTrigger>
          <TabsTrigger value="transactions">Transações ({transactions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="listings" className="space-y-3 mt-4">
          {listings.map(listing => (
            <Card key={listing.id}>
              <CardContent className="p-4">
                <div className="flex gap-4 items-center">
                  <div className="w-20 h-14 rounded bg-muted flex-shrink-0 overflow-hidden">
                    {listing.photos[0] ? (
                      <img src={listing.photos[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full"><Car className="h-5 w-5 text-muted-foreground/30" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{listing.make} {listing.model} ({listing.year})</h3>
                    <p className="text-sm text-muted-foreground">{listing.plate} · €{listing.price.toLocaleString()}</p>
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
                      <Select onValueChange={v => assignShop(listing.id, v)}>
                        <SelectTrigger className="w-40"><SelectValue placeholder="Atribuir oficina" /></SelectTrigger>
                        <SelectContent>
                          {shops.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="inspections" className="space-y-3 mt-4">
          {inspections.map(insp => (
            <Card key={insp.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">
                      {insp.carity_listings?.make} {insp.carity_listings?.model} ({insp.carity_listings?.year})
                    </h3>
                    <p className="text-sm text-muted-foreground">{insp.carity_listings?.plate}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge>{insp.status}</Badge>
                    <Badge variant="outline">{insp.payment_status}</Badge>
                    <span className="text-sm text-emerald-600 font-medium">€{Number(insp.shop_share).toFixed(2)} oficina</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

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
                      <p className="text-sm text-muted-foreground">
                        Plataforma: €{Number(tx.platform_amount).toFixed(2)} · Oficina: €{Number(tx.shop_amount).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">€{Number(tx.amount).toFixed(2)}</p>
                      <Badge variant="outline">{tx.status}</Badge>
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
