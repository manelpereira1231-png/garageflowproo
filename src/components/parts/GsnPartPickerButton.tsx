/**
 * Botão + Dialog reutilizável para pesquisar peças no GarageFlow Supplier Network
 * a partir do ERP (Inventário / Orçamentos / Ordens de Reparação).
 *
 * Modos:
 *  - `onPick` definido: chama o callback com o produto escolhido (integra em linhas do documento).
 *  - `onPick` ausente: adiciona ao carrinho GSN (`gsn_cart_add`) e permite abrir /parts.
 *
 * Só é renderizado quando a feature flag global `supplier_network_enabled` está activa.
 * Zero alterações a design tokens — usa apenas variantes existentes.
 */
import { useEffect, useState } from "react";
import { ShoppingCart, Search, ExternalLink, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useSystemFeature } from "@/hooks/useSystemFeature";
import { useGsnCart } from "@/hooks/useGsnCart";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { formatMoney } from "@/lib/money";
import { getTaxLabel } from "@/lib/regionConfig";

export interface GsnPickedProduct {
  id: string;
  title: string;
  brand: string | null;
  sku: string | null;
  price: number;
  vat: number;
  stock: number;
  supplier_id: string;
}

interface Props {
  onPick?: (product: GsnPickedProduct) => void;
  label?: string;
  size?: "sm" | "default";
  variant?: "outline" | "secondary" | "default";
}

export function GsnPartPickerButton({ onPick, label, size = "sm", variant = "outline" }: Props) {
  const { enabled, loaded } = useSystemFeature("supplier_network_enabled");
  const cart = useGsnCart();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<GsnPickedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc("gsn_search_products" as any, {
        _q: q || null, _in_stock: true, _limit: 30, _offset: 0,
      });
      if (cancelled) return;
      if (error) toast.error(error.message);
      setItems(((data as any) ?? []) as GsnPickedProduct[]);
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q, open]);

  if (!loaded || !enabled) return null;

  const handleAction = async (p: GsnPickedProduct) => {
    if (onPick) {
      onPick(p);
      setOpen(false);
      toast.success("Peça adicionada");
    } else {
      await cart.add(p.id, 1);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size={size} variant={variant} className="gap-1.5">
          <ShoppingCart className="w-3.5 h-3.5" />
          {label ?? "Comprar Peça"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Marketplace de Peças
          </DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Pesquisar por referência, marca, EAN, descrição…"
            className="pl-9"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {loading && <p className="text-sm text-muted-foreground text-center py-6">A pesquisar…</p>}
          {!loading && items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {q ? "Sem resultados." : "Escreve para pesquisar peças de fornecedores."}
            </p>
          )}
          {items.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{p.title}</span>
                  {p.brand && <Badge variant="outline" className="text-[10px]">{p.brand}</Badge>}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-3 mt-0.5">
                  {p.sku && <span>REF: {p.sku}</span>}
                  <span>Stock: {p.stock}</span>
                  <span>{getTaxLabel()} {Number(p.vat)}%</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{formatMoney(Number(p.price))}</div>
                <Button type="button" size="sm" className="mt-1 h-7" onClick={() => handleAction(p)}>
                  {onPick ? "Adicionar" : "Ao carrinho"}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>{items.length} resultado(s)</span>
          <Link to="/parts" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => setOpen(false)}>
            Abrir Marketplace completo <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
