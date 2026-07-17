import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import MarketLayout from "@/components/MarketLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShieldCheck, Plus, Car, Clock, CheckCircle, Eye, XCircle, Rocket, Loader2, Tag, MapPin, Phone, MessageCircle, CalendarCheck, Heart, TrendingUp } from "lucide-react";
import VehicleTimeline from "@/components/VehicleTimeline";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useCountryPricing } from "@/hooks/useCountryPricing";
import { useMarketT } from "@/i18n/marketTranslations";

const STATUS_META: Record<string, { key: string; color: string; icon: any }> = {
  pending_payment: { key: "sd.status.pending_payment", color: "bg-amber-100 text-amber-800", icon: Clock },
  pending_inspection: { key: "sd.status.pending_inspection", color: "bg-blue-100 text-blue-800", icon: Clock },
  inspecting: { key: "sd.status.inspecting", color: "bg-purple-100 text-purple-800", icon: Eye },
  pending_approval: { key: "sd.status.pending_approval", color: "bg-orange-100 text-orange-800", icon: Clock },
  published: { key: "sd.status.published", color: "bg-green-100 text-green-800", icon: CheckCircle },
  sold: { key: "sd.status.sold", color: "bg-slate-100 text-slate-800", icon: CheckCircle },
  rejected: { key: "sd.status.rejected", color: "bg-red-100 text-red-800", icon: XCircle },
};

const BOOST_OPTIONS = [
  { type: "7d", labelKey: "sd.boost.7d", price: "4,99" },
  { type: "14d", labelKey: "sd.boost.14d", price: "7,99" },
  { type: "top", labelKey: "sd.boost.top", price: "9,99" },
];

