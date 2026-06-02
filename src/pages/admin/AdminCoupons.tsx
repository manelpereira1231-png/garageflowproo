import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Copy, Trash2, Tag, Gift, Percent, Pencil } from "lucide-react";
import { toast } from "sonner";

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: "percent" | "amount" | "free_months" | "trial_extension";
  discount_value: number;
  applies_to_plan: string;
  max_redemptions: number | null;
  redemptions_count: number;
  expires_at: string | null;
  active: boolean;
  created_at: string;
}

const TYPE_LABELS = {
  percent: { label: "% Desconto", color: "bg-primary/15 text-primary border-primary/30" },
  amount: { label: "€ Desconto", color: "bg-success/15 text-success border-success/30" },
  free_months: { label: "Meses Grátis", color: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  trial_extension: { label: "Extensão Trial", color: "bg-purple-500/15 text-purple-500 border-purple-500/30" },
};

const EMPTY_DRAFT = {
  code: "",
  description: "",
  discount_type: "percent" as Coupon["discount_type"],
  discount_value: 10,
  applies_to_plan: "any",
  max_redemptions: "" as string | number,
  expires_at: "",
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("admin_coupons").select("*").order("created_at", { ascending: false });
    setCoupons((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const generateCode = () => {
    const code = "GF" + Math.random().toString(36).substring(2, 8).toUpperCase();
    setDraft(d => ({ ...d, code }));
  };

  const openEdit = (c: Coupon) => {
    setEditing(c);
    setDraft({
      code: c.code,
      description: c.description || "",
      discount_type: c.discount_type,
      discount_value: c.discount_value,
      applies_to_plan: c.applies_to_plan,
      max_redemptions: c.max_redemptions ?? "",
      expires_at: toLocalInput(c.expires_at),
    });
  };

  const save = async () => {
    if (!draft.code) { toast.error("Código obrigatório"); return; }
    const payload: any = {
      code: draft.code.toUpperCase(),
      description: draft.description || null,
      discount_type: draft.discount_type,
      discount_value: Number(draft.discount_value),
      applies_to_plan: draft.applies_to_plan,
      max_redemptions: draft.max_redemptions === "" ? null : Number(draft.max_redemptions),
      expires_at: draft.expires_at || null,
    };
    if (editing) {
      const { error } = await supabase.from("admin_coupons").update(payload).eq("id", editing.id);
      if (error) { toast.error(error.message); return; }
      toast.success(`Cupão ${payload.code} atualizado`);
      setEditing(null);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      payload.created_by = user?.id;
      const { error } = await supabase.from("admin_coupons").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success(`Cupão ${payload.code} criado`);
      setCreateOpen(false);
    }
    setDraft({ ...EMPTY_DRAFT });
    load();
  };

  const toggle = async (c: Coupon) => {
    await supabase.from("admin_coupons").update({ active: !c.active }).eq("id", c.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar cupão?")) return;
    await supabase.from("admin_coupons").delete().eq("id", id);
    toast.success("Cupão eliminado");
    load();
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`${code} copiado`);
  };

  const stats = {
    total: coupons.length,
    active: coupons.filter(c => c.active).length,
    redemptions: coupons.reduce((s, c) => s + c.redemptions_count, 0),
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cupões e Ofertas</h1>
          <p className="text-sm text-muted-foreground mt-1">Crie códigos de desconto, meses grátis e extensões de trial.</p>
        </div>
        <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setDraft({ ...EMPTY_DRAFT }); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo cupão</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Criar cupão</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Código</Label>
                <div className="flex gap-2">
                  <Input value={draft.code} onChange={e => setDraft(d => ({ ...d, code: e.target.value.toUpperCase() }))} placeholder="GFXXXX" className="font-mono uppercase" />
                  <Button variant="outline" onClick={generateCode}>Gerar</Button>
                </div>
              </div>
              <div>
                <Label>Descrição interna</Label>
                <Input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} placeholder="Ex: Black Friday 2026" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={draft.discount_type} onValueChange={(v: any) => setDraft(d => ({ ...d, discount_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">% Desconto</SelectItem>
                      <SelectItem value="amount">€ Desconto fixo</SelectItem>
                      <SelectItem value="free_months">Meses grátis</SelectItem>
                      <SelectItem value="trial_extension">Extensão de trial (dias)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input type="number" min={0} value={draft.discount_value} onChange={e => setDraft(d => ({ ...d, discount_value: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plano alvo</Label>
                  <Select value={draft.applies_to_plan} onValueChange={(v) => setDraft(d => ({ ...d, applies_to_plan: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer plano</SelectItem>
                      <SelectItem value="pro">Apenas Pro</SelectItem>
                      <SelectItem value="garage">Apenas Garage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Máx. utilizações</Label>
                  <Input type="number" min={1} value={draft.max_redemptions} onChange={e => setDraft(d => ({ ...d, max_redemptions: e.target.value }))} placeholder="Sem limite" />
                </div>
              </div>
              <div>
                <Label>Expira em</Label>
                <Input type="datetime-local" value={draft.expires_at} onChange={e => setDraft(d => ({ ...d, expires_at: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancelar</Button>
              <Button onClick={save}>Criar cupão</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setDraft({ ...EMPTY_DRAFT }); } }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar cupão</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Código</Label>
                <Input value={draft.code} onChange={e => setDraft(d => ({ ...d, code: e.target.value.toUpperCase() }))} className="font-mono uppercase" />
              </div>
              <div>
                <Label>Descrição interna</Label>
                <Input value={draft.description} onChange={e => setDraft(d => ({ ...d, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={draft.discount_type} onValueChange={(v: any) => setDraft(d => ({ ...d, discount_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">% Desconto</SelectItem>
                      <SelectItem value="amount">€ Desconto fixo</SelectItem>
                      <SelectItem value="free_months">Meses grátis</SelectItem>
                      <SelectItem value="trial_extension">Extensão de trial (dias)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Valor</Label>
                  <Input type="number" min={0} value={draft.discount_value} onChange={e => setDraft(d => ({ ...d, discount_value: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Plano alvo</Label>
                  <Select value={draft.applies_to_plan} onValueChange={(v) => setDraft(d => ({ ...d, applies_to_plan: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Qualquer plano</SelectItem>
                      <SelectItem value="pro">Apenas Pro</SelectItem>
                      <SelectItem value="garage">Apenas Garage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Máx. utilizações</Label>
                  <Input type="number" min={1} value={draft.max_redemptions} onChange={e => setDraft(d => ({ ...d, max_redemptions: e.target.value }))} placeholder="Sem limite" />
                </div>
              </div>
              <div>
                <Label>Expira em</Label>
                <Input type="datetime-local" value={draft.expires_at} onChange={e => setDraft(d => ({ ...d, expires_at: e.target.value }))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={save}>Guardar alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><Tag className="w-8 h-8 text-primary" /><div><div className="text-3xl font-bold tabular-nums tracking-tight">{stats.total}</div><div className="text-xs text-muted-foreground">Cupões totais</div></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><Gift className="w-8 h-8 text-success" /><div><div className="text-3xl font-bold tabular-nums tracking-tight">{stats.active}</div><div className="text-xs text-muted-foreground">Ativos</div></div></div></CardContent></Card>
        <Card><CardContent className="p-5"><div className="flex items-center gap-3"><Percent className="w-8 h-8 text-amber-500" /><div><div className="text-3xl font-bold tabular-nums tracking-tight">{stats.redemptions}</div><div className="text-xs text-muted-foreground">Resgates totais</div></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Todos os cupões</CardTitle><CardDescription>Códigos de desconto e ofertas ativas no sistema</CardDescription></CardHeader>
        <CardContent className="p-0">
          {loading ? <p className="p-6 text-sm text-muted-foreground">A carregar…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead className="text-right">Utilizações</TableHead>
                  <TableHead>Expira</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sem cupões criados</TableCell></TableRow>
                ) : coupons.map(c => {
                  const t = TYPE_LABELS[c.discount_type];
                  const expired = c.expires_at && new Date(c.expires_at) < new Date();
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <button onClick={() => copyCode(c.code)} className="font-mono font-bold text-sm hover:text-primary inline-flex items-center gap-1.5">
                          {c.code}<Copy className="w-3 h-3 opacity-50" />
                        </button>
                        {c.description && <div className="text-[11px] text-muted-foreground mt-0.5">{c.description}</div>}
                      </TableCell>
                      <TableCell><Badge className={`${t.color} text-[10px] border`}>{t.label}</Badge></TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {c.discount_type === "percent" && `${c.discount_value}%`}
                        {c.discount_type === "amount" && `€${c.discount_value}`}
                        {c.discount_type === "free_months" && `${c.discount_value}m`}
                        {c.discount_type === "trial_extension" && `+${c.discount_value}d`}
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="text-[10px] capitalize">{c.applies_to_plan}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {c.redemptions_count}{c.max_redemptions ? `/${c.max_redemptions}` : ""}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.expires_at ? new Date(c.expires_at).toLocaleDateString("pt-PT") : "—"}
                      </TableCell>
                      <TableCell>
                        {expired ? <Badge variant="destructive" className="text-[10px]">Expirado</Badge>
                          : c.active ? <Badge className="bg-success/15 text-success border-success/30 text-[10px]">Ativo</Badge>
                          : <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end items-center gap-2">
                          <Switch checked={c.active} onCheckedChange={() => toggle(c)} />
                          <Button size="icon" variant="ghost" onClick={() => remove(c.id)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
