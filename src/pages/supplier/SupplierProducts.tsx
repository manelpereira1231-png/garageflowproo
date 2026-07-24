import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Copy, Archive, Trash2, Upload, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";

interface Product {
  id: string;
  title: string;
  sku: string | null;
  brand: string | null;
  price: number;
  stock: number;
  status: "draft" | "active" | "archived";
}

export default function SupplierProducts() {
  const { supplierId } = useIsSupplier();
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!supplierId) return;
    setLoading(true);
    const { data } = await supabase
      .from("gsn_products" as any)
      .select("id,title,sku,brand,price,stock,status")
      .eq("supplier_id", supplierId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setItems((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [supplierId]);

  const filtered = items.filter((p) => {
    if (!q) return true;
    const s = q.toLowerCase();
    return p.title.toLowerCase().includes(s) || (p.sku ?? "").toLowerCase().includes(s) || (p.brand ?? "").toLowerCase().includes(s);
  });

  const duplicate = async (id: string) => {
    const src = items.find((p) => p.id === id);
    if (!src || !supplierId) return;
    const { error } = await supabase.from("gsn_products" as any).insert({
      supplier_id: supplierId,
      title: `${src.title} (cópia)`,
      sku: src.sku ? `${src.sku}-COPY` : null,
      brand: src.brand,
      price: src.price,
      stock: 0,
      status: "draft",
    });
    if (error) return toast.error(error.message);
    toast.success("Produto duplicado");
    void load();
  };

  const archive = async (id: string) => {
    const { error } = await supabase.from("gsn_products" as any).update({ status: "archived" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto arquivado");
    void load();
  };

  const softDelete = async (id: string) => {
    if (!confirm("Eliminar este produto?")) return;
    const { error } = await supabase.from("gsn_products" as any).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto eliminado");
    void load();
  };

  const exportCsv = () => {
    const rows = [["sku","title","brand","price","stock","status"], ...items.map((p) => [p.sku ?? "", p.title, p.brand ?? "", String(p.price), String(p.stock), p.status])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `produtos-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    if (!supplierId) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return toast.error("CSV vazio");
    const header = lines[0].split(",").map((h) => h.replace(/^"|"$/g, "").trim().toLowerCase());
    const idx = (k: string) => header.indexOf(k);
    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"')) ?? [];
      const title = cols[idx("title")]?.trim();
      if (!title) continue;
      rows.push({
        supplier_id: supplierId,
        title,
        sku: cols[idx("sku")]?.trim() || null,
        brand: cols[idx("brand")]?.trim() || null,
        price: Number(cols[idx("price")] || 0),
        stock: Number(cols[idx("stock")] || 0),
        status: (cols[idx("status")]?.trim() as any) || "draft",
      });
    }
    if (!rows.length) return toast.error("Sem linhas válidas");
    const { error } = await supabase.from("gsn_products" as any).insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} produtos importados`);
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Catálogo da sua loja.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="w-4 h-4 mr-2" />Exportar</Button>
          <label>
            <input type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importCsv(f); e.target.value = ""; }} />
            <Button variant="outline" asChild><span><Upload className="w-4 h-4 mr-2" />Importar CSV</span></Button>
          </label>
          <Link to="/supplier/products/new">
            <Button><Plus className="w-4 h-4 mr-2" />Novo produto</Button>
          </Link>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por título, SKU ou marca..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Ainda não tem produtos. Crie o primeiro.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Título</th>
                    <th className="px-4 py-3">SKU</th>
                    <th className="px-4 py-3">Marca</th>
                    <th className="px-4 py-3 text-right">Preço</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium">{p.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.sku || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{p.brand || "—"}</td>
                      <td className="px-4 py-3 text-right">€ {Number(p.price).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right">{p.stock}</td>
                      <td className="px-4 py-3">
                        <Badge variant={p.status === "active" ? "default" : p.status === "draft" ? "secondary" : "outline"}>
                          {p.status === "active" ? "Ativo" : p.status === "draft" ? "Rascunho" : "Arquivado"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Link to={`/supplier/products/${p.id}`}>
                            <Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>
                          </Link>
                          <Button size="sm" variant="ghost" onClick={() => duplicate(p.id)}><Copy className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => archive(p.id)}><Archive className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => softDelete(p.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
