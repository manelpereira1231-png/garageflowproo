import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signOutRealm } from "@/integrations/supabase/realmBridge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, TrendingUp, DollarSign, CreditCard, Building2, Trophy, Copy, 
  CheckCircle, Clock, Target, Sparkles, Link as LinkIcon, Download,
  Smartphone, LogOut, Share2, MessageCircle
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate } from "react-router-dom";
import LandingLayout from "@/components/LandingLayout";
import { useCountryPricing } from "@/hooks/useCountryPricing";

// Affiliate commission percentages (the only fixed value — the monetary amount
// is computed dynamically from the current plan price in country_settings).
const PRO_COMMISSION_RATE = 0.10;
const GARAGE_COMMISSION_RATE = 0.20;

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
  const [savingPayout, setSavingPayout] = useState(false);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: partnerData } = await supabase
        .from("partners")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (!partnerData) {
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

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`${t('affiliate.whatsappShare') || "Experimenta o GarageFlow para a tua oficina! Regista-te aqui:"} ${affiliateLink}`);
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const handleLogout = async () => {
    await signOutRealm("erp");
    navigate("/");
  };

  const savePayout = async () => {
    if (!partner) return;
    setSavingPayout(true);
    const { error } = await supabase.from("partners").update({
      payout_method: payoutForm.method,
      payout_holder_name: payoutForm.holder_name,
      payout_iban: payoutForm.iban,
      payout_mbway_phone: payoutForm.mbway_phone,
      payout_bank: payoutForm.bank,
    }).eq("id", partner.id);

    if (error) {
      toast.error(t('affiliate.payoutError') || "Erro ao guardar dados de pagamento");
    } else {
      toast.success(t('affiliate.payoutSaved') || "Dados de pagamento atualizados ✅");
      setEditingPayout(false);
      loadData();
    }
    setSavingPayout(false);
  };

  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) { toast.error(t('affiliate.noDataExport') || "Sem dados para exportar"); return; }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([headers + "\n" + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t('affiliate.csvExported') || "CSV exportado ✅");
  };

  // Stats
  const totalInvites = invites.length;
  const acceptedInvites = invites.filter(i => i.status === "accepted").length;
  const pendingCommission = commissions.filter(c => c.status === "pending").reduce((s, c) => s + Number(c.amount), 0);
  const paidCommission = commissions.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount), 0);
  const conversionRate = totalInvites > 0 ? Math.round((acceptedInvites / totalInvites) * 100) : 0;
  const goalTarget = 5;
  const goalProgress = Math.min(acceptedInvites, goalTarget);

  // Premium Skeleton Loading
  if (loading) {
    return (
      <LandingLayout>
        <div className="container mx-auto px-4 py-6 md:py-10 max-w-6xl">
          {/* Header skeleton */}
          <div className="flex items-center justify-between mb-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-40" />
            </div>
            <Skeleton className="h-9 w-20" />
          </div>
          {/* Link card skeleton */}
          <Skeleton className="h-28 w-full rounded-xl mb-6" />
          {/* KPI skeletons */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          {/* Goal skeleton */}
          <Skeleton className="h-20 w-full rounded-xl mb-6" />
          {/* Tabs skeleton */}
          <Skeleton className="h-10 w-full max-w-lg mb-4" />
          <Skeleton className="h-64 w-full rounded-xl" />
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
              {t('affiliate.welcome') || "Bem-vindo"}, <span className="font-semibold text-foreground">{partner.name}</span>
              <Badge variant="outline" className="ml-2 text-xs">{partner.api_key}</Badge>
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <Input value={affiliateLink} readOnly className="font-mono text-xs bg-background flex-1" />
              <div className="flex gap-2">
                <Button onClick={copyLink} size="sm" variant="default" className="gap-2 flex-1 sm:flex-none min-h-[44px] sm:min-h-0">
                  <Copy className="w-4 h-4" /> {t('affiliate.copyLink') || "Copiar"}
                </Button>
                <Button onClick={shareWhatsApp} size="sm" variant="outline" className="gap-2 flex-1 sm:flex-none min-h-[44px] sm:min-h-0">
                  <MessageCircle className="w-4 h-4" /> WhatsApp
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {t('affiliate.linkDesc') || "Partilhe este link. Cada oficina que se registar e pagar gera comissão automática para si."}
            </p>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { icon: Users, color: "text-primary", value: totalInvites, label: t('affiliate.invited') || "Convidadas" },
            { icon: Building2, color: "text-green-500", value: acceptedInvites, label: t('affiliate.converted') || "Convertidas" },
            { icon: TrendingUp, color: "text-blue-500", value: `${conversionRate}%`, label: t('affiliate.conversionRate') || "Conversão" },
            { icon: DollarSign, color: "text-amber-500", value: `${pendingCommission.toFixed(0)}€`, label: t('affiliate.pending') || "Pendente" },
            { icon: CreditCard, color: "text-emerald-500", value: `${paidCommission.toFixed(0)}€`, label: t('affiliate.paid') || "Pago" },
            { icon: Trophy, color: "text-amber-500", value: `${(pendingCommission + paidCommission).toFixed(0)}€`, label: "Total" },
          ].map((kpi, i) => (
            <Card key={i} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4 text-center">
                <kpi.icon className={`w-5 h-5 ${kpi.color} mx-auto mb-1`} />
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Goal Progress */}
        <Card className="mb-6 border border-primary/10">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3 mb-3">
              <Target className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
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
          <TabsList className="w-full flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="invites" className="flex-1 min-w-[100px] min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              {t('affiliate.tabInvites') || "Convites"} ({totalInvites})
            </TabsTrigger>
            <TabsTrigger value="commissions" className="flex-1 min-w-[100px] min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              {t('affiliate.tabCommissions') || "Comissões"} ({commissions.length})
            </TabsTrigger>
            <TabsTrigger value="rankings" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              {t('affiliate.tabRankings') || "Rankings"}
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex-1 min-w-[100px] min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              {t('affiliate.tabPayments') || "Pagamentos"}
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 min-w-[80px] min-h-[44px] sm:min-h-0 text-xs sm:text-sm">
              {t('affiliate.tabActivity') || "Atividade"}
            </TabsTrigger>
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
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                      <Users className="w-8 h-8 text-primary/40" />
                    </div>
                    <p className="font-semibold text-foreground mb-1">{t('affiliate.noInvitesYet') || "Ainda sem convites"}</p>
                    <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                      {t('affiliate.shareYourLink') || "Partilhe o seu link acima para começar a convidar oficinas!"}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button onClick={copyLink} className="gap-2 min-h-[44px]">
                        <Copy className="w-4 h-4" /> {t('affiliate.copyLink') || "Copiar Link"}
                      </Button>
                      <Button onClick={shareWhatsApp} variant="outline" className="gap-2 min-h-[44px]">
                        <MessageCircle className="w-4 h-4" /> {t('affiliate.shareWhatsApp') || "Partilhar WhatsApp"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="space-y-3 md:hidden">
                      {invites.map(inv => (
                        <div key={inv.id} className="p-4 rounded-lg border bg-card">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-sm">{inv.workshop_name || "—"}</span>
                            <Badge variant={inv.status === "accepted" ? "default" : "secondary"} className="gap-1 text-xs">
                              {inv.status === "accepted" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {inv.status === "accepted" ? (t('affiliate.statusAccepted') || "Aceite") : (t('affiliate.statusPending') || "Pendente")}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-1">{inv.workshop_email}</p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">{inv.plan_offer?.toUpperCase()}</Badge>
                            <span className="text-xs text-muted-foreground">{new Date(inv.created_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block">
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
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Commissions Tab */}
          <TabsContent value="commissions">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg">{t('affiliate.tabCommissions') || "Comissões"}</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1"><Clock className="w-3 h-3" /> {t('affiliate.pending') || "Pendente"}: {pendingCommission.toFixed(2)}€</Badge>
                    <Badge variant="default" className="gap-1"><CheckCircle className="w-3 h-3" /> {t('affiliate.paid') || "Pago"}: {paidCommission.toFixed(2)}€</Badge>
                    {commissions.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => exportCSV(commissions, "comissoes")} className="gap-1 min-h-[36px]">
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {commissions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
                      <DollarSign className="w-8 h-8 text-amber-500/40" />
                    </div>
                    <p className="font-semibold text-foreground mb-1">{t('affiliate.noCommissions') || "Sem comissões ainda"}</p>
                    <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                      {t('affiliate.commissionDesc') || "Quando uma oficina pagar um plano, a comissão aparece aqui automaticamente."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="space-y-3 md:hidden">
                      {commissions.map(c => (
                        <div key={c.id} className="p-4 rounded-lg border bg-card flex items-center justify-between">
                          <div>
                            <p className="font-bold text-lg">{Number(c.amount).toFixed(2)}€</p>
                            <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</p>
                          </div>
                          <Badge variant={c.status === "paid" ? "default" : "secondary"} className="gap-1">
                            {c.status === "paid" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {c.status === "paid" ? (t('affiliate.paid') || "Pago") : (t('affiliate.pending') || "Pendente")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden md:block">
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
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Rankings Tab */}
          <TabsContent value="rankings">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  {t('affiliate.rankingsTitle') || "Ranking de Afiliados"}
                </CardTitle>
                <CardDescription>{t('affiliate.rankingsDesc') || "A sua posição com base em conversões e comissões geradas."}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* Your position */}
                  <div className="p-4 rounded-xl border-2 border-primary/20 bg-primary/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-lg">
                          {partner.name?.charAt(0)?.toUpperCase() || "A"}
                        </div>
                        <div>
                          <p className="font-bold">{partner.name}</p>
                          <p className="text-xs text-muted-foreground">{partner.api_key}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-primary">{acceptedInvites}</p>
                        <p className="text-xs text-muted-foreground">{t('affiliate.conversions') || "conversões"}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
                      <div className="p-2 rounded-lg bg-background">
                        <p className="text-sm font-bold">{totalInvites}</p>
                        <p className="text-xs text-muted-foreground">{t('affiliate.invited') || "Convidadas"}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-background">
                        <p className="text-sm font-bold">{conversionRate}%</p>
                        <p className="text-xs text-muted-foreground">{t('affiliate.conversionRate') || "Conversão"}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-background">
                        <p className="text-sm font-bold">{(pendingCommission + paidCommission).toFixed(0)}€</p>
                        <p className="text-xs text-muted-foreground">{t('affiliate.totalEarned') || "Total ganho"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Goals & Milestones */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-primary" />
                      {t('affiliate.milestones') || "Metas e Conquistas"}
                    </h3>
                    <div className="space-y-3">
                      {[
                        { target: 1, label: t('affiliate.milestone1') || "Primeira conversão", reward: "🏅" },
                        { target: 5, label: t('affiliate.milestone5') || "5 oficinas convertidas", reward: "🥈" },
                        { target: 10, label: t('affiliate.milestone10') || "10 oficinas convertidas", reward: "🥇" },
                        { target: 25, label: t('affiliate.milestone25') || "25 oficinas — Afiliado Gold", reward: "🏆" },
                        { target: 50, label: t('affiliate.milestone50') || "50 oficinas — Afiliado Diamond", reward: "💎" },
                      ].map(m => {
                        const reached = acceptedInvites >= m.target;
                        const progress = Math.min((acceptedInvites / m.target) * 100, 100);
                        return (
                          <div key={m.target} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${reached ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20'}`}>
                            <span className="text-xl">{m.reward}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-sm font-medium ${reached ? 'text-primary' : ''}`}>{m.label}</span>
                                <span className="text-xs text-muted-foreground">{Math.min(acceptedInvites, m.target)}/{m.target}</span>
                              </div>
                              <Progress value={progress} className="h-1.5" />
                            </div>
                            {reached && <CheckCircle className="w-4 h-4 text-primary shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Commission Tiers */}
                  <div className="p-4 rounded-xl bg-muted/30 border">
                    <h3 className="font-semibold text-sm mb-3">{t('affiliate.commissionTiers') || "Tabela de Comissões"}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-background text-center">
                        <p className="text-xl font-black text-primary">10%</p>
                        <p className="text-xs font-medium">{t('affiliate.planPro') || "Plano Pro"}</p>
                        <p className="text-xs text-muted-foreground">4,90€/{t('common.month') || "mês"}</p>
                      </div>
                      <div className="p-3 rounded-lg bg-background text-center">
                        <p className="text-xl font-black text-primary">20%</p>
                        <p className="text-xs font-medium">{t('affiliate.planGarage') || "Plano Garage"}</p>
                        <p className="text-xs text-muted-foreground">19,80€/{t('common.month') || "mês"}</p>
                      </div>
                    </div>
                  </div>
                </div>
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
                    <Button 
                      size="sm" 
                      variant={editingPayout ? "default" : "outline"} 
                      onClick={() => editingPayout ? savePayout() : setEditingPayout(true)}
                      disabled={savingPayout}
                      className="min-h-[40px]"
                    >
                      {savingPayout ? (
                        <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                      ) : editingPayout ? (t('common.save') || "Guardar") : (t('common.edit') || "Editar")}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {editingPayout ? (
                    <div className="space-y-3 max-w-md">
                      <Select value={payoutForm.method === "mbway" ? "mbway" : "bank_transfer"} onValueChange={v => setPayoutForm({ ...payoutForm, method: v })}>
                        <SelectTrigger className="min-h-[44px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank_transfer">{t('affiliate.bankTransfer') || "Transferência Bancária (IBAN)"}</SelectItem>
                          <SelectItem value="mbway">MB WAY</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input placeholder={t('affiliate.holderName') || "Nome do titular"} value={payoutForm.holder_name} onChange={e => setPayoutForm({ ...payoutForm, holder_name: e.target.value })} className="min-h-[44px]" />
                      {payoutForm.method === "bank_transfer" ? (
                        <>
                          <Input placeholder="IBAN" value={payoutForm.iban} onChange={e => setPayoutForm({ ...payoutForm, iban: e.target.value })} className="min-h-[44px]" />
                          <Input placeholder={t('affiliate.bank') || "Banco"} value={payoutForm.bank} onChange={e => setPayoutForm({ ...payoutForm, bank: e.target.value })} className="min-h-[44px]" />
                        </>
                      ) : (
                        <Input placeholder={t('affiliate.mbwayNumber') || "Número MB WAY"} value={payoutForm.mbway_phone} onChange={e => setPayoutForm({ ...payoutForm, mbway_phone: e.target.value })} className="min-h-[44px]" />
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEditingPayout(false)} className="min-h-[40px]">
                        {t('common.cancel') || "Cancelar"}
                      </Button>
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
                      {!partner.payout_holder_name && !partner.payout_iban && !partner.payout_mbway_phone && (
                        <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-700 dark:text-amber-400">
                          ⚠️ {t('affiliate.noPayoutConfigured') || "Configure os seus dados de pagamento para receber comissões."}
                        </div>
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
                      <Button size="sm" variant="outline" onClick={() => exportCSV(payouts, "pagamentos")} className="gap-1 min-h-[36px]">
                        <Download className="w-3 h-3" /> CSV
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {payouts.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                        <CreditCard className="w-7 h-7 text-muted-foreground/40" />
                      </div>
                      <p className="font-medium text-foreground mb-1">{t('affiliate.noPayments') || "Sem pagamentos realizados"}</p>
                      <p className="text-xs text-muted-foreground">{t('affiliate.paymentsWillAppear') || "Os pagamentos aparecerão aqui quando forem processados."}</p>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-3 md:hidden">
                        {payouts.map(p => (
                          <div key={p.id} className="p-4 rounded-lg border bg-card flex items-center justify-between">
                            <div>
                              <p className="font-bold text-lg">{Number(p.amount).toFixed(2)}€</p>
                              <p className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</p>
                            </div>
                            <Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status === "paid" ? (t('affiliate.paid') || "Pago") : (t('affiliate.pending') || "Pendente")}</Badge>
                          </div>
                        ))}
                      </div>
                      <div className="hidden md:block">
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
                                <TableCell><Badge variant={p.status === "paid" ? "default" : "secondary"}>{p.status === "paid" ? (t('affiliate.paid') || "Pago") : (t('affiliate.pending') || "Pendente")}</Badge></TableCell>
                                <TableCell className="text-sm">{new Date(p.created_at).toLocaleDateString()}</TableCell>
                                <TableCell className="text-sm">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </>
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
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                      <Clock className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <p className="font-medium text-foreground mb-1">{t('affiliate.noActivity') || "Sem atividade registada"}</p>
                    <p className="text-xs text-muted-foreground">{t('affiliate.activityWillAppear') || "As suas ações e eventos aparecerão aqui."}</p>
                  </div>
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
