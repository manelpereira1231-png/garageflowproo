import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, ArrowDownToLine, History, Loader2, CheckCircle, Clock, XCircle, Euro } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { useMarketT } from "@/i18n/marketTranslations";

interface WalletData {
  balance: number;
  total_earned: number;
  total_paid: number;
  status: string;
}

interface CountryFmt {
  currency: string;
  currency_symbol: string;
  locale: string;
  code: string;
}

const DEFAULT_COUNTRY: CountryFmt = { currency: "EUR", currency_symbol: "€", locale: "pt-PT", code: "PT" };

export default function MarketWallet() {
  const t = useMarketT();
  const shopId = useActiveShopId();
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [country, setCountry] = useState<CountryFmt>(DEFAULT_COUNTRY);
  const [minPayout, setMinPayout] = useState<number>(20);
  const [loading, setLoading] = useState(true);
  const [requestOpen, setRequestOpen] = useState(false);
  const [reqAmount, setReqAmount] = useState("");
  const [reqMethod, setReqMethod] = useState("bank_transfer");
  const [reqNotes, setReqNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fmt = (v: number) => new Intl.NumberFormat(country.locale, {
    style: "currency", currency: country.currency,
    minimumFractionDigits: country.currency === "INR" ? 0 : 2,
  }).format(v);

  const load = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    const [w, t, p, shopRow] = await Promise.all([
      supabase.from("shop_wallets").select("*").eq("shop_id", shopId).maybeSingle(),
      supabase.from("shop_wallet_transactions" as any).select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(50),
      supabase.from("shop_payouts").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(20),
      supabase.from("shops").select("country_code").eq("id", shopId).maybeSingle(),
    ]);
    setWallet((w.data as WalletData) || { balance: 0, total_earned: 0, total_paid: 0, status: "active" });
    setTransactions((t.data as any[]) || []);
    setPayouts((p.data as any[]) || []);

    const cc = (shopRow.data as any)?.country_code || "PT";
    const { data: countryData } = await supabase
      .from("country_settings")
      .select("code, currency, currency_symbol, locale")
      .eq("code", cc).maybeSingle();
    if (countryData) {
      setCountry(countryData as any);
      // Min payout adapts: ~20 EUR equivalent — INR 1500, USD 25, BRL 100
      if (countryData.currency === "INR") setMinPayout(1500);
      else if (countryData.currency === "BRL") setMinPayout(100);
      else if (countryData.currency === "USD") setMinPayout(25);
      else setMinPayout(20);
    }
    setLoading(false);
  }, [shopId]);

  useEffect(() => { load(); }, [load]);

  const requestPayout = async () => {
    if (!shopId) return;
    const amount = parseFloat(reqAmount);
    if (isNaN(amount) || amount < minPayout) {
      toast.error(t("wallet.toast.minErr", { amount: fmt(minPayout) }));
      return;
    }
    if (!wallet || amount > Number(wallet.balance)) {
      toast.error(t("wallet.toast.insuf"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc("request_shop_payout" as any, {
      _shop_id: shopId,
      _amount: amount,
      _method: reqMethod,
      _notes: reqNotes || null,
    });
    setSubmitting(false);
    if (error) {
      const msg = error.message?.includes("min_payout") ? t("wallet.dialog.min", { amount: fmt(minPayout) }) :
                  error.message?.includes("insufficient") ? t("wallet.toast.insuf") :
                  error.message || t("wallet.toast.reqErr");
      toast.error(msg);
      return;
    }
    toast.success(t("wallet.toast.sent"));
    setRequestOpen(false);
    setReqAmount(""); setReqNotes("");
    load();
  };

  const setMaxAmount = () => {
    if (wallet) setReqAmount(String(Number(wallet.balance).toFixed(2)));
  };

  const statusBadge = (status: string) => {
    if (status === "paid") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1"><CheckCircle className="h-3 w-3" />{t("wallet.status.paid")}</Badge>;
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1"><Clock className="h-3 w-3" />{t("wallet.status.pending")}</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />{t("wallet.status.rejected")}</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  if (loading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-amber-500" /></div>;

  const balance = Number(wallet?.balance || 0);
  const canWithdraw = balance >= minPayout;

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
            <Wallet className="h-7 w-7 text-amber-500" /> {t("wallet.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("wallet.subtitle")}</p>
        </div>
        <Link to="/market/inspections">
          <Button variant="outline" size="sm">{t("wallet.seeInspections")}</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20">
          <CardHeader className="pb-2">
            <CardDescription>{t("wallet.available")}</CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-700 dark:text-amber-400">{fmt(balance)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setRequestOpen(true)} disabled={!canWithdraw} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold gap-2">
              <ArrowDownToLine className="h-4 w-4" /> {t("wallet.requestPayout")}
            </Button>
            {!canWithdraw && <p className="text-xs text-muted-foreground mt-2 text-center">{t("wallet.minToWithdraw", { amount: fmt(minPayout) })}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("wallet.totalEarned")}</CardDescription>
            <CardTitle className="text-2xl font-bold text-green-600">{fmt(Number(wallet?.total_earned || 0))}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{t("wallet.totalEarnedDesc")}</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>{t("wallet.totalPaid")}</CardDescription>
            <CardTitle className="text-2xl font-bold">{fmt(Number(wallet?.total_paid || 0))}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">{t("wallet.totalPaidDesc")}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><ArrowDownToLine className="h-5 w-5" /> {t("wallet.payouts")}</CardTitle>
          <CardDescription>{t("wallet.payoutsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("wallet.noPayouts")}</p>
          ) : (
            <div className="space-y-2">
              {payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{fmt(Number(p.amount))}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString(country.locale)} · {p.method === "bank_transfer" ? t("wallet.transfer") : p.method}</p>
                    {p.reference && <p className="text-xs text-muted-foreground">{t("wallet.ref")} {p.reference}</p>}
                  </div>
                  {statusBadge(p.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" /> {t("wallet.history")}</CardTitle>
          <CardDescription>{t("wallet.historyDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{t("wallet.noTx")}</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => {
                const isCredit = Number(tx.amount) > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between border-b last:border-0 py-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString(country.locale)}</p>
                    </div>
                    <span className={`font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                      {isCredit ? '+' : ''}{fmt(Math.abs(Number(tx.amount)))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("wallet.dialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">{t("wallet.available")}</p>
              <p className="text-2xl font-bold text-amber-600">{fmt(balance)}</p>
            </div>

            <div>
              <Label htmlFor="amount">{t("wallet.dialog.amountLabel", { symbol: country.currency_symbol })}</Label>
              <div className="flex gap-2 mt-1">
                <Input id="amount" type="number" step="0.01" min={minPayout} max={balance} value={reqAmount} onChange={e => setReqAmount(e.target.value)} placeholder={String(minPayout)} />
                <Button type="button" variant="outline" size="sm" onClick={setMaxAmount}>{t("wallet.dialog.max")}</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{t("wallet.dialog.min", { amount: fmt(minPayout) })}</p>
            </div>

            <div>
              <Label htmlFor="method">{t("wallet.dialog.method")}</Label>
              <select id="method" value={reqMethod} onChange={e => setReqMethod(e.target.value)} className="w-full mt-1 border rounded-md p-2 bg-background text-sm">
                <option value="bank_transfer">{t("wallet.dialog.bank")}</option>
                <option value="mbway">{t("wallet.dialog.mbway")}</option>
              </select>
            </div>

            <div>
              <Label htmlFor="notes">{t("wallet.dialog.notes")}</Label>
              <Textarea id="notes" value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder={t("wallet.dialog.notesPh")} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>{t("wallet.dialog.cancel")}</Button>
            <Button onClick={requestPayout} disabled={submitting} className="bg-amber-500 hover:bg-amber-400 text-slate-900">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Euro className="h-4 w-4 mr-2" />}
              {t("wallet.dialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
