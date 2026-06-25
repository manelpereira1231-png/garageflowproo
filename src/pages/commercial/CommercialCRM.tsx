import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Building2 } from "lucide-react";

type Shop = {
  id: string; name: string; email: string; phone?: string; address?: string;
  country?: string; status?: string; created_at: string; last_seen_at?: string;
};
type Sub = { shop_id: string; plan: string; status: string };
type Lead = { id: string; name: string; email?: string; phone?: string; district?: string; pipeline_stage: string; estimated_value?: number; next_contact_at?: string; created_at: string };

export default function CommercialCRM() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"shops" | "leads">("shops");
  const [openNew, setOpenNew] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", district: "", pipeline_stage: "lead", estimated_value: "" });
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [shopsRes, subsRes, leadsRes] = await Promise.all([
      supabase.from("shops").select("id, name, email, phone, address, country, status, created_at, last_seen_at").order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("shop_id, plan, status"),
      supabase.from("crm_leads" as any).select("*").order("created_at", { ascending: false }),
    ]);
    setShops(((shopsRes.data as unknown) || []) as Shop[]);
    setSubs(((subsRes.data as unknown) || []) as Sub[]);
    setLeads(((leadsRes.data as unknown) || []) as Lead[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const subByShop = useMemo(() => {
    const m = new Map<string, Sub>();
    subs.forEach((s) => m.set(s.shop_id, s));
    return m;
  }, [subs]);

  const filteredShops = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return shops;
    return shops.filter((s) =>
      (s.name || "").toLowerCase().includes(t) ||
      (s.email || "").toLowerCase().includes(t) ||
      (s.phone || "").toLowerCase().includes(t)
    );
  }, [shops, q]);

  const filteredLeads = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return leads;
    return leads.filter((l) =>
      (l.name || "").toLowerCase().includes(t) ||
      (l.email || "").toLowerCase().includes(t)
    );
  }, [leads, q]);

  const createLead = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    const { error } = await supabase.from("crm_leads" as any).insert({
      name: form.name.trim(),
      email: form.email || null,
      phone: form.phone || null,
      district: form.district || null,
      pipeline_stage: form.pipeline_stage,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Lead criado");
    setOpenNew(false);
    setForm({ name: "", email: "", phone: "", district: "", pipeline_stage: "lead", estimated_value: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">CRM de Oficinas</h2>
          <p className="text-sm text-muted-foreground">Oficinas reais da plataforma + leads comerciais.</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" /> Novo Lead</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar lead comercial</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Distrito</Label><Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
                <div><Label>Valor estimado (€)</Label><Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></div>
              </div>
              <div>
                <Label>Etapa</Label>
                <Select value={form.pipeline_stage} onValueChange={(v) => setForm({ ...form, pipeline_stage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["lead","contacted","meeting_scheduled","demo_scheduled","demo_done","proposal_sent","negotiation","won","lost"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={createLead}>Criar lead</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1 p-1 bg-muted rounded-md">
          <button onClick={() => setTab("shops")} className={`px-3 py-1.5 text-sm rounded ${tab === "shops" ? "bg-background shadow-sm" : ""}`}>Oficinas ({shops.length})</button>
          <button onClick={() => setTab("leads")} className={`px-3 py-1.5 text-sm rounded ${tab === "leads" ? "bg-background shadow-sm" : ""}`}>Leads ({leads.length})</button>
        </div>
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Pesquisar..." className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading && <div className="text-sm text-muted-foreground">A carregar…</div>}

      {!loading && tab === "shops" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Oficina</th>
                    <th className="text-left p-3">Contacto</th>
                    <th className="text-left p-3">País</th>
                    <th className="text-left p-3">Plano</th>
                    <th className="text-left p-3">Estado</th>
                    <th className="text-left p-3">Registo</th>
                    <th className="text-left p-3">Último acesso</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredShops.map((s) => {
                    const sub = subByShop.get(s.id);
                    return (
                      <tr key={s.id} className="border-t hover:bg-muted/30">
                        <td className="p-3"><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /><span className="font-medium">{s.name}</span></div></td>
                        <td className="p-3"><div className="text-xs">{s.email}<br/>{s.phone || '—'}</div></td>
                        <td className="p-3 text-xs">{s.country || '—'}</td>
                        <td className="p-3"><Badge variant="outline">{sub?.plan || 'free'}</Badge></td>
                        <td className="p-3"><Badge variant={sub?.status === 'active' ? 'default' : 'secondary'}>{sub?.status || s.status || '—'}</Badge></td>
                        <td className="p-3 text-xs">{new Date(s.created_at).toLocaleDateString('pt-PT')}</td>
                        <td className="p-3 text-xs">{s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString('pt-PT') : 'Nunca'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && tab === "leads" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Nome</th>
                    <th className="text-left p-3">Contacto</th>
                    <th className="text-left p-3">Distrito</th>
                    <th className="text-left p-3">Etapa</th>
                    <th className="text-left p-3">Valor</th>
                    <th className="text-left p-3">Próximo contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l) => (
                    <tr key={l.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-medium">{l.name}</td>
                      <td className="p-3 text-xs">{l.email || '—'}<br/>{l.phone || ''}</td>
                      <td className="p-3 text-xs">{l.district || '—'}</td>
                      <td className="p-3"><Badge variant="outline">{l.pipeline_stage}</Badge></td>
                      <td className="p-3 text-xs">{l.estimated_value ? `${Number(l.estimated_value).toFixed(2)} €` : '—'}</td>
                      <td className="p-3 text-xs">{l.next_contact_at ? new Date(l.next_contact_at).toLocaleDateString('pt-PT') : '—'}</td>
                    </tr>
                  ))}
                  {filteredLeads.length === 0 && (
                    <tr><td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">Sem leads ainda. Crie o primeiro acima.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
