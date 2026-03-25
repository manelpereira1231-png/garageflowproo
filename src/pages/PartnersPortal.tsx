import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, TrendingUp, DollarSign, CreditCard, Building2, Trophy, Copy, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";

export default function PartnersPortal() {
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  // Rankings
  const partnerRankings = partners.map((p: any) => {
    const pInvites = invites.filter(i => i.partner_id === p.id);
    const pAccepted = pInvites.filter(i => i.status === "accepted").length;
    const pComm = commissions.filter(c => c.partner_id === p.id);
    const pTotal = pComm.reduce((s: number, c: any) => s + Number(c.amount), 0);
    return { ...p, inviteCount: pInvites.length, acceptedCount: pAccepted, totalEarned: pTotal };
  }).sort((a: any, b: any) => b.totalEarned - a.totalEarned);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portal de Parceiros & Afiliados</h1>
        <p className="text-muted-foreground">Visão geral do ecossistema de parceiros e afiliados</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card><CardContent className="pt-5 text-center"><Users className="w-6 h-6 text-primary mx-auto mb-1" /><p className="text-2xl font-bold">{partners.length}</p><p className="text-xs text-muted-foreground">Parceiros</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><Building2 className="w-6 h-6 text-green-500 mx-auto mb-1" /><p className="text-2xl font-bold">{stats.accepted}</p><p className="text-xs text-muted-foreground">Convertidas</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-1" /><p className="text-2xl font-bold">{stats.conversionRate}%</p><p className="text-xs text-muted-foreground">Conversão</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><DollarSign className="w-6 h-6 text-yellow-500 mx-auto mb-1" /><p className="text-2xl font-bold">{stats.pendingCommissions.toFixed(0)}€</p><p className="text-xs text-muted-foreground">Pendente</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><CreditCard className="w-6 h-6 text-emerald-500 mx-auto mb-1" /><p className="text-2xl font-bold">{stats.paidCommissions.toFixed(0)}€</p><p className="text-xs text-muted-foreground">Pago</p></CardContent></Card>
        <Card><CardContent className="pt-5 text-center"><Trophy className="w-6 h-6 text-amber-500 mx-auto mb-1" /><p className="text-2xl font-bold">{stats.totalRevenue.toFixed(0)}€</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
      </div>

      <Tabs defaultValue="rankings">
        <TabsList>
          <TabsTrigger value="rankings">🏆 Rankings</TabsTrigger>
          <TabsTrigger value="invites">Convites</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
        </TabsList>

        <TabsContent value="rankings">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="w-5 h-5 text-amber-500" />Ranking de Afiliados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Convites</TableHead>
                    <TableHead>Convertidos</TableHead>
                    <TableHead>Total Ganho</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {partnerRankings.map((p: any, i: number) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-bold">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i+1}`}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.inviteCount}</TableCell>
                      <TableCell className="text-green-600 font-semibold">{p.acceptedCount}</TableCell>
                      <TableCell className="font-semibold">{p.totalEarned.toFixed(2)}€</TableCell>
                      <TableCell><Badge variant={p.status === "active" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {partnerRankings.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum parceiro</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
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
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.slice(0, 20).map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.workshop_name || "—"}</TableCell>
                    <TableCell>{inv.workshop_email}</TableCell>
                    <TableCell><Badge variant="outline">{inv.plan_offer?.toUpperCase()}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={inv.status === "accepted" ? "default" : "secondary"} className="gap-1">
                        {inv.status === "accepted" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(inv.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Pago em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.slice(0, 20).map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-semibold">{Number(c.amount).toFixed(2)}€</TableCell>
                    <TableCell>
                      <Badge variant={c.status === "paid" ? "default" : "secondary"} className="gap-1">
                        {c.status === "paid" ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{c.paid_at ? new Date(c.paid_at).toLocaleDateString() : "—"}</TableCell>
                  </TableRow>
                ))}
                {commissions.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-4">Sem comissões</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
