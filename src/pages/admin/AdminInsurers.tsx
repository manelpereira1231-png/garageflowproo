import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Building2, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";

const empty = { name: "", legal_name: "", code: "", sort_order: 100, active: true, notes: "" };

/** Lista central de seguradoras usada no registo de clientes e nos sinistros de todas as oficinas. */
export default function AdminInsurers() {
  const [rows, setRows] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, { total: number; active: number; closed: number; invoiced: number }>>({});
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ ...empty });

  const load = useCallback(async () => {
    const [c, ins] = await Promise.all([
      supabase.from("insurer_catalog").select("*").order("sort_order").order("name"),
      supabase.from("insurers").select("id, catalog_id").not("catalog_id", "is", null).limit(5000),
    ]);
    setRows(c.data || []);
    const byIns = new Map((ins.data || []).map((i: any) => [i.id, i.catalog_id]));
    const ids = [...byIns.keys()];
    const s: Record<string, any> = {};
    if (ids.length) {
      const { data: cl } = await supabase.from("claims").select("insurer_id, status, amount_invoiced").in("insurer_id", ids).limit(10000);
      for (const r of cl || []) {
        const k = byIns.get((r as any).insurer_id) as string;
        s[k] ||= { total: 0, active: 0, closed: 0, invoiced: 0 };
        s[k].total++;
        if (["done", "cancelled", "paid"].includes((r as any).status)) s[k].closed++; else s[k].active++;
        s[k].invoiced += Number((r as any).amount_invoiced || 0);
      }
    }
    setStats(s);
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => rows.filter((r) => !q || `${r.name} ${r.legal_name || ""} ${r.code || ""}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);

  const save = async () => {
    if (!form.name.trim()) { toast.error("Indique o nome comercial."); return; }
    const payload = { name: form.name.trim(), legal_name: form.legal_name || null, code: form.code || null,
      sort_order: Number(form.sort_order) || 100, active: !!form.active, notes: form.notes || null, updated_at: new Date().toISOString() };
    const { error } = editId
      ? await supabase.from("insurer_catalog").update(payload).eq("id", editId)
      : await supabase.from("insurer_catalog").insert(payload);
    if (error) { toast.error(error.code === "23505" ? "Já existe uma seguradora com esse nome." : "Não foi possível guardar."); return; }
    toast.success("Seguradora guardada");
    setOpen(false); load();
  };

  const toggle = async (r: any) => {
    await supabase.from("insurer_catalog").update({ active: !r.active }).eq("id", r.id);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Building2 className="w-6 h-6 text-primary" />Seguradoras</h1>
          <p className="text-sm text-muted-foreground">Lista usada por todas as oficinas. Desativar não apaga processos antigos.</p>
        </div>
        <Button className="min-h-[44px]" onClick={() => { setEditId(null); setForm({ ...empty }); setOpen(true); }}><Plus className="w-4 h-4 mr-2" />Adicionar</Button>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Pesquisar" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {list.map((r) => {
          const st = stats[r.id];
          return (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{r.name} {!r.active && <Badge variant="outline" className="ml-1">Inativa</Badge>}</p>
                    <p className="text-xs text-muted-foreground">{[r.legal_name, r.code && `Código ${r.code}`, `Ordem ${r.sort_order}`].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch checked={r.active} onCheckedChange={() => toggle(r)} />
                    <Button size="icon" variant="ghost" onClick={() => { setEditId(r.id); setForm({ ...empty, ...r }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sinistros: {st?.total || 0} · Ativos: {st?.active || 0} · Encerrados: {st?.closed || 0} · Faturado: {formatMoney(st?.invoiced || 0)}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Editar seguradora" : "Nova seguradora"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome comercial *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Nome legal</Label><Input value={form.legal_name || ""} onChange={(e) => setForm({ ...form, legal_name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Código interno</Label><Input value={form.code || ""} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
