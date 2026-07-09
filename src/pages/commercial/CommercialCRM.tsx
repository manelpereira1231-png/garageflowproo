import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Plus, Search, Building2, Upload, Users, TrendingUp, PhoneCall, CalendarClock,
  Trophy, XCircle, Sparkles,
} from "lucide-react";
import CommercialImportDialog from "@/components/commercial/CommercialImportDialog";
import CommercialLeadDetail, { PIPELINE_STAGES } from "@/components/commercial/CommercialLeadDetail";

type Shop = {
  id: string; name: string; email: string; phone?: string; address?: string;
  country?: string; status?: string; created_at: string; last_seen_at?: string;
};
type Sub = { shop_id: string; plan: string; status: string };
type Lead = {
  id: string; name: string; owner_name?: string; email?: string; phone?: string;
  city?: string; district?: string; country?: string;
  pipeline_stage: string; estimated_value?: number;
  next_contact_at?: string; last_contact_at?: string; created_at: string;
  shop_link_id?: string | null;
};

const STAGE_LABEL: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.label]),
);
const STAGE_TONE: Record<string, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.value, s.tone]),
);

export default function CommercialCRM() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [q, setQ] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [tab, setTab] = useState<"leads" | "shops">("leads");
  const [openNew, setOpenNew] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", owner_name: "", email: "", phone: "", city: "", district: "",
    country: "", website: "", pipeline_stage: "lead", estimated_value: "",
  });
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

  useEffect(() => {
    load();
    const ch = supabase
      .channel("commercial-crm-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "subscriptions" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "crm_leads" }, () => load())
      .subscribe();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    const iv = setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); window.removeEventListener("focus", onFocus); clearInterval(iv); };
  }, []);

  const subByShop = useMemo(() => {
    const m = new Map<string, Sub>();
    subs.forEach((s) => m.set(s.shop_id, s));
    return m;
  }, [subs]);

  const kpis = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const newLeadsToday = leads.filter(
      (l) => l.pipeline_stage === "lead" && new Date(l.created_at) >= today,
    ).length;
    const customers = leads.filter((l) => l.pipeline_stage === "customer").length;
    const lost = leads.filter((l) => l.pipeline_stage === "lost").length;
    const demoScheduled = leads.filter((l) => l.pipeline_stage === "demo_scheduled").length;
    const inProgress = leads.filter(
      (l) => !["customer", "lost"].includes(l.pipeline_stage),
    ).length;
    const followUps = leads.filter(
      (l) => l.next_contact_at && new Date(l.next_contact_at) <= new Date(),
    ).length;
    const total = leads.length || 1;
    const conversion = ((customers / total) * 100).toFixed(1);
    return { total: leads.length, newLeadsToday, customers, lost, demoScheduled, inProgress, followUps, conversion };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => {
      if (stageFilter !== "all" && l.pipeline_stage !== stageFilter) return false;
      if (!t) return true;
      const sub = subs.find((s) => s.shop_id === l.shop_link_id);
      return [
        l.name, l.owner_name, l.email, l.phone,
        l.city, l.district, l.country,
        STAGE_LABEL[l.pipeline_stage], sub?.plan,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [leads, subs, q, stageFilter]);

  const filteredShops = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return shops;
    return shops.filter((s) => {
      const sub = subByShop.get(s.id);
      return [s.name, s.email, s.phone, s.country, sub?.plan, sub?.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [shops, subByShop, q]);

  const createLead = async () => {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    const uid = (await supabase.auth.getUser()).data.user?.id ?? null;
    const { data, error } = await supabase.from("crm_leads" as any).insert({
      name: form.name.trim(),
      owner_name: form.owner_name || null,
      email: form.email || null,
      phone: form.phone || null,
      city: form.city || null,
      district: form.district || null,
      country: form.country || null,
      website: form.website || null,
      pipeline_stage: form.pipeline_stage,
      estimated_value: form.estimated_value ? Number(form.estimated_value) : null,
      source: "manual",
      created_by: uid,
    }).select("id").single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("crm_activity" as any).insert({
      lead_id: (data as any).id,
      kind: "created",
      summary: "Lead criado manualmente",
      created_by: uid,
    });
    toast.success("Lead criado");
    setOpenNew(false);
    setForm({ name: "", owner_name: "", email: "", phone: "", city: "", district: "", country: "", website: "", pipeline_stage: "lead", estimated_value: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold">CRM de Oficinas</h2>
          <p className="text-sm text-muted-foreground">
            Prospecção, chamadas, notas, tarefas e histórico — tudo sobre a oficina real.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setOpenImport(true)}>
            <Upload className="w-4 h-4 mr-2" /> Importar
          </Button>
          <Dialog open={openNew} onOpenChange={setOpenNew}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Novo Lead</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Criar lead comercial</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome da oficina *</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Responsável</Label>
                    <Input value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} /></div>
                  <div><Label>Website</Label>
                    <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Email</Label>
                    <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Telefone</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label>Cidade</Label>
                    <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></div>
                  <div><Label>Distrito/Estado</Label>
                    <Input value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} /></div>
                  <div><Label>País</Label>
                    <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>Estado</Label>
                    <Select value={form.pipeline_stage} onValueChange={(v) => setForm({ ...form, pipeline_stage: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STAGES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Valor estimado</Label>
                    <Input type="number" value={form.estimated_value}
                      onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></div>
                </div>
                <Button className="w-full" onClick={createLead}>Criar lead</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        <Kpi icon={Users} label="Total" value={String(kpis.total)} />
        <Kpi icon={Sparkles} label="Novos hoje" value={String(kpis.newLeadsToday)} tone="text-blue-600 dark:text-blue-400" />
        <Kpi icon={TrendingUp} label="Em curso" value={String(kpis.inProgress)} />
        <Kpi icon={CalendarClock} label="Demos" value={String(kpis.demoScheduled)} tone="text-purple-600 dark:text-purple-400" />
        <Kpi icon={PhoneCall} label="Follow-ups" value={String(kpis.followUps)} tone="text-amber-600 dark:text-amber-400" />
        <Kpi icon={Trophy} label="Ganhos" value={String(kpis.customers)} tone="text-green-600 dark:text-green-400" />
        <Kpi icon={XCircle} label="Perdidos" value={String(kpis.lost)} tone="text-red-600 dark:text-red-400" />
        <Kpi icon={TrendingUp} label="Conversão" value={`${kpis.conversion}%`} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 p-1 bg-muted rounded-md">
          <button onClick={() => setTab("leads")} className={`px-3 py-1.5 text-sm rounded ${tab === "leads" ? "bg-background shadow-sm" : ""}`}>
            Leads ({leads.length})
          </button>
          <button onClick={() => setTab("shops")} className={`px-3 py-1.5 text-sm rounded ${tab === "shops" ? "bg-background shadow-sm" : ""}`}>
            Oficinas ({shops.length})
          </button>
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Nome, responsável, email, telefone, cidade, país…"
            className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {tab === "leads" && (
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos os estados" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os estados</SelectItem>
              {PIPELINE_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {loading && <div className="text-sm text-muted-foreground">A carregar…</div>}

      {!loading && tab === "leads" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Oficina</th>
                    <th className="text-left p-3">Contacto</th>
                    <th className="text-left p-3">Localização</th>
                    <th className="text-left p-3">Estado</th>
                    <th className="text-left p-3">Próximo contacto</th>
                    <th className="text-left p-3">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((l) => {
                    const overdue = l.next_contact_at && new Date(l.next_contact_at) < new Date();
                    return (
                      <tr key={l.id}
                        onClick={() => setDetailId(l.id)}
                        className="border-t hover:bg-muted/40 cursor-pointer">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <div>
                              <div className="font-medium">{l.name}</div>
                              {l.owner_name && (
                                <div className="text-xs text-muted-foreground">{l.owner_name}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {l.email && <div>{l.email}</div>}
                          {l.phone && <div className="text-muted-foreground">{l.phone}</div>}
                        </td>
                        <td className="p-3 text-xs">
                          {[l.city, l.district, l.country].filter(Boolean).join(", ") || "—"}
                        </td>
                        <td className="p-3">
                          <Badge className={STAGE_TONE[l.pipeline_stage] || ""}>
                            {STAGE_LABEL[l.pipeline_stage] || l.pipeline_stage}
                          </Badge>
                        </td>
                        <td className={`p-3 text-xs ${overdue ? "text-red-600 font-medium" : ""}`}>
                          {l.next_contact_at ? new Date(l.next_contact_at).toLocaleDateString("pt-PT") : "—"}
                        </td>
                        <td className="p-3 text-xs">
                          {l.estimated_value ? `${Number(l.estimated_value).toFixed(2)} €` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLeads.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-sm text-muted-foreground">
                        Sem leads. Clique em <strong>Importar</strong> para carregar uma lista ou em <strong>Novo Lead</strong>.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{s.name}</span>
                          </div>
                        </td>
                        <td className="p-3 text-xs">
                          {s.email}<br />{s.phone || "—"}
                        </td>
                        <td className="p-3 text-xs">{s.country || "—"}</td>
                        <td className="p-3"><Badge variant="outline">{sub?.plan || "start"}</Badge></td>
                        <td className="p-3">
                          <Badge variant={sub?.status === "active" ? "default" : "secondary"}>
                            {sub?.status || s.status || "—"}
                          </Badge>
                        </td>
                        <td className="p-3 text-xs">{new Date(s.created_at).toLocaleDateString("pt-PT")}</td>
                        <td className="p-3 text-xs">
                          {s.last_seen_at ? new Date(s.last_seen_at).toLocaleDateString("pt-PT") : "Nunca"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <CommercialImportDialog
        open={openImport}
        onOpenChange={setOpenImport}
        onImported={load}
      />
      <CommercialLeadDetail
        leadId={detailId}
        open={!!detailId}
        onOpenChange={(v) => !v && setDetailId(null)}
        onChanged={load}
      />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon className="w-3.5 h-3.5" /> {label}
        </div>
        <div className={`text-xl font-bold mt-1 ${tone || ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
