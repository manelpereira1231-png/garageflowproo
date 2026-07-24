import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import PartProductCard from "@/components/parts/PartProductCard";
import { Package, Star } from "lucide-react";

export default function SupplierPublic() {
  const { supplierSlug } = useParams();
  const [sup, setSup] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);

  useEffect(() => {
    if (!supplierSlug) return;
    (async () => {
      let { data } = await supabase.from("gsn_suppliers" as any).select("*").eq("slug", supplierSlug).maybeSingle();
      if (!data) {
        const r = await supabase.from("gsn_suppliers" as any).select("*").eq("id", supplierSlug).maybeSingle();
        data = r.data;
      }
      setSup(data);
      if ((data as any)?.id) {
        const { data: prods } = await supabase.rpc("gsn_search_products" as any, { _supplier_id: (data as any).id, _limit: 24, _offset: 0 });
        setProducts((prods as any) ?? []);
      }
    })();
  }, [supplierSlug]);

  if (!sup) return <p className="text-sm text-muted-foreground">A carregar...</p>;
  return (
    <div className="space-y-6">
      <Card>
        <div className="h-40 bg-gradient-to-r from-primary/20 to-primary/5 rounded-t-lg">
          {sup.banner_url && <img src={sup.banner_url} alt="" className="w-full h-full object-cover rounded-t-lg" />}
        </div>
        <CardContent className="p-6 -mt-10">
          <div className="flex gap-4 items-start">
            <div className="w-20 h-20 rounded-lg bg-background border-4 border-background overflow-hidden">
              {sup.logo_url ? <img src={sup.logo_url} className="w-full h-full object-cover" alt="" /> : <Package className="w-full h-full p-4" />}
            </div>
            <div className="pt-10">
              <h1 className="text-2xl font-bold">{sup.trade_name ?? sup.company_name}</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-2"><Star className="w-3 h-3 fill-amber-400 text-amber-400" /> {Number(sup.rating_average ?? 0).toFixed(1)} ({sup.rating_count ?? 0} avaliações)</p>
            </div>
          </div>
          {sup.description && <p className="mt-4 text-sm">{sup.description}</p>}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {sup.website && <p><span className="text-muted-foreground">Website:</span> <a href={sup.website} target="_blank" rel="noreferrer" className="text-primary hover:underline">{sup.website}</a></p>}
            {sup.phone && <p><span className="text-muted-foreground">Telefone:</span> {sup.phone}</p>}
            {sup.email && <p><span className="text-muted-foreground">Email:</span> {sup.email}</p>}
            {sup.average_delivery_time && <p><span className="text-muted-foreground">Entrega:</span> {sup.average_delivery_time}</p>}
            {(sup.city || sup.country) && <p className="col-span-2"><span className="text-muted-foreground">Localização:</span> {[sup.address, sup.city, sup.country].filter(Boolean).join(", ")}</p>}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Produtos ({products.length})</CardTitle></CardHeader>
        <CardContent>
          {products.length === 0 ? <p className="text-sm text-muted-foreground">Sem produtos publicados.</p> : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {products.map((p) => <PartProductCard key={p.id} product={p} supplierName={sup.trade_name ?? sup.company_name} />)}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
