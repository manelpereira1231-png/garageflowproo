import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Loader2, ClipboardCheck, Wallet, TrendingUp, Star } from "lucide-react";
import { formatMoney } from "@/lib/money";

type Stats = {
  totalInspections: number;
  monthInspections: number;
  monthRevenue: number;
  walletBalance: number;
  rating: number | null;
};

export default function MarketStats() {
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    const load = async () => {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [totalInsp, monthInsp, monthRev, wallet, shop] = await Promise.all([
        supabase.from("carity_inspections").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", "completed"),
        supabase.from("carity_inspections").select("id", { count: "exact", head: true }).eq("shop_id", shopId).eq("status", "completed").gte("completed_at", monthStart.toISOString()),
        supabase.from("shop_wallet_transactions").select("amount").eq("shop_id", shopId).gte("created_at", monthStart.toISOString()).gt("amount", 0),
        supabase.from("shop_wallets").select("balance").eq("shop_id", shopId).maybeSingle(),
        supabase.from("shops").select("carity_rating").eq("id", shopId).maybeSingle(),
      ]);

      if (cancelled) return;
      const revenue = (monthRev.data || []).reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
      setS({
        totalInspections: totalInsp.count || 0,
        monthInspections: monthInsp.count || 0,
        monthRevenue: revenue,
        walletBalance: Number(wallet.data?.balance || 0),
        rating: shop.data?.carity_rating ?? null,
      });
      setLoading(false);
    };
    setLoading(true);
    load();
    const ch = supabase
      .channel(`market-stats-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "carity_inspections", filter: `shop_id=eq.${shopId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_wallet_transactions", filter: `shop_id=eq.${shopId}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "shop_wallets", filter: `shop_id=eq.${shopId}` }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const iv = setInterval(load, 30000);
    return () => { cancelled = true; supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); clearInterval(iv); };
  }, [shopId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estatísticas Market</h1>
        <p className="text-sm text-muted-foreground">Atividade da tua oficina no Market.</p>
      </div>

      {loading || !s ? (
        <div className="card-premium p-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> A calcular estatísticas…
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card icon={ClipboardCheck} label="Inspeções totais" value={s.totalInspections} color="text-amber-500" />
          <Card icon={TrendingUp} label="Inspeções este mês" value={s.monthInspections} color="text-blue-500" />
          <Card icon={Wallet} label="Receita do mês" value={formatMoney(s.monthRevenue)} color="text-emerald-500" />
          <Card icon={Wallet} label="Saldo na carteira" value={formatMoney(s.walletBalance)} color="text-purple-500" />
          <Card icon={Star} label="Rating" value={s.rating != null ? s.rating.toFixed(1) : "—"} color="text-yellow-500" />
        </div>
      )}
    </div>
  );
}

function Card({ icon: Icon, label, value, color }: { icon: any; label: string; value: string | number; color: string }) {
  return (
    <div className="card-premium p-4">
      <Icon className={`w-5 h-5 mb-2 ${color}`} />
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
