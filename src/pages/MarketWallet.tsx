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
      toast.error(`Valor mínimo para levantamento: ${fmt(minPayout)}`);
      return;
    }
    if (!wallet || amount > Number(wallet.balance)) {
      toast.error("Saldo insuficiente");
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
      const msg = error.message?.includes("min_payout") ? `Mínimo ${fmt(minPayout)}` :
                  error.message?.includes("insufficient") ? "Saldo insuficiente" :
                  error.message || "Erro ao solicitar";
      toast.error(msg);
      return;
    }
    toast.success("Pedido de levantamento enviado! O administrador vai rever.");
    setRequestOpen(false);
    setReqAmount(""); setReqNotes("");
    load();
  };

  const setMaxAmount = () => {
    if (wallet) setReqAmount(String(Number(wallet.balance).toFixed(2)));
  };

  const statusBadge = (status: string) => {
    if (status === "paid") return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1"><CheckCircle className="h-3 w-3" />Pago</Badge>;
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 gap-1"><Clock className="h-3 w-3" />Em análise</Badge>;
    if (status === "rejected") return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejeitado</Badge>;
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
            <Wallet className="h-7 w-7 text-amber-500" /> Carteira da Oficina
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Saldo acumulado das inspeções Market</p>
        </div>
        <Link to="/market/inspections">
          <Button variant="outline" size="sm">Ver inspeções</Button>
        </Link>
      </div>

      {/* Balance cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20">
          <CardHeader className="pb-2">
            <CardDescription>Saldo disponível</CardDescription>
            <CardTitle className="text-3xl font-bold text-amber-700 dark:text-amber-400">{fmt(balance)}</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setRequestOpen(true)} disabled={!canWithdraw} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold gap-2">
              <ArrowDownToLine className="h-4 w-4" /> Pedir levantamento
            </Button>
            {!canWithdraw && <p className="text-xs text-muted-foreground mt-2 text-center">Mínimo {fmt(minPayout)} para levantar</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total ganho</CardDescription>
            <CardTitle className="text-2xl font-bold text-green-600">{fmt(Number(wallet?.total_earned || 0))}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Soma de todas as inspeções concluídas</CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total pago</CardDescription>
            <CardTitle className="text-2xl font-bold">{fmt(Number(wallet?.total_paid || 0))}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">Já transferido para a sua conta</CardContent>
        </Card>
      </div>

      {/* Payouts */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><ArrowDownToLine className="h-5 w-5" /> Levantamentos</CardTitle>
          <CardDescription>Pedidos enviados ao administrador</CardDescription>
        </CardHeader>
        <CardContent>
          {payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem pedidos de levantamento.</p>
          ) : (
            <div className="space-y-2">
              {payouts.map(p => (
                <div key={p.id} className="flex items-center justify-between border rounded-lg p-3 gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold">{fmt(Number(p.amount))}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString("pt-PT")} · {p.method === "bank_transfer" ? "Transferência" : p.method}</p>
                    {p.reference && <p className="text-xs text-muted-foreground">Ref: {p.reference}</p>}
                  </div>
                  {statusBadge(p.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2"><History className="h-5 w-5" /> Histórico</CardTitle>
          <CardDescription>Últimos 50 movimentos</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem movimentos.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map(tx => {
                const isCredit = Number(tx.amount) > 0;
                return (
                  <div key={tx.id} className="flex items-center justify-between border-b last:border-0 py-2 gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description || tx.type}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString("pt-PT")}</p>
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

      {/* Request payout dialog */}
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pedir levantamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted rounded-lg p-3">
              <p className="text-xs text-muted-foreground">Saldo disponível</p>
              <p className="text-2xl font-bold text-amber-600">{fmt(balance)}</p>
            </div>

            <div>
              <Label htmlFor="amount">Valor a levantar ({country.currency_symbol})</Label>
              <div className="flex gap-2 mt-1">
                <Input id="amount" type="number" step="0.01" min={minPayout} max={balance} value={reqAmount} onChange={e => setReqAmount(e.target.value)} placeholder={String(minPayout)} />
                <Button type="button" variant="outline" size="sm" onClick={setMaxAmount}>Máx</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Mínimo {fmt(minPayout)}</p>
            </div>

            <div>
              <Label htmlFor="method">Método</Label>
              <select id="method" value={reqMethod} onChange={e => setReqMethod(e.target.value)} className="w-full mt-1 border rounded-md p-2 bg-background text-sm">
                <option value="bank_transfer">Transferência bancária</option>
                <option value="mbway">MB WAY</option>
              </select>
            </div>

            <div>
              <Label htmlFor="notes">Dados de pagamento (IBAN ou nº MB WAY)</Label>
              <Textarea id="notes" value={reqNotes} onChange={e => setReqNotes(e.target.value)} placeholder="Ex: IBAN PT50 0000 0000 0000 0000 0000 0&#10;Titular: Nome da Oficina, Lda." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancelar</Button>
            <Button onClick={requestPayout} disabled={submitting} className="bg-amber-500 hover:bg-amber-400 text-slate-900">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Euro className="h-4 w-4 mr-2" />}
              Confirmar pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
