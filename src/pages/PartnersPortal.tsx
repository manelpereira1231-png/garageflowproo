import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, TrendingUp, DollarSign, CreditCard, Building2, Trophy, Copy, 
  CheckCircle, Clock, Target, Sparkles, ArrowUpRight
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export default function PartnersPortal() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    totalInvites: 0, accepted: 0, pendingCommissions: 0, paidCommissions: 0,
    conversionRate: 0, totalRevenue: 0,
  });
  const [invites, setInvites] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [invRes, comRes, partRes] = await Promise.all([
        supabase.from("partner_invites").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("partner_commissions").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("partners").select("*").order("created_at", { ascending: false }),
      ]);
      
      const inv = (invRes.data || []) as any[];
      const com = (comRes.data || []) as any[];
      const parts = (partRes.data || []) as any[];
      
      const accepted = inv.filter(i => i.status === "accepted").length;
      const pending = com.filter(c => c.status === "pending").reduce((s: number, c: any) => s + Number(c.amount), 0);
      const paid = com.filter(c => c.status === "paid").reduce((s: number, c: any) => s + Number(c.amount), 0);
      
      setStats({
        totalInvites: inv.length,
        accepted,
        pendingCommissions: pending,
        paidCommissions: paid,
        conversionRate: inv.length > 0 ? Math.round((accepted / inv.length) * 100) : 0,
        totalRevenue: pending + paid,
      });
      setInvites(inv);
      setCommissions(com);
      setPartners(parts);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5 h-24 animate-pulse bg-muted/30" /></Card>
          ))}
        </div>
        <div className="h-64 bg-muted/20 animate-pulse rounded-lg" />
      </div>
    );
  }

  // Rankings
  const partnerRankings = partners.map((p: any) => {
    const pInvites = invites.filter(i => i.partner_id === p.id);
    const pAccepted = pInvites.filter(i => i.status === "accepted").length;
    const pComm = commissions.filter(c => c.partner_id === p.id);
    const pTotal = pComm.reduce((s: number, c: any) => s + Number(c.amount), 0);
    return { ...p, inviteCount: pInvites.length, acceptedCount: pAccepted, totalEarned: pTotal };
  }).sort((a: any, b: any) => b.totalEarned - a.totalEarned);

  // Progress goal: 5 accepted invites = milestone
  const goalTarget = 5;
  const goalProgress = Math.min(stats.accepted, goalTarget);
  const goalPercent = Math.round((goalProgress / goalTarget) * 100);

  const copyAffiliateLink = (partnerId: string) => {
    const link = `${window.location.origin}/auth?mode=signup&partner=${partnerId}`;
    navigator.clipboard.writeText(link);
    toast.success("Link copiado! 📋");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Portal de Parceiros & Afiliados
          </h1>
          <p className="text-muted-foreground text-sm">Visão geral do ecossistema de parceiros e afiliados</p>
        </div>
        <Button variant="outline" onClick={() => window.open("/afiliados", "_blank")} className="gap-2">
          <Sparkles className="w-4 h-4" /> Página de Registo
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-5 text-center">
            <Users className="w-6 h-6 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{partners.length}</p>
            <p className="text-xs text-muted-foreground">Parceiros</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-5 text-center">
            <Building2 className="w-6 h-6 text-green-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.accepted}</p>
            <p className="text-xs text-muted-foreground">Convertidas</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-5 text-center">
            <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.conversionRate}%</p>
            <p className="text-xs text-muted-foreground">Conversão</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-5 text-center">
            <DollarSign className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.pendingCommissions.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">Pendente</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-5 text-center">
            <CreditCard className="w-6 h-6 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.paidCommissions.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">Pago</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="pt-5 text-center">
            <Trophy className="w-6 h-6 text-amber-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{stats.totalRevenue.toFixed(0)}€</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Goal Progress */}
      <Card className="border-2 border-primary/10">
        <CardContent className="pt-5">
          <div className="flex items-center gap-3 mb-3">
            <Target className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold">Meta: {goalTarget} oficinas convertidas</span>
                <span className="text-sm font-bold text-primary">{goalProgress}/{goalTarget}</span>
              </div>
              <Progress value={goalPercent} className="h-2.5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {goalProgress >= goalTarget 
              ? "🎉 Meta atingida! Continue a crescer." 
              : `Faltam ${goalTarget - goalProgress} oficinas para atingir a meta.`}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="rankings">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="rankings">🏆 Rankings</TabsTrigger>
          <TabsTrigger value="invites">Convites ({invites.length})</TabsTrigger>
          <TabsTrigger value="commissions">Comissões ({commissions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> Ranking de Afiliados
              </CardTitle>
              <CardDescription>Ordenado por total de comissões ganhas</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Convites</TableHead>
                    <TableHead>Convertidos</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Total Ganho</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerRankings.map((p: any, i: number) => (
                    <TableRow key={p.id} className={i < 3 ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}>
                      <TableCell className="font-bold text-lg">
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                      </TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.inviteCount}</TableCell>
                      <TableCell className="text-green-600 font-semibold">{p.acceptedCount}</TableCell>
                      <TableCell>{p.inviteCount > 0 ? Math.round((p.acceptedCount / p.inviteCount) * 100) : 0}%</TableCell>
                      <TableCell className="font-semibold">{p.totalEarned.toFixed(2)}€</TableCell>
                      <TableCell>
                        <Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => copyAffiliateLink(p.id)} className="gap-1 text-xs">
                          <Copy className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {partnerRankings.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Nenhum parceiro registado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites">
          <Card>
            <CardHeader>
              <CardTitle>Convites Enviados</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Oficina</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.slice(0, 30).map(inv => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium">{inv.workshop_name || "—"}</TableCell>
                      <TableCell className="text-sm">{inv.workshop_email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{inv.plan_offer?.toUpperCase()}</Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {inv.plan_offer === "garage" ? "20%" : "10%"}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={inv.status === "accepted" ? "default" : "secondary"} 
                          className="gap-1"
                        >
                          {inv.status === "accepted" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {inv.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {invites.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhum convite enviado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle>Comissões</CardTitle>
                <div className="flex gap-2 text-sm">
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="w-3 h-3" /> Pendente: {stats.pendingCommissions.toFixed(2)}€
                  </Badge>
                  <Badge variant="default" className="gap-1">
                    <CheckCircle className="w-3 h-3" /> Pago: {stats.paidCommissions.toFixed(2)}€
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
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
                  {commissions.slice(0, 30).map(c => {
                    const partner = partners.find(p => p.id === c.partner_id);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{partner?.name || "—"}</TableCell>
                        <TableCell className="font-semibold">{Number(c.amount).toFixed(2)}€</TableCell>
                        <TableCell>
                          <Badge variant={c.status === "paid" ? "default" : "secondary"} className="gap-1">
                            {c.status === "paid" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-sm">{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {commissions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Sem comissões registadas
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
