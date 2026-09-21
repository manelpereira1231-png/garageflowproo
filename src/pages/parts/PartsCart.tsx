import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, ShoppingBag } from "lucide-react";
import { useGsnCart } from "@/hooks/useGsnCart";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { getTaxLabel } from "@/lib/regionConfig";

export default function PartsCart() {
  const {
    items, bySupplier, subtotal, vatTotal, shippingTotal, shippingBySupplier, total,
    carriersBySupplier, selectedCarriers, selectCarrier, missingCarrier,
    updateQuantity, remove, checkout, loading,
  } = useGsnCart();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);


  const onCheckout = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
    const orderIds = await checkout();
    if (!orderIds.length) return;
    const { data, error } = await supabase.functions.invoke("gsn-checkout", { body: { order_ids: orderIds } });
    if (error) { toast.error(error.message); navigate("/parts/orders"); return; }
    const sessions = (data?.sessions ?? []) as { url: string | null; error?: string }[];
    const first = sessions.find(s => s.url);
    if (first?.url) {
      if (sessions.length > 1) toast.info(`${sessions.length} pagamentos criados. A abrir o primeiro; os restantes ficam em Encomendas.`);
      window.location.href = first.url;
    } else {
      toast.error(sessions[0]?.error || "Falha a criar pagamento");
      navigate("/parts/orders");
    }
    } finally {
      setSubmitting(false);
    }
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
                        <p className="text-xs text-muted-foreground">{formatMoney(Number(it.unit_price))} · {getTaxLabel()} {it.vat}%</p>
                      </div>
                      <Input type="number" min={1} value={it.quantity} onChange={(e) => updateQuantity(it.id, Number(e.target.value))} className="w-16 h-9" />
                      <p className="w-24 text-right font-semibold">{formatMoney(it.unit_price * it.quantity)}</p>
                      <Button size="icon" variant="ghost" onClick={() => remove(it.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  ))}

                  {(carriersBySupplier[supId]?.length ?? 0) > 0 ? (
                    <div className="pt-2 border-t space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium"><Truck className="w-4 h-4" />Envio</div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(carriersBySupplier[supId] ?? []).map((c) => {
                          const goods = its.reduce((s, i) => s + Number(i.unit_price) * i.quantity * (1 + Number(i.vat) / 100), 0);
                          const free = c.free_above != null && goods >= Number(c.free_above);
                          const active = selectedCarriers[supId] === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => selectCarrier(supId, c.id)}
                              className={`text-left p-3 rounded-md border min-h-[44px] transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
                            >
                              <p className="text-sm font-medium">{c.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {free ? "Portes grátis" : formatMoney(Number(c.base_price))}
                                {c.eta_days ? ` · ${c.eta_days} dia${c.eta_days > 1 ? "s" : ""}` : ""}
                                {!free && c.free_above != null ? ` · grátis acima de ${formatMoney(Number(c.free_above))}` : ""}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Portes deste fornecedor</span>
                        <span>{formatMoney(shippingBySupplier[supId] ?? 0)}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="pt-2 border-t text-xs text-muted-foreground">Este fornecedor não cobra portes.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="h-fit sticky top-24">
            <CardHeader><CardTitle>Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
              <div className="flex justify-between"><span>{getTaxLabel()}</span><span>{formatMoney(vatTotal)}</span></div>
              <div className="flex justify-between"><span>Portes</span><span>{shippingTotal > 0 ? formatMoney(shippingTotal) : "Grátis"}</span></div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t"><span>Total</span><span>{formatMoney(total)}</span></div>
              <Button className="w-full mt-3" size="lg" onClick={onCheckout} disabled={submitting || missingCarrier}>{submitting ? "A enviar pedido..." : "Finalizar compra"}</Button>
              {missingCarrier && <p className="text-xs text-destructive text-center">Escolha a transportadora de cada fornecedor.</p>}
              <p className="text-xs text-muted-foreground text-center">Cada fornecedor gera uma encomenda separada.</p>

            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
