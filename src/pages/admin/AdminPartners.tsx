import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { Plus, Users, TrendingUp, DollarSign, Send, Eye, CreditCard } from "lucide-react";

interface Partner {
  id: string;
  name: string;
  type: string;
  contact_email: string;
  contact_phone: string;
  commission_percentage: number;
  discount_percentage: number;
  payout_method: string;
  status: string;
  created_at: string;
}

interface PartnerInvite {
  id: string;
  partner_id: string;
  workshop_email: string;
  workshop_name: string;
  status: string;
  plan_offer: string;
  discount_percent: number;
  trial_days: number;
  created_at: string;
  accepted_at: string | null;
}

interface Commission {
  id: string;
  partner_id: string;
  shop_id: string;
  amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
}

interface Payout {
  id: string;
  partner_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  paid_at: string | null;
}

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [invites, setInvites] = useState<PartnerInvite[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    name: "", type: "supplier", contact_email: "", contact_phone: "",
    commission_percentage: 10, discount_percentage: 0, payout_method: "bank_transfer",
  });

  const [inviteForm, setInviteForm] = useState({
    workshop_email: "", workshop_name: "", workshop_phone: "",
    plan_offer: "pro", discount_percent: 0, trial_days: 30,
  });

  const loadData = async () => {
    setLoading(true);
    const [p, i, c, po] = await Promise.all([
      supabase.from("partners").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_invites").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_commissions").select("*").order("created_at", { ascending: false }),
      supabase.from("partner_payouts").select("*").order("created_at", { ascending: false }),
    ]);
    setPartners((p.data || []) as Partner[]);
    setInvites((i.data || []) as PartnerInvite[]);
    setCommissions((c.data || []) as Commission[]);
    setPayouts((po.data || []) as Payout[]);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const createPartner = async () => {
    const { error } = await supabase.from("partners").insert([form] as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Parceiro criado!" });
    setShowCreate(false);
    setForm({ name: "", type: "supplier", contact_email: "", contact_phone: "", commission_percentage: 10, discount_percentage: 0, payout_method: "bank_transfer" });
    loadData();
  };

  const sendInvite = async () => {
    if (!selectedPartner) return;
    const { error } = await supabase.from("partner_invites").insert([{
      partner_id: selectedPartner.id,
      ...inviteForm,
    }] as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Convite criado!" });
    setShowInvite(false);
    setInviteForm({ workshop_email: "", workshop_name: "", workshop_phone: "", plan_offer: "pro", discount_percent: 0, trial_days: 30 });
    loadData();
  };

  const totalCommissionsPending = commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const totalCommissionsPaid = commissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const totalInvitesAccepted = invites.filter(i => i.status === "accepted").length;

  const statusColor = (s: string) => {
    if (s === "active" || s === "accepted" || s === "paid") return "default";
    if (s === "pending" || s === "sent") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestão de Parceiros</h1>
          <p className="text-muted-foreground">Parceiros, convites, comissões e pagamentos</p>
        </div>
        <Dialog open={showCreate} onOpenChange={setShowCreate}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Parceiro</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar Parceiro</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Fornecedor</SelectItem>
                    <SelectItem value="dealer">Dealer</SelectItem>
                    <SelectItem value="network">Rede</SelectItem>
                    <SelectItem value="affiliate">Afiliado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Email</Label><Input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Comissão %</Label><Input type="number" value={form.commission_percentage} onChange={e => setForm({ ...form, commission_percentage: +e.target.value })} /></div>
                <div><Label>Desconto %</Label><Input type="number" value={form.discount_percentage} onChange={e => setForm({ ...form, discount_percentage: +e.target.value })} /></div>
              </div>
              <div><Label>Método Pagamento</Label>
                <Select value={form.payout_method} onValueChange={v => setForm({ ...form, payout_method: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Transferência</SelectItem>
                    <SelectItem value="stripe">Stripe</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={createPartner} className="w-full">Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="w-8 h-8 text-primary" /><div><p className="text-sm text-muted-foreground">Parceiros</p><p className="text-2xl font-bold">{partners.length}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="w-8 h-8 text-green-500" /><div><p className="text-sm text-muted-foreground">Oficinas Convertidas</p><p className="text-2xl font-bold">{totalInvitesAccepted}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="w-8 h-8 text-yellow-500" /><div><p className="text-sm text-muted-foreground">Comissões Pendentes</p><p className="text-2xl font-bold">{totalCommissionsPending.toFixed(2)}€</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><CreditCard className="w-8 h-8 text-blue-500" /><div><p className="text-sm text-muted-foreground">Total Pago</p><p className="text-2xl font-bold">{totalCommissionsPaid.toFixed(2)}€</p></div></div></CardContent></Card>
      </div>

      <Tabs defaultValue="partners">
        <TabsList>
          <TabsTrigger value="partners">Parceiros</TabsTrigger>
          <TabsTrigger value="invites">Convites ({invites.length})</TabsTrigger>
          <TabsTrigger value="commissions">Comissões ({commissions.length})</TabsTrigger>
          <TabsTrigger value="payouts">Pagamentos ({payouts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="partners">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell><Badge variant="outline">{p.type}</Badge></TableCell>
                    <TableCell>{p.contact_email}</TableCell>
                    <TableCell>{p.commission_percentage}%</TableCell>
                    <TableCell>{p.discount_percentage}%</TableCell>
                    <TableCell><Badge variant={statusColor(p.status)}>{p.status}</Badge></TableCell>
                    <TableCell className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={() => { setSelectedPartner(p); setShowInvite(true); }}>
                        <Send className="w-3 h-3 mr-1" />Convidar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {partners.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum parceiro criado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="invites">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oficina</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Trial</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.workshop_name || "—"}</TableCell>
                    <TableCell>{inv.workshop_email}</TableCell>
                    <TableCell><Badge variant="outline">{inv.plan_offer.toUpperCase()}</Badge></TableCell>
                    <TableCell>{inv.discount_percent}%</TableCell>
                    <TableCell>{inv.trial_days}d</TableCell>
                    <TableCell><Badge variant={statusColor(inv.status)}>{inv.status}</Badge></TableCell>
                    <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {invites.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum convite enviado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.map(c => {
                  const partner = partners.find(p => p.id === c.partner_id);
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                      <TableCell>{Number(c.amount).toFixed(2)}€</TableCell>
                      <TableCell><Badge variant={statusColor(c.status)}>{c.status}</Badge></TableCell>
                      <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {commissions.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma comissão registada</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="payouts">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parceiro</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map(po => {
                  const partner = partners.find(p => p.id === po.partner_id);
                  return (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                      <TableCell>{Number(po.amount).toFixed(2)}€</TableCell>
                      <TableCell><Badge variant={statusColor(po.status)}>{po.status}</Badge></TableCell>
                      <TableCell>{new Date(po.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>{po.paid_at ? new Date(po.paid_at).toLocaleDateString() : "—"}</TableCell>
                    </TableRow>
                  );
                })}
                {payouts.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum pagamento registado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invite modal */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar Convite — {selectedPartner?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome da Oficina</Label><Input value={inviteForm.workshop_name} onChange={e => setInviteForm({ ...inviteForm, workshop_name: e.target.value })} /></div>
            <div><Label>Email</Label><Input value={inviteForm.workshop_email} onChange={e => setInviteForm({ ...inviteForm, workshop_email: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={inviteForm.workshop_phone} onChange={e => setInviteForm({ ...inviteForm, workshop_phone: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label>Plano</Label>
                <Select value={inviteForm.plan_offer} onValueChange={v => setInviteForm({ ...inviteForm, plan_offer: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pro">Pro</SelectItem>
                    <SelectItem value="garage">Garage</SelectItem>
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
    </div>
  );
}
