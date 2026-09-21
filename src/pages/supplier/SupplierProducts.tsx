import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Search, Pencil, Copy, Trash2, Upload, Download, Eye, Check, X,
  ImageIcon, Package, Globe, EyeOff,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { format } from "date-fns";

interface Product {
  id: string;
  title: string;
  sku: string | null;
  manufacturer_reference: string | null;
  ean: string | null;
  brand: string | null;
  category: string | null;
  price: number;
  discount_price: number | null;
  currency: string | null;
  stock: number;
  status: "draft" | "active" | "archived";
  image: string | null;
  updated_at: string | null;
}

const FILTERS = [
  { key: "all", label: "Todos" },
  { key: "published", label: "Publicados" },
  { key: "draft", label: "Rascunhos" },
  { key: "out", label: "Sem stock" },
  { key: "unpublished", label: "Despublicados" },
] as const;

type FilterKey = typeof FILTERS[number]["key"];

function statusInfo(p: Product) {
  if (p.status === "active" && p.stock <= 0) return { dot: "🔴", label: "Sem stock", variant: "destructive" as const };
  if (p.status === "active") return { dot: "🟢", label: "Publicado", variant: "default" as const };
  if (p.status === "draft") return { dot: "🟡", label: "Rascunho", variant: "secondary" as const };
  return { dot: "⚪", label: "Despublicado", variant: "outline" as const };
}

