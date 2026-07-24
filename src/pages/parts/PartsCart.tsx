import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, ShoppingBag } from "lucide-react";
import { useGsnCart } from "@/hooks/useGsnCart";

export default function PartsCart() {
  const { items, bySupplier, subtotal, vatTotal, total, updateQuantity, remove, checkout, loading } = useGsnCart();
  const navigate = useNavigate();

  const onCheckout = async () => {
    const orderIds = await checkout();
    if (orderIds.length > 0) navigate("/parts/orders");
  };

  if (loading) return <p className="text-sm text-muted-foreground">A carregar...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Carrinho</h1>
      {items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground"><ShoppingBag className="w-8 h-8 mx-auto mb-2" />Carrinho vazio.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-4">
            {Object.entries(bySupplier).map(([supId, its]) => (
              <Card key={supId}>
                <CardHeader><CardTitle className="text-base">{its[0]?.supplier?.company_name ?? "Fornecedor"}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {its.map((it) => (
                    <div key={it.id} className="flex items-center gap-3 p-2 border rounded-md">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{it.product?.title ?? "Produto"}</p>
                        <p className="text-xs text-muted-foreground">€ {Number(it.unit_price).toFixed(2)} · IVA {it.vat}%</p>
                      </div>
                      <Input type="number" min={1} value={it.quantity} onChange={(e) => updateQuantity(it.id, Number(e.target.value))} className="w-16 h-9" />
                      <p className="w-24 text-right font-semibold">€ {(it.unit_price * it.quantity).toFixed(2)}</p>
                      <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="h-fit sticky top-24">
            <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>€ {subtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>IVA</span><span>€ {vatTotal.toFixed(2)}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t"><span>Total</span><span>€ {total.toFixed(2)}</span></div>
              <Button className="w-full mt-3" size="lg" onClick={onCheckout}>Finalizar compra</Button>
              <p className="text-xs text-muted-foreground text-center">Cada fornecedor gera uma encomenda separada.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
