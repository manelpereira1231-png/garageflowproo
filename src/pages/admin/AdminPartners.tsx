import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import { useLanguage } from "@/i18n/LanguageContext";
import {
  Plus, Users, TrendingUp, DollarSign, Send, CreditCard, Copy, Shield, AlertTriangle,
  CheckCircle, Clock, XCircle, BarChart3, Trophy, Eye, Ban, Download, Smartphone, Banknote
} from "lucide-react";

const PRODUCTION_DOMAIN = "https://garageflow.pt";

interface Partner {
  id: string; name: string; type: string; contact_email: string; contact_phone: string;
  commission_percentage: number; discount_percentage: number; payout_method: string;
  status: string; created_at: string; api_key: string | null;
  payout_holder_name?: string; payout_iban?: string; payout_mbway_phone?: string; payout_bank?: string;
}
interface PartnerInvite {
  id: string; partner_id: string; workshop_email: string; workshop_name: string;
  workshop_phone: string; status: string; plan_offer: string; discount_percent: number;
  trial_days: number; created_at: string; accepted_at: string | null; invite_token: string;
}
interface Commission {
  id: string; partner_id: string; shop_id: string; amount: number; status: string;
  created_at: string; paid_at: string | null; currency: string;
}
interface Payout {
  id: string; partner_id: string; amount: number; currency: string; status: string;
  created_at: string; paid_at: string | null;
}
interface PartnerLog {
  id: string; partner_id: string | null; action: string; details: any; created_at: string;
}
interface Referral {
  id: string; partner_id: string; shop_id: string; commission_rate: number; created_at: string;
}

