import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { clientDisplayName } from "@/lib/clientDisplayName";
import { claimVehicleLabel } from "@/lib/claimVehicle";
import { Accordion } from "@/components/ui/accordion";
import { ClaimSection } from "@/components/claims/ClaimSection";
import { useParams, useNavigate } from "react-router-dom";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { useShopCountry } from "@/hooks/useShopCountry";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { InsurerPicker, resolveInsurerId, type InsurerSelection } from "@/components/InsurerPicker";
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
  ArrowLeft, Save, ShieldAlert, Send, Eye, MoreHorizontal, Phone, Mail, Globe, Paperclip, Plus, Copy,
  Trash2, FileText, Clock, CheckCircle2, CalendarClock, Download, Star,
} from "lucide-react";
import { toast } from "sonner";
import { formatMoney } from "@/lib/money";
import { ClaimBillingLines } from "@/components/claims/ClaimBillingLines";
import { ClaimSupplements } from "@/components/claims/ClaimSupplements";
import { ClaimTotalLoss } from "@/components/claims/ClaimTotalLoss";
import { ClaimImmobilization } from "@/components/claims/ClaimImmobilization";
import { ClaimDocumentsV2 } from "@/components/claims/ClaimDocumentsV2";
import { ClaimSplitBilling } from "@/components/claims/ClaimSplitBilling";
import { ClaimDeadlines } from "@/components/claims/ClaimDeadlines";
import { ClaimClientInformed, sendClientEmail } from "@/components/claims/ClaimClientInformed";
import { ClaimPhaseBar } from "@/components/claims/ClaimPhaseBar";
import { createExpertLink, getClientLink } from "@/components/claims/claimShare";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  computeRepairPhase, computeTotalLossPhase, phaseBadge, nextStep, isPendingSup, clientMessageForPhase,
  STATUS_TO_PHASE, PHASE_TO_STATUS, REPAIR_PHASES, REPAIR_PHASE_LABELS, authorizedTotal, type Sup,
} from "@/lib/claimPhases";
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


