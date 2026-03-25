import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, TrendingUp, DollarSign, CreditCard, Building2, Trophy, Copy, 
  CheckCircle, Clock, Target, Sparkles, Link as LinkIcon, Download,
  Smartphone, LogOut, ExternalLink
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import LandingLayout from "@/components/LandingLayout";

const PRODUCTION_DOMAIN = "https://garageflow.pt";

export default function AffiliateDashboard() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [partner, setPartner] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPayout, setEditingPayout] = useState(false);
  const [payoutForm, setPayoutForm] = useState({
    method: "bank_transfer",
    holder_name: "",
    iban: "",
    mbway_phone: "",
    bank: "",
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Get current user's partner record
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!partnerData) {
        // Not an affiliate - redirect
        navigate("/dashboard");
        return;
      }

      setPartner(partnerData);
      setPayoutForm({
        method: partnerData.payout_method || "bank_transfer",
        holder_name: partnerData.payout_holder_name || "",
        iban: partnerData.payout_iban || "",
        mbway_phone: partnerData.payout_mbway_phone || "",
        bank: partnerData.payout_bank || "",
      });

      // Load related data in parallel
      const [invRes, comRes, payRes, logRes] = await Promise.all([
        supabase.from("partner_invites").select("*").eq("partner_id", partnerData.id).order("created_at", { ascending: false }),
        supabase.from("partner_commissions").select("*").eq("partner_id", partnerData.id).order("created_at", { ascending: false }),
        supabase.from("partner_payouts").select("*").eq("partner_id", partnerData.id).order("created_at", { ascending: false }),
        supabase.from("partner_logs").select("*").eq("partner_id", partnerData.id).order("created_at", { ascending: false }).limit(20),
      ]);

      setInvites(invRes.data || []);
      setCommissions(comRes.data || []);
      setPayouts(payRes.data || []);
      setLogs(logRes.data || []);
    } catch (err) {
      console.error("Error loading affiliate data:", err);
    } finally {
      setLoading(false);
    }
  };

  const affiliateLink = partner ? `${PRODUCTION_DOMAIN}/auth?mode=signup&partner=${partner.id}` : "";
  
  const copyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    toast.success(t('affiliate.linkCopied') || "Link copiado! 📋");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const savePayout = async () => {
    if (!partner) return;
    const { error } = await supabase.from("partners").update({
      payout_method: payoutForm.method,
      payout_holder_name: payoutForm.holder_name,
      payout_iban: payoutForm.iban,
      payout_mbway_phone: payoutForm.mbway_phone,
      payout_bank: payoutForm.bank,
    }).eq("id", partner.id);

    if (error) {
      toast.error("Erro ao guardar dados de pagamento");
    } else {
      toast.success(t('affiliate.payoutSaved') || "Dados de pagamento atualizados ✅");
      setEditingPayout(false);
      loadData();
    }
  };

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) { toast.error("Sem dados para exportar"); return; }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado ✅");
  };

  // Calculate stats
  const totalInvites = invites.length;
  const acceptedInvites = invites.filter(i => i.status === "accepted").length;
  const pendingCommission = commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const paidCommission = commissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const conversionRate = totalInvites > 0 ? Math.round((acceptedInvites / totalInvites) * 100) : 0;
  const goalTarget = 5;
  const goalProgress = Math.min(acceptedInvites, goalTarget);

  if (loading) {
    return (
      <LandingLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </LandingLayout>
    );
  }

  if (!partner) return null;

  return (
    <LandingLayout>
      <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              {t('affiliate.dashboardTitle') || "Painel de Afiliado"}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t('affiliate.welcome') || "Bem-vindo"}, <span className="font-semibold text-foreground">{partner.name}</span> — 
              <Badge variant="outline" className="ml-2">{partner.api_key}</Badge>
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
            <LogOut className="w-4 h-4" /> {t('affiliate.logout') || "Sair"}
          </Button>
        </div>

        {/* Affiliate Link Card */}
        <Card className="mb-6 border-2 border-primary/20 bg-primary/5">
          <CardContent className="pt-5 pb-4">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-2">
              <LinkIcon className="w-4 h-4 text-primary" />
              {t('affiliate.yourLink') || "O seu link exclusivo de afiliado"}
            </Label>
            <div className="flex items-center gap-2">
              <Input value={affiliateLink} readOnly className="font-mono text-xs bg-background" />
              <Button onClick={copyLink} size="icon" variant="default" className="shrink-0">
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('affiliate.linkDesc') || "Partilhe este link. Cada oficina que se registar e pagar gera comissão automática para si."}
            </p>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          <Card><CardContent className="pt-5 text-center">
            <Users className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{totalInvites}</p>
            <p className="text-xs text-muted-foreground">{t('affiliate.invited') || "Convidadas"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <Building2 className="w-5 h-5 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{acceptedInvites}</p>
            <p className="text-xs text-muted-foreground">{t('affiliate.converted') || "Convertidas"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <TrendingUp className="w-5 h-5 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground">{t('affiliate.conversionRate') || "Conversão"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <DollarSign className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{pendingCommission.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">{t('affiliate.pending') || "Pendente"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <CreditCard className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{paidCommission.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">{t('affiliate.paid') || "Pago"}</p>
          </CardContent></Card>
          <Card><CardContent className="pt-5 text-center">
            <Trophy className="w-5 h-5 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{(pendingCommission + paidCommission).toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent></Card>
        </div>

        {/* Goal Progress */}
        <Card className="mb-6 border border-primary/10">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold">{t('affiliate.goal') || "Meta"}: {goalTarget} {t('affiliate.convertedShops') || "oficinas convertidas"}</span>
                  <span className="text-sm font-bold text-primary">{goalProgress}/{goalTarget}</span>
                </div>
                <Progress value={(goalProgress / goalTarget) * 100} className="h-2.5" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {goalProgress >= goalTarget 
                ? "🎉 " + (t('affiliate.goalReached') || "Meta atingida! Continue a crescer.")
                : `${t('affiliate.goalRemaining') || "Faltam"} ${goalTarget - goalProgress} ${t('affiliate.goalRemainingShops') || "oficinas para atingir a meta."}`}
            </p>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="invites" className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="invites">{t('affiliate.tabInvites') || "Convites"} ({totalInvites})</TabsTrigger>
            <TabsTrigger value="commissions">{t('affiliate.tabCommissions') || "Comissões"} ({commissions.length})</TabsTrigger>
            <TabsTrigger value="payments">{t('affiliate.tabPayments') || "Pagamentos"}</TabsTrigger>
            <TabsTrigger value="activity">{t('affiliate.tabActivity') || "Atividade"}</TabsTrigger>
          </TabsList>

          {/* Invites Tab */}
          <TabsContent value="invites">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('affiliate.invitedShops') || "Oficinas Convidadas"}</CardTitle>
              </CardHeader>
              <CardContent>
                {invites.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground font-medium">{t('affiliate.noInvitesYet') || "Ainda sem convites"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('affiliate.shareYourLink') || "Partilhe o seu link acima para começar a convidar oficinas!"}</p>
                    <Button onClick={copyLink} className="mt-4 gap-2">
                      <Copy className="w-4 h-4" /> {t('affiliate.copyLink') || "Copiar Link"}
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('affiliate.workshop') || "Oficina"}</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>{t('affiliate.plan') || "Plano"}</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>{t('affiliate.date') || "Data"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invites.map(inv => (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">{inv.workshop_name || "—"}</TableCell>
                          <TableCell className="text-sm">{inv.workshop_email}</TableCell>
                          <TableCell><Badge variant="outline">{inv.plan_offer?.toUpperCase()}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={inv.status === "accepted" ? "default" : "secondary"} className="gap-1">
                              {inv.status === "accepted" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {inv.status === "accepted" ? (t('affiliate.statusAccepted') || "Aceite") : (t('affiliate.statusPending') || "Pendente")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-lg">{t('affiliate.tabCommissions') || "Comissões"}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> {t('affiliate.pending') || "Pendente"}: {pendingCommission.toFixed(2)}€</Badge>
                    <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" /> {t('affiliate.paid') || "Pago"}: {paidCommission.toFixed(2)}€</Badge>
                    {commissions.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => exportCSV(commissions, "comissoes")} className="gap-1">
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {commissions.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">{t('affiliate.noCommissions') || "Sem comissões ainda"}</p>
                    <p className="text-sm text-muted-foreground mt-1">{t('affiliate.commissionDesc') || "Quando uma oficina pagar um plano, a comissão aparece aqui automaticamente."}</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('affiliate.amount') || "Valor"}</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>{t('affiliate.date') || "Data"}</TableHead>
                        <TableHead>{t('affiliate.paidAt') || "Pago em"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissions.map(c => (
                        <TableRow key={c.id}>
                          <TableCell className="font-semibold">{Number(c.amount).toFixed(2)}€</TableCell>
                          <TableCell>
                            <Badge variant={c.status === "paid" ? "default" : "secondary"} className="gap-1">
                              {c.status === "paid" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {c.status === "paid" ? (t('affiliate.paid') || "Pago") : (t('affiliate.pending') || "Pendente")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="text-sm">{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <div className="space-y-4">
              {/* Payout Method */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-primary" />
                      {t('affiliate.paymentMethod') || "Método de Pagamento"}
                    </CardTitle>
                    <Button size="sm" variant={editingPayout ? "default" : "outline"} onClick={() => editingPayout ? savePayout() : setEditingPayout(true)}>
                      {editingPayout ? (t('common.save') || "Guardar") : (t('common.edit') || "Editar")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingPayout ? (
                    <div className="space-y-3 max-w-md">
                      <Select value={payoutForm.method === "mbway" ? "mbway" : "bank_transfer"} onValueChange={v => setPayoutForm({ ...payoutForm, method: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer">{t('affiliate.bankTransfer') || "Transferência Bancária (IBAN)"}</SelectItem>
                          <SelectItem value="mbway">MB WAY</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder={t('affiliate.holderName') || "Nome do titular"} value={payoutForm.holder_name} onChange={e => setPayoutForm({ ...payoutForm, holder_name: e.target.value })} />
                      {payoutForm.method === "bank_transfer" ? (
                        <>
                          <Input placeholder="IBAN" value={payoutForm.iban} onChange={e => setPayoutForm({ ...payoutForm, iban: e.target.value })} />
                          <Input placeholder={t('affiliate.bank') || "Banco"} value={payoutForm.bank} onChange={e => setPayoutForm({ ...payoutForm, bank: e.target.value })} />
                        </>
                      ) : (
                        <Input placeholder={t('affiliate.mbwayNumber') || "Número MB WAY"} value={payoutForm.mbway_phone} onChange={e => setPayoutForm({ ...payoutForm, mbway_phone: e.target.value })} />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {partner.payout_method === "mbway" ? (
                            <><Smartphone className="w-3 h-3 mr-1" /> MB WAY</>
                          ) : (
                            <><CreditCard className="w-3 h-3 mr-1" /> IBAN</>
                          )}
                        </Badge>
                      </div>
                      {partner.payout_holder_name && <p className="text-sm"><span className="text-muted-foreground">{t('affiliate.holder') || "Titular"}:</span> {partner.payout_holder_name}</p>}
                      {partner.payout_method === "mbway" ? (
                        partner.payout_mbway_phone && <p className="text-sm"><span className="text-muted-foreground">MB WAY:</span> {partner.payout_mbway_phone}</p>
                      ) : (
                        <>
                          {partner.payout_iban && <p className="text-sm font-mono"><span className="text-muted-foreground">IBAN:</span> {partner.payout_iban}</p>}
                          {partner.payout_bank && <p className="text-sm"><span className="text-muted-foreground">{t('affiliate.bank') || "Banco"}:</span> {partner.payout_bank}</p>}
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Payment History */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{t('affiliate.paymentHistory') || "Histórico de Pagamentos"}</CardTitle>
                    {payouts.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => exportCSV(payouts, "pagamentos")} className="gap-1">
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {payouts.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">{t('affiliate.noPayments') || "Sem pagamentos realizados"}</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('affiliate.amount') || "Valor"}</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>{t('affiliate.date') || "Data"}</TableHead>
                          <TableHead>{t('affiliate.paidAt') || "Pago em"}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payouts.map(p => (
                          <TableRow key={p.id}>
                            <TableCell className="font-semibold">{Number(p.amount).toFixed(2)}€</TableCell>
                            <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                            <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('affiliate.recentActivity') || "Atividade Recente"}</CardTitle>
              </CardHeader>
              <CardContent>
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t('affiliate.noActivity') || "Sem atividade registada"}</p>
                ) : (
                  <div className="space-y-3">
                    {logs.map(log => (
                      <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{log.action}</p>
                          <p className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </LandingLayout>
  );
}
