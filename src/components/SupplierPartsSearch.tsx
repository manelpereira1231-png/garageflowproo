import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ShoppingCart, Plus, Minus, Trash2, Send, Package, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

interface SupplierPart {
  id: string;
  supplier_id: string;
  part_number: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  stock_available: number;
  supplier_name?: string;
}

interface CartItem {
  part: SupplierPart;
  quantity: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  workOrderId: string;
  shopId: string;
  onOrderPlaced?: () => void;
}

export default function SupplierPartsSearch({ open, onClose, workOrderId, shopId, onOrderPlaced }: Props) {
  const { language } = useLanguage();
  const isPt = language === "pt";
  const [search, setSearch] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [parts, setParts] = useState<SupplierPart[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [showCart, setShowCart] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: partsData }, { data: suppData }] = await Promise.all([
      supabase.from("supplier_parts").select("*, suppliers(name)").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
    ]);

    if (partsData) {
      setParts(partsData.map((p: any) => ({
        ...p,
        supplier_name: p.suppliers?.name || "",
      })));
    }
    if (suppData) setSuppliers(suppData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const brands = [...new Set(parts.map(p => p.brand).filter(Boolean))];

  const filtered = parts.filter(p => {
    const matchSearch = !search || 
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.part_number.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchBrand = brandFilter === "all" || p.brand === brandFilter;
    const matchSupplier = supplierFilter === "all" || p.supplier_id === supplierFilter;
    return matchSearch && matchBrand && matchSupplier;
  });

  const addToCart = (part: SupplierPart) => {
    setCart(prev => {
      const existing = prev.find(c => c.part.id === part.id);
      if (existing) {
        return prev.map(c => c.part.id === part.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { part, quantity: 1 }];
    });
    toast.success(`${part.name} ${isPt ? "adicionado ao carrinho" : "added to cart"}`);
  };

  const updateCartQty = (partId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.part.id === partId) {
        const newQty = Math.max(1, c.quantity + delta);
        return { ...c, quantity: newQty };
      }
      return c;
    }));
  };

  const removeFromCart = (partId: string) => {
    setCart(prev => prev.filter(c => c.part.id !== partId));
  };

  const cartTotal = cart.reduce((s, c) => s + c.part.price * c.quantity, 0);
  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);

    // Group cart items by supplier
    const bySupplier = new Map<string, CartItem[]>();
    cart.forEach(item => {
      const sid = item.part.supplier_id;
      if (!bySupplier.has(sid)) bySupplier.set(sid, []);
      bySupplier.get(sid)!.push(item);
    });

    try {
      for (const [supplierId, items] of bySupplier) {
        const orderTotal = items.reduce((s, i) => s + i.part.price * i.quantity, 0);
        const firstPart = items[0].part;

        // Create the order
        const { data: order, error: orderErr } = await supabase.from("parts_orders").insert({
          shop_id: shopId,
          supplier_id: supplierId,
          work_order_id: workOrderId,
          part_name: items.length === 1 ? firstPart.name : `${items.length} ${isPt ? "peças" : "parts"}`,
          part_reference: items.length === 1 ? firstPart.part_number : null,
          quantity: items.reduce((s, i) => s + i.quantity, 0),
          unit_price: items.length === 1 ? firstPart.price : 0,
          total: orderTotal,
          status: "pending",
        } as any).select("id").single();

        if (orderErr) throw orderErr;

        // Create order items
        const itemsPayload = items.map(i => ({
          order_id: order.id,
          supplier_part_id: i.part.id,
          part_name: i.part.name,
          part_number: i.part.part_number,
          quantity: i.quantity,
          unit_price: i.part.price,
          total: i.part.price * i.quantity,
        }));

        const { error: itemsErr } = await supabase.from("parts_order_items").insert(itemsPayload as any);
        if (itemsErr) throw itemsErr;

        // Send order to supplier via edge function
        try {
          await supabase.functions.invoke("send-parts-order", {
            body: { orderId: order.id, shopId },
          });
        } catch (e) {
          console.warn("Failed to notify supplier:", e);
        }
      }

      toast.success(isPt ? "Pedido(s) criado(s) com sucesso!" : "Order(s) placed successfully!");
      setCart([]);
      setShowCart(false);
      onOrderPlaced?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Error placing order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {isPt ? "Encomendar Peças ao Fornecedor" : "Order Parts from Supplier"}
            {cartCount > 0 && (
              <Button size="sm" variant="outline" className="ml-auto gap-1" onClick={() => setShowCart(!showCart)}>
                <ShoppingCart className="w-4 h-4" />
                {cartCount} — €{cartTotal.toFixed(2)}
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        {showCart ? (
          <div className="flex-1 overflow-y-auto space-y-3">
            <h3 className="font-semibold text-sm">{isPt ? "Carrinho" : "Cart"}</h3>
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">{isPt ? "Carrinho vazio" : "Cart is empty"}</p>
            ) : (
              <div className="space-y-2">
                {cart.map(item => (
                  <Card key={item.part.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.part.name}</p>
                        <p className="text-xs text-muted-foreground">{item.part.supplier_name} · {item.part.part_number}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(item.part.id, -1)}>
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateCartQty(item.part.id, 1)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold w-20 text-right">€{(item.part.price * item.quantity).toFixed(2)}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeFromCart(item.part.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <div className="flex justify-between items-center pt-2 border-t">
                  <span className="font-semibold">{isPt ? "Total" : "Total"}</span>
                  <span className="text-lg font-bold text-primary">€{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Search & Filters */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={isPt ? "Pesquisar peça, referência, marca..." : "Search part, reference, brand..."} className="pl-9" />
              </div>
              {brands.length > 0 && (
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder={isPt ? "Marca" : "Brand"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isPt ? "Todas" : "All"}</SelectItem>
                    {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {suppliers.length > 0 && (
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder={isPt ? "Fornecedor" : "Supplier"} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isPt ? "Todos" : "All"}</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {parts.length === 0
                    ? (isPt ? "Nenhuma peça no catálogo de fornecedores. Adicione peças em Admin > Fornecedores." : "No parts in supplier catalog. Add parts in Admin > Suppliers.")
                    : (isPt ? "Sem resultados para esta pesquisa." : "No results for this search.")
                  }
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isPt ? "Peça" : "Part"}</TableHead>
                      <TableHead>{isPt ? "Referência" : "Reference"}</TableHead>
                      <TableHead>{isPt ? "Marca" : "Brand"}</TableHead>
                      <TableHead>{isPt ? "Fornecedor" : "Supplier"}</TableHead>
                      <TableHead>{isPt ? "Preço" : "Price"}</TableHead>
                      <TableHead>{isPt ? "Disponível" : "Available"}</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(p => {
                      const inCart = cart.find(c => c.part.id === p.id);
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{p.part_number || "—"}</TableCell>
                          <TableCell><Badge variant="outline">{p.brand || "—"}</Badge></TableCell>
                          <TableCell className="text-muted-foreground">{p.supplier_name}</TableCell>
                          <TableCell className="font-semibold">€{p.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={p.stock_available > 0 ? "default" : "destructive"}>
                              {p.stock_available}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant={inCart ? "secondary" : "default"} onClick={() => addToCart(p)} disabled={p.stock_available <= 0}>
                              {inCart ? `(${inCart.quantity})` : <Plus className="w-3 h-3" />}
                              <ShoppingCart className="w-3 h-3 ml-1" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          {showCart && cart.length > 0 && (
            <Button onClick={() => setShowCart(false)} variant="outline">
              {isPt ? "Continuar a comprar" : "Continue shopping"}
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>{isPt ? "Fechar" : "Close"}</Button>
          {cart.length > 0 && (
            <Button onClick={showCart ? placeOrder : () => setShowCart(true)} disabled={placing}>
              {placing && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
              <Send className="w-4 h-4 mr-1" />
              {showCart ? (isPt ? "Confirmar Pedido" : "Confirm Order") : (isPt ? "Ver Carrinho" : "View Cart")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}