export default function ClaimDetail() {
  const IS_BR = useShopCountry().code === "BR";
  const DOC = IS_BR ? "Nota fiscal" : "Fatura";
  const LOC = IS_BR ? "pt-BR" : "pt-PT";
  const dt = (v: string | null) => v ? new Date(v).toLocaleString(LOC) : "—";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const activeShopId = useActiveShopId();

  const [claim, setClaim] = useState<any>(null);
  const [insurers, setInsurers] = useState<any[]>([]);
  const [insSel, setInsSel] = useState<InsurerSelection>(null);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [comms, setComms] = useState<any[]>([]);
  const [docs, setDocs] = useState<any[]>([]);
  const [fin, setFin] = useState<{ invoices: any[]; payments: any[] } | null>(null);
  const loadFin = async () => {
    if (!id || !activeShopId) return;
    const { data: iv } = await (supabase as any).from("invoices").select("id, number, total, status, client_id, clients(name, company)").eq("claim_id", id).eq("shop_id", activeShopId).order("created_at");
    const ids = (iv || []).map((i: any) => i.id);
    const { data: py } = ids.length ? await supabase.from("payments").select("amount, invoice_id").in("invoice_id", ids) : { data: [] as any[] };
    setFin({ invoices: iv || [], payments: py || [] });
  };
  useEffect(() => { void loadFin(); }, [id, activeShopId]);
  const [events, setEvents] = useState<any[]>([]);
  const [sups, setSups] = useState<Sup[]>([]);
  const [links, setLinks] = useState<any[]>([]);
  const [sections, setSections] = useState<string[]>([]);
  const [expertOpen, setExpertOpen] = useState(false);
  const [expertSupId, setExpertSupId] = useState("");
  const [expertBusy, setExpertBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState("new");
  const [wos, setWos] = useState<any[]>([]);
  const [invs, setInvs] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [persistedProcess, setPersistedProcess] = useState<{ claim: any; sups: Sup[] } | null>(null);

  const load = useCallback(async () => {
    if (!id || !activeShopId) return;
    const [c, ins, ct, cm, dc, ev] = await Promise.all([
      supabase.from("claims")
        .select("*, insurers(*), clients(id, name, company, nif, email, phone), vehicles(id, make, model, plate, year, version, vin, mileage, fuel), work_orders(id, number, status, total)")
        .eq("id", id).eq("shop_id", activeShopId).maybeSingle(),
      supabase.from("insurers").select("*").eq("shop_id", activeShopId).order("name"),
      supabase.from("claim_contacts").select("*").eq("claim_id", id).eq("shop_id", activeShopId).order("is_primary", { ascending: false }),
      supabase.from("claim_communications").select("*").eq("claim_id", id).eq("shop_id", activeShopId).order("occurred_at", { ascending: false }),
      supabase.from("claim_documents").select("*").eq("claim_id", id).eq("shop_id", activeShopId).order("created_at", { ascending: false }),
      supabase.from("claim_events").select("*").eq("claim_id", id).eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(200),
    ]);
    if (!c.data) { toast.error("Sinistro não encontrado"); navigate("/claims"); return; }
    setClaim(c.data);
    setInsurers(ins.data || []);
    setContacts(ct.data || []);
    setComms(cm.data || []);
    setDocs(dc.data || []);
    setEvents(ev.data || []);
    const [sp, lk] = await Promise.all([
      (supabase as any).from("claim_supplements").select("*").eq("claim_id", id).eq("shop_id", activeShopId).order("created_at"),
      (supabase as any).from("claim_share_links").select("supplement_id, created_at, audience").eq("claim_id", id).eq("shop_id", activeShopId).order("created_at", { ascending: false }),
    ]);
    setSups(sp.data || []);
    setLinks(lk.data || []);
    if (c.data.client_id) {
      const q = await supabase.from("quotes")
        .select("id, number, total, status, date")
        .eq("shop_id", activeShopId).eq("client_id", c.data.client_id)
        .order("created_at", { ascending: false }).limit(50);
      setQuotes(q.data || []);
      const [w, iv] = await Promise.all([
        supabase.from("work_orders").select("id, number, status, total, vehicle_id")
          .eq("shop_id", activeShopId).eq("client_id", c.data.client_id).order("created_at", { ascending: false }).limit(50),
        supabase.from("invoices").select("id, number, total, status, created_at, clients(name, company)")
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
    setPersistedProcess({ claim: c.data, sups: sp.data || [] });
    setLoading(false);
  }, [id, activeShopId, navigate]);

  useEffect(() => { load(); }, [load]);

  // Live: same claim edited by another user (owner/technician) shows up here.
  const liveOpts = { onChange: () => { void load(); }, enabled: !!id, debounceMs: 400 };
  useRealtimeTable("claims", { ...liveOpts, filter: `id=eq.${id}`, event: "UPDATE" });
  useRealtimeTable("claim_events", { ...liveOpts, filter: `claim_id=eq.${id}` });
  useRealtimeTable("claim_communications", { ...liveOpts, filter: `claim_id=eq.${id}` });
  useRealtimeTable("claim_documents", { ...liveOpts, filter: `claim_id=eq.${id}` });
  useRealtimeTable("claim_supplements", { ...liveOpts, filter: `claim_id=eq.${id}` });
  useRealtimeTable("work_orders", { ...liveOpts, filter: `id=eq.${claim?.work_order_id}`, enabled: !!claim?.work_order_id });
  useRealtimeTable("invoices", { ...liveOpts, filter: `claim_id=eq.${id}`, onChange: () => { void loadFin(); void load(); } });
  useRealtimeTable("payments", { ...liveOpts, shopId: activeShopId, onChange: () => { void loadFin(); } });

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
    let insurerId = claim.insurer_id ?? null;
    if (!patch && insSel && !insSel.insurerId && activeShopId) {
      try { insurerId = await resolveInsurerId(activeShopId, insSel); }
      catch (e: any) { setSaving(false); toast.error(e.message || "Erro na seguradora"); return; }
    }
    const payload = patch ?? {
      insurer_id: insurerId, claim_number: claim.claim_number, policy_number: claim.policy_number,
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
      amount_approved: sups.length ? authorizedTotal(sups) : num(claim.amount_approved),
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
    const { error } = await supabase.from("claims").update(payload).eq("id", claim.id).eq("shop_id", activeShopId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sinistro guardado");
    if (!patch) setInsSel(null);
    load();
  };

  const ctx = useMemo(() => ({
    insurer: claim?.insurers?.name,
    claim_number: claim?.claim_number,
    policy_number: claim?.policy_number,
    client: clientDisplayName(claim?.clients),
    vehicle: claim?.vehicles ? `${claim.vehicles.make} ${claim.vehicles.model}` : "",
    plate: claim?.vehicles?.plate,
    wo_number: claim?.work_orders?.number,
    quote_number: quotes.find((q) => q.id === claim?.quote_id)?.number,
    amount: claim?.amount_requested != null ? formatMoney(Number(claim.amount_requested)) : undefined,
  }), [claim, quotes]);


  /* ---------------- Fases (v2): avanço automático ---------------- */
  const repairPhase = useMemo(() => {
    if (!claim) return "entrada" as const;
    const live = (fin?.invoices || []).filter((i: any) => !["cancelled", "draft"].includes(i.status));
    const billed = live.reduce((t: number, i: any) => t + Number(i.total || 0), 0);
    const liveIds = new Set(live.map((i: any) => i.id));
    const paid = (fin?.payments || []).filter((p: any) => liveIds.has(p.invoice_id)).reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
    const woDone = ["completed", "done", "delivered", "ready", "invoiced"].includes(String(claim.work_orders?.status || ""));
    return computeRepairPhase(claim, { sups, woDone, billedAndPaid: billed > 0 && paid >= billed - 0.01 });
  }, [claim, sups, fin]);

  const observedPhase = useRef<{ id: string; phase: string } | null>(null);
  useEffect(() => {
    if (!persistedProcess || !fin) return;
    const saved = persistedProcess.claim;
    const live = fin.invoices.filter((i: any) => !["cancelled", "draft"].includes(i.status));
    const billed = live.reduce((t: number, i: any) => t + Number(i.total || 0), 0);
    const paid = fin.payments.filter((p: any) => live.some((i: any) => i.id === p.invoice_id)).reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
    const current = saved.outcome === "perda_total" || saved.total_loss ? computeTotalLossPhase(saved) : computeRepairPhase(saved, {
      sups: persistedProcess.sups,
      woDone: ["completed", "done", "delivered", "ready", "invoiced"].includes(String(saved.work_orders?.status || "")),
      billedAndPaid: billed > 0 && paid >= billed - 0.01,
    });
    const prev = observedPhase.current;
    observedPhase.current = { id: saved.id, phase: current };
    if (prev?.id === saved.id && prev.phase !== current && saved.auto_notify_client) void notifyClient(current, persistedProcess.sups.some(isPendingSup));
  }, [persistedProcess, fin]);

  const notifyClient = async (ph: string, pendingSup: boolean) => {
    if (!claim?.auto_notify_client || !activeShopId) return;
    const msg = clientMessageForPhase(ph, IS_BR, pendingSup);
    if (claim.clients?.email) {
      const link = await getClientLink(claim, activeShopId);
      const sent = await sendClientEmail(claim, activeShopId, msg, link, IS_BR);
      if (sent) await supabase.from("claims").update({ last_client_message: msg, last_client_message_at: new Date().toISOString(), client_informed_at: new Date().toISOString(), client_informed_note: "email automático" } as any).eq("id", claim.id).eq("shop_id", activeShopId);
    }
  };

  const changeOutcome = async (o: "reparacao" | "perda_total") => {
    const { error } = await supabase.from("claims").update({ outcome: o, total_loss: o === "perda_total", ...(o === "perda_total" && !claim.total_loss_date ? { total_loss_date: new Date().toISOString().slice(0, 10) } : {}) } as any).eq("id", claim.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: activeShopId, kind: "note", description: o === "perda_total" ? "Processo marcado como perda total" : "Processo voltou ao fluxo de reparação" } as any);

    load();
  };

  const applyOverride = async (status: string | null) => {
    const { data: auth } = await supabase.auth.getSession();
    const who = auth.session?.user.email || "utilizador";
    const patch: any = status ? { status, phase_override: STATUS_TO_PHASE[status] || null } : { phase_override: null };
    const { error } = await supabase.from("claims").update(patch).eq("id", claim.id);
    if (error) { toast.error(error.message); return; }
    await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: activeShopId, kind: "status", description: status ? `Estado corrigido manualmente por ${who}: ${CLAIM_STATUS_LABELS[status] || status}` : `Cálculo automático retomado por ${who}`, meta: status ? { to: status, manual: true } : {} } as any);
    setOverrideOpen(false); toast.success("Estado atualizado"); load();
  };

  const sendExpertPackage = async (supplementId?: string) => {
    if (!activeShopId) return;
    const pend = sups.filter(isPendingSup).sort((a, b) => (a.type === "inicial" ? -1 : (a.number || 0) - (b.number || 0)))[0];
    if (!pend) { toast.error("Registe primeiro o orçamento inicial ou um adicional para o perito validar."); return; }
    setExpertSupId(supplementId || pend.id);
    setExpertOpen(true);
  };
  const deliverExpertPackage = async (delivery: "copy" | "email") => {
    if (!activeShopId || !expertSupId || expertBusy) return;
    setExpertBusy(true);
    try {
      const url = await createExpertLink(claim, activeShopId, expertSupId, delivery);
      if (url) { setExpertOpen(false); void load(); }
    } finally { setExpertBusy(false); }
  };
  const openClientView = async () => {
    if (!activeShopId) return;
    const w = window.open("about:blank", "_blank");
    const url = await getClientLink(claim, activeShopId);
    if (url) { if (w) w.location.href = url; else window.location.href = url; } else w?.close();
  };

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

  if (loading || !claim) {
    return <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  const insurer = claim.insurers;

  const isLoss = claim.outcome === "perda_total" || claim.total_loss;
  const phase = isLoss ? computeTotalLossPhase(claim) : repairPhase;
  const badge = phaseBadge({ ...claim, outcome: isLoss ? "perda_total" : "reparacao" }, phase, sups, IS_BR);
  const badgeTone: Record<string, string> = { amber: "claim-tone-warning", blue: "claim-tone-info", red: "claim-tone-danger", green: "claim-tone-success", gray: "bg-muted text-muted-foreground border-border" };
  const ddmm = (v: string | null | undefined) => (v ? new Date(v).toLocaleDateString(LOC, { day: "2-digit", month: "2-digit" }) : "");
  const initialSup = sups.find((s) => s.type === "inicial");
  const subs: Record<string, string> = {
    entrada: ddmm(claim.vehicle_in_date || claim.report_date || claim.created_at),
    peritagem: claim.expert_done_date ? `Feita ${ddmm(claim.expert_done_date)}` : claim.expert_date ? `Marcada ${ddmm(claim.expert_date)}` : "",
    autorizacao: sups.some(isPendingSup) ? "À espera do perito" : initialSup?.decided_at ? `Autorizada ${ddmm(initialSup.decided_at)}` : "",
    reparacao: claim.status === "waiting_parts" ? (IS_BR ? "Aguardando peças" : "A aguardar peças") : claim.work_orders?.number ? `OS ${claim.work_orders.number}` : "",
    faturacao: fin?.invoices?.length ? `${fin.invoices.filter((i: any) => i.status !== "cancelled").length} ${IS_BR ? "nota(s)" : "fatura(s)"}` : "",
    perda_total: ddmm(claim.total_loss_date),
    decisao: claim.client_decision && claim.client_decision !== "pending" ? `Decidido ${ddmm(claim.client_decision_date)}` : "",
    fechado: ddmm(claim.closed_at),
  };
  const nextText = nextStep({ ...claim, outcome: isLoss ? "perda_total" : "reparacao" }, phase, sups, links, IS_BR);
  const focusSection = isLoss ? "loss" : ["entrada", "peritagem"].includes(phase) ? "documents" : phase === "autorizacao" ? "authorization" : phase === "reparacao" ? "work" : "billing";
  const focusLabel = isLoss ? "Ver decisão e encargos" : focusSection === "documents" ? "Ver documentos" : focusSection === "authorization" ? "Ver orçamento e autorizações" : focusSection === "work" ? "Abrir reparação" : IS_BR ? "Ver notas fiscais" : "Ver faturação";
  const openSection = (value: string) => {
    setSections((current) => current.includes(value) ? current : [...current, value]);
    window.setTimeout(() => document.getElementById(`claim-section-${value}`)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" }), 100);
  };

  return (
    <div className="claims-surface space-y-5 max-w-7xl mx-auto pb-24">
      {/* 1. Cabeçalho */}
      <div className="flex flex-col xl:flex-row xl:items-start gap-3">
        <div className="flex items-start gap-2 flex-1 min-w-0">
          <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px]" aria-label="Voltar" onClick={() => navigate("/claims")}><ArrowLeft className="w-5 h-5" /></Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{claim.ref || "Sinistro"}</h1>
              <Badge variant="outline" className={badgeTone[badge.tone]}>{badge.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {[
                claim.vehicles ? [claim.vehicles.make, claim.vehicles.model].filter(Boolean).join(" ") : null,
                claim.vehicles?.plate,
                clientDisplayName(claim.clients),
                insurer?.name,
                (claim.process_number || claim.claim_number) ? `Proc. nº ${claim.process_number || claim.claim_number}` : null,
              ].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] sm:flex sm:flex-wrap gap-2">
          <Button variant="outline" className="min-h-[44px] col-span-2 sm:order-3" onClick={openClientView}><Eye className="w-4 h-4 mr-2" />Ver o que o cliente vê</Button>
          <Button variant="outline" className="min-h-[44px] sm:order-2" onClick={() => sendExpertPackage()}><Send className="w-4 h-4 mr-2" />Enviar pacote ao perito</Button>
          <Button variant="outline" className="min-h-[44px] hidden sm:inline-flex sm:order-1" onClick={() => setHistoryOpen(true)}><Clock className="w-4 h-4 mr-2" />Ver histórico</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="icon" className="min-h-[44px] min-w-[44px] sm:order-4" aria-label="Mais opções"><MoreHorizontal className="w-5 h-5" /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="sm:hidden" onClick={() => setHistoryOpen(true)}>Ver histórico</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setOverrideStatus(claim.status); setOverrideOpen(true); }}>Corrigir estado manualmente</DropdownMenuItem>
              {claim.phase_override && <DropdownMenuItem onClick={() => applyOverride(null)}>Voltar ao cálculo automático</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 2. Onde está o processo */}
      <ClaimPhaseBar outcome={isLoss ? "perda_total" : "reparacao"} phase={phase} cancelled={claim.status === "cancelled"} subs={subs} next={nextText} onOutcome={changeOutcome} isBR={IS_BR} action={<Button className="min-h-[44px] w-full sm:w-auto" onClick={() => openSection(focusSection)}>{focusLabel}</Button>} />

      {/* 3. Duas colunas */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Accordion type="multiple" value={sections.length ? sections : [focusSection]} onValueChange={(values) => setSections(values.length ? values : ["collapsed"])} className="min-w-0">
          <div id="claim-section-documents" className="scroll-mt-4"><ClaimSection value="documents" title="Documentos e fotografias" summary={`${docs.length} ${docs.length === 1 ? "ficheiro" : "ficheiros"}`}>
            {activeShopId && <ClaimDocumentsV2 claimId={claim.id} shopId={activeShopId} docs={docs} isBR={IS_BR} onChanged={load} />}
          </ClaimSection></div>
          {!isLoss && <div id="claim-section-authorization" className="scroll-mt-4"><ClaimSection value="authorization" title="Orçamento e autorizações" summary={sups.length ? `${sups.filter(isPendingSup).length} pendente(s) · ${formatMoney(authorizedTotal(sups))} autorizado` : "Sem pedidos registados"}>
            {activeShopId && <ClaimSupplements claim={claim} shopId={activeShopId} sups={sups} quotes={quotes} isBR={IS_BR} onChanged={load} onSendExpert={(supId) => { void sendExpertPackage(supId); }} />}
          </ClaimSection></div>}
          {!isLoss && <div id="claim-section-work" className="scroll-mt-4"><ClaimSection value="work" title="Reparação" summary={claim.work_orders?.number || "Sem ordem de serviço associada"}>
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={claim.work_order_id || ""} onValueChange={(v) => link({ work_order_id: v })}><SelectTrigger className="min-h-[44px]"><SelectValue placeholder="Associar OS existente" /></SelectTrigger><SelectContent>{wos.filter((w) => !claim.vehicle_id || w.vehicle_id === claim.vehicle_id).map((w) => <SelectItem key={w.id} value={w.id}>{w.number} — {w.status}</SelectItem>)}</SelectContent></Select>
              <Button variant="outline" className="min-h-[44px]" onClick={() => claim.work_order_id ? navigate(`/services/edit/${claim.work_order_id}`) : createWorkOrder()}>{claim.work_order_id ? "Abrir OS" : "Criar OS"}</Button>
            </div>
          </ClaimSection></div>}
          {!isLoss && <div id="claim-section-billing" className="scroll-mt-4"><ClaimSection value="billing" title={IS_BR ? "Notas fiscais" : "Faturação"} summary={`${(fin?.invoices || []).filter((i: any) => i.status !== "cancelled").length} ${IS_BR ? "nota(s) fiscal(is)" : "fatura(s)"}`}>
            {activeShopId && <ClaimSplitBilling claim={claim} shopId={activeShopId} sups={sups} isBR={IS_BR} onChanged={() => { void loadFin(); }} />}
          </ClaimSection></div>}
          {isLoss && <div id="claim-section-loss" className="scroll-mt-4"><ClaimSection value="loss" title="Perda total · decisão e encargos">
            {activeShopId && <ClaimTotalLoss claim={claim} shopId={activeShopId} isBR={IS_BR} onSaved={load} />}
          </ClaimSection></div>}
        </Accordion>
        <Accordion type="multiple" className="min-w-0">
          <ClaimSection value="essential" title="Dados do processo" summary={[insurer?.name, claim.expert_name].filter(Boolean).join(" · ") || "Seguradora, franquia e perito"}>
          <Card className="rounded-[14px]">
            <CardHeader><CardTitle className="text-base">O essencial</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <InsurerPicker
                shopId={activeShopId}
                value={insSel ?? (claim.insurer_id ? { insurerId: claim.insurer_id } : null)}
                onChange={(v) => { setInsSel(v); if (!v) set({ insurer_id: null }); else if (v.insurerId) set({ insurer_id: v.insurerId }); }}
              />
              <div><Label>Nº do processo</Label><Input className="min-h-[44px]" placeholder="Está no relatório? Deixa vazio" value={claim.process_number || ""} onChange={(e) => set({ process_number: e.target.value })} /></div>
              <div><Label>Franquia ({IS_BR ? "R$" : "€"})</Label><Input className="min-h-[44px]" type="number" step="0.01" inputMode="decimal" value={claim.deductible ?? ""} onChange={(e) => set({ deductible: e.target.value })} /></div>
              <div className="grid grid-cols-1 gap-2">
                <div><Label>Perito</Label><Input className="min-h-[44px]" placeholder="Nome" value={claim.expert_name || ""} onChange={(e) => set({ expert_name: e.target.value })} /></div>
                <div><Input className="min-h-[44px]" placeholder="Email ou telefone do perito" value={claim.expert_contact || ""} onChange={(e) => set({ expert_contact: e.target.value })} /></div>
              </div>
              <Button className="w-full min-h-[44px]" onClick={() => persist()} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? "A guardar…" : "Guardar"}</Button>
              <Button variant="link" className="px-0 min-h-[44px]" aria-expanded={showMore} aria-controls="claim-more-details" onClick={() => setShowMore((v) => !v)}>
                {showMore ? "Esconder detalhes" : "Mais detalhes (opcional)"}
               </Button>
            </CardContent>
          </Card>
          </ClaimSection>
          <ClaimSection value="dates" title="Datas e imobilização" summary={claim.vehicle_in_date ? `Entrada: ${new Date(claim.vehicle_in_date).toLocaleDateString(LOC)}` : "Entrada, entrega e viatura de substituição"}><ClaimImmobilization claim={claim} isBR={IS_BR} onSaved={load} /></ClaimSection>
          {!IS_BR && <ClaimSection value="deadlines" title="Prazos da seguradora"><ClaimDeadlines claim={claim} sups={sups} onSaved={load} /></ClaimSection>}
          <ClaimSection value="client" title="Contacto com o cliente" summary={claim.client_informed_at ? `Última atualização: ${new Date(claim.client_informed_at).toLocaleDateString(LOC)}` : "Sem atualização registada"}>{activeShopId && <ClaimClientInformed claim={{ ...claim, claim_supplements: sups }} shopId={activeShopId} isBR={IS_BR} onSaved={load} />}</ClaimSection>
        </Accordion>
      </div>

      <Dialog open={expertOpen} onOpenChange={(open) => !expertBusy && setExpertOpen(open)}>
        <DialogContent className="claims-surface max-w-lg max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Pacote para o perito</DialogTitle><DialogDescription>{claim.ref} · {claim.process_number || claim.claim_number || "Sem nº de processo"}</DialogDescription></DialogHeader>
          <div className="border border-border rounded-lg p-3 space-y-1 text-sm">
            <p className="font-semibold break-words">{claimVehicleLabel(claim.vehicles) || "Sem viatura associada"}</p>
            {claim.vehicles?.vin && <p className="font-mono break-all">VIN / Chassis: {claim.vehicles.vin}</p>}
            <p className="text-muted-foreground">{claim.expert_name || "Perito não indicado"} · {claim.expert_contact || "Sem contacto"}</p>
          </div>
          <div><Label>Pedido a validar</Label><Select value={expertSupId} onValueChange={setExpertSupId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{sups.filter(isPendingSup).map((s) => <SelectItem key={s.id} value={s.id}>{s.type === "inicial" ? "Orçamento inicial" : `Adicional #${s.number}`} · {formatMoney(Number(s.amount_requested))}</SelectItem>)}</SelectContent></Select></div>
          <p className="text-sm text-muted-foreground">Dados da viatura, fotografias deste pedido e linhas do orçamento associado. Link válido durante 14 dias.</p>
          <DialogFooter className="gap-2"><Button variant="outline" disabled={expertBusy} onClick={() => deliverExpertPackage("copy")}><Copy className="w-4 h-4 mr-2" />Copiar link</Button><Button disabled={expertBusy || !String(claim.expert_contact || "").match(/[^\s@]+@[^\s@]+\.[^\s@]+/)} onClick={() => deliverExpertPackage("email")}><Mail className="w-4 h-4 mr-2" />{expertBusy ? "A preparar…" : "Enviar por email"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mais detalhes (opcional): todos os campos antigos, nenhum obrigatório */}
      {showMore && (
      <div id="claim-more-details" className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Mais detalhes (opcional)</h2>
        <Button onClick={() => persist()} disabled={saving} className="min-h-[44px] w-full sm:w-auto"><Save className="w-4 h-4 mr-2" />{saving ? "A guardar…" : "Guardar detalhes"}</Button>
      </div>
      <Tabs defaultValue="process">
        <div>
        <TabsList className="h-auto w-full grid grid-cols-1 gap-1 sm:flex sm:w-auto sm:flex-wrap">
          <TabsTrigger value="process" className="min-h-[40px]">Dados, contactos e peritagem</TabsTrigger>
          <TabsTrigger value="work" className="min-h-[40px]">Orçamento e OS</TabsTrigger>
          <TabsTrigger value="values" className="min-h-[40px]">{IS_BR ? "Valores e notas fiscais" : "Valores e faturas"}</TabsTrigger>
        </TabsList>
        </div>
        <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:items-end rounded-[14px] border border-border p-3">
          <div className="flex-1"><Label>Próxima ação (manual)</Label><Input value={claim.next_action || ""} onChange={(e) => set({ next_action: e.target.value })} placeholder="Ex.: aguardar resposta da seguradora" /></div>
          <div><Label>Data</Label><Input type="date" value={claim.next_action_date || ""} onChange={(e) => set({ next_action_date: e.target.value })} /></div>
          <div><Label>Responsável</Label><Input value={claim.next_action_owner || ""} onChange={(e) => set({ next_action_owner: e.target.value })} /></div>
        </div>

        {/* Reparação */}
        <TabsContent value="work" className="space-y-4">
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
            </CardContent>
          </Card>
        </TabsContent>

        {/* Valores + faturação */}
        <TabsContent value="values" className="space-y-4">
          {activeShopId && <ClaimBillingLines claimId={claim.id} shopId={activeShopId} isBR={IS_BR} hasInsurer={!!claim.insurer_id} />}
          {fin && fin.invoices.length > 0 && (() => {
            const live = fin.invoices.filter((i: any) => i.status !== "cancelled");
            const billed = live.reduce((t: number, i: any) => t + Number(i.total || 0), 0);
            const toClient = live.filter((i: any) => i.client_id === claim.client_id).reduce((t: number, i: any) => t + Number(i.total || 0), 0);
            const paid = fin.payments.reduce((t: number, p: any) => t + Number(p.amount || 0), 0);
            const rows: [string, number | null][] = [
              ["Valor autorizado", claim.amount_approved != null && claim.amount_approved !== "" ? Number(claim.amount_approved) : null],
              ["Franquia", claim.deductible != null && claim.deductible !== "" ? Number(claim.deductible) : null],
              [IS_BR ? "Total em notas fiscais" : "Total faturado", billed],
              [IS_BR ? "Notas fiscais a outras entidades (seguradora)" : "Faturado a outras entidades (seguradora)", billed - toClient],
              [IS_BR ? "Notas fiscais ao cliente" : "Faturado ao cliente", toClient],
              ["Pago", paid],
              ["Pendente", Math.max(0, billed - paid)],
            ];
            return (
              <Card>
                <CardHeader><CardTitle className="text-base">Resumo financeiro (calculado)</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {rows.filter(([, v]) => v != null).map(([l, v]) => (
                      <div key={l} className="rounded-lg border border-border p-3"><p className="text-xs text-muted-foreground">{l}</p><p className="font-semibold">{formatMoney(v as number)}</p></div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {fin.invoices.map((i: any) => (
                      <button key={i.id} type="button" onClick={() => navigate(`/invoices/${i.id}`)} className="w-full flex justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm min-h-[44px] hover:border-primary/50">
                        <span>{i.number || "—"} · {i.client_id === claim.client_id ? "Cliente" : (i.clients?.company || i.clients?.name || "Outra entidade")}</span>
                        <span className={i.status === "cancelled" ? "line-through text-muted-foreground" : ""}>{formatMoney(Number(i.total || 0))}</span>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{IS_BR ? "Calculado a partir das notas fiscais e pagamentos reais ligados a este sinistro." : "Calculado a partir das faturas e pagamentos reais ligados a este sinistro."}</p>
                </CardContent>
              </Card>
            );
          })()}
          <Card>
            <CardHeader><CardTitle className="text-base">Valores</CardTitle></CardHeader>
            <CardContent className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {([
                ["amount_initial_quote", "Orçamento inicial"], ["amount_expert", "Valor peritado"],
                ["amount_approved", "Valor autorizado"], ["deductible", "Franquia"],
                ["amount_invoiced", IS_BR ? "Valor da nota fiscal" : "Valor faturado"], ["amount_paid_insurer", "Pago pela seguradora"],
                ["amount_client", "A cargo do cliente"], ["amount_pending", "Pendente"],
              ] as const).map(([k, l]) => (
                <div key={k}><Label>{l} ({IS_BR ? "R$" : "€"})</Label><Input type="number" step="0.01" inputMode="decimal" value={claim[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })} /></div>
              ))}
              <p className="sm:col-span-2 text-xs text-muted-foreground">Os valores são registados pela oficina; o GarageFlow não decide quem paga cada parte.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">{IS_BR ? "Nota fiscal e pagamento" : "Faturação e pagamento"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={claim.invoice_id || ""} onValueChange={(v) => {
                  const inv = invs.find((i) => i.id === v);
                  link({ invoice_id: v, ...(inv && claim.amount_invoiced == null ? { amount_invoiced: inv.total } : {}) });
                  void (supabase as any).from("invoices").update({ claim_id: claim.id }).eq("id", v).then(() => loadFin());
                }}>
                  <SelectTrigger className="min-h-[44px]"><SelectValue placeholder={IS_BR ? "Associar nota fiscal existente" : "Associar fatura existente"} /></SelectTrigger>
                  <SelectContent>{invs.map((i) => <SelectItem key={i.id} value={i.id}>{i.number} — {formatMoney(Number(i.total))}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="outline" className="min-h-[44px]" onClick={() => navigate(`/invoices/new?from_claim=${claim.id}`)}>{IS_BR ? "Emitir nota fiscal (eNotas)" : "Emitir fatura"}</Button>
              </div>
              {(() => { const inv = invs.find((i) => i.id === claim.invoice_id); return inv ? (
                <div className="rounded-lg border border-border p-3 text-sm grid grid-cols-2 gap-1">
                  <span className="text-muted-foreground">Número</span><span>{inv.number}</span>
                  <span className="text-muted-foreground">Valor</span><span>{formatMoney(Number(inv.total))}</span>
                  <span className="text-muted-foreground">Entidade faturada</span><span>{clientDisplayName(inv.clients) || clientDisplayName(claim.clients)}</span>
                  <span className="text-muted-foreground">Data</span><span>{inv.created_at ? new Date(inv.created_at).toLocaleDateString(LOC) : "—"}</span>
                  <span className="text-muted-foreground">Estado</span><span>{inv.status}</span>
                </div>) : null; })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dados */}
        <TabsContent value="process" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Dados do sinistro</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div>
                <InsurerPicker
                  shopId={activeShopId}
                  value={insSel ?? (claim.insurer_id ? { insurerId: claim.insurer_id } : null)}
                  onChange={(v) => { setInsSel(v); if (!v) set({ insurer_id: null }); else if (v.insurerId) set({ insurer_id: v.insurerId }); }}
                />
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
        <TabsContent value="process" className="space-y-3">
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
        <TabsContent value="process">
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
        <TabsContent value="work" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Orçamento</CardTitle></CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Orçamento associado</Label>
                <div className="flex flex-col sm:flex-row gap-2">
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

      </Tabs>
      </div>
      )}

      {/* Histórico + comunicações (gaveta lateral) */}
      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="claims-surface w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader><SheetTitle>Histórico e comunicações</SheetTitle></SheetHeader>
          <Tabs defaultValue="timeline" className="mt-4">
            <TabsList><TabsTrigger value="timeline">Histórico</TabsTrigger><TabsTrigger value="comms">Comunicações</TabsTrigger></TabsList>
            <TabsContent value="timeline">
        <div className="space-y-2">
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
        </div>
            </TabsContent>
            <TabsContent value="comms">
        <div className="space-y-3">
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
                  <Badge variant="outline" className={c.status === "sent" ? "claim-tone-success" : "claim-tone-warning"}>
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
        </div>

            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Corrigir estado manualmente */}
      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="claims-surface max-w-md">
          <DialogHeader>
            <DialogTitle>Corrigir estado manualmente</DialogTitle>
            <DialogDescription>Só para exceções. Fica registado no histórico quem fez a correção.</DialogDescription>
          </DialogHeader>
          <Select value={overrideStatus} onValueChange={setOverrideStatus}>
            <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
            <SelectContent>{CLAIM_STATUSES.map((s) => <SelectItem key={s} value={s}>{CLAIM_STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter><Button className="min-h-[44px]" onClick={() => applyOverride(overrideStatus)}>Aplicar</Button></DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Dialog contacto */}
      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="claims-surface max-w-md max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="claims-surface max-w-2xl max-h-[90vh] overflow-y-auto">
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
