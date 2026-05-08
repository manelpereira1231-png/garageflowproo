import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Car, Clock, CheckCircle, XCircle, ShieldCheck, CreditCard, AlertTriangle, ArrowRight } from "lucide-react";
import MarketLayout from "@/components/MarketLayout";
import { toast } from "sonner";
import { formatMarketPriceExact, getMarketLocale } from "@/lib/marketPrice";
import { useMarketT } from "@/i18n/marketTranslations";
import { pageCache } from "@/lib/pageCache";

const PURCHASES_CACHE_KEY = "market:purchases:v1";

const STATUS_ICONS: Record<string, { color: string; icon: any }> = {
  pending: { color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  paid: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: ShieldCheck },
  delivery_confirmed: { color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400", icon: CheckCircle },
  released: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  disputed: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  refunded: { color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: XCircle },
  cancelled: { color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", icon: XCircle },
};

interface Purchase {
  id: string;
  listing_id: string;
  status: string;
  amount: number;
  created_at: string;
  carity_listings: {
    make: string;
    model: string;
    year: number;
    photos: any;
    status: string;
  } | null;
}

export default function MarketPurchases() {
  const t = useMarketT();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const cached = pageCache.get<Purchase[]>(PURCHASES_CACHE_KEY);
  const [loading, setLoading] = useState(!cached);
  const [purchases, setPurchases] = useState<Purchase[]>(cached ?? []);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("escrow") === "cancelled") {
      toast.info(t("pur.toast.cancelled"));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/market/auth?redirect=/market/purchases");
      return;
    }

    const { data, error } = await supabase
      .from("market_escrow")
      .select("id, listing_id, status, amount, created_at, carity_listings(make, model, year, photos, status)")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(t("pur.toast.loadErr"));
      setLoading(false);
      return;
    }

    const rows = (data || []) as any;
    setPurchases(rows);
    pageCache.set(PURCHASES_CACHE_KEY, rows);
    setLoading(false);
  };

  const resumePayment = async (escrowId: string) => {
    setActionLoading(escrowId);
    try {
      const { data, error } = await supabase.functions.invoke("market-escrow-resume", {
        body: { escrow_id: escrowId, action: "resume" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.url) throw new Error(t("pur.toast.openErr"));

      window.location.href = data.url;
    } catch (err: any) {
      toast.error(err.message || t("pur.toast.resumeErr"));
      setActionLoading(null);
    }
  };

  const cancelPurchase = async (escrowId: string) => {
    setActionLoading(escrowId);
    try {
      const { data, error } = await supabase.functions.invoke("market-escrow-resume", {
        body: { escrow_id: escrowId, action: "cancel" },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(t("pur.toast.cancelOk"));
      await load();
    } catch (err: any) {
      toast.error(err.message || t("pur.toast.cancelErr"));
    } finally {
      setActionLoading(null);
    }
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

  const pendingPurchases = purchases.filter(p => p.status === "pending");
  const otherPurchases = purchases.filter(p => p.status !== "pending");

  return (
    <MarketLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-amber-500" /> {t("pur.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("pur.subtitle")}
        </p>
      </div>

      {purchases.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Car className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground mb-4">{t("pur.empty")}</p>
            <Link to="/market">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold">
                {t("pur.explore")} <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {pendingPurchases.length > 0 && (
        <Card className="mb-6 border-amber-300 dark:border-amber-700 bg-amber-50/40 dark:bg-amber-900/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Clock className="h-5 w-5" /> {t("pur.pendingHeader", { n: pendingPurchases.length })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingPurchases.map(p => {
              const photo = Array.isArray(p.carity_listings?.photos) ? p.carity_listings?.photos[0] : null;
              const stillAvailable = p.carity_listings?.status === "published";
              return (
                <div key={p.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 rounded-lg bg-background border">
                  <div className="w-full sm:w-24 h-20 rounded bg-muted flex-shrink-0 overflow-hidden">
                    {photo ? (
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full"><Car className="h-6 w-6 text-muted-foreground/30" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">
                      {p.carity_listings?.make} {p.carity_listings?.model} ({p.carity_listings?.year})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatMarketPriceExact(p.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t("pur.startedAt", { date: new Date(p.created_at).toLocaleDateString(getMarketLocale()) })}
                    </p>
                    {!stillAvailable && (
                      <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> {t("pur.unavailable")}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => resumePayment(p.id)}
                      disabled={!stillAvailable || actionLoading === p.id}
                      className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
                      size="sm"
                    >
                      {actionLoading === p.id ? t("pur.opening") : t("pur.finish")}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" disabled={actionLoading === p.id}>
                          {t("pur.cancel")}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("pur.cancelDialogTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("pur.cancelDialogDesc")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("pur.back")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => cancelPurchase(p.id)}>
                            {t("pur.confirmCancel")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {otherPurchases.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">{t("pur.history")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {otherPurchases.map(p => {
              const cfg = STATUS_ICONS[p.status] || STATUS_ICONS.pending;
              const Icon = cfg.icon;
              const photo = Array.isArray(p.carity_listings?.photos) ? p.carity_listings?.photos[0] : null;
              return (
                <Link key={p.id} to={`/market/car/${p.listing_id}`} className="block">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="w-16 h-12 rounded bg-muted flex-shrink-0 overflow-hidden">
                      {photo ? (
                        <img src={photo} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Car className="h-4 w-4 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {p.carity_listings?.make} {p.carity_listings?.model} ({p.carity_listings?.year})
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatMarketPriceExact(p.amount)} · {new Date(p.created_at).toLocaleDateString(getMarketLocale())}
                      </p>
                    </div>
                    <Badge className={`${cfg.color} text-xs`}>
                      <Icon className="h-3 w-3 mr-1" />
                      {t(`pur.s.${p.status}`)}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}
    </MarketLayout>
  );
}
