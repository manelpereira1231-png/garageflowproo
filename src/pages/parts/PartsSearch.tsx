import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, SlidersHorizontal } from "lucide-react";
import PartProductCard from "@/components/parts/PartProductCard";

export default function PartsSearch() {
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const size = 24;

  const load = async (reset = true) => {
    setLoading(true);
    const { data } = await supabase.rpc("gsn_search_products" as any, {
      _q: q || null,
      _brand: brand || null,
      _min_price: minPrice ? Number(minPrice) : null,
      _max_price: maxPrice ? Number(maxPrice) : null,
      _in_stock: inStock ? true : null,
      _limit: size,
      _offset: reset ? 0 : page * size,
    });
    const list = (data as any[]) ?? [];
    setRows(reset ? list : [...rows, ...list]);
    if (reset) setPage(1); else setPage(page + 1);
    // fetch supplier names
    const ids = Array.from(new Set(list.map((r: any) => r.supplier_id)));
    if (ids.length) {
      const { data: sups } = await supabase.from("gsn_suppliers" as any).select("id,company_name,trade_name").in("id", ids);
      const map: Record<string, string> = { ...suppliers };
      ((sups as any[]) ?? []).forEach((s) => { map[s.id] = s.trade_name || s.company_name; });
      setSuppliers(map);
    }
    setLoading(false);
  };

  useEffect(() => { void load(true); /* eslint-disable-next-line */ }, []);
  useEffect(() => { const t = setTimeout(() => void load(true), 300); return () => clearTimeout(t); /* eslint-disable-next-line */ }, [q, brand, minPrice, maxPrice, inStock]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Marketplace de Peças</h1>
        <p className="text-sm text-muted-foreground">Pesquise por SKU, EAN, referência, marca, modelo ou descrição.</p>
      </div>
      <Card>
        <CardContent className="p-4 grid gap-3 sm:grid-cols-6">
          <div className="sm:col-span-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pesquisar peças..." className="pl-9" />
          </div>
          <Input placeholder="Marca" value={brand} onChange={(e) => setBrand(e.target.value)} />
          <Input placeholder="Preço mín." type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <Input placeholder="Preço máx." type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <label className="flex items-center gap-2 text-sm col-span-full sm:col-span-2">
            <input type="checkbox" checked={inStock} onChange={(e) => setInStock(e.target.checked)} /> Apenas com stock
          </label>
        </CardContent>
      </Card>

      {loading && rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">A carregar...</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><SlidersHorizontal className="w-8 h-8 mx-auto mb-2" />Sem resultados para a pesquisa.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rows.map((p) => <PartProductCard key={p.id} product={p} supplierName={suppliers[p.supplier_id]} />)}
        </div>
      )}

      {rows.length > 0 && rows.length % size === 0 && (
        <div className="flex justify-center"><Button variant="outline" onClick={() => load(false)} disabled={loading}>{loading ? "A carregar..." : "Ver mais"}</Button></div>
      )}
    </div>
  );
}
