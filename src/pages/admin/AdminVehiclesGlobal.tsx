import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Car, Store, Wrench, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toastError } from "@/lib/errorMessages";

type ErpRow = {
  source: "erp";
  id: string;
  shop_id: string;
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  client_id: string;
  created_at: string;
  shop_name?: string | null;
};

type MarketRow = {
  source: "market";
  id: string;
  seller_id: string;
  plate: string;
  vin: string | null;
  make: string;
  model: string;
  year: number;
  mileage: number;
  status: string;
  price: number;
  created_at: string;
};

type Row = ErpRow | MarketRow;

function normalizePlate(p: string) {
  return p.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

const PAGE_SIZE = 60;

export default function AdminVehiclesGlobal() {
  const [params] = useSearchParams();
  const initial = params.get("q") || "";
  const [q, setQ] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [totals, setTotals] = useState<{ erp: number; market: number } | null>(null);

  useEffect(() => {
    void load(initial, 0);
    void loadTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTotals = async () => {
    const [erpC, mktC] = await Promise.all([
      supabase.from("vehicles").select("id", { count: "exact", head: true }).is("deleted_at", null),
      supabase.from("carity_listings").select("id", { count: "exact", head: true }),
    ]);
    setTotals({ erp: erpC.count ?? 0, market: mktC.count ?? 0 });
  };

  const load = async (rawTerm: string, pageIndex: number) => {
    const term = rawTerm.trim();
    const isSearch = term.length >= 2;
    setLoading(true);
    setSearched(isSearch);
    setPage(pageIndex);
    try {
      const like = `%${term}%`;
      const from = pageIndex * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let erpQuery = supabase
        .from("vehicles")
        .select("id, shop_id, plate, vin, make, model, year, mileage, client_id, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      let marketQuery = supabase
        .from("carity_listings")
        .select("id, seller_id, plate, vin, make, model, year, mileage, status, price, created_at")
        .order("created_at", { ascending: false });

      if (isSearch) {
        const filter = `plate.ilike.${like},vin.ilike.${like},make.ilike.${like},model.ilike.${like}`;
        erpQuery = erpQuery.or(filter);
        marketQuery = marketQuery.or(filter);
      }

      const [erpRes, marketRes] = await Promise.all([
        erpQuery.range(from, to),
        marketQuery.range(from, to),
      ]);

      if (erpRes.error) throw erpRes.error;
      if (marketRes.error) throw marketRes.error;

      // Hydrate shop names for ERP rows
      const shopIds = Array.from(new Set((erpRes.data || []).map((v: any) => v.shop_id).filter(Boolean)));
      let shopMap: Record<string, string> = {};
      if (shopIds.length > 0) {
        const { data: shops } = await supabase.from("shops").select("id, name").in("id", shopIds);
        shopMap = Object.fromEntries((shops || []).map((s: any) => [s.id, s.name]));
      }

      const erpRows: ErpRow[] = (erpRes.data || []).map((v: any) => ({
        source: "erp" as const,
        ...v,
        shop_name: shopMap[v.shop_id] || null,
      }));
      const marketRows: MarketRow[] = (marketRes.data || []).map((v: any) => ({
        source: "market" as const,
        ...v,
      }));

      const merged: Row[] = [...erpRows, ...marketRows]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setHasMore((erpRes.data?.length ?? 0) === PAGE_SIZE || (marketRes.data?.length ?? 0) === PAGE_SIZE);
      setRows(prev => (pageIndex === 0 ? merged : [...prev, ...merged]));
    } catch (e: any) {
      toastError(e, "Não foi possível carregar veículos");
    } finally {
      setLoading(false);
    }
  };

  const erpCount = rows.filter(r => r.source === "erp").length;
  const marketCount = rows.filter(r => r.source === "market").length;

  return (
    <div className="space-y-6 p-1">
      <div>
        <h1 className="text-2xl font-bold">Veículos (Global)</h1>
        <p className="text-sm text-muted-foreground">
          Todos os veículos das oficinas (ERP) e anúncios (Market). Pesquise por matrícula, VIN, marca ou modelo.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4">
          <form
            onSubmit={(e) => { e.preventDefault(); void load(q, 0); }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Ex: 12-AB-34, WVWZZZ1KZAW..., BMW Serie 3"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={loading} className="min-h-[44px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Pesquisar"}
              </Button>
              {(q || searched) && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={() => { setQ(""); void load("", 0); }}
                >
                  Limpar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="gap-1"><Wrench className="w-3 h-3" /> ERP: {erpCount}{totals && !searched ? ` de ${totals.erp}` : ""}</Badge>
        <Badge variant="outline" className="gap-1"><Store className="w-3 h-3" /> Market: {marketCount}{totals && !searched ? ` de ${totals.market}` : ""}</Badge>
        <span className="ml-auto">{rows.length} {searched ? "resultado(s)" : "em lista"}</span>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {searched ? `Nenhum veículo encontrado para "${q}".` : "Ainda não existem veículos registados."}
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rows.map(r => <VehicleCard key={`${r.source}-${r.id}`} row={r} />)}
          </div>
          {hasMore && (
            <div className="flex justify-center">
              <Button variant="outline" disabled={loading} onClick={() => void load(q, page + 1)} className="min-h-[44px]">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Carregar mais"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}


function VehicleCard({ row }: { row: Row }) {
  const isErp = row.source === "erp";
  return (
    <Card className={isErp ? "border-l-4 border-l-blue-500" : "border-l-4 border-l-amber-500"}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Car className="w-4 h-4" />
              {row.make} {row.model} <span className="text-muted-foreground font-normal">({row.year})</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              {row.plate || "—"} {row.vin ? `· VIN ${row.vin}` : ""}
            </p>
          </div>
          <Badge variant={isErp ? "default" : "secondary"} className="gap-1">
            {isErp ? <><Wrench className="w-3 h-3" /> ERP</> : <><Store className="w-3 h-3" /> Market</>}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="text-xs space-y-1.5">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Quilómetros</span>
          <span className="font-medium">{(row.mileage || 0).toLocaleString("pt-PT")} km</span>
        </div>
        {isErp ? (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Oficina</span>
              <span className="font-medium truncate max-w-[60%]">{(row as ErpRow).shop_name || "—"}</span>
            </div>
            <div className="pt-2 flex gap-2">
              <Link to={`/admin/shops/${(row as ErpRow).shop_id}`} className="text-xs text-amber-600 hover:underline inline-flex items-center gap-1">
                Ver oficina <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <Badge variant="outline" className="text-[10px]">{(row as MarketRow).status}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço</span>
              <span className="font-bold text-amber-600">€{Number((row as MarketRow).price || 0).toLocaleString("pt-PT")}</span>
            </div>
            <div className="pt-2 flex gap-2">
              <Link to={`/market/listing/${row.id}`} className="text-xs text-amber-600 hover:underline inline-flex items-center gap-1">
                Ver anúncio <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          </>
        )}
        <p className="text-[10px] text-muted-foreground pt-1">
          Criado {new Date(row.created_at).toLocaleDateString("pt-PT")}
        </p>
      </CardContent>
    </Card>
  );
}
