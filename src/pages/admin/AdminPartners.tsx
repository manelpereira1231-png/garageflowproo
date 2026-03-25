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
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { logAudit } from "@/lib/auditLog";
import {
  Plus, Users, TrendingUp, DollarSign, Send, CreditCard, Copy, Shield, AlertTriangle,
  CheckCircle, Clock, XCircle, BarChart3, Trophy, Eye, Ban, Download, FileSpreadsheet
} from "lucide-react";

interface Partner {
  id: string; name: string; type: string; contact_email: string; contact_phone: string;
  commission_percentage: number; discount_percentage: number; payout_method: string;
  status: string; created_at: string;
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

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [logs, setLogs] = useState<PartnerLog[]>([]);
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
    const [p, i, c, po, lg] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_invites").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_commissions").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_payouts").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_logs").select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setPartners((p.data || []) as Partner[]);
    setInvites((i.data || []) as PartnerInvite[]);
    setCommissions((c.data || []) as Commission[]);
    setPayouts((po.data || []) as Payout[]);
    setLogs((lg.data || []) as PartnerLog[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const checkDuplicatePartner = (email: string): boolean => {
    return partners.some(p => p.contact_email.toLowerCase() === email.toLowerCase());
  };

  const createPartner = async () => {
    if (!form.name.trim() || !form.contact_email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    if (checkDuplicatePartner(form.contact_email)) {
      toast.error("⚠️ Já existe um parceiro com este email");
      return;
    }
    const commissionRate = form.type === "affiliate" ? 10 : form.commission_percentage;
    const { data, error } = await supabase.from("partners").insert([{
      ...form, commission_percentage: commissionRate,
    }] as any).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      await supabase.from("partner_logs").insert({
        partner_id: (data as any).id, action: "partner_created",
        details: { name: form.name, type: form.type, email: form.contact_email, commission: commissionRate },
      } as any);
      await logAudit({ action: "partner_created", entityType: "partner", entityId: (data as any).id, details: { name: form.name } });
    }
    toast.success("Parceiro/Afiliado criado com sucesso! ✅");
    setShowCreate(false);
    setForm({ name: "", type: "affiliate", contact_email: "", contact_phone: "", commission_percentage: 10, discount_percentage: 0, payout_method: "bank_transfer" });
    loadData();
  };

  const sendInvite = async () => {
    if (!selectedPartner) return;
    if (!inviteForm.workshop_email.trim()) { toast.error("Email da oficina é obrigatório"); return; }
    const existing = invites.find(inv =>
      inv.partner_id === selectedPartner.id &&
      inv.workshop_email.toLowerCase() === inviteForm.workshop_email.toLowerCase()
    );
    if (existing) { toast.error("⚠️ Já existe um convite para esta oficina deste parceiro"); return; }
    const { data, error } = await supabase.from("partner_invites").insert([{
      partner_id: selectedPartner.id, ...inviteForm,
    }] as any).select().single();
    if (error) { toast.error(error.message); return; }
    if (data) {
      await supabase.from("partner_logs").insert({
        partner_id: selectedPartner.id, action: "invite_sent",
        details: { workshop_email: inviteForm.workshop_email, plan: inviteForm.plan_offer },
      } as any);
    }
    toast.success("Convite criado com sucesso! 📩");
    setShowInvite(false);
    setInviteForm({ workshop_email: "", workshop_name: "", workshop_phone: "", plan_offer: "pro", discount_percent: 0, trial_days: 30 });
    loadData();
  };

  const togglePartnerStatus = async (partner: Partner) => {
    const newStatus = partner.status === "active" ? "inactive" : "active";
    await supabase.from("partners").update({ status: newStatus } as any).eq("id", partner.id);
    await supabase.from("partner_logs").insert({
      partner_id: partner.id, action: newStatus === "active" ? "partner_activated" : "partner_deactivated",
      details: { name: partner.name },
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
      partner_id: commission.partner_id, action: "commission_paid",
      details: { amount: commission.amount, commission_id: commission.id },
    } as any);
    await logAudit({ action: "commission_paid", entityType: "partner_commission", entityId: commission.id, details: { amount: commission.amount } });
    toast.success(`Comissão de ${Number(commission.amount).toFixed(2)}€ marcada como paga ✅`);
    loadData();
  };

  const copyAffiliateLink = (partner: Partner) => {
    const link = `${window.location.origin}/auth?mode=signup&partner=${partner.id}`;
    navigator.clipboard.writeText(link);
    toast.success("Link de afiliado copiado! 📋");
  };

  // CSV Export
  const exportCommissionsCSV = () => {
    const headers = ["Parceiro", "Valor", "Moeda", "Status", "Criado", "Pago em"];
    const rows = commissions.map(c => {
      const p = partners.find(p => p.id === c.partner_id);
      return [
        p?.name || "—", Number(c.amount).toFixed(2), c.currency, c.status,
        new Date(c.created_at).toLocaleDateString(), c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—",
      ];
    });
    const csv = [headers, ...rows].map(r => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `comissoes_afiliados_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    toast.success("CSV exportado! 📊");
  };

  // KPIs
  const totalCommissionsPending = commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const totalCommissionsPaid = commissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const totalInvitesAccepted = invites.filter(i => i.status === "accepted").length;
  const affiliateCount = partners.filter(p => p.type === "affiliate").length;
  const conversionRate = invites.length > 0 ? Math.round((totalInvitesAccepted / invites.length) * 100) : 0;

  // Rankings
  const partnerRankings = partners.map(p => {
    const pInvites = invites.filter(i => i.partner_id === p.id);
    const pAccepted = pInvites.filter(i => i.status === "accepted").length;
    const pComm = commissions.filter(c => c.partner_id === p.id);
    const pTotalEarned = pComm.reduce((s, c) => s + Number(c.amount), 0);
    const pPending = pComm.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
    return { ...p, inviteCount: pInvites.length, acceptedCount: pAccepted, totalEarned: pTotalEarned, pendingCommissions: pPending };
  }).sort((a, b) => b.totalEarned - a.totalEarned);

  const statusColor = (s: string) => {
    if (s === "active" || s === "accepted" || s === "paid") return "default" as const;
    if (s === "pending" || s === "sent") return "secondary" as const;
    if (s === "inactive" || s === "rejected") return "destructive" as const;
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
          <p className="text-muted-foreground text-sm">Parceiros, convites, comissões, rankings e auditoria completa</p>
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
                  <Select value={form.type} onValueChange={v => {
                    const comm = v === "affiliate" ? 10 : form.commission_percentage;
                    setForm({ ...form, type: v, commission_percentage: comm });
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="affiliate">Afiliado</SelectItem>
                      <SelectItem value="supplier">Fornecedor</SelectItem>
                      <SelectItem value="dealer">Dealer</SelectItem>
                      <SelectItem value="network">Rede</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Email *</Label><Input type="email" value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} placeholder="email@exemplo.com" /></div>
                <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} placeholder="+351..." /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Comissão %</Label>
                    <Input type="number" value={form.commission_percentage} onChange={e => setForm({ ...form, commission_percentage: +e.target.value })} />
                    <p className="text-xs text-muted-foreground mt-1">Pro: 10% · Garage: 20%</p>
                  </div>
                  <div><Label>Desconto %</Label><Input type="number" value={form.discount_percentage} onChange={e => setForm({ ...form, discount_percentage: +e.target.value })} /></div>
                </div>
                <div><Label>Método Pagamento</Label>
                  <Select value={form.payout_method} onValueChange={v => setForm({ ...form, payout_method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bank_transfer">Transferência Bancária</SelectItem>
                      <SelectItem value="stripe">Stripe</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={createPartner} className="w-full"><Plus className="w-4 h-4 mr-2" />Criar Afiliado</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="hover:shadow-md transition-shadow"><CardContent className="pt-5 text-center">
          <Users className="w-6 h-6 text-primary mx-auto mb-1" />
          <p className="text-2xl font-bold">{partners.length}</p>
          <p className="text-xs text-muted-foreground">Total Parceiros</p>
        </CardContent></Card>
        <Card className="hover:shadow-md transition-shadow"><CardContent className="pt-5 text-center">
          <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{affiliateCount}</p>
          <p className="text-xs text-muted-foreground">Afiliados</p>
        </CardContent></Card>
        <Card className="hover:shadow-md transition-shadow"><CardContent className="pt-5 text-center">
          <TrendingUp className="w-6 h-6 text-green-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalInvitesAccepted}</p>
          <p className="text-xs text-muted-foreground">Oficinas Convertidas</p>
        </CardContent></Card>
        <Card className="hover:shadow-md transition-shadow"><CardContent className="pt-5 text-center">
          <BarChart3 className="w-6 h-6 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{conversionRate}%</p>
          <p className="text-xs text-muted-foreground">Taxa Conversão</p>
        </CardContent></Card>
        <Card className="hover:shadow-md transition-shadow"><CardContent className="pt-5 text-center">
          <DollarSign className="w-6 h-6 text-amber-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalCommissionsPending.toFixed(0)}€</p>
          <p className="text-xs text-muted-foreground">Comissões Pendentes</p>
        </CardContent></Card>
        <Card className="hover:shadow-md transition-shadow"><CardContent className="pt-5 text-center">
          <CreditCard className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
          <p className="text-2xl font-bold">{totalCommissionsPaid.toFixed(0)}€</p>
          <p className="text-xs text-muted-foreground">Total Pago</p>
        </CardContent></Card>
      </div>

      {/* Pending alert */}
      {totalCommissionsPending > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            {commissions.filter(c => c.status === "pending").length} comissões pendentes totalizando {totalCommissionsPending.toFixed(2)}€
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
              <CardDescription>Ordenado por total de comissões ganhas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="w-12">#</TableHead><TableHead>Parceiro</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Convites</TableHead><TableHead>Convertidos</TableHead><TableHead>Taxa</TableHead>
                  <TableHead>Total Ganho</TableHead><TableHead>Pendente</TableHead><TableHead>Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {partnerRankings.map((p, i) => (
                    <TableRow key={p.id} className={i < 3 ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <TableCell className="font-bold text-lg">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                      <TableCell>{p.inviteCount}</TableCell>
                      <TableCell className="font-semibold text-green-600">{p.acceptedCount}</TableCell>
                      <TableCell>{p.inviteCount > 0 ? Math.round((p.acceptedCount / p.inviteCount) * 100) : 0}%</TableCell>
                      <TableCell className="font-semibold">{p.totalEarned.toFixed(2)}€</TableCell>
                      <TableCell className={p.pendingCommissions > 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>{p.pendingCommissions.toFixed(2)}€</TableCell>
                      <TableCell><Badge variant={statusColor(p.status)}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {partnerRankings.length === 0 && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhum parceiro registado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partners */}
        <TabsContent value="partners">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Email</TableHead>
                  <TableHead>Comissão</TableHead><TableHead>Link</TableHead><TableHead>Status</TableHead><TableHead>Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {partners.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                      <TableCell className="text-sm">{p.contact_email}</TableCell>
                      <TableCell><span className="font-semibold">Pro: 10%</span><span className="text-muted-foreground"> · </span><span className="font-semibold">Garage: 20%</span></TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => copyAffiliateLink(p)} className="gap-1">
                          <Copy className="w-3 h-3" />Copiar
                        </Button>
                      </TableCell>
                      <TableCell><Badge variant={statusColor(p.status)}>{p.status}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" onClick={() => { setSelectedPartner(p); setShowInvite(true); }}><Send className="w-3 h-3 mr-1" />Convidar</Button>
                          <Button size="sm" variant="ghost" onClick={() => setDetailPartner(p)}><Eye className="w-3 h-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => togglePartnerStatus(p)}
                            className={p.status === "active" ? "text-destructive hover:text-destructive" : "text-green-600 hover:text-green-700"}>
                            {p.status === "active" ? <Ban className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {partners.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum parceiro criado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invites */}
        <TabsContent value="invites">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Parceiro</TableHead><TableHead>Oficina</TableHead><TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead><TableHead>Comissão</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead>
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
                        <TableCell className="font-semibold">{inv.plan_offer === "garage" ? "20%" : "10%"}</TableCell>
                        <TableCell>
                          <Badge variant={statusColor(inv.status)} className="gap-1">
                            {inv.status === "accepted" ? <CheckCircle className="w-3 h-3" /> : inv.status === "pending" ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    );
                  })}
                  {invites.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum convite enviado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commissions */}
        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Comissões</CardTitle>
                <div className="flex gap-2 items-center">
                  <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" />Pendente: {totalCommissionsPending.toFixed(2)}€</Badge>
                  <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" />Pago: {totalCommissionsPaid.toFixed(2)}€</Badge>
                  <Button size="sm" variant="outline" onClick={exportCommissionsCSV} className="gap-1 ml-2">
                    <Download className="w-3 h-3" />CSV
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Parceiro</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead>
                  <TableHead>Data</TableHead><TableHead>Pago em</TableHead><TableHead>Ação</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {commissions.map(c => {
                    const partner = partners.find(p => p.id === c.partner_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                        <TableCell className="font-semibold">{Number(c.amount).toFixed(2)}€</TableCell>
                        <TableCell><Badge variant={statusColor(c.status)} className="gap-1">{c.status === "paid" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{c.status}</Badge></TableCell>
                        <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—"}</TableCell>
                        <TableCell>{c.status === "pending" && <Button size="sm" variant="outline" onClick={() => markCommissionPaid(c)} className="gap-1"><CreditCard className="w-3 h-3" />Pagar</Button>}</TableCell>
                      </TableRow>
                    );
                  })}
                  {commissions.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma comissão registada</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Payouts */}
        <TabsContent value="payouts">
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Parceiro</TableHead><TableHead>Valor</TableHead><TableHead>Moeda</TableHead>
                  <TableHead>Status</TableHead><TableHead>Criado</TableHead><TableHead>Pago em</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {payouts.map(po => {
                    const partner = partners.find(p => p.id === po.partner_id);
                    return (
                      <TableRow key={po.id}>
                        <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                        <TableCell className="font-semibold">{Number(po.amount).toFixed(2)}€</TableCell>
                        <TableCell>{po.currency}</TableCell>
                        <TableCell><Badge variant={statusColor(po.status)}>{po.status}</Badge></TableCell>
                        <TableCell className="text-sm">{new Date(po.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{po.paid_at ? new Date(po.paid_at).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {payouts.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum pagamento registado</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Shield className="w-5 h-5 text-primary" />Logs de Auditoria</CardTitle>
              <CardDescription>Histórico completo de todas as ações do sistema de afiliados</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Parceiro</TableHead><TableHead>Ação</TableHead><TableHead>Detalhes</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {logs.map(log => {
                    const partner = partners.find(p => p.id === log.partner_id);
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</TableCell>
                        <TableCell className="font-medium">{partner?.name || "Sistema"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {log.action === "partner_created" && <Plus className="w-3 h-3" />}
                            {log.action === "affiliate_self_registered" && <Users className="w-3 h-3" />}
                            {log.action === "invite_sent" && <Send className="w-3 h-3" />}
                            {log.action === "commission_paid" && <CreditCard className="w-3 h-3" />}
                            {log.action === "partner_activated" && <CheckCircle className="w-3 h-3" />}
                            {log.action === "partner_deactivated" && <Ban className="w-3 h-3" />}
                            {log.action.replace(/_/g, " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                          {log.details ? JSON.stringify(log.details) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {logs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum log registado</TableCell></TableRow>}
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
            <div><Label>Email da Oficina *</Label><Input type="email" value={inviteForm.workshop_email} onChange={e => setInviteForm({ ...inviteForm, workshop_email: e.target.value })} placeholder="oficina@email.com" /></div>
            <div><Label>Nome da Oficina</Label><Input value={inviteForm.workshop_name} onChange={e => setInviteForm({ ...inviteForm, workshop_name: e.target.value })} placeholder="Auto Centro Lisboa" /></div>
            <div><Label>Telefone</Label><Input value={inviteForm.workshop_phone} onChange={e => setInviteForm({ ...inviteForm, workshop_phone: e.target.value })} placeholder="+351..." /></div>
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

      {/* Partner Detail Dialog */}
      <Dialog open={!!detailPartner} onOpenChange={() => setDetailPartner(null)}>
        <DialogContent className="max-w-lg">
          {detailPartner && (() => {
            const pInvites = invites.filter(i => i.partner_id === detailPartner.id);
            const pAccepted = pInvites.filter(i => i.status === "accepted");
            const pComm = commissions.filter(c => c.partner_id === detailPartner.id);
            const pPending = pComm.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
            const pPaid = pComm.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
            const pLogs = logs.filter(l => l.partner_id === detailPartner.id);
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {detailPartner.name}
                    <Badge variant={statusColor(detailPartner.status)}>{detailPartner.status}</Badge>
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Tipo:</span> <strong>{detailPartner.type}</strong></div>
                    <div><span className="text-muted-foreground">Email:</span> <strong>{detailPartner.contact_email}</strong></div>
                    <div><span className="text-muted-foreground">Telefone:</span> <strong>{detailPartner.contact_phone || "—"}</strong></div>
                    <div><span className="text-muted-foreground">Pagamento:</span> <strong>{detailPartner.payout_method}</strong></div>
                    <div><span className="text-muted-foreground">Desde:</span> <strong>{new Date(detailPartner.created_at).toLocaleDateString()}</strong></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold">{pInvites.length}</p><p className="text-xs text-muted-foreground">Convites</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-green-600">{pAccepted.length}</p><p className="text-xs text-muted-foreground">Convertidas</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-amber-600">{pPending.toFixed(2)}€</p><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
                    <Card><CardContent className="pt-4 text-center"><p className="text-xl font-bold text-emerald-600">{pPaid.toFixed(2)}€</p><p className="text-xs text-muted-foreground">Pago</p></CardContent></Card>
                  </div>
                  {pAccepted.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Oficinas Convertidas</h4>
                      <div className="space-y-1">
                        {pAccepted.map(inv => (
                          <div key={inv.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                            <span>{inv.workshop_name || inv.workshop_email}</span>
                            <Badge variant="outline">{inv.plan_offer.toUpperCase()}</Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {pLogs.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2">Últimas Ações</h4>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {pLogs.slice(0, 10).map(log => (
                          <div key={log.id} className="flex items-center justify-between text-xs p-2 bg-muted/30 rounded">
                            <span>{log.action.replace(/_/g, " ")}</span>
                            <span className="text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button variant="outline" className="w-full gap-1" onClick={() => copyAffiliateLink(detailPartner)}>
                    <Copy className="w-4 h-4" /> Copiar Link de Afiliado
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
