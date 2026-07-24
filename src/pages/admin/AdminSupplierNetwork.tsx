import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Store, ShieldCheck, ShieldOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSystemFeature, setSystemFeature } from "@/hooks/useSystemFeature";
import { toast } from "sonner";

interface Supplier {
  id: string;
  company_name: string;
  trade_name: string | null;
  email: string | null;
  country: string | null;
  active: boolean;
  approved: boolean;
  commission_percentage: number;
  rating_average: number;
  created_at: string;
}

export default function AdminSupplierNetwork() {
  const { enabled, loaded, refresh } = useSystemFeature("supplier_network_enabled");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ company_name: "", email: "", owner_user_id: "", commission_percentage: "5" });

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gsn_suppliers" as any)
      .select("id,company_name,trade_name,email,country,active,approved,commission_percentage,rating_average,created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    setSuppliers((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const toggleFlag = async (v: boolean) => {
    try {
      await setSystemFeature("supplier_network_enabled", v);
      toast.success(v ? "Rede de Fornecedores ativada" : "Rede de Fornecedores desativada");
      refresh();
    } catch (e: any) { toast.error(e.message); }
  };

  const create = async () => {
    if (!form.company_name.trim()) return toast.error("Nome da empresa obrigatório");
    setCreating(true);
    const { error } = await supabase.from("gsn_suppliers" as any).insert({
      company_name: form.company_name.trim(),
      email: form.email.trim() || null,
      owner_user_id: form.owner_user_id.trim() || null,
      commission_percentage: Number(form.commission_percentage) || 5,
      approved: true,
      active: true,
    });
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Fornecedor criado");
    setForm({ company_name: "", email: "", owner_user_id: "", commission_percentage: "5" });
    void load();
  };

  const setApproved = async (id: string, v: boolean) => {
    const { error } = await supabase.from("gsn_suppliers" as any).update({ approved: v }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(v ? "Aprovado" : "Aprovação removida");
    void load();
  };

  const setActive = async (id: string, v: boolean) => {
    const { error } = await supabase.from("gsn_suppliers" as any).update({ active: v }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(v ? "Ativado" : "Suspenso");
    void load();
  };

  const setCommission = async (id: string, pct: number) => {
    const { error } = await supabase.from("gsn_suppliers" as any).update({ commission_percentage: pct }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Comissão atualizada");
    void load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Rede de Fornecedores</h1>
        <p className="text-sm text-muted-foreground">Gestão do módulo B2B de peças automóveis.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ativar Supplier Network</CardTitle>
          <CardDescription>Quando desativado, o módulo está oculto para todas as oficinas e fornecedores. Apenas o Super Admin acede.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-border rounded-lg">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium">Estado global</p>
                <p className="text-xs text-muted-foreground">Controla toda a rede: menus, rotas, APIs.</p>
              </div>
            </div>
            {loaded && <Switch checked={enabled} onCheckedChange={toggleFlag} />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Fornecedores</CardTitle>
            <CardDescription>{suppliers.length} registados</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-2" />Novo fornecedor</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Novo fornecedor</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Nome da empresa *</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Owner user ID (UUID)</Label><Input value={form.owner_user_id} onChange={(e) => setForm({ ...form, owner_user_id: e.target.value })} placeholder="Preencher depois se necessário" /></div>
                <div><Label>Comissão (%)</Label><Input type="number" step="0.01" value={form.commission_percentage} onChange={(e) => setForm({ ...form, commission_percentage: e.target.value })} /></div>
                <Button onClick={create} disabled={creating} className="w-full">{creating ? "A criar..." : "Criar fornecedor"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">A carregar...</div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">Nenhum fornecedor registado.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border">
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3">Empresa</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">País</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Comissão</th>
                    <th className="px-4 py-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-accent/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{s.company_name}</div>
                        {s.trade_name && <div className="text-xs text-muted-foreground">{s.trade_name}</div>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.country || "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          <Badge variant={s.approved ? "default" : "secondary"}>{s.approved ? "Aprovado" : "Pendente"}</Badge>
                          <Badge variant={s.active ? "default" : "outline"}>{s.active ? "Ativo" : "Suspenso"}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          step="0.01"
                          defaultValue={s.commission_percentage}
                          className="w-20 h-8"
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (!isNaN(v) && v !== s.commission_percentage) void setCommission(s.id, v);
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setApproved(s.id, !s.approved)} title={s.approved ? "Remover aprovação" : "Aprovar"}>
                            {s.approved ? <ShieldOff className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setActive(s.id, !s.active)}>
                            {s.active ? "Suspender" : "Ativar"}
                          </Button>
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
