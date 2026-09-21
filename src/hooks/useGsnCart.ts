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

export interface CartCarrier {
  id: string;
  supplier_id: string;
  name: string;
  base_price: number;
  eta_days: number | null;
  free_above: number | null;
}

export function useGsnCart() {
  const { activeShopId, enabled, ready } = useSupplierMarket();
  const [items, setItems] = useState<CartItem[]>([]);
  const [carriers, setCarriers] = useState<CartCarrier[]>([]);
  const [selectedCarriers, setSelectedCarriers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!ready || !enabled || !activeShopId) { setItems([]); setCarriers([]); return; }
    setLoading(true);
    const { data: cart } = await supabase.from("gsn_carts" as any).select("id").eq("shop_id", activeShopId).maybeSingle();
    if (!cart) { setItems([]); setCarriers([]); setLoading(false); return; }
    const { data } = await supabase
      .from("gsn_cart_items" as any)
      .select("id,product_id,supplier_id,quantity,unit_price,vat,product:gsn_products(title,image,brand),supplier:gsn_suppliers(company_name)")
      .eq("cart_id", (cart as any).id);
    const rows = ((data as any) ?? []) as CartItem[];
    setItems(rows);

    const supplierIds = Array.from(new Set(rows.map((r) => r.supplier_id)));
    if (supplierIds.length) {
      const { data: cs } = await supabase
        .from("gsn_carriers" as any)
        .select("id,supplier_id,name,base_price,eta_days,free_above")
        .in("supplier_id", supplierIds)
        .eq("active", true)
        .order("base_price");
      const list = ((cs as any) ?? []) as CartCarrier[];
      setCarriers(list);
      // Pré-selecciona a opção mais barata de cada fornecedor
      setSelectedCarriers((prev) => {
        const next = { ...prev };
        supplierIds.forEach((sid) => {
          const opts = list.filter((c) => c.supplier_id === sid);
          if (!opts.length) { delete next[sid]; return; }
          if (!next[sid] || !opts.some((o) => o.id === next[sid])) next[sid] = opts[0].id;
        });
        Object.keys(next).forEach((k) => { if (!supplierIds.includes(k)) delete next[k]; });
        return next;
      });
    } else {
      setCarriers([]);
      setSelectedCarriers({});
    }
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
    const { data, error } = await supabase.rpc("gsn_cart_checkout" as any, {
      _shop_id: activeShopId,
      _carriers: selectedCarriers,
    });
    if (error) {
      const msg = error.message.includes("carrier_required")
        ? "Escolha a transportadora antes de finalizar."
        : error.message.includes("carrier_invalid")
          ? "Transportadora indisponível. Escolha outra."
          : error.message;
      toast.error(msg);
      return [];
    }
    toast.success("Encomenda criada");
    void load();
    return ((data as any) ?? []).map((r: any) => (typeof r === "string" ? r : r.gsn_cart_checkout));
  }, [activeShopId, load, selectedCarriers]);

  const subtotal = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity, 0);
  const vatTotal = items.reduce((s, i) => s + Number(i.unit_price) * i.quantity * Number(i.vat) / 100, 0);
  const bySupplier = items.reduce<Record<string, CartItem[]>>((acc, i) => {
    (acc[i.supplier_id] ??= []).push(i); return acc;
  }, {});

  const carriersBySupplier = carriers.reduce<Record<string, CartCarrier[]>>((acc, c) => {
    (acc[c.supplier_id] ??= []).push(c); return acc;
  }, {});

  // Portes por fornecedor (mesma regra do servidor: grátis acima do limiar)
  const shippingBySupplier: Record<string, number> = {};
  Object.entries(bySupplier).forEach(([sid, its]) => {
    const carrier = carriers.find((c) => c.id === selectedCarriers[sid]);
    if (!carrier) { shippingBySupplier[sid] = 0; return; }
    const goods = its.reduce((s, i) => s + Number(i.unit_price) * i.quantity * (1 + Number(i.vat) / 100), 0);
    shippingBySupplier[sid] = carrier.free_above != null && goods >= Number(carrier.free_above)
      ? 0
      : Number(carrier.base_price);
  });
  const shippingTotal = Object.values(shippingBySupplier).reduce((s, v) => s + v, 0);
  const total = subtotal + vatTotal + shippingTotal;

  const missingCarrier = Object.keys(bySupplier).some(
    (sid) => (carriersBySupplier[sid]?.length ?? 0) > 0 && !selectedCarriers[sid]
  );

  const selectCarrier = useCallback((supplierId: string, carrierId: string) => {
    setSelectedCarriers((prev) => ({ ...prev, [supplierId]: carrierId }));
  }, []);

  return {
    items, bySupplier, subtotal, vatTotal, shippingTotal, shippingBySupplier, total, loading,
    carriersBySupplier, selectedCarriers, selectCarrier, missingCarrier,
    add, updateQuantity, remove, checkout, reload: load,
  };
}