export default function SupplierProducts() {
  const { supplierId } = useIsSupplier();
  const [params, setParams] = useSearchParams();
  const filter = (params.get("f") as FilterKey) || "all";
  const [items, setItems] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [loading, setLoading] = useState(true);
  const [brand, setBrand] = useState("all");
  const [category, setCategory] = useState("all");
  const [editing, setEditing] = useState<{ id: string; stock: string; price: string } | null>(null);
  const [preview, setPreview] = useState<Product | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    if (!supplierId) return;
    setLoading(true);
    let query = supabase
      .from("gsn_products" as any)
      .select("id,title,sku,manufacturer_reference,ean,brand,category,price,discount_price,currency,stock,status,image,updated_at")
      .eq("supplier_id", supplierId)
      .is("deleted_at", null);

    if (debounced) {
      const s = debounced.replace(/[%,]/g, " ");
      query = query.or(
        `title.ilike.%${s}%,sku.ilike.%${s}%,manufacturer_reference.ilike.%${s}%,ean.ilike.%${s}%,brand.ilike.%${s}%`,
      );
    }
    if (filter === "published") query = query.eq("status", "active").gt("stock", 0);
    if (filter === "draft") query = query.eq("status", "draft");
    if (filter === "out") query = query.eq("stock", 0);
    if (filter === "unpublished") query = query.eq("status", "archived");

    const { data, error } = await query.order("updated_at", { ascending: false }).limit(500);
    if (error) toast.error("Não foi possível carregar os produtos");
    setItems(((data as any) ?? []) as Product[]);
    setLoading(false);
  }, [supplierId, debounced, filter]);

  useEffect(() => { void load(); }, [load]);

  const brands = useMemo(() => Array.from(new Set(items.map((p) => p.brand).filter(Boolean))) as string[], [items]);
  const categories = useMemo(() => Array.from(new Set(items.map((p) => p.category).filter(Boolean))) as string[], [items]);

  const visible = items.filter((p) =>
    (brand === "all" || p.brand === brand) && (category === "all" || p.category === category));

  const setFilter = (k: FilterKey) => {
    const next = new URLSearchParams(params);
    if (k === "all") next.delete("f"); else next.set("f", k);
    setParams(next, { replace: true });
  };

  const togglePublish = async (p: Product) => {
    if (busy) return;
    setBusy(p.id);
    const next = p.status === "active" ? "archived" : "active";
    const { error } = await supabase.from("gsn_products" as any).update({ status: next }).eq("id", p.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    toast.success(next === "active" ? "Produto publicado na Rede" : "Produto despublicado");
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, status: next as Product["status"] } : x)));
  };

  const saveInline = async () => {
    if (!editing) return;
    const stock = Math.max(0, Math.floor(Number(editing.stock) || 0));
    const price = Number(editing.price);
    if (!Number.isFinite(price) || price < 0) return toast.error("Preço inválido");
    setBusy(editing.id);
    const { error } = await supabase.from("gsn_products" as any).update({ stock, price }).eq("id", editing.id);
    setBusy(null);
    if (error) return toast.error(error.message);
    setItems((prev) => prev.map((x) => (x.id === editing.id ? { ...x, stock, price, updated_at: new Date().toISOString() } : x)));
    setEditing(null);
    toast.success("Produto atualizado");
  };

  const duplicate = async (id: string) => {
    const src = items.find((p) => p.id === id);
    if (!src || !supplierId) return;
    const { error } = await supabase.from("gsn_products" as any).insert({
      supplier_id: supplierId,
      title: `${src.title} (cópia)`,
      sku: src.sku ? `${src.sku}-COPY` : null,
      brand: src.brand,
      category: src.category,
      price: src.price,
      stock: 0,
      status: "draft",
    });
    if (error) return toast.error(error.message);
    toast.success("Produto duplicado");
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
    const rows = [["sku","title","brand","category","price","stock","status"], ...items.map((p) => [p.sku ?? "", p.title, p.brand ?? "", p.category ?? "", String(p.price), String(p.stock), p.status])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = `produtos-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const openCsv = async (file: File) => {
    const text = await readCsvText(file);
    const parsed = parseProductCsv(text);
    setImportState({ parsed, running: false, result: null });
  };

  const runImport = async () => {
    const parsed = importState?.parsed;
    if (!parsed || !supplierId) return;
    setImportState({ ...importState!, running: true });

    let imported = 0, updated = 0, failed = 0;
    const errors: { line: number; message: string }[] = [...parsed.errors];

    // SKUs já existentes deste fornecedor (nunca duplicar)
    const skus = parsed.rows.map((r) => r.sku).filter(Boolean) as string[];
    const existing = new Map<string, string>();
    if (skus.length) {
      const { data } = await supabase.from("gsn_products" as any)
        .select("id,sku").eq("supplier_id", supplierId).in("sku", skus);
      ((data as any[]) ?? []).forEach((p) => p.sku && existing.set(p.sku, p.id));
    }

    for (const row of parsed.rows) {
      const payload = toProductPayload(row, supplierId);
      const existingId = row.sku ? existing.get(row.sku) : undefined;
      const { error } = existingId
        ? await supabase.from("gsn_products" as any).update({ ...payload, updated_at: new Date().toISOString() }).eq("id", existingId)
        : await supabase.from("gsn_products" as any).insert(payload);
      if (error) { failed++; errors.push({ line: row.line, message: error.message }); }
      else if (existingId) updated++;
      else imported++;
    }

    setImportState({
      parsed,
      running: false,
      result: { read: parsed.rows.length, imported, updated, failed, errors },
    });
    void load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Produtos</h1>
          <p className="text-sm text-muted-foreground">Catálogo disponível para as oficinas da Rede GarageFlow.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar por nome, SKU, referência, EAN ou marca..." value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <Button key={f.key} size="sm" variant={filter === f.key ? "default" : "outline"} className="shrink-0" onClick={() => setFilter(f.key)}>
              {f.label}
            </Button>
          ))}
        </div>
        {brands.length > 1 && (
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="all">Todas as marcas</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        )}
        {categories.length > 1 && (
          <select className="h-9 rounded-md border border-input bg-background px-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="all">Todas as categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : visible.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground space-y-3">
              <Package className="w-8 h-8 mx-auto opacity-60" />
              <p className="text-sm">{debounced || filter !== "all" ? "Nenhum produto corresponde a esta vista." : "Ainda não tem produtos. Crie o primeiro para ser encontrado pelas oficinas."}</p>
              {!debounced && filter === "all" && (
                <Link to="/supplier/products/new"><Button size="sm"><Plus className="w-4 h-4 mr-2" />Publicar primeiro produto</Button></Link>
              )}
            </div>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border">
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Referência</th>
                      <th className="px-4 py-3">Marca / Categoria</th>
                      <th className="px-4 py-3 text-right">Preço</th>
                      <th className="px-4 py-3 text-right">Stock</th>
                      <th className="px-4 py-3">Estado</th>
                      <th className="px-4 py-3">Atualizado</th>
                      <th className="px-4 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((p) => {
                      const st = statusInfo(p);
                      const ed = editing?.id === p.id;
                      return (
                        <tr key={p.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3 min-w-0">
                              {p.image ? (
                                <img src={p.image} alt={p.title} className="w-9 h-9 rounded object-cover shrink-0" loading="lazy" />
                              ) : (
                                <div className="w-9 h-9 rounded bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4 text-muted-foreground" /></div>
                              )}
                              <span className="font-medium truncate max-w-[220px]" title={p.title}>{p.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{p.sku || p.manufacturer_reference || p.ean || "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground">{[p.brand, p.category].filter(Boolean).join(" · ") || "—"}</td>
                          <td className="px-4 py-3 text-right">
                            {ed ? (
                              <Input type="number" step="0.01" className="h-8 w-24 ml-auto text-right" value={editing!.price} onChange={(e) => setEditing({ ...editing!, price: e.target.value })} />
                            ) : formatMoney(Number(p.price), p.currency ?? undefined)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {ed ? (
                              <Input type="number" min="0" className="h-8 w-20 ml-auto text-right" value={editing!.stock} onChange={(e) => setEditing({ ...editing!, stock: e.target.value })} />
                            ) : p.stock}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={st.variant} className="gap-1">{st.dot} {st.label}</Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{p.updated_at ? format(new Date(p.updated_at), "dd/MM/yyyy HH:mm") : "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              {ed ? (
                                <>
                                  <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={saveInline} title="Guardar"><Check className="w-4 h-4 text-emerald-500" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)} title="Cancelar"><X className="w-4 h-4" /></Button>
                                </>
                              ) : (
                                <>
                                  <Button size="sm" variant="ghost" onClick={() => setEditing({ id: p.id, stock: String(p.stock), price: String(p.price) })} title="Editar preço e stock"><Pencil className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => setPreview(p)} title="Ver como aparece às oficinas"><Eye className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => togglePublish(p)} title={p.status === "active" ? "Despublicar" : "Publicar na Rede"}>
                                    {p.status === "active" ? <EyeOff className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                                  </Button>
                                  <Link to={`/supplier/products/${p.id}`}><Button size="sm" variant="ghost" title="Editar produto"><Package className="w-4 h-4" /></Button></Link>
                                  <Button size="sm" variant="ghost" onClick={() => duplicate(p.id)} title="Duplicar"><Copy className="w-4 h-4" /></Button>
                                  <Button size="sm" variant="ghost" onClick={() => softDelete(p.id)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="md:hidden divide-y">
                {visible.map((p) => {
                  const st = statusInfo(p);
                  const ed = editing?.id === p.id;
                  return (
                    <div key={p.id} className="p-3 space-y-2 overflow-hidden">
                      <div className="flex items-start gap-3 min-w-0">
                        {p.image ? (
                          <img src={p.image} alt={p.title} className="w-10 h-10 rounded object-cover shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0"><ImageIcon className="w-4 h-4 text-muted-foreground" /></div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate" title={p.title}>{p.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{[p.sku || p.manufacturer_reference, p.brand].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                        <Badge variant={st.variant} className="shrink-0 text-[10px]">{st.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        {ed ? (
                          <div className="flex items-center gap-2">
                            <Input type="number" step="0.01" className="h-8 w-24" value={editing!.price} onChange={(e) => setEditing({ ...editing!, price: e.target.value })} />
                            <Input type="number" min="0" className="h-8 w-16" value={editing!.stock} onChange={(e) => setEditing({ ...editing!, stock: e.target.value })} />
                            <Button size="sm" disabled={busy === p.id} onClick={saveInline}>Guardar</Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm"><span className="font-semibold">{formatMoney(Number(p.price), p.currency ?? undefined)}</span> · Stock {p.stock}</p>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button size="sm" variant="ghost" onClick={() => setEditing({ id: p.id, stock: String(p.stock), price: String(p.price) })}><Pencil className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" onClick={() => setPreview(p)}><Eye className="w-4 h-4" /></Button>
                              <Button size="sm" variant="ghost" disabled={busy === p.id} onClick={() => togglePublish(p)}>{p.status === "active" ? <EyeOff className="w-4 h-4" /> : <Globe className="w-4 h-4" />}</Button>
                              <Link to={`/supplier/products/${p.id}`}><Button size="sm" variant="ghost"><Package className="w-4 h-4" /></Button></Link>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Como aparece às oficinas</DialogTitle></DialogHeader>
          {preview && (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden">
                {preview.image ? (
                  <img src={preview.image} alt={preview.title} className="w-full h-44 object-cover" />
                ) : (
                  <div className="w-full h-44 bg-muted flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground" /></div>
                )}
                <div className="p-4 space-y-1">
                  <p className="font-semibold">{preview.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {[preview.brand, preview.sku || preview.manufacturer_reference, preview.category].filter(Boolean).join(" · ") || "—"}
                  </p>
                  <p className="text-lg font-bold">{formatMoney(Number(preview.discount_price ?? preview.price), preview.currency ?? undefined)}</p>
                  <p className={`text-xs ${preview.stock > 0 ? "text-emerald-500" : "text-destructive"}`}>
                    {preview.stock > 0 ? `Disponível · ${preview.stock} em stock` : "Sem stock"}
                  </p>
                </div>
              </div>
              <div className="text-sm">
                {preview.status === "active" ? (
                  <p className="text-emerald-500">🟢 Publicado na Rede — este produto está atualmente disponível para as oficinas.</p>
                ) : (
                  <p className="text-muted-foreground">⚪ Não publicado — este produto não está visível para as oficinas.</p>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>Fechar</Button>
                <Button onClick={() => { void togglePublish(preview); setPreview(null); }}>
                  {preview.status === "active" ? "Despublicar" : "Publicar"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
