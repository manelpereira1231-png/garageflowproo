import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, TrendingUp, TrendingDown, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";

interface Movement {
  id: string; product_id: string; type: string; quantity: number; reason: string | null; created_at: string;
  product?: { title: string; sku: string | null; stock: number };
}
interface Product { id: string; title: string; sku: string | null; stock: number }

export default function SupplierStock() {
  const { supplierId } = useIsSupplier();
  const [moves, setMoves] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [type, setType] = useState<"in" | "out" | "adjust">("in");
  const [qty, setQty] = useState<number>(0);
  const [reason, setReason] = useState("");

  const load = async () => {
    if (!supplierId) return;
    setLoading(true);
    const [{ data: m }, { data: p }] = await Promise.all([
      supabase.from("gsn_stock_movements" as any)
        .select("id,product_id,type,quantity,reason,created_at,product:gsn_products(title,sku,stock)")
        .eq("supplier_id", supplierId).order("created_at", { ascending: false }).limit(200),
      supabase.from("gsn_products" as any).select("id,title,sku,stock")
        .eq("supplier_id", supplierId).is("deleted_at", null).order("title"),
    ]);
    setMoves((m as any) ?? []);
    setProducts((p as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [supplierId]);

  const submit = async () => {
    if (!productId || !qty || !supplierId) return;
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    let newStock = product.stock;
    if (type === "in") newStock = product.stock + Math.abs(qty);
    if (type === "out") newStock = Math.max(0, product.stock - Math.abs(qty));
    if (type === "adjust") newStock = Math.max(0, qty);

    const { error: e1 } = await supabase.from("gsn_stock_movements" as any).insert({
      supplier_id: supplierId, product_id: productId, type,
      quantity: type === "adjust" ? qty - product.stock : (type === "in" ? Math.abs(qty) : -Math.abs(qty)),
      reason: reason || null,
    });
    if (e1) return toast.error(e1.message);
    const { error: e2 } = await supabase.from("gsn_products" as any).update({ stock: newStock }).eq("id", productId);
    if (e2) return toast.error(e2.message);
    toast.success("Movimento registado");
    setOpen(false); setProductId(""); setQty(0); setReason(""); setType("in");
    void load();
  };

  const lowStock = products.filter((p) => p.stock > 0 && p.stock <= 5).length;
  const outOfStock = products.filter((p) => p.stock === 0).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock</h1>
          <p className="text-sm text-muted-foreground">Movimentos, ajustes e inventário.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Novo movimento</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Produtos</div><div className="text-2xl font-bold">{products.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Stock baixo (≤5)</div><div className="text-2xl font-bold text-amber-500">{lowStock}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Sem stock</div><div className="text-2xl font-bold text-destructive">{outOfStock}</div></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : moves.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Sem movimentos ainda.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Produto</th>
                    <th className="px-4 py-3">Tipo</th>
                    <th className="px-4 py-3 text-right">Qtd</th>
                    <th className="px-4 py-3">Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {moves.map((m) => (
                    <tr key={m.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-3 text-muted-foreground">{new Date(m.created_at).toLocaleString()}</td>
                      <td className="px-4 py-3 font-medium">{m.product?.title ?? "—"} <span className="text-xs text-muted-foreground">{m.product?.sku}</span></td>
                      <td className="px-4 py-3">
                        <Badge variant={m.type === "in" ? "default" : m.type === "out" ? "destructive" : "secondary"}>
                          {m.type === "in" && <TrendingUp className="w-3 h-3 mr-1" />}
                          {m.type === "out" && <TrendingDown className="w-3 h-3 mr-1" />}
                          {m.type === "adjust" && <RotateCcw className="w-3 h-3 mr-1" />}
                          {m.type === "in" ? "Entrada" : m.type === "out" ? "Saída" : "Ajuste"}
                        </Badge>
                      </td>
                      <td className={`px-4 py-3 text-right font-mono ${m.quantity < 0 ? "text-destructive" : "text-emerald-500"}`}>{m.quantity > 0 ? "+" : ""}{m.quantity}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo movimento de stock</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Produto</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">— Escolher —</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.title} (stock: {p.stock})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={type} onChange={(e) => setType(e.target.value as any)}>
                <option value="in">Entrada</option>
                <option value="out">Saída</option>
                <option value="adjust">Ajuste (definir stock final)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Quantidade</label>
              <Input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-sm font-medium">Motivo (opcional)</label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: Receção de fornecedor, quebra, inventário..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit}>Registar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
