import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, TrendingUp, DollarSign, CreditCard, Building2 } from "lucide-react";

export default function PartnersPortal() {
  const [stats, setStats] = useState({
    totalInvites: 0, accepted: 0, pendingCommissions: 0, paidCommissions: 0,
    conversionRate: 0, totalRevenue: 0,
  });
  const [invites, setInvites] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      // For now, show all partner data (super admin only page)
      const [invRes, comRes] = await Promise.all([
        supabase.from("partner_invites").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("partner_commissions").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      
      const inv = (invRes.data || []) as any[];
      const com = (comRes.data || []) as any[];
      
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
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Portal de Parceiros</h1>
        <p className="text-muted-foreground">Visão geral do ecossistema de parceiros</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Users className="w-8 h-8 text-primary" /><div><p className="text-sm text-muted-foreground">Convites Enviados</p><p className="text-2xl font-bold">{stats.totalInvites}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><Building2 className="w-8 h-8 text-green-500" /><div><p className="text-sm text-muted-foreground">Oficinas Convertidas</p><p className="text-2xl font-bold">{stats.accepted}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><TrendingUp className="w-8 h-8 text-yellow-500" /><div><p className="text-sm text-muted-foreground">Taxa Conversão</p><p className="text-2xl font-bold">{stats.conversionRate}%</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><DollarSign className="w-8 h-8 text-blue-500" /><div><p className="text-sm text-muted-foreground">Receita Total</p><p className="text-2xl font-bold">{stats.totalRevenue.toFixed(2)}€</p></div></div></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Últimos Convites</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Oficina</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.slice(0, 10).map(inv => (
                  <TableRow key={inv.id}>
                    <TableCell>{inv.workshop_name || "—"}</TableCell>
                    <TableCell>{inv.workshop_email}</TableCell>
                    <TableCell><Badge variant={inv.status === "accepted" ? "default" : "secondary"}>{inv.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Últimas Comissões</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {commissions.slice(0, 10).map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{Number(c.amount).toFixed(2)}€</TableCell>
                    <TableCell><Badge variant={c.status === "paid" ? "default" : "secondary"}>{c.status}</Badge></TableCell>
                    <TableCell>{new Date(c.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
                {commissions.length === 0 && (
                  <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">Sem comissões</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
