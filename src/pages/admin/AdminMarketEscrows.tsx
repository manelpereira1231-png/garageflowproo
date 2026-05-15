import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

export default function AdminMarketEscrows() {
  const [rows, setRows] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let q = supabase
        .from("market_escrow")
        .select("id, listing_id, buyer_id, seller_id, amount, platform_fee, status, created_at, disputed_at, released_at, refunded_at, capture_method, stripe_verified")
        .order("created_at", { ascending: false })
        .limit(300);
      if (status !== "all") q = q.eq("status", status);
      const { data } = await q;
      setRows(data || []);
      setLoading(false);
    })();
  }, [status]);

  const STATUSES = ["all", "pending", "paid", "delivery_confirmed", "released", "disputed", "refunded", "cancelled"];

  const totals = rows.reduce(
    (acc, r) => {
      acc.volume += Number(r.amount || 0);
      acc.fees += Number(r.platform_fee || 0);
      if (r.status === "disputed") acc.disputes++;
      return acc;
    },
    { volume: 0, fees: 0, disputes: 0 }
  );

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6 text-amber-500" /> Market — Escrow & Disputas</h1>
        <p className="text-sm text-muted-foreground">Transações em garantia, libertações e disputas.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Volume listado</p>
          <p className="text-xl font-bold">€{totals.volume.toLocaleString("pt-PT")}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Comissões</p>
          <p className="text-xl font-bold text-amber-600">€{totals.fees.toLocaleString("pt-PT")}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <p className="text-xs text-muted-foreground">Disputas</p>
          <p className="text-xl font-bold text-red-600 flex items-center gap-1">
            {totals.disputes > 0 && <AlertTriangle className="w-4 h-4" />}
            {totals.disputes}
          </p>
        </CardContent></Card>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`text-xs px-2.5 py-1 rounded-full border ${status === s ? "bg-amber-500 text-black border-amber-500" : "border-border hover:bg-accent"}`}>
            {s === "all" ? "Todos" : s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {rows.length === 0 && <div className="py-8 text-center text-sm text-muted-foreground">Sem transações.</div>}
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-mono">#{r.id.slice(0, 8)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-PT")}
                      {r.stripe_verified ? " · Stripe ✓" : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">€{Number(r.amount || 0).toLocaleString("pt-PT")}</p>
                    <Badge variant={r.status === "disputed" ? "destructive" : "outline"} className="text-[10px] mt-1">{r.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
