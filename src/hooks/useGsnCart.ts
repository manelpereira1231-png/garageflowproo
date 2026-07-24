/**
 * Carrinho GSN (client-side wrapper).
 * Todas as escritas fluem via RPC segura (`gsn_cart_add`, `gsn_cart_checkout`)
 * para garantir que o cálculo de preço/IVA nunca depende do cliente.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSupplierMarket } from "@/hooks/useSupplierMarket";
import { toast } from "sonner";

export interface CartItem {
  id: string;
  product_id: string;
  supplier_id: string;
  quantity: number;
  unit_price: number;
  vat: number;
  product?: { title: string; image: string | null; brand: string | null } | null;
  supplier?: { company_name: string } | null;
}

export function useGsnCart() {
  const { activeShopId, enabled, ready } = useSupplierMarket();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ready || !enabled || !activeShopId) { setItems([]); return; }
    setLoading(true);
    const { data: cart } = await supabase.from("gsn_carts" as any).select("id").eq("shop_id", activeShopId).maybeSingle();
    if (!cart) { setItems([]); setLoading(false); return; }
    const { data } = await supabase
      .from("gsn_cart_items" as any)
      .select("id,product_id,supplier_id,quantity,unit_price,vat,product:gsn_products(title,image,brand),supplier:gsn_suppliers(company_name)")
      .eq("cart_id", (cart as any).id);
    setItems((data as any) ?? []);
    setLoading(false);
  }, [ready, enabled, activeShopId]);

  useEffect(() => { void load(); }, [load]);

  const add = useCallback(async (productId: string, qty = 1) => {
    if (!activeShopId) { toast.error("Sem oficina activa"); return; }
    const { error } = await supabase.rpc("gsn_cart_add" as any, { _shop_id: activeShopId, _product_id: productId, _quantity: qty });
    if (error) { toast.error(error.message); return; }
    toast.success("Adicionado ao carrinho");
    void load();
  }, [activeShopId, load]);

  const updateQuantity = useCallback(async (itemId: string, qty: number) => {
    if (qty <= 0) return remove(itemId);
    const { error } = await supabase.from("gsn_cart_items" as any).update({ quantity: qty }).eq("id", itemId);
    if (error) toast.error(error.message);
    void load();
  }, [load]);

  const remove = useCallback(async (itemId: string) => {
    const { error } = await supabase.from("gsn_cart_items" as any).delete().eq("id", itemId);
    if (error) toast.error(error.message);
    void load();
  }, [load]);

  const checkout = useCallback(async (): Promise<string[]> => {
    if (!activeShopId) { toast.error("Sem oficina activa"); return []; }
    const { data, error } = await supabase.rpc("gsn_cart_checkout" as any, { _shop_id: activeShopId });
    if (error) { toast.error(error.message); return []; }
    toast.success("Encomenda criada");
    void load();
    return ((data as any) ?? []).map((r: any) => (typeof r === "string" ? r : r.gsn_cart_checkout));
  }, [activeShopId, load]);

  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
  const vatTotal = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity * Number(i.vat) / 100, 0);
  const total = subtotal + vatTotal;
  const bySupplier = items.reduce<Record<string, CartItem[]>>((acc, i) => {
    (acc[i.supplier_id] ??= []).push(i); return acc;
  }, {});

  return { items, bySupplier, subtotal, vatTotal, total, loading, add, updateQuantity, remove, checkout, reload: load };
}
