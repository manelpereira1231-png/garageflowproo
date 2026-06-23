import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { Loader2, History } from "lucide-react";
import EmptyState from "@/components/EmptyState";

type Tx = {
  id: string;
  type: string;
  amount: number;
  description: string | null;
  created_at: string;
};

const TYPE_LABEL: Record<string, string> = {
  inspection_paid: "Inspeção paga",
  sale_commission: "Comissão de venda",
  payout_request: "Levantamento",
  payout_paid: "Levantamento processado",
  refund: "Reembolso",
  adjustment: "Ajuste",
};

export default function MarketHistory() {
  const shopId = useActiveShopId();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Tx[]>([]);

  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("shop_wallet_transactions")
        .select("id, type, amount, description, created_at")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (cancelled) return;
      setItems((data as any) || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [shopId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Histórico Market</h1>
        <p className="text-sm text-muted-foreground">Movimentos da tua carteira Market.</p>
      </div>

      {loading ? (
        <div className="card-premium p-8 flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> A carregar histórico…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon="📜"
          title="Sem movimentos ainda"
          description="Quando completares inspeções pagas ou vendas, o histórico aparece aqui."
        />
      ) : (
        <div className="card-premium overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Data</th>
                <th className="text-left px-4 py-3 font-medium">Tipo</th>
                <th className="text-left px-4 py-3 font-medium">Descrição</th>
                <th className="text-right px-4 py-3 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="border-t border-border/60">
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                    {new Date(it.created_at).toLocaleDateString("pt-PT")}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <History className="w-3.5 h-3.5 text-muted-foreground" />
                      {TYPE_LABEL[it.type] || it.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{it.description || "—"}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-medium ${Number(it.amount) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {Number(it.amount) >= 0 ? "+" : ""}€{Number(it.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
