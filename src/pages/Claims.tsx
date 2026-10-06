import { useState, useEffect, useCallback, useMemo } from "react";
import { clientDisplayName } from "@/lib/clientDisplayName";
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
import { ShieldAlert, Plus, Search, Building2, Pencil, AlertTriangle, Camera } from "lucide-react";
import { useShopCountry } from "@/hooks/useShopCountry";
import { computeRepairPhase, computeTotalLossPhase, phaseBadge, nextStep, ptDeadlines, deadlineState, REPAIR_PHASES, REPAIR_PHASE_LABELS, isPendingSup } from "@/lib/claimPhases";
import { uploadClaimFiles } from "@/components/claims/ClaimDocumentsV2";
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
import { CompactFilterBar, FilterCombobox } from "@/components/filters/CompactFilters";
import { ClaimRowActions } from "@/components/claims/ClaimRowActions";
import { claimVehicleLabel } from "@/lib/claimVehicle";

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
  const [tab, setTab] = useState("claims");
  const [insurerSearch, setInsurerSearch] = useState("");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...emptyClaim });
  const [insSel, setInsSel] = useState<InsurerSelection>(null);
  const [addVehicle, setAddVehicle] = useState(false);
  const [period, setPeriod] = useState("all");
  const [quoteNums, setQuoteNums] = useState<Record<string, string>>({});
  const IS_BR = useShopCountry().code === "BR";
  const [newPhotos, setNewPhotos] = useState<File[]>([]);
  const [newMore, setNewMore] = useState(false);

  const [insurerOpen, setInsurerOpen] = useState(false);
  const [insurerEditId, setInsurerEditId] = useState<string | null>(null);
  const [insurerForm, setInsurerForm] = useState({ ...emptyInsurer });

  const load = useCallback(async () => {
    if (!activeShopId) return;
    const [cl, ins, cli, veh, wo] = await Promise.all([
      supabase.from("claims")
        .select("*, insurers(name), clients(name, company), vehicles(make, model, plate), work_orders(number, status), invoices!invoices_claim_id_fkey(id,total,status,payments(amount)), claim_supplements(id, type, number, status, requested_at, decided_at, amount_requested, amount_approved)")
        .eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(500),
      supabase.from("insurers").select("*").eq("shop_id", activeShopId).order("name"),
      supabase.from("clients").select("id, name, company, nif").eq("shop_id", activeShopId).is("deleted_at", null).order("name").limit(1000),
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
  useRealtimeTable("claim_supplements", { shopId: activeShopId, onChange: () => { void load(); } });
  useRealtimeTable("invoices", { shopId: activeShopId, onChange: () => { void load(); } });
  useRealtimeTable("payments", { shopId: activeShopId, onChange: () => { void load(); } });

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

  const info = useMemo(() => {
    const m: Record<string, { phase: string; badge: ReturnType<typeof phaseBadge>; next: string; overdue: boolean; dueSoon: boolean }> = {};
    for (const c of claims) {
      const sups = c.claim_supplements || [];
      const woDone = ["completed", "done", "delivered", "ready", "invoiced"].includes(String(c.work_orders?.status || ""));
      const live = (c.invoices || []).filter((i: any) => !["draft", "cancelled"].includes(i.status));
      const billed = live.reduce((t: number, i: any) => t + Number(i.total || 0), 0);
      const paid = live.reduce((t: number, i: any) => t + (i.payments || []).reduce((p: number, x: any) => p + Number(x.amount || 0), 0), 0);
      const normalized = { ...c, outcome: c.total_loss ? "perda_total" : c.outcome };
      const phase = normalized.outcome === "perda_total" ? computeTotalLossPhase(c) : computeRepairPhase(c, { sups, woDone, billedAndPaid: billed > 0 && paid >= billed - 0.01 });
      const ds = IS_BR || ["done", "cancelled"].includes(c.status) ? [] : ptDeadlines(c, sups).map(deadlineState);
      m[c.id] = { phase, badge: phaseBadge(normalized, phase, sups, IS_BR), next: nextStep(normalized, phase, sups, [], IS_BR), overdue: ds.some((d) => d.overdue), dueSoon: ds.some((d) => d.dueSoon) };
    }
    return m;
  }, [claims, IS_BR]);
  const phaseGroup = (c: any) => {
    const ph = info[c.id]?.phase || "entrada";
    if (ph === "perda_total" || ph === "decisao" || ph === "encargos") return "autorizacao";
    return ph;
  };

  // Filtro por grupo vindo do painel (?status=g:<grupo> / late)
  const groupFilter = statusFilter.startsWith("g:") ? CLAIM_GROUPS.find((g) => "g:" + g.key === statusFilter) : null;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return claims.filter((c) => {
      if (statusFilter.startsWith("p:")) { if (phaseGroup(c) !== statusFilter.slice(2)) return false; }
      else if (statusFilter === "overdue") { if (!info[c.id]?.overdue) return false; }
      else if (groupFilter) { if (!groupFilter.statuses.includes(c.status)) return false; }
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
        c.insurers?.name, clientDisplayName(c.clients), c.work_orders?.number,
        c.vehicles?.plate, c.vehicles?.make, c.vehicles?.model,
        CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS],
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [claims, search, statusFilter, insurerFilter, period, quoteNums, groupFilter, info]);

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
    if (newPhotos.length) await uploadClaimFiles(newPhotos, { shopId: activeShopId, claimId: data.id, category: "damage" });
    setNewPhotos([]); setNewMore(false);
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

  const counters = useMemo(() => [
    ...REPAIR_PHASES.map((ph) => ({
      key: "p:" + ph, label: ph === "fechado" ? "Fechados" : ph === "faturacao" && IS_BR ? "Nota fiscal" : REPAIR_PHASE_LABELS[ph],
      value: claims.filter((c) => phaseGroup(c) === ph).length, danger: false,
    })),
    ...(IS_BR ? [] : [{ key: "overdue", label: "Prazos em atraso", value: claims.filter((c) => info[c.id]?.overdue).length, danger: true }]),
  ], [claims, info, IS_BR]);

  const statusOptions = [
    { value: "all", label: "Todos os estados" }, { value: "active", label: "Ativos" },
    { value: "late", label: "Ações em atraso" },
    ...(!IS_BR ? [{ value: "overdue", label: "Prazos em atraso" }] : []),
    ...REPAIR_PHASES.map((ph) => ({ value: `p:${ph}`, label: ph === "faturacao" && IS_BR ? "Nota fiscal" : REPAIR_PHASE_LABELS[ph] })),
    ...CLAIM_GROUPS.map((g) => ({ value: `g:${g.key}`, label: `Grupo: ${g.label}` })),
    ...CLAIM_STATUSES.map((s) => ({ value: s, label: CLAIM_STATUS_LABELS[s] })),
  ];
  const periodOptions = [{ value: "all", label: "Qualquer data" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }, { value: "365", label: "Último ano" }];
  const insurerOptions = [{ value: "all", label: "Todas as seguradoras" }, ...insurers.map((i) => ({ value: i.id, label: i.name }))];
  const filterCount = [statusFilter, period, insurerFilter].filter((value) => value !== "all").length;
  const clearFilters = () => { setSearch(""); setStatusFilter("all"); setPeriod("all"); setInsurerFilter("all"); };
  const newClaim = (insurerId?: string) => { setForm({ ...emptyClaim }); setInsSel(insurerId ? { insurerId } : null); setAddVehicle(false); setNewPhotos([]); setNewMore(false); setOpen(true); };
  const viewInsurerClaims = (insurerId: string) => { clearFilters(); setInsurerFilter(insurerId); setTab("claims"); };

  if (loading) {
    return <div className="space-y-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>;
  }

  return (
    <div className="claims-surface space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" /> Sinistros
          </h1>
          
        </div>
        <Button onClick={() => newClaim()} className="min-h-[44px]">
          <Plus className="w-4 h-4 mr-2" /> Novo Sinistro
        </Button>
      </div>

      <div className="flex gap-2 overflow-x-auto snap-x pb-1" role="group" aria-label="Filtrar por etapa">
        {counters.map((k) => (
          <Button key={k.key} variant="outline" aria-pressed={statusFilter === k.key} className={`h-auto min-h-[44px] shrink-0 snap-start gap-2 px-3 py-2 ${statusFilter === k.key ? "border-primary bg-accent" : ""} ${k.danger && k.value > 0 ? "claim-tone-danger" : ""}`}
            onClick={() => setStatusFilter(statusFilter === k.key ? "all" : k.key)}>
            <span className="text-sm font-normal">{k.label}</span><span className="text-sm font-bold tabular-nums">{k.value}</span>
          </Button>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="claims">Sinistros</TabsTrigger>
          <TabsTrigger value="insurers">Seguradoras</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="space-y-4">
          <CompactFilterBar activeCount={filterCount} onClear={clearFilters}
            search={<><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 min-h-[44px]" aria-label="Pesquisar sinistros" placeholder="Matrícula, cliente, processo…" value={search} onChange={(e) => setSearch(e.target.value)} /></>}
            filters={(stacked) => <>
              <FilterCombobox value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="Estado" fullWidth={stacked} className="min-h-[44px]" />
              <FilterCombobox value={period} onChange={setPeriod} options={periodOptions} placeholder="Data" fullWidth={stacked} className="min-h-[44px]" />
              <FilterCombobox value={insurerFilter} onChange={setInsurerFilter} options={insurerOptions} placeholder="Seguradora" fullWidth={stacked} className="min-h-[44px]" />
            </>} />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground" aria-live="polite">
            <span>{filtered.length} de {claims.length} sinistros{insurerFilter !== "all" ? ` · ${insurerOptions.find((i) => i.value === insurerFilter)?.label || ""}` : ""}</span>
            {(filterCount > 0 || search) && <Button variant="ghost" size="sm" className="min-h-[44px]" onClick={clearFilters}>Limpar pesquisa e filtros</Button>}
          </div>

          {filtered.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">
              {claims.length === 0 ? "Sem processos de seguradora." : "Nenhum sinistro corresponde à pesquisa ou aos filtros."}
            </CardContent></Card>
          ) : (
            <>
              {/* Desktop */}
              <div className="hidden sm:block">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[9%]">Sinistro</TableHead>
                      <TableHead className="w-[13%]">Seguradora</TableHead>
                      <TableHead className="w-[9%]">Cliente</TableHead>
                      <TableHead className="w-[16%]">Viatura</TableHead>
                      <TableHead className="w-[8%]">OS</TableHead>
                      <TableHead className="w-[11%]">Estado</TableHead>
                      <TableHead className="w-[22%]">Próximo passo</TableHead>
                      <TableHead className="w-[8%] text-right">Aprovado</TableHead>
                      <TableHead className="w-12"><span className="sr-only">Ações</span></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/claims/${c.id}`)}>
                        <TableCell className="font-medium"><div className="truncate">{c.ref}</div><div className="text-xs text-muted-foreground truncate">{c.claim_number || ""}</div></TableCell>
                        <TableCell><div className="truncate">{c.insurers?.name || "—"}</div></TableCell>
                        <TableCell><div className="truncate">{clientDisplayName(c.clients) || "—"}</div></TableCell>
                        <TableCell><div className="truncate">{c.vehicles ? `${c.vehicles.make} ${c.vehicles.model} — ${c.vehicles.plate}` : "—"}</div></TableCell>
                        <TableCell><div className="truncate">{c.work_orders?.number || "—"}</div></TableCell>
                        <TableCell>
                          <Badge variant="outline" className={claimStatusTone(c.status)}>
                            {info[c.id]?.badge.label || CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS] || c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          <div className="flex w-[280px] max-w-full items-start gap-1.5">
                            {(info[c.id]?.overdue || info[c.id]?.dueSoon) && <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${info[c.id]?.overdue ? "text-destructive" : "text-warning"}`} aria-label={info[c.id]?.overdue ? "Prazo em atraso" : "Prazo a vencer"} />}
                            <span className="line-clamp-2 break-words">{info[c.id]?.next}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {c.amount_approved != null ? formatMoney(Number(c.amount_approved)) : "—"}
                        </TableCell>
                        <TableCell><ClaimRowActions claim={c} /></TableCell>
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
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">{c.ref}{c.claim_number ? ` · ${c.claim_number}` : ""}</span>
                        <div className="flex items-center gap-1"><Badge variant="outline" className={claimStatusTone(c.status)}>
                          {info[c.id]?.badge.label || CLAIM_STATUS_LABELS[c.status as keyof typeof CLAIM_STATUS_LABELS] || c.status}
                        </Badge><ClaimRowActions claim={c} /></div>
                      </div>
                      <p className="text-xs flex items-start gap-1">{(info[c.id]?.overdue || info[c.id]?.dueSoon) && <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${info[c.id]?.overdue ? "text-destructive" : "text-warning"}`} />}<span>Próximo passo: {info[c.id]?.next}</span></p>
                      <p className="text-sm">{c.insurers?.name || "Sem seguradora"}</p>
                      <p className="text-xs text-muted-foreground">
                        {claimVehicleLabel(c.vehicles)}
                      </p>
                      <p className="text-xs text-muted-foreground">{clientDisplayName(c.clients)}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="insurers" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input className="min-h-[44px] sm:max-w-xs" aria-label="Pesquisar seguradoras" placeholder="Pesquisar seguradora…" value={insurerSearch} onChange={(e) => setInsurerSearch(e.target.value)} />
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
              {insurers.filter((i) => `${i.name} ${i.nif || ""}`.toLowerCase().includes(insurerSearch.trim().toLowerCase())).map((i) => (
                <Card key={i.id}>
                  <CardContent className="p-4 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Building2 className="w-4 h-4 text-primary" />
                        <span className="font-semibold break-words min-w-0">{i.name}</span>
                        {!i.active && <Badge variant="outline">Inativa</Badge>}
                      </div>
                      <Button size="icon" variant="ghost" aria-label={`Editar ${i.name}`} title="Editar seguradora"
                        onClick={() => { setInsurerEditId(i.id); setInsurerForm({ ...emptyInsurer, ...i }); setInsurerOpen(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">{i.claims_email || i.email || "—"}</p>
                    <p className="text-xs text-muted-foreground">{i.claims_phone || i.phone || "—"}</p>
                    <div className="flex flex-wrap gap-2 pt-3">
                      <Button variant="outline" className="min-h-[44px]" onClick={() => viewInsurerClaims(i.id)}>Ver sinistros ({claims.filter((c) => c.insurer_id === i.id).length})</Button>
                      {i.active && <Button variant="ghost" className="min-h-[44px]" onClick={() => newClaim(i.id)}><Plus className="mr-1 h-4 w-4" />Novo sinistro</Button>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Novo sinistro */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="claims-surface max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Sinistro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between"><Label>Cliente *</Label>
                <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => navigate("/clients?new=1&insurance=1&return=claims")}>+ Criar novo cliente</Button>
              </div>
              <Select value={form.client_id} onValueChange={(v) => { setForm({ ...form, client_id: v, vehicle_id: "", work_order_id: "" }); setAddVehicle(false); }}>
                <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{clientDisplayName(c)}</SelectItem>)}</SelectContent>
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
            <InsurerPicker shopId={activeShopId} value={insSel} onChange={setInsSel} />
            <div>
              <Button type="button" variant="outline" className="w-full min-h-[44px]" onClick={() => document.getElementById("new-claim-photos")?.click()}>
                <Camera className="w-4 h-4 mr-2" />{newPhotos.length ? `${newPhotos.length} fotografia(s)/documento(s)` : "Fotografias (opcional)"}
              </Button>
              <input id="new-claim-photos" type="file" accept="image/*,application/pdf" capture="environment" multiple className="hidden" onChange={(e) => { setNewPhotos(Array.from(e.target.files || [])); e.target.value = ""; }} />
            </div>
            <Button variant="link" className="px-0 min-h-[44px]" onClick={() => setNewMore((v) => !v)}>{newMore ? "Esconder detalhes" : "Mais detalhes (opcional)"}</Button>
            {newMore && (<div className="space-y-3">
            <div>
              <Label>Ordem de serviço (opcional)</Label>
              <Select value={form.work_order_id} onValueChange={(v) => setForm({ ...form, work_order_id: v })}>
                <SelectTrigger><SelectValue placeholder="Associar OS existente" /></SelectTrigger>
                <SelectContent>
                  {wosForContext.map((w) => <SelectItem key={w.id} value={w.id}>{w.number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
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
            </div>)}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={createClaim} disabled={saving}>{saving ? "A criar…" : "Criar sinistro"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seguradora */}
      <Dialog open={insurerOpen} onOpenChange={setInsurerOpen}>
        <DialogContent className="claims-surface max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{insurerEditId ? "Editar seguradora" : "Nova seguradora"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={insurerForm.name} onChange={(e) => setInsurerForm({ ...insurerForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{IS_BR ? "CPF/CNPJ" : "NIF"}</Label><Input value={insurerForm.nif || ""} onChange={(e) => setInsurerForm({ ...insurerForm, nif: e.target.value })} /></div>
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
