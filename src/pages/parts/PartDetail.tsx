import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Package, Truck } from "lucide-react";
import { useGsnCart } from "@/hooks/useGsnCart";
import { useGsnFavorites } from "@/hooks/useGsnFavorites";
import { formatMoney } from "@/lib/money";
import { getTaxLabel } from "@/lib/regionConfig";

export default function PartDetail() {
  const { productId } = useParams();
  const [p, setP] = useState<any>(null);
  const [sup, setSup] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const { add } = useGsnCart();
  const { isFavorite, toggle } = useGsnFavorites();

  useEffect(() => {
    if (!productId) return;
    (async () => {
      const { data } = await supabase.from("gsn_products" as any).select("*").eq("id", productId).maybeSingle();
      setP(data);
      if ((data as any)?.supplier_id) {
        const { data: s } = await supabase.from("gsn_suppliers" as any).select("id,company_name,trade_name,slug,logo_url,average_delivery_time,rating_average").eq("id", (data as any).supplier_id).maybeSingle();
        setSup(s);
      }
    })();
  }, [productId]);

  if (!p) return <p className="text-sm text-muted-foreground">A carregar...</p>;
  const fav = isFavorite(p.id);
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card><CardContent className="p-4 aspect-square flex items-center justify-center bg-muted">
        {p.image ? <img src={p.image} alt={p.title} className="max-h-full object-contain" /> : <Package className="w-16 h-16 text-muted-foreground" />}
      </CardContent></Card>
      <div className="space-y-4">
        <div>
          {p.brand && <p className="text-xs uppercase text-muted-foreground">{p.brand}</p>}
          <h1 className="text-2xl font-bold">{p.title}</h1>
          <p className="text-sm text-muted-foreground">{p.sku && `SKU: ${p.sku}`} {p.ean && `· EAN: ${p.ean}`}</p>
        </div>
        {sup && (
          <Link to={`/parts/supplier/${sup.slug ?? sup.id}`} className="flex items-center gap-2 p-3 border rounded-md hover:bg-muted/50">
            {sup.logo_url && <img src={sup.logo_url} className="w-8 h-8 rounded" alt="" />}
            <div>
              <p className="text-sm font-medium">{sup.trade_name ?? sup.company_name}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-2"><Truck className="w-3 h-3" /> {sup.average_delivery_time ?? "Entrega padrão"} · ⭐ {Number(sup.rating_average ?? 0).toFixed(1)}</p>
            </div>
          </Link>
        )}
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold">{formatMoney(Number(p.price))}</p>
          <span className="text-xs text-muted-foreground">{getTaxLabel()} {p.vat}%</span>
          <Badge variant={p.stock > 0 ? "secondary" : "outline"}>{p.stock > 0 ? `${p.stock} em stock` : "Esgotado"}</Badge>
        </div>
        {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
        <div className="flex gap-2 items-center">
          <input type="number" min={1} max={p.stock} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value)))} className="w-20 h-10 px-2 border rounded" />
          <Button size="lg" className="flex-1" disabled={p.stock <= 0} onClick={() => add(p.id, qty)}><ShoppingCart className="w-4 h-4 mr-2" /> Adicionar ao carrinho</Button>
          <Button size="lg" variant={fav ? "default" : "outline"} onClick={() => toggle(p.id)}><Heart className={`w-4 h-4 ${fav ? "fill-current" : ""}`} /></Button>
        </div>
        {p.technical_description && (
          <Card><CardContent className="p-4 text-sm whitespace-pre-wrap">{p.technical_description}</CardContent></Card>
        )}
      </div>
    </div>
  );
}
