import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft, Save, ShieldAlert, Phone, Mail, Globe, Paperclip, Plus, Copy,
  Trash2, FileText, Clock, CheckCircle2, CalendarClock, Download, Star,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import {
  CLAIM_STATUSES, CLAIM_STATUS_LABELS, claimStatusTone,
  EXPERT_STATUSES, EXPERT_STATUS_LABELS,
  APPROVAL_STATUSES, APPROVAL_STATUS_LABELS,
  CONTACT_KINDS, CONTACT_KIND_LABELS,
  COMM_KINDS, COMM_KIND_LABELS, COMM_STATUS_LABELS,
  DOC_CATEGORIES, DOC_CATEGORY_LABELS,
  CLAIM_TYPES, LIABILITY_OPTIONS,
  CLAIM_EMAIL_TEMPLATES, renderClaimTemplate,
} from "@/lib/claims";

function eventText(e: any): string {
  const to = e.meta?.to;
  if (e.kind === "status" && to) return `Estado: ${CLAIM_STATUS_LABELS[to] || to}`;
  if (e.kind === "expert" && to) return `Peritagem: ${EXPERT_STATUS_LABELS[to] || to}`;
  if (e.kind === "approval" && to) return `Autorização: ${APPROVAL_STATUS_LABELS[to] || to}`;
  return e.description;
}

const dt = (v: string | null) => (v ? new Date(v).toLocaleString("pt-PT") : "—");

