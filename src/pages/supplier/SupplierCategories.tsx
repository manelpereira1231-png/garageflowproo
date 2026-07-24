import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { toast } from "sonner";

interface Category { id: string; slug: string; name: string; parent_id: string | null; active: boolean }

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function SupplierCategories() {
  const { isSuperAdmin } = useSuperAdmin();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string>("");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("gsn_categories" as any).select("*").order("name");
    setItems((data as any) ?? []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, []);

  const openNew = () => { setEditing(null); setName(""); setParentId(""); setOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setName(c.name); setParentId(c.parent_id ?? ""); setOpen(true); };

  const save = async () => {
    if (!name.trim()) return;
    const payload: any = { name: name.trim(), slug: slugify(name), parent_id: parentId || null };
    const q = editing
      ? supabase.from("gsn_categories" as any).update(payload).eq("id", editing.id)
      : supabase.from("gsn_categories" as any).insert(payload);
    const { error } = await q;
    if (error) return toast.error(error.message);
    toast.success(editing ? "Categoria atualizada" : "Categoria criada");
    setOpen(false);
    void load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar categoria?")) return;
    const { error } = await supabase.from("gsn_categories" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Categoria eliminada");
    void load();
  };

  const nameFor = (id: string | null) => items.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Categorias</h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin ? "Gerir a árvore de categorias do catálogo global." : "Categorias disponíveis para os seus produtos."}
          </p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Nova categoria</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Sem categorias.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Slug</th>
                    <th className="px-4 py-3">Categoria pai</th>
                    {isSuperAdmin && <th className="px-4 py-3 text-right">Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.slug}</td>
                      <td className="px-4 py-3 text-muted-foreground">{nameFor(c.parent_id)}</td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(c)}><Pencil className="w-4 h-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => remove(c.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      )}
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
          <DialogHeader><DialogTitle>{editing ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Nome</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Travões" />
            </div>
            <div>
              <label className="text-sm font-medium">Categoria pai (opcional)</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
              >
                <option value="">— Nenhuma —</option>
                {items.filter((c) => c.id !== editing?.id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Guardar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
