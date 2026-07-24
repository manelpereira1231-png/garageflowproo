import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Row {
  id: string; status: string; total: number; currency: string;
  commission_total: number; created_at: string;
  supplier: { company_name: string } | null;
  buyer_shop: { name: string } | null;
}

const STATE_TONE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  pending: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  shipped: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  delivered: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
  cancelled: "bg-red-500/10 text-red-700 border-red-500/30",
  refunded: "bg-red-500/10 text-red-700 border-red-500/30",
};

export default function AdminSupplierNetworkOrders() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("gsn_orders" as any)
        .select("id,status,total,currency,commission_total,created_at,supplier:gsn_suppliers(company_name),buyer_shop:shops(name)")
        .order("created_at", { ascending: false }).limit(200);
      setRows((data as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = rows.filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return r.id.toLowerCase().includes(s)
      || (r.supplier?.company_name ?? "").toLowerCase().includes(s)
      || (r.buyer_shop?.name ?? "").toLowerCase().includes(s)
      || r.status.toLowerCase().includes(s);
  });

  const totalRevenue = rows.filter(r => r.status !== "cancelled" && r.status !== "refunded").reduce((s, r) => s + Number(r.total), 0);
  const totalCommission = rows.filter(r => r.status !== "cancelled" && r.status !== "refunded").reduce((s, r) => s + Number(r.commission_total), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Encomendas GSN</h1>
          <p className="text-sm text-muted-foreground">Vista global de todas as encomendas da rede.</p>
        </div>
        <Link to="/admin/supplier-network" className="text-sm text-primary hover:underline">← Fornecedores</Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Encomendas</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{rows.length}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Volume total</CardTitle></CardHeader><CardContent className="text-2xl font-bold">€{totalRevenue.toFixed(2)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Comissão plataforma</CardTitle></CardHeader><CardContent className="text-2xl font-bold text-emerald-600">€{totalCommission.toFixed(2)}</CardContent></Card>
      </div>

      <Input placeholder="Pesquisar por ID, fornecedor, comprador ou estado..." value={q} onChange={(e) => setQ(e.target.value)} />

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground text-center">Nenhuma encomenda.</div>
          ) : (
            <div className="divide-y">
              {filtered.map(r => (
                <div key={r.id} className="p-4 flex items-center justify-between gap-3 hover:bg-muted/50">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs">{r.id.slice(0, 8).toUpperCase()}</span>
                      <Badge variant="outline" className={STATE_TONE[r.status] ?? ""}>{r.status}</Badge>
                    </div>
                    <div className="text-sm mt-1 truncate">
                      <span className="text-muted-foreground">De</span> <strong>{r.buyer_shop?.name ?? "—"}</strong>{" "}
                      <span className="text-muted-foreground">para</span> <strong>{r.supplier?.company_name ?? "—"}</strong>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">{new Date(r.created_at).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">€{Number(r.total).toFixed(2)}</div>
                    <div className="text-xs text-emerald-600">Comissão €{Number(r.commission_total).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
