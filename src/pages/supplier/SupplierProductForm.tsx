import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";

interface Form {
  title: string;
  sku: string;
  ean: string;
  brand: string;
  model: string;
  category: string;
  description: string;
  price: string;
  discount_price: string;
  vat: string;
  stock: string;
  status: "draft" | "active" | "archived";
  condition: "new" | "refurbished" | "used";
  image: string;
}

const empty: Form = {
  title: "", sku: "", ean: "", brand: "", model: "", category: "", description: "",
  price: "0", discount_price: "", vat: "23", stock: "0",
  status: "draft", condition: "new", image: "",
};

export default function SupplierProductForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id && id !== "new";
  const navigate = useNavigate();
  const { supplierId } = useIsSupplier();
  const [form, setForm] = useState<Form>(empty);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      const { data } = await supabase.from("gsn_products" as any).select("*").eq("id", id).maybeSingle();
      if (data) {
        const d: any = data;
        setForm({
          title: d.title ?? "", sku: d.sku ?? "", ean: d.ean ?? "", brand: d.brand ?? "",
          model: d.model ?? "", category: d.category ?? "", description: d.description ?? "",
          price: String(d.price ?? 0), discount_price: d.discount_price != null ? String(d.discount_price) : "",
          vat: String(d.vat ?? 23), stock: String(d.stock ?? 0),
          status: d.status ?? "draft", condition: d.condition ?? "new", image: d.image ?? "",
        });
      }
      setLoading(false);
    })();
  }, [id, isEdit]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!supplierId) return toast.error("Sem fornecedor associado");
    if (!form.title.trim()) return toast.error("Título obrigatório");
    setSaving(true);
    const payload: any = {
      supplier_id: supplierId,
      title: form.title.trim(),
      sku: form.sku.trim() || null,
      ean: form.ean.trim() || null,
      brand: form.brand.trim() || null,
      model: form.model.trim() || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      price: Number(form.price) || 0,
      discount_price: form.discount_price ? Number(form.discount_price) : null,
      vat: Number(form.vat) || 0,
      stock: Math.max(0, Math.floor(Number(form.stock) || 0)),
      status: form.status,
      condition: form.condition,
      image: form.image.trim() || null,
    };
    const { error } = isEdit
      ? await supabase.from("gsn_products" as any).update(payload).eq("id", id!)
      : await supabase.from("gsn_products" as any).insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(isEdit ? "Produto atualizado" : "Produto criado");
    navigate("/supplier/products");
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link to="/supplier/products"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Voltar</Button></Link>
        <h1 className="text-2xl font-bold">{isEdit ? "Editar produto" : "Novo produto"}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>Detalhes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título *</Label>
            <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Pastilhas de travão dianteiras" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => set("sku", e.target.value)} /></div>
            <div><Label>EAN</Label><Input value={form.ean} onChange={(e) => set("ean", e.target.value)} /></div>
            <div><Label>Categoria</Label><Input value={form.category} onChange={(e) => set("category", e.target.value)} placeholder="Travagem" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label>Marca</Label><Input value={form.brand} onChange={(e) => set("brand", e.target.value)} /></div>
            <div><Label>Modelo</Label><Input value={form.model} onChange={(e) => set("model", e.target.value)} /></div>
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} />
          </div>
          <div>
            <Label>Imagem (URL)</Label>
            <Input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Preço e stock</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Label>Preço (€)</Label><Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} /></div>
          <div><Label>Preço promo (€)</Label><Input type="number" step="0.01" value={form.discount_price} onChange={(e) => set("discount_price", e.target.value)} /></div>
          <div><Label>IVA (%)</Label><Input type="number" step="0.01" value={form.vat} onChange={(e) => set("vat", e.target.value)} /></div>
          <div><Label>Stock</Label><Input type="number" min="0" value={form.stock} onChange={(e) => set("stock", e.target.value)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Estado</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Estado do anúncio</Label>
            <Select value={form.status} onValueChange={(v) => set("status", v as Form["status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="archived">Arquivado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Condição</Label>
            <Select value={form.condition} onValueChange={(v) => set("condition", v as Form["condition"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Novo</SelectItem>
                <SelectItem value="refurbished">Recondicionado</SelectItem>
                <SelectItem value="used">Usado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link to="/supplier/products"><Button variant="outline">Cancelar</Button></Link>
        <Button onClick={submit} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</Button>
      </div>
    </div>
  );
}
