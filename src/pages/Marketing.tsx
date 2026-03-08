import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Megaphone, Plus, Send, Mail, Users, TrendingUp, Clock } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-info/10 text-info",
  sending: "bg-warning/10 text-warning",
  sent: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function Marketing() {
  const { t } = useLanguage();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "email", subject: "", content: "",
    target_segment: "all", scheduled_at: "",
  });

  const shopId = localStorage.getItem("garageflow_active_shop");

  const load = async () => {
    if (!shopId) return;
    const [campRes, clientRes] = await Promise.all([
      supabase.from("campaigns").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
      supabase.from("clients").select("id, email").eq("shop_id", shopId).is("deleted_at", null).neq("email", ""),
    ]);
    if (campRes.data) setCampaigns(campRes.data);
    if (clientRes.data) setClients(clientRes.data);
  };

  useEffect(() => { load(); }, []);

  const createCampaign = async () => {
    if (!shopId || !form.name || !form.subject) {
      toast.error(t('marketing.fillRequired'));
      return;
    }
    const recipientsCount = form.target_segment === 'all' ? clients.length : Math.ceil(clients.length * 0.3);
    const { error } = await supabase.from("campaigns").insert({
      shop_id: shopId, name: form.name, type: form.type,
      subject: form.subject, content: form.content,
      target_segment: form.target_segment,
      recipients_count: recipientsCount,
      status: form.scheduled_at ? 'scheduled' : 'draft',
      scheduled_at: form.scheduled_at || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(t('marketing.created'));
    setDialogOpen(false);
    setForm({ name: "", type: "email", subject: "", content: "", target_segment: "all", scheduled_at: "" });
    load();
  };

  const sendCampaign = async (campaign: any) => {
    if (!shopId) return;
    // Mark as sent (actual email sending would be via edge function)
    await supabase.from("campaigns").update({
      status: 'sent', sent_at: new Date().toISOString(),
    } as any).eq("id", campaign.id);
    toast.success(t('marketing.sent'));
    load();
  };

  const cancelCampaign = async (id: string) => {
    await supabase.from("campaigns").update({ status: 'cancelled' } as any).eq("id", id);
    load();
  };

  const totalSent = campaigns.filter(c => c.status === 'sent').length;
  const totalRecipients = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (c.recipients_count || 0), 0);

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Megaphone className="w-6 h-6 text-primary" />{t('marketing.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('marketing.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />{t('marketing.newCampaign')}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Send className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">{t('marketing.totalCampaigns')}</p><p className="text-2xl font-bold">{campaigns.length}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Mail className="w-5 h-5 text-success" /><div><p className="text-xs text-muted-foreground">{t('marketing.sentCampaigns')}</p><p className="text-2xl font-bold">{totalSent}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Users className="w-5 h-5 text-info" /><div><p className="text-xs text-muted-foreground">{t('marketing.totalReached')}</p><p className="text-2xl font-bold">{totalRecipients}</p></div></div></CardContent></Card>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead>{t('marketing.campaignName')}</TableHead>
            <TableHead>{t('marketing.type')}</TableHead>
            <TableHead>{t('marketing.segment')}</TableHead>
            <TableHead className="text-center">{t('marketing.recipients')}</TableHead>
            <TableHead>{t('marketing.status')}</TableHead>
            <TableHead></TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('marketing.empty')}</TableCell></TableRow>
            ) : campaigns.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                <TableCell className="text-sm">{t(`marketing.seg_${c.target_segment}`)}</TableCell>
                <TableCell className="text-center">{c.recipients_count}</TableCell>
                <TableCell><Badge variant="secondary" className={STATUS_COLORS[c.status]}>{t(`marketing.st_${c.status}`)}</Badge></TableCell>
                <TableCell>
                  <div className="flex gap-1 justify-end">
                    {['draft', 'scheduled'].includes(c.status) && (
                      <>
                        <Button variant="outline" size="sm" className="text-xs" onClick={() => sendCampaign(c)}><Send className="w-3 h-3 mr-1" />{t('marketing.send')}</Button>
                        <Button variant="ghost" size="sm" className="text-xs text-destructive" onClick={() => cancelCampaign(c.id)}>✕</Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('marketing.newCampaign')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('marketing.campaignName')}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('marketing.namePlaceholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t('marketing.type')}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t('marketing.segment')}</Label>
                <Select value={form.target_segment} onValueChange={v => setForm({ ...form, target_segment: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('marketing.seg_all')}</SelectItem>
                    <SelectItem value="inactive">{t('marketing.seg_inactive')}</SelectItem>
                    <SelectItem value="frequent">{t('marketing.seg_frequent')}</SelectItem>
                    <SelectItem value="new">{t('marketing.seg_new')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t('marketing.subject')}</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder={t('marketing.subjectPlaceholder')} /></div>
            <div><Label>{t('marketing.content')}</Label><Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={4} placeholder={t('marketing.contentPlaceholder')} /></div>
            <div><Label>{t('marketing.scheduleAt')}</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground"><Users className="w-3 h-3 inline mr-1" />{clients.length} {t('marketing.eligibleClients')}</p>
          </div>
          <DialogFooter><Button onClick={createCampaign}>{t('marketing.create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
