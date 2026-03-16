import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ShoppingCart, Plus, Minus, Trash2, Send, Package, Loader2, Building2 } from "lucide-react";
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
  workOrderId?: string;
  shopId: string;
  defaultSupplierId?: string;
  onOrderPlaced?: () => void;
}

export default function SupplierPartsSearch({
  open,
  onClose,
  workOrderId,
  shopId,
  defaultSupplierId,
  onOrderPlaced,
}: Props) {
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

  const linkedToWorkOrder = Boolean(workOrderId);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: partsData }, { data: suppData }] = await Promise.all([
      supabase.from("supplier_parts").select("*, suppliers(name)").order("name"),
      supabase.from("suppliers").select("id, name").order("name"),
    ]);

    if (partsData) {
      setParts(
        partsData.map((p: any) => ({
          ...p,
          supplier_name: p.suppliers?.name || "",
        })),
      );
    }

    if (suppData) setSuppliers(suppData);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSupplierFilter(defaultSupplierId ?? "all");
    setBrandFilter("all");
    setSearch("");
    loadData();
  }, [open, loadData, defaultSupplierId]);

  const brands = [...new Set(parts.map((p) => p.brand).filter(Boolean))];

  const filtered = parts.filter((p) => {
    const matchSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.part_number.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase());
    const matchBrand = brandFilter === "all" || p.brand === brandFilter;
    const matchSupplier = supplierFilter === "all" || p.supplier_id === supplierFilter;
    return matchSearch && matchBrand && matchSupplier;
  });

  const summary = useMemo(() => {
    const visibleSuppliers = new Set(filtered.map((part) => part.supplier_id)).size;
    const availableNow = filtered.filter((part) => part.stock_available > 0).length;

    return {
      totalParts: filtered.length,
      visibleSuppliers,
      availableNow,
    };
  }, [filtered]);

  const addToCart = (part: SupplierPart) => {
    if (part.stock_available <= 0) {
      toast.error(isPt ? "Esta peça está sem stock." : "This part is out of stock.");
      return;
    }

    const existing = cart.find((item) => item.part.id === part.id);
    if (existing && existing.quantity >= part.stock_available) {
      toast.error(isPt ? "Já atingiu o stock disponível." : "You already reached available stock.");
      return;
    }

    setCart((prev) => {
      if (existing) {
        return prev.map((item) =>
          item.part.id === part.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [...prev, { part, quantity: 1 }];
    });

    toast.success(`${part.name} ${isPt ? "adicionado ao carrinho" : "added to cart"}`);
  };

  const updateCartQty = (partId: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.part.id !== partId) return item;
        const nextQty = Math.min(item.part.stock_available, Math.max(1, item.quantity + delta));
        return { ...item, quantity: nextQty };
      }),
    );
  };

  const removeFromCart = (partId: string) => {
    setCart((prev) => prev.filter((item) => item.part.id !== partId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.part.price * item.quantity, 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    if (!shopId) {
      toast.error(isPt ? "Selecione uma oficina antes de encomendar." : "Select a shop before ordering.");
      return;
    }

    if (cart.length === 0) return;
    setPlacing(true);

    const bySupplier = new Map<string, CartItem[]>();
    cart.forEach((item) => {
      const supplierId = item.part.supplier_id;
      if (!bySupplier.has(supplierId)) bySupplier.set(supplierId, []);
      bySupplier.get(supplierId)!.push(item);
    });

    try {
      for (const [supplierId, items] of bySupplier) {
        const orderTotal = items.reduce((sum, item) => sum + item.part.price * item.quantity, 0);
        const firstPart = items[0].part;

        const { data: order, error: orderError } = await supabase
          .from("parts_orders")
          .insert({
            shop_id: shopId,
            supplier_id: supplierId,
            work_order_id: workOrderId ?? null,
            part_name: items.length === 1 ? firstPart.name : `${items.length} ${isPt ? "peças" : "parts"}`,
            part_reference: items.length === 1 ? firstPart.part_number : null,
            quantity: items.reduce((sum, item) => sum + item.quantity, 0),
            unit_price: items.length === 1 ? firstPart.price : 0,
            total: orderTotal,
            status: "pending",
          } as any)
          .select("id")
          .single();

        if (orderError) throw orderError;

        const itemsPayload = items.map((item) => ({
          order_id: order.id,
          supplier_part_id: item.part.id,
          part_name: item.part.name,
          part_number: item.part.part_number,
          quantity: item.quantity,
          unit_price: item.part.price,
          total: item.part.price * item.quantity,
        }));

        const { error: itemsError } = await supabase.from("parts_order_items").insert(itemsPayload as any);
        if (itemsError) throw itemsError;

        try {
          await supabase.functions.invoke("send-parts-order", {
            body: { orderId: order.id, shopId },
          });
        } catch (error) {
          console.warn("Failed to notify supplier:", error);
        }
      }

      toast.success(
        isPt
          ? "Pedido criado e enviado ao fornecedor com sucesso."
          : "Order created and sent to the supplier successfully.",
      );
      setCart([]);
      setShowCart(false);
      onOrderPlaced?.();
      onClose();
    } catch (error: any) {
      toast.error(error.message || (isPt ? "Erro ao criar pedido." : "Error placing order."));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {linkedToWorkOrder
              ? isPt
                ? "Encomendar peças para a ordem"
                : "Order parts for work order"
              : isPt
                ? "Comprar peças aos fornecedores"
                : "Buy parts from suppliers"}
            {cartCount > 0 && (
              <Button size="sm" variant="outline" className="ml-auto gap-1" onClick={() => setShowCart(!showCart)}>
                <ShoppingCart className="w-4 h-4" />
                {cartCount} — €{cartTotal.toFixed(2)}
              </Button>
            )}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {linkedToWorkOrder
              ? isPt
                ? "Pesquise no catálogo real, adicione ao carrinho e envie o pedido diretamente ao fornecedor."
                : "Search the real catalog, add items to cart, and send the order directly to the supplier."
              : isPt
                ? "Escolha o fornecedor, adicione as peças ao carrinho e envie a encomenda para a oficina ativa."
                : "Choose a supplier, add parts to cart, and send the order for the active shop."}
          </p>
        </DialogHeader>

        {showCart ? (
          <div className="flex-1 overflow-y-auto space-y-3">
            <h3 className="font-semibold text-sm">{isPt ? "Resumo do pedido" : "Order summary"}</h3>
            {cart.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">{isPt ? "Carrinho vazio" : "Cart is empty"}</p>
            ) : (
              <div className="space-y-2">
                {cart.map((item) => (
                  <Card key={item.part.id}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.part.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.part.supplier_name} · {item.part.part_number || "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateCartQty(item.part.id, -1)}
                        >
                          <Minus className="w-3 h-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-7 w-7"
                          onClick={() => updateCartQty(item.part.id, 1)}
                          disabled={item.quantity >= item.part.stock_available}
                        >
                          <Plus className="w-3 h-3" />
                        </Button>
                      </div>
                      <span className="text-sm font-semibold w-20 text-right">€{(item.part.price * item.quantity).toFixed(2)}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeFromCart(item.part.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
                <div className="flex justify-between items-center pt-2 border-t border-border">
                  <span className="font-semibold">{isPt ? "Total" : "Total"}</span>
                  <span className="text-lg font-bold text-primary">€{cartTotal.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <Package className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{summary.totalParts}</p>
                    <p className="text-xs text-muted-foreground">{isPt ? "Peças visíveis" : "Visible parts"}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{summary.visibleSuppliers}</p>
                    <p className="text-xs text-muted-foreground">{isPt ? "Fornecedores" : "Suppliers"}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 flex items-center gap-3">
                  <ShoppingCart className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-lg font-bold">{summary.availableNow}</p>
                    <p className="text-xs text-muted-foreground">{isPt ? "Com stock" : "In stock"}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={isPt ? "Pesquisar peça, referência ou marca..." : "Search part, reference, or brand..."}
                  className="pl-9"
                />
              </div>
              {brands.length > 0 && (
                <Select value={brandFilter} onValueChange={setBrandFilter}>
                  <SelectTrigger className="w-full sm:w-[160px]">
                    <SelectValue placeholder={isPt ? "Marca" : "Brand"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isPt ? "Todas as marcas" : "All brands"}</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {suppliers.length > 0 && (
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger className="w-full sm:w-[220px]">
                    <SelectValue placeholder={isPt ? "Fornecedor" : "Supplier"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{isPt ? "Todos os fornecedores" : "All suppliers"}</SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">
                  {parts.length === 0
                    ? isPt
                      ? "Nenhuma peça disponível no catálogo dos fornecedores."
                      : "No parts available in the supplier catalog."
                    : isPt
                      ? "Sem resultados para esta pesquisa."
                      : "No results for this search."}
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
                      <TableHead>{isPt ? "Ação" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((part) => {
                      const inCart = cart.find((item) => item.part.id === part.id);
                      return (
                        <TableRow key={part.id}>
                          <TableCell className="font-medium">{part.name}</TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">{part.part_number || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{part.brand || "—"}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{part.supplier_name}</TableCell>
                          <TableCell className="font-semibold">€{part.price.toFixed(2)}</TableCell>
                          <TableCell>
                            <Badge variant={part.stock_available > 0 ? "default" : "destructive"}>{part.stock_available}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant={inCart ? "secondary" : "default"}
                              onClick={() => addToCart(part)}
                              disabled={part.stock_available <= 0}
                            >
                              {inCart
                                ? `${isPt ? "No carrinho" : "In cart"} (${inCart.quantity})`
                                : isPt
                                  ? "Adicionar"
                                  : "Add"}
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
          <Button variant="outline" onClick={onClose}>
            {isPt ? "Fechar" : "Close"}
          </Button>
          {cart.length > 0 && (
            <Button onClick={showCart ? placeOrder : () => setShowCart(true)} disabled={placing}>
              {placing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              {showCart ? (isPt ? "Confirmar pedido" : "Confirm order") : isPt ? "Ver carrinho" : "View cart"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
