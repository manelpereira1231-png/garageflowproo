import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import PartProductCard from "@/components/parts/PartProductCard";
import { useGsnFavorites } from "@/hooks/useGsnFavorites";
import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export default function PartsFavorites() {
  const { ids } = useGsnFavorites();
  const [rows, setRows] = useState<any[]>([]);
  const [supplierNames, setSupplierNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      if (ids.size === 0) { setRows([]); return; }
      const { data } = await supabase.from("gsn_products" as any).select("*").in("id", Array.from(ids));
      const list = (data as any[]) ?? [];
      setRows(list);
      const supIds = Array.from(new Set(list.map((r) => r.supplier_id)));
      if (supIds.length) {
        const { data: sups } = await supabase.from("gsn_suppliers" as any).select("id,company_name,trade_name").in("id", supIds);
        const map: Record<string, string> = {};
        ((sups as any[]) ?? []).forEach((s) => { map[s.id] = s.trade_name ?? s.company_name; });
        setSupplierNames(map);
      }
    })();
  }, [ids]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Favoritos</h1>
      {rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><Heart className="w-8 h-8 mx-auto mb-2" />Sem favoritos.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rows.map((p) => <PartProductCard key={p.id} product={p} supplierName={supplierNames[p.supplier_id]} />)}
        </div>
      )}
    </div>
  );
}
