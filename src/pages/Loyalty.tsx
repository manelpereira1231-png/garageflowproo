import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Gift, Plus, TrendingUp, Users, Search } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const TIER_COLORS: Record<string, string> = {
  bronze: "bg-amber-600/10 text-amber-700 border-amber-300",
  silver: "bg-slate-400/10 text-slate-600 border-slate-300",
  gold: "bg-yellow-500/10 text-yellow-700 border-yellow-300",
  platinum: "bg-violet-500/10 text-violet-700 border-violet-300",
};

function getTier(points: number): string {
  if (points >= 5000) return 'platinum';
  if (points >= 2000) return 'gold';
  if (points >= 500) return 'silver';
  return 'bronze';
}

export default function Loyalty() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [addDialog, setAddDialog] = useState(false);
  const [pointsDialog, setPointsDialog] = useState<any>(null);
  const [form, setForm] = useState({ client_id: "", points: "100", type: "earn", description: "" });

  const shopId = localStorage.getItem("garageflow_active_shop");

  const load = async () => {
    if (!shopId) return;
    const [membersRes, clientsRes, txRes] = await Promise.all([
      supabase.from("loyalty_points").select("*, clients(name, email, phone)").eq("shop_id", shopId).order("points", { ascending: false }),
      supabase.from("clients").select("id, name").eq("shop_id", shopId).is("deleted_at", null).order("name"),
      supabase.from("loyalty_transactions").select("*, clients(name)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (membersRes.data) setMembers(membersRes.data);
    if (clientsRes.data) setClients(clientsRes.data);
    if (txRes.data) setTransactions(txRes.data);
  };

  useEffect(() => { load(); }, []);

  const addMember = async () => {
    if (!shopId || !form.client_id) return;
    const existing = members.find(m => m.client_id === form.client_id);
    if (existing) { toast.error(t('loyalty.alreadyMember')); return; }

    await supabase.from("loyalty_points").insert({
      shop_id: shopId, client_id: form.client_id, points: 0, tier: 'bronze',
    } as any);
    toast.success(t('loyalty.memberAdded'));
    setAddDialog(false);
    load();
  };

  const addPoints = async () => {
    if (!shopId || !pointsDialog) return;
    const pts = parseInt(form.points);
    if (!pts || pts <= 0) return;

    const isRedeem = form.type === 'redeem';
    const member = pointsDialog;

    if (isRedeem && pts > member.points) {
      toast.error(t('loyalty.insufficientPoints'));
      return;
    }

    const newPoints = isRedeem ? member.points - pts : member.points + pts;
    const updates: any = { points: newPoints, tier: getTier(newPoints), updated_at: new Date().toISOString() };
    if (!isRedeem) updates.total_earned = (member.total_earned || 0) + pts;
    else updates.total_redeemed = (member.total_redeemed || 0) + pts;

    await supabase.from("loyalty_points").update(updates).eq("id", member.id);
    await supabase.from("loyalty_transactions").insert({
      shop_id: shopId, client_id: member.client_id,
      points: isRedeem ? -pts : pts, type: form.type,
      description: form.description || (isRedeem ? t('loyalty.redeemed') : t('loyalty.earned')),
    } as any);

    toast.success(isRedeem ? t('loyalty.pointsRedeemed') : t('loyalty.pointsAdded'));
    setPointsDialog(null);
    setForm({ client_id: "", points: "100", type: "earn", description: "" });
    load();
  };

  const totalPoints = members.reduce((s, m) => s + m.points, 0);
  const totalEarned = members.reduce((s, m) => s + (m.total_earned || 0), 0);
  const totalRedeemed = members.reduce((s, m) => s + (m.total_redeemed || 0), 0);
  const redemptionRate = totalEarned > 0 ? ((totalRedeemed / totalEarned) * 100).toFixed(1) : '0';
  const filtered = members.filter(m =>
    (m.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Star className="w-6 h-6 text-yellow-500" />{t('loyalty.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('loyalty.subtitle')}</p>
        </div>
        <Button onClick={() => setAddDialog(true)}><Plus className="w-4 h-4 mr-2" />{t('loyalty.addMember')}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Users className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">{t('loyalty.totalMembers')}</p><p className="text-2xl font-bold">{members.length}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Star className="w-5 h-5 text-yellow-500" /><div><p className="text-xs text-muted-foreground">{t('loyalty.totalPoints')}</p><p className="text-2xl font-bold">{totalPoints.toLocaleString()}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Gift className="w-5 h-5 text-success" /><div><p className="text-xs text-muted-foreground">{t('loyalty.totalRedeemed')}</p><p className="text-2xl font-bold">{totalRedeemed.toLocaleString()}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><TrendingUp className="w-5 h-5 text-info" /><div><p className="text-xs text-muted-foreground">{t('loyalty.redemptionRate')}</p><p className="text-2xl font-bold">{redemptionRate}%</p></div></div></CardContent></Card>
      </div>

      <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><Input placeholder={t('loyalty.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" /></div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('loyalty.client')}</TableHead>
            <TableHead className="text-center">{t('loyalty.points')}</TableHead>
            <TableHead className="text-center">{t('loyalty.tier')}</TableHead>
            <TableHead className="text-right">{t('loyalty.totalEarned')}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('loyalty.empty')}</TableCell></TableRow>
            ) : filtered.map(m => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{(m.clients as any)?.name}</TableCell>
                <TableCell className="text-center font-bold text-lg">{m.points}</TableCell>
                <TableCell className="text-center"><Badge variant="outline" className={TIER_COLORS[getTier(m.points)]}>{getTier(m.points)}</Badge></TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">{m.total_earned || 0}</TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    <Button variant="outline" size="sm" className="text-xs" onClick={() => { setPointsDialog(m); setForm({ ...form, type: "earn", points: "100", description: "" }); }}><Plus className="w-3 h-3 mr-1" />{t('loyalty.addPoints')}</Button>
                    <Button variant="ghost" size="sm" className="text-xs" onClick={() => { setPointsDialog(m); setForm({ ...form, type: "redeem", points: "100", description: "" }); }}><Gift className="w-3 h-3 mr-1" />{t('loyalty.redeem')}</Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('loyalty.recentTransactions')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                  <div>
                    <span className="font-medium">{(tx.clients as any)?.name}</span>
                    <span className="text-muted-foreground ml-2">{tx.description}</span>
                  </div>
                  <span className={`font-bold ${tx.points > 0 ? 'text-success' : 'text-destructive'}`}>
                    {tx.points > 0 ? '+' : ''}{tx.points} pts
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add member dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('loyalty.addMember')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('loyalty.client')}</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder={t('loyalty.selectClient')} /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={addMember} disabled={!form.client_id}>{t('loyalty.addMember')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Points dialog */}
      <Dialog open={!!pointsDialog} onOpenChange={o => !o && setPointsDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{form.type === 'earn' ? t('loyalty.addPoints') : t('loyalty.redeemPoints')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('loyalty.points')}</Label><Input type="number" value={form.points} onChange={e => setForm({ ...form, points: e.target.value })} min="1" /></div>
            <div><Label>{t('loyalty.description')}</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder={form.type === 'earn' ? t('loyalty.earnReason') : t('loyalty.redeemReason')} /></div>
          </div>
          <DialogFooter><Button onClick={addPoints}>{form.type === 'earn' ? t('loyalty.addPoints') : t('loyalty.redeemPoints')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
