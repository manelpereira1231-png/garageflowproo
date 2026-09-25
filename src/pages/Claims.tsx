import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, Plus, Search, Building2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import {
  CLAIM_STATUSES,
  CLAIM_STATUS_LABELS,
  CLAIM_TYPES,
  CLAIM_GROUPS,
  CLAIM_CLOSED,
  claimStatusTone,
} from "@/lib/claims";
import { InsurerPicker, resolveInsurerId, type InsurerSelection } from "@/components/InsurerPicker";
import QuickVehicleForm from "@/components/QuickVehicleForm";

const emptyClaim = {
  client_id: "",
  vehicle_id: "",
  work_order_id: "",
  insurer_id: "",
  claim_number: "",
  policy_number: "",
  claim_date: new Date().toISOString().slice(0, 10),
  claim_type: "",
  description: "",
  notes: "",
};

const emptyInsurer = {
  name: "", nif: "", phone: "", email: "", website: "",
  claims_contact: "", claims_email: "", claims_phone: "", notes: "", active: true,
};

export default function Claims() {
  const navigate = useNavigate();
  const activeShopId = useActiveShopId();
  const [params, setParams] = useSearchParams();

  const [claims, setClaims] = useState<any[]>([]);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState(params.get("search") || "");
  const [statusFilter, setStatusFilter] = useState(params.get("status") || "all");
  const [insurerFilter, setInsurerFilter] = useState("all");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyClaim });
  const [insSel, setInsSel] = useState<InsurerSelection>(null);
  const [addVehicle, setAddVehicle] = useState(false);
  const [period, setPeriod] = useState("all");
  const [quoteNums, setQuoteNums] = useState<Record<string, string>>({});

  const [insurerOpen, setInsurerOpen] = useState(false);
  const [insurerEditId, setInsurerEditId] = useState<string | null>(null);
  const [insurerForm, setInsurerForm] = useState({ ...emptyInsurer });

  const load = useCallback(async () => {
    if (!activeShopId) return;
    const [cl, ins, cli, veh, wo] = await Promise.all([
      supabase.from("claims")
        .select("*, insurers(name), clients(name), vehicles(make, model, plate), work_orders(number)")
        .eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(500),
      supabase.from("insurers").select("*").eq("shop_id", activeShopId).order("name"),
      supabase.from("clients").select("id, name").eq("shop_id", activeShopId).is("deleted_at", null).order("name").limit(1000),
      supabase.from("vehicles").select("id, client_id, make, model, plate").eq("shop_id", activeShopId).is("deleted_at", null).limit(1000),
      supabase.from("work_orders").select("id, number, client_id, vehicle_id, status").eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(300),
    ]);
    setClaims(cl.data || []);
    const qids = [...new Set((cl.data || []).map((c: any) => c.quote_id).filter(Boolean))];
    const iids = [...new Set((cl.data || []).map((c: any) => c.invoice_id).filter(Boolean))];
    const [qq, ii] = await Promise.all([
      qids.length ? supabase.from("quotes").select("id, number").in("id", qids) : Promise.resolve({ data: [] as any[] }),
      iids.length ? supabase.from("invoices").select("id, number").in("id", iids) : Promise.resolve({ data: [] as any[] }),
    ]);
    const m: Record<string, string> = {};
    for (const r of [...(qq.data || []), ...(ii.data || [])] as any[]) m[r.id] = r.number;
    setQuoteNums(m);
    setInsurers(ins.data || []);
    setClients(cli.data || []);
    setVehicles(veh.data || []);
    setWorkOrders(wo.data || []);
    setLoading(false);
  }, [activeShopId]);

  useEffect(() => { load(); }, [load]);
  // Live: claims changed by any user of this shop refresh the list/counters.
  useRealtimeTable("claims", { shopId: activeShopId, onChange: () => { void load(); } });

  // Pré-preenchimento vindo da Ordem de Serviço (/claims?wo=<id>)
  useEffect(() => {
    const woId = params.get("wo");
    if (!woId || !workOrders.length) return;
    const wo = workOrders.find((w) => w.id === woId);
    if (!wo) return;
    setForm((f) => ({ ...f, work_order_id: wo.id, client_id: wo.client_id, vehicle_id: wo.vehicle_id }));
    setOpen(true);
    params.delete("wo");
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrders]);

  // Vindo de "Cliente criado → Criar sinistro agora" (/claims?new=1&client=<id>)
  useEffect(() => {
    if (params.get("new") !== "1" || !activeShopId) return;
    const clientId = params.get("client");
    (async () => {
      let next = { ...emptyClaim };
      let sel: InsurerSelection = null;
      if (clientId) {
        const { data: c } = await supabase.from("clients").select("id, name, insurer_id, insurance_meta")
          .eq("id", clientId).eq("shop_id", activeShopId).maybeSingle();
        if (c) {
          const meta: any = (c as any).insurance_meta || {};
          next = { ...next, client_id: c.id, policy_number: meta.policy_number || "", claim_number: meta.claim_number || "",
            claim_date: meta.claim_date || next.claim_date, notes: meta.notes || "" };
          if ((c as any).insurer_id) sel = { insurerId: (c as any).insurer_id };
          setClients((l) => (l.some((x) => x.id === c.id) ? l : [...l, { id: c.id, name: c.name }]));
        }
      }
      setForm(next); setInsSel(sel); setAddVehicle(false); setOpen(true);
      params.delete("new"); params.delete("client");
      setParams(params, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeShopId]);

  // Filtro por grupo vindo do painel (?status=g:<grupo> / late)
  const groupFilter = statusFilter.startsWith("g:") ? CLAIM_GROUPS.find((g) => "g:" + g.key === statusFilter) : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (groupFilter) { if (!groupFilter.statuses.includes(c.status)) return false; }
      else if (statusFilter === "late") {
        if (CLAIM_CLOSED.includes(c.status) || !c.next_action_date || c.next_action_date >= new Date().toISOString().slice(0, 10)) return false;
      } else if (statusFilter === "active") { if (CLAIM_CLOSED.includes(c.status)) return false; }
      else if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (period !== "all") {
        const days = Number(period);
        if (new Date(c.created_at).getTime() < Date.now() - days * 86400000) return false;
      }
      if (insurerFilter !== "all" && c.insurer_id !== insurerFilter) return false;
      if (!q) return true;
      const hay = [
        c.ref, quoteNums[c.quote_id], quoteNums[c.invoice_id], c.claim_number, c.policy_number, c.process_number, c.expert_name,
        c.insurers?.name, c.clients?.name, c.work_orders?.number,
        c.vehicles?.plate, c.vehicles?.make, c.vehicles?.model,
        CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS],
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [claims, search, statusFilter, insurerFilter, period, quoteNums, groupFilter]);

  const vehiclesForClient = useMemo(
    () => vehicles.filter((v) => !form.client_id || v.client_id === form.client_id),
    [vehicles, form.client_id],
  );
  const wosForContext = useMemo(
    () => workOrders.filter((w) => (!form.client_id || w.client_id === form.client_id)
      && (!form.vehicle_id || w.vehicle_id === form.vehicle_id)),
    [workOrders, form.client_id, form.vehicle_id],
  );

  const createClaim = async () => {
    if (!activeShopId) return;
    if (!form.client_id || !form.vehicle_id) {
      toast.error("Escolha o cliente e a viatura.");
      return;
    }
    setSaving(true);
    let insurerId: string | null = null;
    try { insurerId = await resolveInsurerId(activeShopId, insSel); }
    catch { setSaving(false); toast.error("Não foi possível guardar a seguradora."); return; }
    const { data: auth } = await supabase.auth.getSession();
    const { data, error } = await supabase.from("claims").insert({
      shop_id: activeShopId,
      client_id: form.client_id,
      vehicle_id: form.vehicle_id,
      work_order_id: form.work_order_id || null,
      insurer_id: insurerId,
      notes: form.notes || null,
      claim_number: form.claim_number || null,
      policy_number: form.policy_number || null,
      claim_date: form.claim_date || null,
      claim_type: form.claim_type || null,
      description: form.description || null,
      created_by: auth.session?.user.id ?? null,
    }).select("id").single();
    setSaving(false);
    if (error) { toast.error("Não foi possível criar o sinistro."); return; }

    // Marca a OS como processo de seguradora (reutiliza a OS existente)
    if (form.work_order_id) {
      await supabase.from("work_orders").update({ process_type: "seguradora" }).eq("id", form.work_order_id);
    }
    toast.success("Sinistro criado");
    setOpen(false);
    setForm({ ...emptyClaim });
    navigate(`/claims/${data.id}`);
  };

  const saveInsurer = async () => {
    if (!activeShopId || !insurerForm.name.trim()) { toast.error("Indique o nome da seguradora."); return; }
    const payload = { ...insurerForm, shop_id: activeShopId };
    const { error } = insurerEditId
      ? await supabase.from("insurers").update(payload).eq("id", insurerEditId)
      : await supabase.from("insurers").insert(payload);
    if (error) { toast.error(error.message); return; }
    toast.success("Seguradora guardada");
    setInsurerOpen(false);
    setInsurerEditId(null);
    setInsurerForm({ ...emptyInsurer });
    load();
  };

  const counters = useMemo(() => CLAIM_GROUPS.map((g) => ({
    key: "g:" + g.key, label: g.label, value: claims.filter((c) => g.statuses.includes(c.status)).length,
  })), [claims]);

  if (loading) {
    return <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Processos de Seguradoras
          </h1>
          <p className="text-sm text-muted-foreground">Sinistros, peritagens, aprovações e comunicações.</p>
        </div>
        <Button onClick={() => { setForm({ ...emptyClaim }); setInsSel(null); setAddVehicle(false); setOpen(true); }} className="min-h-[44px]">
          <Plus className="w-4 h-4 mr-2" /> Novo Sinistro
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {counters.map((k) => (
          <Card key={k.key} className={`cursor-pointer hover:border-primary/50 transition-colors ${statusFilter === k.key ? "border-primary" : ""}`}
            onClick={() => setStatusFilter(statusFilter === k.key ? "all" : k.key)}>
            <CardContent className="p-4">
              <p className="text-2xl font-bold">{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="claims">
        <TabsList>
          <TabsTrigger value="claims">Sinistros</TabsTrigger>
          <TabsTrigger value="insurers">Seguradoras</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="SIN, matrícula, cliente, seguradora, processo, ORC, OS…"
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os estados</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="late">Atrasados</SelectItem>
                {CLAIM_GROUPS.map((g) => <SelectItem key={g.key} value={"g:" + g.key}>Grupo: {g.label}</SelectItem>)}
                {CLAIM_STATUSES.map((s) => <SelectItem key={s} value={s}>{CLAIM_STATUS_LABELS[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Sempre</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
                <SelectItem value="365">Último ano</SelectItem>
              </SelectContent>
            </Select>
            <Select value={insurerFilter} onValueChange={setInsurerFilter}>
              <SelectTrigger className="w-full sm:w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as seguradoras</SelectItem>
                {insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Sem processos de seguradora.
            </CardContent></Card>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sinistro</TableHead>
                      <TableHead>Seguradora</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Viatura</TableHead>
                      <TableHead>OS</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Aprovado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/claims/${c.id}`)}>
                        <TableCell className="font-medium">{c.ref}<div className="text-xs text-muted-foreground">{c.claim_number || ""}</div></TableCell>
                        <TableCell>{c.insurers?.name || "—"}</TableCell>
                        <TableCell>{c.clients?.name || "—"}</TableCell>
                        <TableCell>{c.vehicles ? `${c.vehicles.make} ${c.vehicles.model} — ${c.vehicles.plate}` : "—"}</TableCell>
                        <TableCell>{c.work_orders?.number || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={claimStatusTone(c.status)}>
                            {CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS] || c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.amount_approved != null ? formatMoney(Number(c.amount_approved)) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile */}
              <div className="sm:hidden space-y-2">
                {filtered.map((c) => (
                  <Card key={c.id} className="cursor-pointer" onClick={() => navigate(`/claims/${c.id}`)}>
                    <CardContent className="p-4 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{c.ref}{c.claim_number ? ` · ${c.claim_number}` : ""}</span>
                        <Badge variant="outline" className={claimStatusTone(c.status)}>
                          {CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS] || c.status}
                        </Badge>
                      </div>
                      <p className="text-sm">{c.insurers?.name || "Sem seguradora"}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.clients?.name} · {c.vehicles?.plate}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="insurers" className="space-y-4">
          <div className="flex justify-end">
            <Button variant="outline" className="min-h-[44px]"
              onClick={() => { setInsurerEditId(null); setInsurerForm({ ...emptyInsurer }); setInsurerOpen(true); }}>
              <Plus className="w-4 h-4 mr-2" /> Nova seguradora
            </Button>
          </div>
          {insurers.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              Ainda não tem seguradoras registadas. Cria uma e reutiliza-a em todos os sinistros.
            </CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {insurers.map((i) => (
                <Card key={i.id}>
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="font-semibold">{i.name}</span>
                        {!i.active && <Badge variant="outline">Inativa</Badge>}
                      </div>
                      <Button size="icon" variant="ghost"
                        onClick={() => { setInsurerEditId(i.id); setInsurerForm({ ...emptyInsurer, ...i }); setInsurerOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{i.claims_email || i.email || "—"}</p>
                    <p className="text-xs text-muted-foreground">{i.claims_phone || i.phone || "—"}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Novo sinistro */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Sinistro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between"><Label>Cliente *</Label>
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => navigate("/clients?new=1&insurance=1&return=claims")}>+ Criar novo cliente</Button>
              </div>
              <Select value={form.client_id} onValueChange={(v) => { setForm({ ...form, client_id: v, vehicle_id: "", work_order_id: "" }); setAddVehicle(false); }}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <div className="flex items-center justify-between"><Label>Viatura *</Label>
                {form.client_id && !addVehicle && (
                  <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setAddVehicle(true)}>+ Adicionar viatura</Button>
                )}
              </div>
              {addVehicle && activeShopId && form.client_id ? (
                <QuickVehicleForm shopId={activeShopId} clientId={form.client_id}
                  onCancel={() => setAddVehicle(false)}
                  onCreated={(v) => {
                    setVehicles((l) => (l.some((x) => x.id === v.id) ? l : [...l, { ...v, client_id: form.client_id }]));
                    setForm((f) => ({ ...f, vehicle_id: v.id }));
                    setAddVehicle(false);
                  }} />
              ) : (
                <Select value={form.vehicle_id} onValueChange={(v) => setForm({ ...form, vehicle_id: v })} disabled={!form.client_id}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder={form.client_id && vehiclesForClient.length === 0 ? "Sem viaturas — adicione uma" : "Selecionar viatura"} /></SelectTrigger>
                  <SelectContent>
                    {vehiclesForClient.map((v) => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Ordem de serviço (opcional)</Label>
              <Select value={form.work_order_id} onValueChange={(v) => setForm({ ...form, work_order_id: v })}>
                <SelectTrigger><SelectValue placeholder="Associar OS existente" /></SelectTrigger>
                <SelectContent>
                  {wosForContext.map((w) => <SelectItem key={w.id} value={w.id}>{w.number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <InsurerPicker shopId={activeShopId} value={insSel} onChange={setInsSel} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>Nº sinistro/processo</Label><Input value={form.claim_number} onChange={(e) => setForm({ ...form, claim_number: e.target.value })} /></div>
              <div><Label>Nº da apólice</Label><Input value={form.policy_number} onChange={(e) => setForm({ ...form, policy_number: e.target.value })} /></div>
              <div><Label>Data do sinistro</Label><Input type="date" value={form.claim_date} onChange={(e) => setForm({ ...form, claim_date: e.target.value })} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.claim_type} onValueChange={(v) => setForm({ ...form, claim_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>{CLAIM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={createClaim} disabled={saving}>{saving ? "A criar…" : "Criar sinistro"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seguradora */}
      <Dialog open={insurerOpen} onOpenChange={setInsurerOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{insurerEditId ? "Editar seguradora" : "Nova seguradora"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={insurerForm.name} onChange={(e) => setInsurerForm({ ...insurerForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NIF</Label><Input value={insurerForm.nif || ""} onChange={(e) => setInsurerForm({ ...insurerForm, nif: e.target.value })} /></div>
              <div><Label>Website</Label><Input value={insurerForm.website || ""} onChange={(e) => setInsurerForm({ ...insurerForm, website: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={insurerForm.phone || ""} onChange={(e) => setInsurerForm({ ...insurerForm, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={insurerForm.email || ""} onChange={(e) => setInsurerForm({ ...insurerForm, email: e.target.value })} /></div>
              <div><Label>Contacto de sinistros</Label><Input value={insurerForm.claims_contact || ""} onChange={(e) => setInsurerForm({ ...insurerForm, claims_contact: e.target.value })} /></div>
              <div><Label>Telefone de sinistros</Label><Input value={insurerForm.claims_phone || ""} onChange={(e) => setInsurerForm({ ...insurerForm, claims_phone: e.target.value })} /></div>
            </div>
            <div><Label>Email de sinistros</Label><Input value={insurerForm.claims_email || ""} onChange={(e) => setInsurerForm({ ...insurerForm, claims_email: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea rows={2} value={insurerForm.notes || ""} onChange={(e) => setInsurerForm({ ...insurerForm, notes: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={insurerForm.active} onCheckedChange={(v) => setInsurerForm({ ...insurerForm, active: v })} />
              <Label>Ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInsurerOpen(false)}>Cancelar</Button>
            <Button onClick={saveInsurer}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