export default function ClaimDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeShopId = useActiveShopId();

  const [claim, setClaim] = useState<any>(null);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [wos, setWos] = useState<any[]>([]);
  const [invs, setInvs] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const [docCategory, setDocCategory] = useState("other");
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!id || !activeShopId) return;
    const [c, ins, ct, cm, dc, ev] = await Promise.all([
      supabase.from("claims")
        .select("*, insurers(*), clients(id, name, email, phone), vehicles(id, make, model, plate, year), work_orders(id, number, status, total)")
        .eq("id", id).maybeSingle(),
      supabase.from("insurers").select("*").eq("shop_id", activeShopId).order("name"),
      supabase.from("claim_contacts").select("*").eq("claim_id", id).order("is_primary", { ascending: false }),
      supabase.from("claim_communications").select("*").eq("claim_id", id).order("occurred_at", { ascending: false }),
      supabase.from("claim_documents").select("*").eq("claim_id", id).order("created_at", { ascending: false }),
      supabase.from("claim_events").select("*").eq("claim_id", id).order("created_at", { ascending: false }).limit(200),
    ]);
    if (!c.data) { toast.error("Sinistro não encontrado"); navigate("/claims"); return; }
    setClaim(c.data);
    setInsurers(ins.data || []);
    setContacts(ct.data || []);
    setComms(cm.data || []);
    setDocs(dc.data || []);
    setEvents(ev.data || []);
    if (c.data.client_id) {
      const q = await supabase.from("quotes")
        .select("id, number, total, status, date")
        .eq("shop_id", activeShopId).eq("client_id", c.data.client_id)
        .order("created_at", { ascending: false }).limit(50);
      setQuotes(q.data || []);
      const [w, iv] = await Promise.all([
        supabase.from("work_orders").select("id, number, status, total, vehicle_id")
          .eq("shop_id", activeShopId).eq("client_id", c.data.client_id).order("created_at", { ascending: false }).limit(50),
        supabase.from("invoices").select("id, number, total, status, date, client_name")
          .eq("shop_id", activeShopId).eq("client_id", c.data.client_id).order("created_at", { ascending: false }).limit(50),
      ]);
      setWos(w.data || []);
      setInvs(iv.data || []);
    }
    const { data: mem } = await supabase.rpc("get_shop_member_emails" as any, { _shop_id: activeShopId });
    if (Array.isArray(mem)) {
      const m: Record<string, string> = {};
      for (const r of mem as any[]) if (r.user_id) m[r.user_id] = r.email || "";
      setMembers(m);
    }
    setLoading(false);
  }, [id, activeShopId, navigate]);

  useEffect(() => { load(); }, [load]);

  // Live: same claim edited by another user (owner/technician) shows up here.
  const liveOpts = { onChange: () => { void load(); }, enabled: !!id, debounceMs: 400 };
  useRealtimeTable("claims", { ...liveOpts, filter: `id=eq.${id}`, event: "UPDATE" });
  useRealtimeTable("claim_events", { ...liveOpts, filter: `claim_id=eq.${id}` });
  useRealtimeTable("claim_communications", { ...liveOpts, filter: `claim_id=eq.${id}` });
  useRealtimeTable("claim_documents", { ...liveOpts, filter: `claim_id=eq.${id}` });

  const set = (patch: Record<string, any>) => setClaim((c: any) => ({ ...c, ...patch }));

  const num = (v: any) => (v === "" || v == null ? null : Number(v));

  /** Associa rapidamente uma OS/orçamento/fatura e guarda. */
  const link = async (patch: Record<string, any>) => {
    set(patch);
    const { error } = await supabase.from("claims").update(patch).eq("id", claim.id);
    if (error) { toast.error("Não foi possível guardar."); return; }
    if (patch.work_order_id) await supabase.from("work_orders").update({ process_type: "seguradora" }).eq("id", patch.work_order_id);
    toast.success("Associado ao sinistro");
    load();
  };

  const createWorkOrder = () => navigate(`/services/new?client=${claim.client_id}&vehicle=${claim.vehicle_id}&claim=${claim.id}`);

  const persist = async (patch?: Record<string, any>) => {
    if (!claim) return;
    setSaving(true);
    const payload = patch ?? {
      insurer_id: claim.insurer_id, claim_number: claim.claim_number, policy_number: claim.policy_number,
      process_number: claim.process_number, report_number: claim.report_number,
      claim_date: claim.claim_date || null, report_date: claim.report_date || null,
      claim_type: claim.claim_type, description: claim.description, location: claim.location,
      liability: claim.liability, coverage: claim.coverage,
      deductible: claim.deductible === "" ? null : claim.deductible,
      notes: claim.notes, status: claim.status,
      expert_status: claim.expert_status, expert_date: claim.expert_date || null,
      expert_time: claim.expert_time || null, expert_location: claim.expert_location,
      expert_name: claim.expert_name, expert_company: claim.expert_company,
      expert_contact: claim.expert_contact, expert_report_number: claim.expert_report_number,
      expert_done_date: claim.expert_done_date || null, expert_result: claim.expert_result,
      expert_notes: claim.expert_notes,
      quote_id: claim.quote_id, insurer_quote_notes: claim.insurer_quote_notes,
      amount_requested: claim.amount_requested === "" ? null : claim.amount_requested,
      amount_approved: claim.amount_approved === "" ? null : claim.amount_approved,
      amount_rejected: claim.amount_rejected === "" ? null : claim.amount_rejected,
      approval_status: claim.approval_status, approval_date: claim.approval_date || null,
      approved_by: claim.approved_by, approval_reference: claim.approval_reference,
      approval_notes: claim.approval_notes,
      next_action: claim.next_action, next_action_date: claim.next_action_date || null,
      next_action_owner: claim.next_action_owner,
      work_order_id: claim.work_order_id || null, invoice_id: claim.invoice_id || null,
      amount_initial_quote: num(claim.amount_initial_quote), amount_expert: num(claim.amount_expert),
      amount_invoiced: num(claim.amount_invoiced), amount_paid_insurer: num(claim.amount_paid_insurer),
      amount_client: num(claim.amount_client), amount_pending: num(claim.amount_pending),
    };
    const { error } = await supabase.from("claims").update(payload).eq("id", claim.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sinistro guardado");
    load();
  };

  const ctx = useMemo(() => ({
    insurer: claim?.insurers?.name,
    claim_number: claim?.claim_number,
    policy_number: claim?.policy_number,
    client: claim?.clients?.name,
    vehicle: claim?.vehicles ? `${claim.vehicles.make} ${claim.vehicles.model}` : "",
    plate: claim?.vehicles?.plate,
    wo_number: claim?.work_orders?.number,
    quote_number: quotes.find((q) => q.id === claim?.quote_id)?.number,
    amount: claim?.amount_requested != null ? formatMoney(Number(claim.amount_requested)) : undefined,
  }), [claim, quotes]);

  /* ---------------- Contactos ---------------- */
  const [contactOpen, setContactOpen] = useState(false);
  const [contactForm, setContactForm] = useState<any>({ kind: "insurer", name: "", company: "", role: "", phone: "", email: "", notes: "", is_primary: false });

  const saveContact = async () => {
    if (!contactForm.name.trim()) { toast.error("Indique o nome do contacto."); return; }
    const { error } = await supabase.from("claim_contacts").insert({
      shop_id: activeShopId, claim_id: claim.id, ...contactForm,
    });
    if (error) { toast.error(error.message); return; }
    setContactOpen(false);
    setContactForm({ kind: "insurer", name: "", company: "", role: "", phone: "", email: "", notes: "", is_primary: false });
    load();
  };

  const removeContact = async (cid: string) => {
    await supabase.from("claim_contacts").delete().eq("id", cid);
    load();
  };

  /* ---------------- Comunicações ---------------- */
  const [commOpen, setCommOpen] = useState(false);
  const [commKind, setCommKind] = useState("email");
  const [commForm, setCommForm] = useState<any>({});

  const openComm = (kind: string) => {
    setCommKind(kind);
    const base: any = {
      occurred_at: new Date().toISOString().slice(0, 16),
      contact_id: "", contact_label: "", subject: "", body: "",
      outcome: "", next_step: "", next_contact_date: "",
      duration_minutes: "", portal_name: "", portal_url: "", portal_reference: "",
      direction: kind === "email" ? "out" : "out",
      status: kind === "email" ? "prepared" : "logged",
      template: "send_quote",
    };
    if (kind === "email") {
      const r = renderClaimTemplate("send_quote", ctx);
      base.subject = r.subject; base.body = r.body;
      base.contact_label = claim?.insurers?.claims_email || claim?.insurers?.email || "";
    }
    setCommForm(base);
    setCommOpen(true);
  };

  const applyTemplate = (key: string) => {
    const r = renderClaimTemplate(key, ctx);
    setCommForm((f: any) => ({ ...f, template: key, subject: r.subject, body: r.body }));
  };

  const saveComm = async (markSent = false) => {
    const payload: any = {
      shop_id: activeShopId, claim_id: claim.id, kind: commKind,
      direction: commKind === "email_in" ? "in" : (commForm.direction || "out"),
      status: commKind === "email" ? (markSent ? "sent" : "prepared") : commKind === "email_in" ? "received" : "logged",
      occurred_at: commForm.occurred_at ? new Date(commForm.occurred_at).toISOString() : new Date().toISOString(),
      contact_id: commForm.contact_id || null,
      contact_label: commForm.contact_label || null,
      subject: commForm.subject || null,
      body: commForm.body || null,
      outcome: commForm.outcome || null,
      next_step: commForm.next_step || null,
      next_contact_date: commForm.next_contact_date || null,
      duration_minutes: commForm.duration_minutes ? Number(commForm.duration_minutes) : null,
      portal_name: commForm.portal_name || null,
      portal_url: commForm.portal_url || null,
      portal_reference: commForm.portal_reference || null,
    };
    const { data: auth } = await supabase.auth.getSession();
    payload.user_id = auth.session?.user.id ?? null;
    payload.user_name = auth.session?.user.email ?? null;
    const { error } = await supabase.from("claim_communications").insert(payload);
    if (error) { toast.error(error.message); return; }
    if (commForm.next_contact_date) {
      await supabase.from("claims").update({
        next_action: commForm.next_step || claim.next_action,
        next_action_date: commForm.next_contact_date,
      }).eq("id", claim.id);
    }
    toast.success(commKind === "email" ? (markSent ? "Email registado como enviado" : "Email preparado e registado") : "Registo guardado");
    setCommOpen(false);
    load();
  };

  const markCommSent = async (commId: string) => {
    await supabase.from("claim_communications").update({ status: "sent" }).eq("id", commId);
    toast.success("Marcado como enviado");
    load();
  };

  const openMailClient = () => {
    const to = encodeURIComponent(commForm.contact_label || "");
    const s = encodeURIComponent(commForm.subject || "");
    const b = encodeURIComponent(commForm.body || "");
    window.open(`mailto:${to}?subject=${s}&body=${b}`, "_blank");
  };

  const copyEmail = async () => {
    await navigator.clipboard.writeText(`Para: ${commForm.contact_label || ""}\nAssunto: ${commForm.subject || ""}\n\n${commForm.body || ""}`);
    toast.success("Mensagem copiada");
  };

  /* ---------------- Documentos ---------------- */
  const uploadDoc = async (file: File) => {
    if (!file || !activeShopId) return;
    setUploading(true);
    const path = `${activeShopId}/claims/${claim.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const up = await supabase.storage.from("work-order-files").upload(path, file);
    if (up.error) { setUploading(false); toast.error(up.error.message); return; }
    const { data: pub } = supabase.storage.from("work-order-files").getPublicUrl(path);
    const { data: auth } = await supabase.auth.getSession();
    const { error } = await supabase.from("claim_documents").insert({
      shop_id: activeShopId, claim_id: claim.id, category: docCategory,
      file_name: file.name, file_url: pub.publicUrl, file_type: file.type,
      file_size: file.size, uploaded_by: auth.session?.user.id ?? null,
    });
    setUploading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Documento anexado");
    load();
  };

  const removeDoc = async (docId: string) => {
    await supabase.from("claim_documents").delete().eq("id", docId);
    load();
  };

  if (loading || !claim) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  const insurer = claim.insurers;

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-24">
      {/* Cabeçalho + estado global */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/claims")}><ArrowLeft className="w-5 h-5" /></Button>
        <div className="flex-1">
          <h1 className="page-title flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-primary" />
            {claim.ref || "Sinistro"}{claim.claim_number ? <span className="text-base text-muted-foreground font-normal">· Processo {claim.claim_number}</span> : null}
          </h1>
          <p className="text-sm text-muted-foreground">
            {claim.clients?.name} · {claim.vehicles ? `${claim.vehicles.make} ${claim.vehicles.model} — ${claim.vehicles.plate}` : "—"}
            {claim.work_orders?.number ? ` · OS ${claim.work_orders.number}` : ""}
          </p>
        </div>
        <Button onClick={() => persist()} disabled={saving} className="min-h-[44px]">
          <Save className="w-4 h-4 mr-2" />{saving ? "A guardar…" : "Guardar"}
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-3">
          <div>
            <Label>Estado do processo</Label>
            <Select value={claim.status} onValueChange={(v) => { set({ status: v }); persist({ status: v }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CLAIM_STATUSES.map((s) => <SelectItem key={s} value={s}>{CLAIM_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
            </Select>
            <Badge variant="outline" className={`mt-2 ${claimStatusTone(claim.status)}`}>
              {CLAIM_STATUS_LABELS[claim.status as keyof typeof CLAIM_STATUS_LABELS] || claim.status}
            </Badge>
          </div>
          <div>
            <Label>Próxima ação</Label>
            <Input value={claim.next_action || ""} onChange={(e) => set({ next_action: e.target.value })}
              placeholder="Ex.: aguardar resposta da seguradora" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Data</Label>
              <Input type="date" value={claim.next_action_date || ""} onChange={(e) => set({ next_action_date: e.target.value })} />
            </div>
            <div>
              <Label>Responsável</Label>
              <Input value={claim.next_action_owner || ""} onChange={(e) => set({ next_action_owner: e.target.value })} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="summary">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="data">Sinistro</TabsTrigger>
          <TabsTrigger value="contacts">Contactos</TabsTrigger>
          <TabsTrigger value="expert">Peritagem</TabsTrigger>
          <TabsTrigger value="quote">Orçamento</TabsTrigger>
          <TabsTrigger value="repair">Reparação</TabsTrigger>
          <TabsTrigger value="values">Valores</TabsTrigger>
          <TabsTrigger value="comms">Comunicações</TabsTrigger>
          <TabsTrigger value="docs">Documentos</TabsTrigger>
          <TabsTrigger value="timeline">Histórico</TabsTrigger>
        </TabsList>

        {/* Resumo */}
        <TabsContent value="summary" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card><CardContent className="p-4 text-sm space-y-1">
              <p className="text-xs text-muted-foreground">Cliente</p>
              <button className="font-semibold hover:underline text-left" onClick={() => navigate(`/clients?search=${encodeURIComponent(claim.clients?.name || "")}`)}>{claim.clients?.name || "—"}</button>
              <p className="text-muted-foreground">{[claim.clients?.phone, claim.clients?.email].filter(Boolean).join(" · ") || "Sem contacto"}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-sm space-y-1">
              <p className="text-xs text-muted-foreground">Viatura</p>
              <button className="font-semibold font-mono hover:underline" onClick={() => navigate(`/vehicles?search=${encodeURIComponent(claim.vehicles?.plate || "")}`)}>{claim.vehicles?.plate || "—"}</button>
              <p className="text-muted-foreground">{[claim.vehicles?.make, claim.vehicles?.model, claim.vehicles?.year].filter(Boolean).join(" ")}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-sm space-y-1">
              <p className="text-xs text-muted-foreground">Seguradora</p>
              <p className="font-semibold">{insurer?.name || "Ainda não definida"}</p>
              <p className="text-muted-foreground">Processo: {claim.claim_number || "—"} · Apólice: {claim.policy_number || "—"}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4 text-sm space-y-1">
              <p className="text-xs text-muted-foreground">Autorização</p>
              <p className="font-semibold">{APPROVAL_STATUS_LABELS[claim.approval_status || "waiting"]}</p>
              <p className="text-muted-foreground">Autorizado: {claim.amount_approved != null ? formatMoney(Number(claim.amount_approved)) : "—"}</p>
            </CardContent></Card>
          </div>
          {(() => {
            const q = quotes.find((x) => x.id === claim.quote_id);
            const quoted = claim.amount_initial_quote != null && claim.amount_initial_quote !== "" ? Number(claim.amount_initial_quote) : (q ? Number(q.total) : null);
            const approved = claim.amount_approved != null && claim.amount_approved !== "" ? Number(claim.amount_approved) : null;
            const diff = quoted != null && approved != null ? Math.round((quoted - approved) * 100) / 100 : null;
            const last = events[0];
            return (
              <Card><CardContent className="p-4 grid gap-3 grid-cols-2 sm:grid-cols-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Orçamentado</p><p className="font-semibold">{quoted != null ? formatMoney(quoted) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Autorizado</p><p className="font-semibold">{approved != null ? formatMoney(approved) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Diferença</p><p className="font-semibold">{diff != null ? formatMoney(diff) : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Última atualização</p><p className="font-medium">{last ? new Date(last.created_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : new Date(claim.updated_at || claim.created_at).toLocaleString("pt-PT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>{last?.description || last?.title ? <p className="text-xs text-muted-foreground truncate">{last.title || last.description}</p> : null}</div>
                {diff != null && diff !== 0 && <p className="col-span-2 sm:col-span-4 text-xs text-muted-foreground">A diferença é apenas informativa — não é cobrada automaticamente ao cliente.</p>}
                <div className="col-span-2 sm:col-span-4"><p className="text-xs text-muted-foreground">Próxima ação</p><p className="font-medium">{claim.next_action || "Nenhuma definida"}{claim.next_action_date ? ` · ${claim.next_action_date}` : ""}</p></div>
              </CardContent></Card>
            );
          })()}
          <Card><CardContent className="p-4 grid gap-2 sm:grid-cols-3 text-sm">
            <div><p className="text-xs text-muted-foreground">Orçamento</p><p className="font-medium">{quotes.find((q) => q.id === claim.quote_id)?.number || "Não associado"}</p></div>
            <div><p className="text-xs text-muted-foreground">Ordem de serviço</p><p className="font-medium">{claim.work_orders?.number || "Não associada"}</p></div>
            <div><p className="text-xs text-muted-foreground">Fatura</p><p className="font-medium">{invs.find((i) => i.id === claim.invoice_id)?.number || "Não associada"}</p></div>
          </CardContent></Card>
          <p className="text-xs text-muted-foreground">Sem ligação direta à seguradora: o GarageFlow regista o que a oficina recebe e envia por email, telefone ou portal.</p>
        </TabsContent>

        {/* Reparação */}
        <TabsContent value="repair" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Ordem de serviço</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={claim.work_order_id || ""} onValueChange={(v) => link({ work_order_id: v })}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Associar OS existente" /></SelectTrigger>
                  <SelectContent>{wos.map((w) => <SelectItem key={w.id} value={w.id}>{w.number} — {w.status}</SelectItem>)}</SelectContent>
                </Select>
                {!claim.work_order_id && <Button className="min-h-[44px]" onClick={createWorkOrder}><Plus className="w-4 h-4 mr-2" />Criar OS</Button>}
                {claim.work_order_id && <Button variant="outline" className="min-h-[44px]" onClick={() => navigate(`/services/edit/${claim.work_order_id}`)}>Abrir OS</Button>}
              </div>
              <div className="flex flex-wrap gap-2">
                {[["repairing", "Em reparação"], ["waiting_parts", "A aguardar peças"], ["repair_done", "Reparação concluída"]].map(([k, l]) => (
                  <Button key={k} size="sm" variant={claim.status === k ? "default" : "outline"} onClick={() => { set({ status: k }); persist({ status: k }); }}>{l}</Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Valores + faturação */}
        <TabsContent value="values" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Valores</CardTitle></CardHeader>
            <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {([
                ["amount_initial_quote", "Orçamento inicial"], ["amount_expert", "Valor peritado"],
                ["amount_approved", "Valor autorizado"], ["deductible", "Franquia"],
                ["amount_invoiced", "Valor faturado"], ["amount_paid_insurer", "Pago pela seguradora"],
                ["amount_client", "A cargo do cliente"], ["amount_pending", "Pendente"],
              ] as const).map(([k, l]) => (
                <div key={k}><Label>{l} (€)</Label><Input type="number" step="0.01" inputMode="decimal" value={claim[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })} /></div>
              ))}
              <p className="sm:col-span-2 text-xs text-muted-foreground">Os valores são registados pela oficina; o GarageFlow não decide quem paga cada parte.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Faturação e pagamento</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={claim.invoice_id || ""} onValueChange={(v) => {
                  const inv = invs.find((i) => i.id === v);
                  link({ invoice_id: v, ...(inv && claim.amount_invoiced == null ? { amount_invoiced: inv.total } : {}) });
                }}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Associar fatura existente" /></SelectTrigger>
                  <SelectContent>{invs.map((i) => <SelectItem key={i.id} value={i.id}>{i.number} — {formatMoney(Number(i.total))}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" className="min-h-[44px]" onClick={() => navigate("/invoices")}>Ir para Faturação</Button>
              </div>
              {(() => { const inv = invs.find((i) => i.id === claim.invoice_id); return inv ? (
                <div className="rounded-lg border border-border p-3 text-sm grid grid-cols-2 gap-1">
                  <span className="text-muted-foreground">Número</span><span>{inv.number}</span>
                  <span className="text-muted-foreground">Valor</span><span>{formatMoney(Number(inv.total))}</span>
                  <span className="text-muted-foreground">Entidade faturada</span><span>{inv.client_name || claim.clients?.name}</span>
                  <span className="text-muted-foreground">Data</span><span>{inv.date ? new Date(inv.date).toLocaleDateString("pt-PT") : "—"}</span>
                  <span className="text-muted-foreground">Estado</span><span>{inv.status}</span>
                </div>) : null; })()}
              <div className="flex flex-wrap gap-2">
                {[["waiting_invoice", "A aguardar faturação"], ["invoiced", "Faturado"], ["waiting_payment", "A aguardar pagamento"], ["paid", "Pago"], ["done", "Encerrar"]].map(([k, l]) => (
                  <Button key={k} size="sm" variant={claim.status === k ? "default" : "outline"} onClick={() => { set({ status: k }); persist({ status: k }); }}>{l}</Button>
                ))}
                {["done", "cancelled"].includes(claim.status) && (
                  <Button size="sm" variant="outline" onClick={() => { set({ status: "repairing" }); persist({ status: "repairing" }); }}>Reabrir</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dados */}
        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados do sinistro</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Seguradora</Label>
                <Select value={claim.insurer_id || ""} onValueChange={(v) => set({ insurer_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{insurers.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Nº do sinistro</Label><Input value={claim.claim_number || ""} onChange={(e) => set({ claim_number: e.target.value })} /></div>
              <div><Label>Nº da apólice</Label><Input value={claim.policy_number || ""} onChange={(e) => set({ policy_number: e.target.value })} /></div>
              <div><Label>Nº do processo</Label><Input value={claim.process_number || ""} onChange={(e) => set({ process_number: e.target.value })} /></div>
              <div><Label>Nº da participação</Label><Input value={claim.report_number || ""} onChange={(e) => set({ report_number: e.target.value })} /></div>
              <div><Label>Data do sinistro</Label><Input type="date" value={claim.claim_date || ""} onChange={(e) => set({ claim_date: e.target.value })} /></div>
              <div><Label>Data da participação</Label><Input type="date" value={claim.report_date || ""} onChange={(e) => set({ report_date: e.target.value })} /></div>
              <div>
                <Label>Tipo de sinistro</Label>
                <Select value={claim.claim_type || ""} onValueChange={(v) => set({ claim_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{CLAIM_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Responsabilidade</Label>
                <Select value={claim.liability || ""} onValueChange={(v) => set({ liability: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{LIABILITY_OPTIONS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Cobertura</Label><Input value={claim.coverage || ""} onChange={(e) => set({ coverage: e.target.value })} /></div>
              <div><Label>Franquia</Label><Input type="number" step="0.01" value={claim.deductible ?? ""} onChange={(e) => set({ deductible: e.target.value })} /></div>
              <div><Label>Local do sinistro</Label><Input value={claim.location || ""} onChange={(e) => set({ location: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Descrição</Label><Textarea rows={3} value={claim.description || ""} onChange={(e) => set({ description: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={claim.notes || ""} onChange={(e) => set({ notes: e.target.value })} /></div>
            </CardContent>
          </Card>

          {insurer && (
            <Card>
              <CardHeader><CardTitle className="text-base">Contactos da seguradora</CardTitle></CardHeader>
              <CardContent className="text-sm space-y-1">
                <p className="font-semibold">{insurer.name}</p>
                {insurer.claims_contact && <p className="text-muted-foreground">Gestor: {insurer.claims_contact}</p>}
                {(insurer.claims_phone || insurer.phone) && <p className="flex items-center gap-2"><Phone className="w-3.5 h-3.5" />{insurer.claims_phone || insurer.phone}</p>}
                {(insurer.claims_email || insurer.email) && <p className="flex items-center gap-2"><Mail className="w-3.5 h-3.5" />{insurer.claims_email || insurer.email}</p>}
                {insurer.website && <p className="flex items-center gap-2"><Globe className="w-3.5 h-3.5" /><a className="text-primary underline" href={insurer.website} target="_blank" rel="noreferrer">{insurer.website}</a></p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contactos */}
        <TabsContent value="contacts" className="space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" className="min-h-[44px]" onClick={() => setContactOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Adicionar contacto
            </Button>
          </div>
          {contacts.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Sem contactos registados.</CardContent></Card>
          ) : contacts.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 flex items-start justify-between gap-3">
                <div className="space-y-0.5 text-sm">
                  <p className="font-semibold flex items-center gap-2">
                    {c.name}
                    {c.is_primary && <Star className="w-3.5 h-3.5 text-primary fill-primary" />}
                    <Badge variant="outline">{CONTACT_KIND_LABELS[c.kind] || c.kind}</Badge>
                  </p>
                  {(c.company || c.role) && <p className="text-muted-foreground">{[c.company, c.role].filter(Boolean).join(" · ")}</p>}
                  {c.phone && <p className="text-muted-foreground">{c.phone}</p>}
                  {c.email && <p className="text-muted-foreground">{c.email}</p>}
                  {c.notes && <p className="text-muted-foreground">{c.notes}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => removeContact(c.id)}><Trash2 className="w-4 h-4" /></Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Peritagem */}
        <TabsContent value="expert">
          <Card>
            <CardHeader><CardTitle className="text-base">Peritagem</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Estado</Label>
                <Select value={claim.expert_status || "not_scheduled"} onValueChange={(v) => set({ expert_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EXPERT_STATUSES.map((s) => <SelectItem key={s} value={s}>{EXPERT_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Data</Label><Input type="date" value={claim.expert_date || ""} onChange={(e) => set({ expert_date: e.target.value })} /></div>
                <div><Label>Hora</Label><Input type="time" value={claim.expert_time || ""} onChange={(e) => set({ expert_time: e.target.value })} /></div>
              </div>
              <div><Label>Local</Label><Input value={claim.expert_location || ""} onChange={(e) => set({ expert_location: e.target.value })} /></div>
              <div><Label>Perito</Label><Input value={claim.expert_name || ""} onChange={(e) => set({ expert_name: e.target.value })} /></div>
              <div><Label>Empresa de peritagem</Label><Input value={claim.expert_company || ""} onChange={(e) => set({ expert_company: e.target.value })} /></div>
              <div><Label>Contacto</Label><Input value={claim.expert_contact || ""} onChange={(e) => set({ expert_contact: e.target.value })} /></div>
              <div><Label>Nº do relatório</Label><Input value={claim.expert_report_number || ""} onChange={(e) => set({ expert_report_number: e.target.value })} /></div>
              <div><Label>Data de realização</Label><Input type="date" value={claim.expert_done_date || ""} onChange={(e) => set({ expert_done_date: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Resultado</Label><Textarea rows={2} value={claim.expert_result || ""} onChange={(e) => set({ expert_result: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={claim.expert_notes || ""} onChange={(e) => set({ expert_notes: e.target.value })} /></div>
              <p className="md:col-span-2 text-xs text-muted-foreground">
                Relatórios e fotografias da peritagem anexam-se no separador Documentos (categoria Peritagem).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Orçamento + aprovação */}
        <TabsContent value="quote" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Orçamento</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Orçamento associado</Label>
                <div className="flex gap-2">
                  <Select value={claim.quote_id || ""} onValueChange={(v) => set({ quote_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecionar orçamento do cliente" /></SelectTrigger>
                    <SelectContent>
                      {quotes.map((q) => (
                        <SelectItem key={q.id} value={q.id}>{q.number} — {formatMoney(Number(q.total))}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" onClick={() => navigate(`/quotes/new?client=${claim.client_id}&vehicle=${claim.vehicle_id}&claim=${claim.id}`)}>Criar orçamento</Button>
                  {claim.quote_id && (
                    <Button variant="outline" onClick={() => navigate(`/quotes/edit/${claim.quote_id}`)}>Abrir</Button>
                  )}
                </div>
              </div>
              <div><Label>Valor solicitado</Label><Input type="number" step="0.01" value={claim.amount_requested ?? ""} onChange={(e) => set({ amount_requested: e.target.value })} /></div>
              <div><Label>Valor autorizado</Label><Input type="number" step="0.01" value={claim.amount_approved ?? ""} onChange={(e) => set({ amount_approved: e.target.value })} /></div>
              <div><Label>Valor não aprovado</Label><Input type="number" step="0.01" value={claim.amount_rejected ?? ""} onChange={(e) => set({ amount_rejected: e.target.value })} /></div>
              <div><Label>Franquia</Label><Input type="number" step="0.01" value={claim.deductible ?? ""} onChange={(e) => set({ deductible: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Observações da seguradora</Label><Textarea rows={2} value={claim.insurer_quote_notes || ""} onChange={(e) => set({ insurer_quote_notes: e.target.value })} /></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Autorização da reparação</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Estado</Label>
                <Select value={claim.approval_status || "waiting"} onValueChange={(v) => set({ approval_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{APPROVAL_STATUSES.map((s) => <SelectItem key={s} value={s}>{APPROVAL_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data</Label><Input type="date" value={claim.approval_date || ""} onChange={(e) => set({ approval_date: e.target.value })} /></div>
              <div><Label>Quem autorizou</Label><Input value={claim.approved_by || ""} onChange={(e) => set({ approved_by: e.target.value })} /></div>
              <div><Label>Referência / autorização</Label><Input value={claim.approval_reference || ""} onChange={(e) => set({ approval_reference: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Observações</Label><Textarea rows={2} value={claim.approval_notes || ""} onChange={(e) => set({ approval_notes: e.target.value })} /></div>
              <p className="md:col-span-2 text-xs text-muted-foreground">
                O email ou documento de autorização anexa-se em Documentos (categoria Autorização).
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comunicações */}
        <TabsContent value="comms" className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" className="min-h-[44px]" onClick={() => openComm("email")}><Mail className="w-4 h-4 mr-2" />Enviar email</Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => openComm("phone")}><Phone className="w-4 h-4 mr-2" />Registar chamada</Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => openComm("portal")}><Globe className="w-4 h-4 mr-2" />Portal externo</Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => openComm("email_in")}><Mail className="w-4 h-4 mr-2" />Email recebido</Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => openComm("whatsapp")}><Phone className="w-4 h-4 mr-2" />WhatsApp</Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => openComm("in_person")}><FileText className="w-4 h-4 mr-2" />Presencial</Button>
            <Button variant="outline" className="min-h-[44px]" onClick={() => openComm("note")}><FileText className="w-4 h-4 mr-2" />Nota interna</Button>
          </div>
          {comms.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Sem comunicações registadas.</CardContent></Card>
          ) : comms.map((c) => (
            <Card key={c.id}>
              <CardContent className="p-4 space-y-1 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{COMM_KIND_LABELS[c.kind] || c.kind}</Badge>
                  <Badge variant="outline" className={c.status === "sent" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-400 border-amber-500/30"}>
                    {COMM_STATUS_LABELS[c.status] || c.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{dt(c.occurred_at)}</span>
                  {c.user_name && <span className="text-xs text-muted-foreground">· {c.user_name}</span>}
                  {c.kind === "email" && c.status === "prepared" && (
                    <Button size="sm" variant="ghost" onClick={() => markCommSent(c.id)}>
                      <CheckCircle2 className="w-4 h-4 mr-1" />Marcar como enviado
                    </Button>
                  )}
                </div>
                {c.contact_label && <p className="text-muted-foreground">Contacto: {c.contact_label}</p>}
                {c.subject && <p className="font-semibold">{c.subject}</p>}
                {c.body && <p className="whitespace-pre-wrap text-muted-foreground">{c.body}</p>}
                {c.duration_minutes != null && <p className="text-muted-foreground">Duração: {c.duration_minutes} min</p>}
                {c.portal_name && <p className="text-muted-foreground">Portal: {c.portal_name} {c.portal_reference ? `· ref. ${c.portal_reference}` : ""}</p>}
                {c.outcome && <p className="text-muted-foreground">Resultado: {c.outcome}</p>}
                {c.next_step && <p className="text-muted-foreground">Próximo passo: {c.next_step} {c.next_contact_date ? `(${c.next_contact_date})` : ""}</p>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Documentos */}
        <TabsContent value="docs" className="space-y-3">
          <Card>
            <CardContent className="p-4 flex flex-col sm:flex-row gap-2 items-stretch sm:items-end">
              <div className="flex-1">
                <Label>Categoria</Label>
                <Select value={docCategory} onValueChange={setDocCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{DOC_CATEGORIES.map((d) => <SelectItem key={d} value={d}>{DOC_CATEGORY_LABELS[d]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <input ref={fileRef} type="file" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadDoc(f); e.target.value = ""; }} />
              <Button className="min-h-[44px]" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Paperclip className="w-4 h-4 mr-2" />{uploading ? "A carregar…" : "Anexar documento"}
              </Button>
            </CardContent>
          </Card>
          {docs.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Sem documentos.</CardContent></Card>
          ) : docs.map((d) => (
            <Card key={d.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">{DOC_CATEGORY_LABELS[d.category] || d.category} · {dt(d.created_at)}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" asChild>
                    <a href={d.file_url} target="_blank" rel="noreferrer"><Download className="w-4 h-4" /></a>
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => removeDoc(d.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-2">
          {events.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Sem histórico.</CardContent></Card>
          ) : events.map((e) => (
            <div key={e.id} className="flex gap-3 items-start border-l-2 border-border pl-4 py-2">
              <Clock className="w-4 h-4 text-muted-foreground mt-0.5" />
              <div className="text-sm">
                <p>{eventText(e)}</p>
                <p className="text-xs text-muted-foreground">{dt(e.created_at)}{e.created_by && members[e.created_by] ? ` · ${members[e.created_by]}` : ""}</p>
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Dialog contacto */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Adicionar contacto</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={contactForm.kind} onValueChange={(v) => setContactForm({ ...contactForm, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CONTACT_KINDS.map((k) => <SelectItem key={k} value={k}>{CONTACT_KIND_LABELS[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nome *</Label><Input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Empresa</Label><Input value={contactForm.company} onChange={(e) => setContactForm({ ...contactForm, company: e.target.value })} /></div>
              <div><Label>Função</Label><Input value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })} /></div>
              <div><Label>Email</Label><Input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} /></div>
            </div>
            <div><Label>Observações</Label><Textarea rows={2} value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} /></div>
            <div className="flex items-center gap-2">
              <Switch checked={contactForm.is_primary} onCheckedChange={(v) => setContactForm({ ...contactForm, is_primary: v })} />
              <Label>Contacto principal</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setContactOpen(false)}>Cancelar</Button>
            <Button onClick={saveContact}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog comunicação */}
      <Dialog open={commOpen} onOpenChange={setCommOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{COMM_KIND_LABELS[commKind]}</DialogTitle>
            {commKind === "email" && (
              <DialogDescription>
                A mensagem é preparada aqui. Copie ou abra o seu email para a enviar e depois marque como enviada.
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data e hora</Label><Input type="datetime-local" value={commForm.occurred_at || ""} onChange={(e) => setCommForm({ ...commForm, occurred_at: e.target.value })} /></div>
              <div>
                <Label>Contacto</Label>
                <Input value={commForm.contact_label || ""} onChange={(e) => setCommForm({ ...commForm, contact_label: e.target.value })}
                  placeholder={commKind === "email" ? "email@seguradora.pt" : "Nome / telefone"} />
              </div>
            </div>

            {contacts.length > 0 && (
              <div>
                <Label>Usar contacto do processo</Label>
                <Select value={commForm.contact_id || ""} onValueChange={(v) => {
                  const c = contacts.find((x) => x.id === v);
                  setCommForm({ ...commForm, contact_id: v, contact_label: commKind === "email" ? (c?.email || "") : (c?.phone || c?.name || "") });
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{contacts.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} — {CONTACT_KIND_LABELS[c.kind]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {commKind === "email" && (
              <div>
                <Label>Modelo</Label>
                <Select value={commForm.template} onValueChange={applyTemplate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CLAIM_EMAIL_TEMPLATES.map((t) => <SelectItem key={t.key} value={t.key}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}

            {commKind === "portal" && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome do portal</Label><Input value={commForm.portal_name || ""} onChange={(e) => setCommForm({ ...commForm, portal_name: e.target.value })} /></div>
                <div><Label>URL</Label><Input value={commForm.portal_url || ""} onChange={(e) => setCommForm({ ...commForm, portal_url: e.target.value })} /></div>
                <div className="col-span-2"><Label>Referência / protocolo</Label><Input value={commForm.portal_reference || ""} onChange={(e) => setCommForm({ ...commForm, portal_reference: e.target.value })} /></div>
              </div>
            )}

            {commKind === "phone" && (
              <div><Label>Duração (minutos)</Label><Input type="number" value={commForm.duration_minutes || ""} onChange={(e) => setCommForm({ ...commForm, duration_minutes: e.target.value })} /></div>
            )}

            <div><Label>Assunto</Label><Input value={commForm.subject || ""} onChange={(e) => setCommForm({ ...commForm, subject: e.target.value })} /></div>
            <div><Label>{commKind === "email" ? "Mensagem" : "Descrição / resumo"}</Label>
              <Textarea rows={commKind === "email" ? 10 : 4} value={commForm.body || ""} onChange={(e) => setCommForm({ ...commForm, body: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Resultado</Label><Input value={commForm.outcome || ""} onChange={(e) => setCommForm({ ...commForm, outcome: e.target.value })} /></div>
              <div><Label>Próximo passo</Label><Input value={commForm.next_step || ""} onChange={(e) => setCommForm({ ...commForm, next_step: e.target.value })} /></div>
            </div>
            <div><Label>Data do próximo contacto</Label><Input type="date" value={commForm.next_contact_date || ""} onChange={(e) => setCommForm({ ...commForm, next_contact_date: e.target.value })} /></div>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {commKind === "email" && (
              <>
                <Button variant="outline" onClick={copyEmail}><Copy className="w-4 h-4 mr-2" />Copiar</Button>
                <Button variant="outline" onClick={openMailClient}><Mail className="w-4 h-4 mr-2" />Abrir no email</Button>
                <Button variant="outline" onClick={() => saveComm(true)}><CheckCircle2 className="w-4 h-4 mr-2" />Guardar como enviado</Button>
              </>
            )}
            <Button onClick={() => saveComm(false)}>
              <CalendarClock className="w-4 h-4 mr-2" />{commKind === "email" ? "Guardar como preparado" : "Guardar registo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
