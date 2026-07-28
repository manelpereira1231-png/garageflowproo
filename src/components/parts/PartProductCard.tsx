import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, ShoppingCart, Package } from "lucide-react";
import { useGsnFavorites } from "@/hooks/useGsnFavorites";
import { useGsnCart } from "@/hooks/useGsnCart";
import { formatMoney } from "@/lib/money";

export interface PartProductCardProps {
  product: {
    id: string;
    title: string;
    image: string | null;
    brand: string | null;
    price: number;
    vat: number;
    stock: number;
    supplier_id: string;
  };
  supplierName?: string;
}

export default function PartProductCard({ product, supplierName }: PartProductCardProps) {
  const { isFavorite, toggle } = useGsnFavorites();
  const { add } = useGsnCart();
  const fav = isFavorite(product.id);
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <Link to={`/parts/${product.id}`} className="block aspect-square bg-muted flex items-center justify-center">
        {product.image ? <img src={product.image} alt={product.title} loading="lazy" className="w-full h-full object-cover" /> : <Package className="w-10 h-10 text-muted-foreground" />}
      </Link>
      <CardContent className="p-3 space-y-2">
        {product.brand && <p className="text-xs uppercase text-muted-foreground">{product.brand}</p>}
        <Link to={`/parts/${product.id}`} className="block text-sm font-medium line-clamp-2 hover:text-primary">{product.title}</Link>
        {supplierName && <p className="text-xs text-muted-foreground truncate">{supplierName}</p>}
        <div className="flex items-baseline justify-between">
          <p className="font-semibold">{formatMoney(Number(product.price))}</p>
          <Badge variant={product.stock > 0 ? "secondary" : "outline"}>{product.stock > 0 ? `Stock: ${product.stock}` : "Esgotado"}</Badge>
        </div>
        <div className="flex gap-1">
          <Button size="sm" className="flex-1" disabled={product.stock <= 0} onClick={() => add(product.id, 1)}><ShoppingCart className="w-3.5 h-3.5 mr-1" />Carrinho</Button>
          <Button size="sm" variant={fav ? "default" : "outline"} onClick={() => toggle(product.id)}><Heart className={`w-3.5 h-3.5 ${fav ? "fill-current" : ""}`} /></Button>
        </div>
      </CardContent>
    </Card>
  );
}