export default function AdminPartners() {
  const { t } = useLanguage();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [logs, setLogs] = useState<PartnerLog[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [detailPartner, setDetailPartner] = useState<Partner | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "", type: "affiliate", contact_email: "", contact_phone: "",
    commission_percentage: 10, discount_percentage: 0, payout_method: "bank_transfer",
  });
  const [inviteForm, setInviteForm] = useState({
    workshop_email: "", workshop_name: "", workshop_phone: "",
    plan_offer: "pro", discount_percent: 0, trial_days: 30,
  });

  const loadData = async () => {
    setLoading(true);
    const [p, i, c, po, lg, ref] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_invites").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_commissions").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_payouts").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("partner_referrals").select("*").order("created_at", { ascending: false }),
    ]);
    setPartners((p.data || []) as Partner[]);
    setInvites((i.data || []) as PartnerInvite[]);
    setCommissions((c.data || []) as Commission[]);
    setPayouts((po.data || []) as Payout[]);
    setLogs((lg.data || []) as PartnerLog[]);
    setReferrals((ref.data || []) as Referral[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const createPartner = async () => {
    if (!form.name.trim() || !form.contact_email.trim()) {
      toast.error(t('admin.partners.nameEmailRequired')); return;
    }
    if (partners.some(p => p.contact_email.toLowerCase() === form.contact_email.toLowerCase())) {
      toast.error(t('admin.partners.duplicateEmail')); return;
    }
    const { data, error } = await supabase.from("partners").insert([{
      ...form, commission_percentage: form.type === "affiliate" ? 10 : form.commission_percentage,
    }] as any).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      await supabase.from("partner_logs").insert({
        partner_id: (data as any).id, action: "partner_created_by_admin",
        details: { name: form.name, type: form.type, email: form.contact_email },
      } as any);
      await logAudit({ action: "partner_created", entityType: "partner", entityId: (data as any).id, details: { name: form.name } });
    }
    toast.success(t('admin.partners.created'));
    setShowCreate(false);
    setForm({ name: "", type: "affiliate", contact_email: "", contact_phone: "", commission_percentage: 10, discount_percentage: 0, payout_method: "bank_transfer" });
    loadData();
  };

  const sendInvite = async () => {
    if (!selectedPartner || !inviteForm.workshop_email.trim()) { toast.error(t('admin.partners.inviteEmailRequired')); return; }
    const existing = invites.find(inv =>
      inv.partner_id === selectedPartner.id &&
      inv.workshop_email.toLowerCase() === inviteForm.workshop_email.toLowerCase()
    );
    if (existing) { toast.error(t('admin.partners.duplicateInvite')); return; }
    const { error } = await supabase.from("partner_invites").insert([{
      partner_id: selectedPartner.id, ...inviteForm,
    }] as any).select().single();
    if (error) { toast.error(error.message); return; }
    await supabase.from("partner_logs").insert({
      partner_id: selectedPartner.id, action: "invite_sent_by_admin",
      details: { workshop_email: inviteForm.workshop_email, plan: inviteForm.plan_offer },
    } as any);
    toast.success(t('admin.partners.inviteCreated'));
    setShowInvite(false);
    setInviteForm({ workshop_email: "", workshop_name: "", workshop_phone: "", plan_offer: "pro", discount_percent: 0, trial_days: 30 });
    loadData();
  };

  const togglePartnerStatus = async (partner: Partner) => {
    const newStatus = partner.status === "active" ? "inactive" : "active";
    await supabase.from("partners").update({ status: newStatus } as any).eq("id", partner.id);
    await supabase.from("partner_logs").insert({
      partner_id: partner.id, action: newStatus === "active" ? "partner_activated" : "partner_deactivated",
      details: { name: partner.name, changed_by: "admin" },
    } as any);
    await logAudit({ action: `partner_${newStatus}`, entityType: "partner", entityId: partner.id });
    toast.success(`Parceiro ${newStatus === "active" ? "ativado ✅" : "desativado ❌"}`);
    loadData();
  };

  const markCommissionPaid = async (commission: Commission) => {
    await supabase.from("partner_commissions").update({
      status: "paid", paid_at: new Date().toISOString(),
    } as any).eq("id", commission.id);
    await supabase.from("partner_logs").insert({
      partner_id: commission.partner_id, action: "commission_marked_paid",
      details: { amount: commission.amount, commission_id: commission.id, paid_by: "admin" },
    } as any);
    await logAudit({ action: "commission_paid", entityType: "partner_commission", entityId: commission.id, details: { amount: commission.amount } });
    toast.success(`Comissão de ${Number(commission.amount).toFixed(2)}€ paga ✅`);
    loadData();
  };

  const copyAffiliateLink = (partner: Partner) => {
    const link = `${PRODUCTION_DOMAIN}/auth?mode=signup&partner=${partner.id}`;
    navigator.clipboard.writeText(link);
    toast.success(t('admin.partners.linkCopied'));
  };

  const getPaymentInfo = (partner: Partner) => {
    const method = partner.payout_method;
    if (method === "mbway" && partner.payout_mbway_phone) {
      return { method: "MB WAY", detail: partner.payout_mbway_phone, holder: partner.payout_holder_name };
    }
    if (partner.payout_iban) {
      return { method: "IBAN", detail: partner.payout_iban, holder: partner.payout_holder_name, bank: partner.payout_bank };
    }
    return null;
  };

  const exportCSV = () => {
    const headers = ["Parceiro", "Valor", "Moeda", "Status", "Método Pagamento", "IBAN/MBWAY", "Criado", "Pago em"];
    const rows = commissions.map(c => {
      const p = partners.find(p2 => p2.id === c.partner_id);
      const pay = p ? getPaymentInfo(p) : null;
      return [p?.name || "—", Number(c.amount).toFixed(2), c.currency, c.status,
        pay?.method || "—", pay?.detail || "—",
        new Date(c.created_at).toLocaleDateString(), c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—"];
    });
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `comissoes_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exportado 📊");
  };

  // KPIs
  const totalPending = commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const totalPaid = commissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const totalConverted = referrals.length;
  const affiliateCount = partners.filter(p => p.type === "affiliate").length;
  const convRate = partners.length > 0 ? Math.round((totalConverted / Math.max(invites.length, 1)) * 100) : 0;

  // Rankings
  const rankings = partners.map(p => {
    const pRefs = referrals.filter(r => r.partner_id === p.id);
    const pComm = commissions.filter(c => c.partner_id === p.id);
    const earned = pComm.reduce((s, c) => s + Number(c.amount), 0);
    const pending = pComm.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
    return { ...p, refCount: pRefs.length, totalEarned: earned, pendingAmt: pending };
  }).sort((a, b) => b.totalEarned - a.totalEarned);

  const statusBadge = (s: string) => {
    if (["active", "accepted", "paid"].includes(s)) return "default" as const;
    if (["pending", "sent"].includes(s)) return "secondary" as const;
    if (["inactive", "rejected", "blocked"].includes(s)) return "destructive" as const;
    return "outline" as const;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-72 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5 h-24 animate-pulse bg-muted/30" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
            Gestão de Afiliados & Parceiros
          </h1>
          <p className="text-muted-foreground text-sm">Parceiros, oficinas vinculadas, comissões, rankings e auditoria</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open("/afiliados", "_blank")} className="gap-1">
            <Eye className="w-4 h-4" /> Página Pública
          </Button>
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Novo Afiliado</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Criar Afiliado / Parceiro</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Nome completo" /></div>
                <div><Label>Tipo</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v, commission_percentage: v === "affiliate" ? 10 : form.commission_percentage })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="affiliate">Afiliado</SelectItem>
                      <SelectItem value="supplier">Fornecedor</SelectItem>
                      <SelectItem value="dealer">Dealer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Email *</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
                <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
                <Button onClick={createPartner} className="w-full"><Plus className="w-4 h-4 mr-2" />Criar</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Users, color: "text-primary", value: partners.length, label: "Total Parceiros" },
          { icon: Trophy, color: "text-amber-500", value: affiliateCount, label: "Afiliados" },
          { icon: TrendingUp, color: "text-green-500", value: totalConverted, label: "Oficinas Vinculadas" },
          { icon: BarChart3, color: "text-blue-500", value: `${convRate}%`, label: "Taxa Conversão" },
          { icon: DollarSign, color: "text-amber-500", value: `${totalPending.toFixed(0)}€`, label: "Pendentes" },
          { icon: CreditCard, color: "text-emerald-500", value: `${totalPaid.toFixed(0)}€`, label: "Total Pago" },
        ].map((kpi, i) => (
          <Card key={i} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-5 text-center">
              <kpi.icon className={`w-6 h-6 ${kpi.color} mx-auto mb-1`} />
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {totalPending > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {commissions.filter(c => c.status === "pending").length} comissões pendentes — {totalPending.toFixed(2)}€
          </p>
        </div>
      )}

      <Tabs defaultValue="rankings">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="rankings">🏆 Rankings</TabsTrigger>
          <TabsTrigger value="partners">Parceiros ({partners.length})</TabsTrigger>
          <TabsTrigger value="invites">Convites ({invites.length})</TabsTrigger>
          <TabsTrigger value="commissions">Comissões ({commissions.length})</TabsTrigger>
          <TabsTrigger value="payouts">Pagamentos ({payouts.length})</TabsTrigger>
          <TabsTrigger value="logs">🔒 Auditoria ({logs.length})</TabsTrigger>
        </TabsList>

        {/* Rankings */}
        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />Ranking de Desempenho</CardTitle>
              <CardDescription>Ordenado por comissões totais</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12">#</TableHead><TableHead>Parceiro</TableHead><TableHead>Código</TableHead>
                  <TableHead>Oficinas</TableHead><TableHead>Total Ganho</TableHead><TableHead>Pendente</TableHead>
                  <TableHead>Pagamento</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {rankings.map((p, i) => {
                    const pay = getPaymentInfo(p);
                    return (
                      <TableRow key={p.id} className={i < 3 ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                        <TableCell className="font-bold text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</TableCell>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-xs">{p.api_key || "—"}</Badge></TableCell>
                        <TableCell className="font-semibold text-green-600">{p.refCount}</TableCell>
                        <TableCell className="font-semibold">{p.totalEarned.toFixed(2)}€</TableCell>
                        <TableCell className={p.pendingAmt > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>{p.pendingAmt.toFixed(2)}€</TableCell>
                        <TableCell>
                          {pay ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                              {pay.method === "MB WAY" ? <Smartphone className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                              {pay.method}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant={statusBadge(p.status)}>{p.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                  {rankings.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum parceiro</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partners */}
        <TabsContent value="partners">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Código</TableHead><TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead><TableHead>Pagamento</TableHead><TableHead>Oficinas</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {partners.map(p => {
                    const refs = referrals.filter(r => r.partner_id === p.id).length;
                    const pay = getPaymentInfo(p);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell><Badge variant="outline" className="font-mono text-xs">{p.api_key || "—"}</Badge></TableCell>
                        <TableCell className="text-sm">{p.contact_email}</TableCell>
                        <TableCell className="text-sm">{p.contact_phone || "—"}</TableCell>
                        <TableCell>
                          {pay ? (
                            <div className="text-xs">
                              <Badge variant="outline" className="gap-1 mb-0.5">
                                {pay.method === "MB WAY" ? <Smartphone className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                                {pay.method}
                              </Badge>
                              <p className="text-muted-foreground font-mono truncate max-w-[120px]">{pay.detail}</p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem dados</span>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{refs}</TableCell>
                        <TableCell><Badge variant={statusBadge(p.status)}>{p.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => copyAffiliateLink(p)} title="Copiar link"><Copy className="w-3 h-3" /></Button>
                            <Button size="sm" variant="outline" onClick={() => { setSelectedPartner(p); setShowInvite(true); }} title="Enviar convite"><Send className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => setDetailPartner(p)} title="Ver detalhes"><Eye className="w-3 h-3" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => togglePartnerStatus(p)}
                              className={p.status === "active" ? "text-destructive hover:text-destructive" : "text-green-600"}
                              title={p.status === "active" ? "Desativar" : "Ativar"}>
                              {p.status === "active" ? <Ban className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {partners.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum parceiro</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites */}
        <TabsContent value="invites">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Parceiro</TableHead><TableHead>Oficina</TableHead><TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {invites.map(inv => {
                    const partner = partners.find(p => p.id === inv.partner_id);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                        <TableCell>{inv.workshop_name || "—"}</TableCell>
                        <TableCell className="text-sm">{inv.workshop_email}</TableCell>
                        <TableCell><Badge variant="outline">{inv.plan_offer.toUpperCase()}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={statusBadge(inv.status)} className="gap-1">
                            {inv.status === "accepted" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {invites.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum convite</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions - Now with payment info */}
        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Comissões</CardTitle>
                <div className="flex gap-2 items-center">
                  <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pendente: {totalPending.toFixed(2)}€</Badge>
                  <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />Pago: {totalPaid.toFixed(2)}€</Badge>
                  <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1 ml-2"><Download className="w-3 h-3" />CSV</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Parceiro</TableHead><TableHead>Valor</TableHead><TableHead>Método</TableHead>
                  <TableHead>Dados Pagamento</TableHead><TableHead>Status</TableHead>
                  <TableHead>Data</TableHead><TableHead>Pago em</TableHead><TableHead>Ação</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {commissions.map(c => {
                    const partner = partners.find(p => p.id === c.partner_id);
                    const pay = partner ? getPaymentInfo(partner) : null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                        <TableCell className="font-semibold">{Number(c.amount).toFixed(2)}€</TableCell>
                        <TableCell>
                          {pay ? (
                            <Badge variant="outline" className="gap-1 text-xs">
                              {pay.method === "MB WAY" ? <Smartphone className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                              {pay.method}
                            </Badge>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-[150px] truncate">
                          {pay ? (
                            <div>
                              <p>{pay.detail}</p>
                              {pay.holder && <p className="text-muted-foreground">{pay.holder}</p>}
                            </div>
                          ) : <span className="text-muted-foreground">Sem dados</span>}
                        </TableCell>
                        <TableCell><Badge variant={statusBadge(c.status)} className="gap-1">{c.status === "paid" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{c.status}</Badge></TableCell>
                        <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{c.status === "pending" && <Button size="sm" variant="outline" onClick={() => markCommissionPaid(c)} className="gap-1"><CreditCard className="w-3 h-3" />Pagar</Button>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {commissions.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma comissão</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts */}
        <TabsContent value="payouts">
          <Card>
            <CardContent className="pt-4 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Parceiro</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead><TableHead>Pago em</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payouts.map(po => {
                    const partner = partners.find(p => p.id === po.partner_id);
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                        <TableCell className="font-semibold">{Number(po.amount).toFixed(2)}€</TableCell>
                        <TableCell><Badge variant={statusBadge(po.status)}>{po.status}</Badge></TableCell>
                        <TableCell className="text-sm">{new Date(po.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{po.paid_at ? new Date(po.paid_at).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {payouts.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum pagamento</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Auditoria Completa</CardTitle>
              <CardDescription>Todas as ações do sistema de afiliados — anti-fraude ativo</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data/Hora</TableHead><TableHead>Parceiro</TableHead><TableHead>Ação</TableHead><TableHead>Detalhes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map(log => {
                    const partner = partners.find(p => p.id === log.partner_id);
                    const isSuspicious = log.action?.includes("suspicious") || log.action?.includes("blocked") || log.action?.includes("duplicate");
                    return (
                      <TableRow key={log.id} className={isSuspicious ? "bg-red-50/50 dark:bg-red-950/10" : ""}>
                        <TableCell className="text-sm whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{partner?.name || "Sistema"}</TableCell>
                        <TableCell>
                          <Badge variant={isSuspicious ? "destructive" : "outline"} className="gap-1 text-xs">
                            {isSuspicious && <AlertTriangle className="w-3 h-3" />}
                            {log.action?.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[300px] truncate">
                          {log.details ? JSON.stringify(log.details) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum log</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar Oficina — {selectedPartner?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Email da Oficina *</Label><Input type="email" value={inviteForm.workshop_email} onChange={e => setInviteForm({ ...inviteForm, workshop_email: e.target.value })} /></div>
            <div><Label>Nome da Oficina</Label><Input value={inviteForm.workshop_name} onChange={e => setInviteForm({ ...inviteForm, workshop_name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={inviteForm.workshop_phone} onChange={e => setInviteForm({ ...inviteForm, workshop_phone: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Plano</Label>
                <Select value={inviteForm.plan_offer} onValueChange={v => setInviteForm({ ...inviteForm, plan_offer: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pro">Pro (10%)</SelectItem>
                    <SelectItem value="garage">Garage (20%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Desconto %</Label><Input type="number" value={inviteForm.discount_percent} onChange={e => setInviteForm({ ...inviteForm, discount_percent: +e.target.value })} /></div>
              <div><Label>Trial (dias)</Label><Input type="number" value={inviteForm.trial_days} onChange={e => setInviteForm({ ...inviteForm, trial_days: +e.target.value })} /></div>
            </div>
            <Button onClick={sendInvite} className="w-full"><Send className="w-4 h-4 mr-2" />Enviar Convite</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Partner Detail Dialog - Now with payment info */}
      <Dialog open={!!detailPartner} onOpenChange={() => setDetailPartner(null)}>
        <DialogContent className="max-w-lg">
          {detailPartner && (() => {
            const pRefs = referrals.filter(r => r.partner_id === detailPartner.id);
            const pComm = commissions.filter(c => c.partner_id === detailPartner.id);
            const pPending = pComm.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
            const pPaid = pComm.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
            const pLogs = logs.filter(l => l.partner_id === detailPartner.id);
            const suspiciousLogs = pLogs.filter(l => l.action?.includes("suspicious") || l.action?.includes("blocked") || l.action?.includes("duplicate"));
            const pay = getPaymentInfo(detailPartner);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {detailPartner.name}
                    <Badge variant={statusBadge(detailPartner.status)}>{detailPartner.status}</Badge>
                    {suspiciousLogs.length > 0 && <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{suspiciousLogs.length} alertas</Badge>}
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Código:</span> <strong className="font-mono">{detailPartner.api_key || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Email:</span> <strong>{detailPartner.contact_email}</strong></div>
                    <div><span className="text-muted-foreground">Telefone:</span> <strong>{detailPartner.contact_phone || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Desde:</span> <strong>{new Date(detailPartner.created_at).toLocaleDateString()}</strong></div>
                  </div>

                  {/* Payment Info Section */}
                  <div className="border rounded-lg p-3 bg-muted/30">
                    <p className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-primary" />
                      Dados de Pagamento
                    </p>
                    {pay ? (
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            {pay.method === "MB WAY" ? <Smartphone className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}
                            {pay.method}
                          </Badge>
                        </div>
                        {pay.holder && <p><span className="text-muted-foreground">Titular:</span> <strong>{pay.holder}</strong></p>}
                        <p><span className="text-muted-foreground">{pay.method === "MB WAY" ? "Nº:" : "IBAN:"}</span> <strong className="font-mono">{pay.detail}</strong></p>
                        {(pay as any).bank && <p><span className="text-muted-foreground">Banco:</span> <strong>{(pay as any).bank}</strong></p>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem dados de pagamento registados</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-green-600">{pRefs.length}</p><p className="text-xs text-muted-foreground">Oficinas vinculadas</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold">{pComm.length}</p><p className="text-xs text-muted-foreground">Comissões</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-amber-600">{pPending.toFixed(2)}€</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-emerald-600">{pPaid.toFixed(2)}€</p><p className="text-xs text-muted-foreground">Pago</p></CardContent></Card>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <Label className="text-xs text-muted-foreground mb-1 block">Link de afiliado</Label>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={`${PRODUCTION_DOMAIN}/auth?mode=signup&partner=${detailPartner.id}`} className="text-xs font-mono" />
                      <Button size="icon" variant="outline" onClick={() => copyAffiliateLink(detailPartner)}><Copy className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  {pLogs.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-2">Últimos logs ({pLogs.length})</p>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {pLogs.slice(0, 10).map(l => (
                          <div key={l.id} className={`text-xs p-2 rounded ${l.action?.includes("suspicious") ? "bg-red-50 dark:bg-red-950/20" : "bg-muted/30"}`}>
                            <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                            <span className="ml-2 font-medium">{l.action?.replace(/_/g, " ")}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
