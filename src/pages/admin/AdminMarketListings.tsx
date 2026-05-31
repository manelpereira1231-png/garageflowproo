import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Store, Search } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminMarketListings() {
  const [rows, setRows] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let query = supabase
        .from("carity_listings")
        .select("id, make, model, year, plate, price, status, created_at, sold_at, seller_id")
        .order("created_at", { ascending: false })
        .limit(300);
      if (status !== "all") query = query.eq("status", status);
      const { data } = await query;
      setRows(data || []);
      setLoading(false);
    })();
  }, [status]);

  const filtered = rows.filter(r => {
    if (!q) return true;
    const t = q.toLowerCase();
    return (
      (r.plate || "").toLowerCase().includes(t) ||
      (r.make || "").toLowerCase().includes(t) ||
      (r.model || "").toLowerCase().includes(t)
    );
  });

  const STATUSES = ["all", "pending_payment", "pending_inspection", "inspection_in_progress", "published", "reserved", "sold", "cancelled"];

  return (
    <div className="space-y-4 p-1">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><Store className="w-6 h-6 text-amber-500" /> Market — Anúncios</h1>
        <p className="text-sm text-muted-foreground">Todos os anúncios do marketplace.</p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Filtrar por matrícula, marca ou modelo..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUSES.map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className={`text-xs px-2.5 py-1 rounded-full border ${status === s ? "bg-amber-500 text-black border-amber-500" : "border-border hover:bg-accent"}`}>
                {s === "all" ? "Todos" : s}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="w-6 h-6 animate-spin text-amber-500" /></div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {filtered.length === 0 && (
                <div className="py-8 text-center text-sm text-muted-foreground">Nenhum anúncio encontrado.</div>
              )}
              {filtered.map(r => (
                <Link key={r.id} to={`/market/car/${r.id}`}
                  className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.make} {r.model} <span className="text-muted-foreground">({r.year})</span></p>
                    <p className="text-[11px] text-muted-foreground font-mono">{r.plate || "sem matrícula"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">€{Number(r.price || 0).toLocaleString("pt-PT")}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">{r.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