export default function CaritySellerDashboard() {
  const navigate = useNavigate();
  const t = useMarketT();
  const { pricing, formatPrice } = useCountryPricing();
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [boostingId, setBoostingId] = useState<string | null>(null);
  const [selectedListing, setSelectedListing] = useState<any | null>(null);
  const [sellDialog, setSellDialog] = useState<{ listing: any } | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [submittingSale, setSubmittingSale] = useState(false);

  useEffect(() => { loadData(); }, []);

  // Realtime: seller's own listings, offers, boosts, inspections, transactions.
  useEffect(() => {
    let channel: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel(`seller-live-${user.id}`)
        .on("postgres_changes" as any, { event: "*", schema: "public", table: "carity_listings", filter: `seller_id=eq.${user.id}` }, () => loadData())
        .on("postgres_changes" as any, { event: "*", schema: "public", table: "carity_offers", filter: `seller_id=eq.${user.id}` }, () => loadData())
        .on("postgres_changes" as any, { event: "*", schema: "public", table: "carity_boosts", filter: `seller_id=eq.${user.id}` }, () => loadData())
        .on("postgres_changes" as any, { event: "*", schema: "public", table: "carity_transactions", filter: `seller_id=eq.${user.id}` }, () => loadData())
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/market/auth"); return; }

    // Get listings
    const { data: listingsData } = await supabase
      .from("carity_listings")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    const listingsArr = (listingsData || []).map((l: any) => ({
      ...l,
      photos: Array.isArray(l.photos) ? l.photos : [],
    }));

    // For each listing with a shop_id, fetch shop info and inspection details
    const shopIds = [...new Set(listingsArr.filter((l: any) => l.shop_id).map((l: any) => l.shop_id))];
    let shopsMap: Record<string, any> = {};
    if (shopIds.length > 0) {
      const { data: shops } = await supabase
        .from("shops")
        .select("id, name, address, phone, latitude, longitude")
        .in("id", shopIds);
      (shops || []).forEach((s: any) => { shopsMap[s.id] = s; });
    }

    // Fetch inspections for these listings
    const listingIds = listingsArr.map((l: any) => l.id);
    let inspectionsMap: Record<string, any> = {};
    if (listingIds.length > 0) {
      const { data: inspections } = await supabase
        .from("carity_inspections")
        .select("*")
        .in("listing_id", listingIds);
      (inspections || []).forEach((i: any) => { inspectionsMap[i.listing_id] = i; });
    }

    // Fetch view + favorite analytics per listing
    const today = new Date().toISOString().slice(0, 10);
    const [viewsTotalRes, viewsTodayRes, favsRes] = await Promise.all([
      supabase.from("listing_views" as any).select("listing_id").in("listing_id", listingIds),
      supabase.from("listing_views" as any).select("listing_id").in("listing_id", listingIds).eq("viewed_date", today),
      supabase.from("listing_favorites" as any).select("listing_id").in("listing_id", listingIds),
    ]);
    const countBy = (rows: any[] | null) => {
      const m: Record<string, number> = {};
      (rows || []).forEach((r: any) => { m[r.listing_id] = (m[r.listing_id] || 0) + 1; });
      return m;
    };
    const viewsTotalMap = countBy(viewsTotalRes.data);
    const viewsTodayMap = countBy(viewsTodayRes.data);
    const favsMap = countBy(favsRes.data);

    // Enrich listings
    const enriched = listingsArr.map((l: any) => ({
      ...l,
      shop: l.shop_id ? shopsMap[l.shop_id] || null : null,
      inspection: inspectionsMap[l.id] || null,
      stats: {
        viewsTotal: viewsTotalMap[l.id] || 0,
        viewsToday: viewsTodayMap[l.id] || 0,
        favorites: favsMap[l.id] || 0,
      },
    }));

    setListings(enriched);
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
      toast.error(err.message || t("sd.boost.error"));
    } finally {
      setBoostingId(null);
    }
  };

  const handleMarkSold = async () => {
    if (!sellDialog || !buyerEmail) return;
    setSubmittingSale(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase.from("sale_confirmations").insert({
        listing_id: sellDialog.listing.id,
        seller_id: user.id,
        seller_confirmed: true,
        buyer_email: buyerEmail,
        buyer_phone: buyerPhone,
        sale_price: parseFloat(salePrice) || sellDialog.listing.price,
      });

      if (error) throw error;
      toast.success(t("sd.sale.success"));
      setSellDialog(null);
      setBuyerEmail("");
      setBuyerPhone("");
      setSalePrice("");
    } catch (err: any) {
      toast.error(err.message || t("sd.sale.error"));
    } finally {
      setSubmittingSale(false);
    }
  };

  const openWhatsAppToShop = (shop: any, listing: any) => {
    if (!shop?.phone) { toast.error(t("sd.shop.noPhone")); return; }
    const url = buildWhatsAppUrl({
      phone: shop.phone,
      clientName: shop.name,
      type: "service",
      plate: listing.plate,
    });
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <MarketLayout>
      <h1 className="text-2xl font-bold mb-6">{t("sd.title")}</h1>


        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : listings.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Car className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <h3 className="font-semibold mb-2">{t("sd.empty.title")}</h3>
              <p className="text-muted-foreground mb-4">{t("sd.empty.desc")}</p>
              <Link to="/market/sell">
                <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                  <Plus className="h-4 w-4 mr-1" /> {t("sd.empty.cta")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {listings.map(listing => {
              const statusConfig = STATUS_META[listing.status] || STATUS_META.pending_payment;
              const StatusIcon = statusConfig.icon;
              const canBoost = listing.status === "published" && !listing.boost_active;
              const canSell = listing.status === "published";
              const shop = listing.shop;
              const inspection = listing.inspection;
              const hasShop = !!shop;

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
                            <p className="text-sm text-muted-foreground">{listing.plate} · {listing.mileage?.toLocaleString()} km · {formatPrice(Number(listing.price) || 0)}</p>
                          </div>
                        <div className="flex items-center gap-2">
                            {listing.boost_active && <Badge className="bg-purple-100 text-purple-800"><Rocket className="h-3 w-3 mr-1" />{t("sd.boost.badge")}</Badge>}
                            <Badge className={statusConfig.color}><StatusIcon className="h-3 w-3 mr-1" />{t(statusConfig.key)}</Badge>
                          </div>
                        </div>

                        {/* Analytics row */}
                        {listing.status === "published" && listing.stats && (
                          <div className="flex flex-wrap gap-3 mt-2 text-[11px]">
                            <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                              <Eye className="h-3 w-3" />
                              <strong className="text-foreground">{listing.stats.viewsTotal}</strong> {t("sd.stats.views")}
                            </span>
                            {listing.stats.viewsToday > 0 && (
                              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded font-medium">
                                <TrendingUp className="h-3 w-3" />
                                {t("sd.stats.today", { count: listing.stats.viewsToday })}
                              </span>
                            )}
                            <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                              <Heart className={`h-3 w-3 ${listing.stats.favorites > 0 ? "fill-red-500 text-red-500" : ""}`} />
                              <strong className="text-foreground">{listing.stats.favorites}</strong> {listing.stats.favorites === 1 ? t("sd.stats.favorite") : t("sd.stats.favorites")}
                            </span>
                          </div>
                        )}

                        <div className="flex gap-2 mt-2 flex-wrap">
                          <Button size="sm" variant="outline" onClick={() => setSelectedListing(selectedListing?.id === listing.id ? null : listing)}>
                            <Eye className="h-3 w-3 mr-1" /> {selectedListing?.id === listing.id ? t("sd.btn.hide") : t("sd.btn.show")}
                          </Button>

                          {listing.status === 'pending_payment' && (
                            <Link to={`/market/pay/${listing.id}`}>
                              <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">{t("sd.btn.payInspection", { price: formatPrice(pricing.inspection_price) })}</Button>
                            </Link>
                          )}

                          {hasShop && (
                            <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => openWhatsAppToShop(shop, listing)}>
                              <MessageCircle className="h-3 w-3 mr-1" /> {t("sd.btn.contactShop")}
                            </Button>
                          )}

                          {canSell && (
                            <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => { setSellDialog({ listing }); setSalePrice(listing.price?.toString() || ""); }}>
                              <Tag className="h-3 w-3 mr-1" /> {t("sd.btn.markSold")}
                            </Button>
                          )}
                        </div>

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
                                {t(opt.labelKey)} — €{opt.price}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expanded detail panel */}
                    {selectedListing?.id === listing.id && (
                      <div className="mt-4 pt-4 border-t space-y-4">
                        <h4 className="text-sm font-semibold mb-2">{t("sd.progress.title")}</h4>
                        <VehicleTimeline
                          status={listing.status}
                          inspectionStatus={inspection?.status}
                          scheduledDate={inspection?.scheduled_date}
                          scheduledTime={inspection?.scheduled_time}
                          shopName={shop?.name}
                          shopAddress={shop?.address}
                        />

                        {/* Shop info card */}
                        {hasShop && (
                          <Card className="bg-muted/30 border-dashed">
                            <CardHeader className="pb-2 pt-3">
                              <CardTitle className="text-sm flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-amber-500" />
                                {t("sd.shop.responsible")}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="pb-3 space-y-2">
                              <p className="font-semibold">{shop.name}</p>
                              {shop.address && (
                                <p className="text-sm text-muted-foreground flex items-start gap-1">
                                  <MapPin className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                                  {shop.address}
                                </p>
                              )}
                              {shop.phone && (
                                <p className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                  {shop.phone}
                                </p>
                              )}

                              {/* Scheduled date/time */}
                              {inspection?.scheduled_date && (
                                <div className="flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded">
                                  <CalendarCheck className="h-3.5 w-3.5" />
                                  {t("sd.shop.scheduled", { date: `${inspection.scheduled_date}${inspection.scheduled_time ? ` — ${inspection.scheduled_time}` : ""}` })}
                                </div>
                              )}

                              <div className="flex gap-2 mt-2">
                                {/* Google Maps */}
                                {shop.latitude && shop.longitude ? (
                                  <a
                                    href={`https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button size="sm" variant="outline">
                                      <MapPin className="h-3 w-3 mr-1" /> {t("sd.shop.openMaps")}
                                    </Button>
                                  </a>
                                ) : shop.address ? (
                                  <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    <Button size="sm" variant="outline">
                                      <MapPin className="h-3 w-3 mr-1" /> {t("sd.shop.openMaps")}
                                    </Button>
                                  </a>
                                ) : null}

                                {/* WhatsApp */}
                                {shop.phone && (
                                  <Button size="sm" variant="outline" className="border-green-200 text-green-700" onClick={() => openWhatsAppToShop(shop, listing)}>
                                    <MessageCircle className="h-3 w-3 mr-1" /> WhatsApp
                                  </Button>
                                )}
                              </div>

                              {/* Map embed if coordinates exist */}
                              {shop.latitude && shop.longitude && (
                                <div className="mt-2 rounded overflow-hidden border">
                                  <iframe
                                    title="Localização da oficina"
                                    width="100%"
                                    height="150"
                                    style={{ border: 0 }}
                                    loading="lazy"
                                    referrerPolicy="no-referrer-when-downgrade"
                                    src={`https://maps.google.com/maps?q=${shop.latitude},${shop.longitude}&z=15&output=embed`}
                                  />
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}



      {/* Mark as Sold Dialog */}
      <Dialog open={!!sellDialog} onOpenChange={o => !o && setSellDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("sd.sale.dialog.title", { vehicle: `${sellDialog?.listing?.make ?? ""} ${sellDialog?.listing?.model ?? ""}`.trim() })}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            {t("sd.sale.dialog.desc")}
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t("sd.sale.buyerEmail")}</label>
              <Input value={buyerEmail} onChange={e => setBuyerEmail(e.target.value)} placeholder="comprador@email.com" type="email" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("sd.sale.buyerPhone")}</label>
              <Input value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} placeholder="912345678" />
            </div>
            <div>
              <label className="text-sm font-medium">{t("sd.sale.price", { currency: pricing.currency_symbol })}</label>
              <Input value={salePrice} onChange={e => setSalePrice(e.target.value)} type="number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSellDialog(null)}>{t("sd.sale.cancel")}</Button>
            <Button onClick={handleMarkSold} disabled={!buyerEmail || submittingSale} className="bg-green-600 hover:bg-green-500 text-white">
              {submittingSale ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle className="h-4 w-4 mr-1" />}
              {t("sd.sale.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MarketLayout>
  );
}
