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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Megaphone, Plus, Send, Mail, Users, TrendingUp, Clock, Trash2, Eye, Search } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useShopContext } from "@/hooks/useShopContext";
import { toast } from "sonner";
import ListSkeleton from "@/components/ListSkeleton";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  sending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  sent: "bg-green-500/10 text-green-700 dark:text-green-400",
  cancelled: "bg-destructive/10 text-destructive",
};

export default function Marketing() {
  const { t } = useLanguage();
  const { activeShopId } = useShopContext();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailCampaign, setDetailCampaign] = useState<any | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dataLoading, setDataLoading] = useState(true);
  const [form, setForm] = useState({
    name: "", type: "email", subject: "", content: "",
    target_segment: "all", scheduled_at: "",
  });

  const load = async () => {
    if (!activeShopId) { setDataLoading(false); return; }
    setDataLoading(true);
    try {
      const [campRes, clientRes] = await Promise.all([
        supabase.from("campaigns").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
        supabase.from("clients").select("id, email, name").eq("shop_id", activeShopId).is("deleted_at", null).neq("email", ""),
      ]);
      if (campRes.data) setCampaigns(campRes.data);
      if (clientRes.data) setClients(clientRes.data);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeShopId]);

  const createCampaign = async () => {
    if (!activeShopId || !form.name || !form.subject) {
      toast.error(t('marketing.fillRequired'));
      return;
    }
    const recipientsCount = form.target_segment === 'all' ? clients.length : Math.ceil(clients.length * 0.3);
    const { error } = await supabase.from("campaigns").insert({
      shop_id: activeShopId, name: form.name, type: form.type,
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
    if (!activeShopId) return;

    // Guard: only email campaigns can actually send
    if (campaign.type !== 'email') {
      toast.error(t('marketing.channelNotConfigured'));
      return;
    }
    let recipients = clients.filter(c => c.email);
    if (campaign.target_segment === 'new') {
      recipients = recipients.slice(0, Math.ceil(recipients.length * 0.3));
    } else if (campaign.target_segment === 'inactive') {
      recipients = recipients.slice(-Math.ceil(recipients.length * 0.3));
    } else if (campaign.target_segment === 'frequent') {
      recipients = recipients.slice(0, Math.ceil(recipients.length * 0.5));
    }

    if (recipients.length === 0) {
      toast.error(t('marketing.noRecipients'));
      return;
    }

    await supabase.from("campaigns").update({ status: 'sending' } as any).eq("id", campaign.id);
    toast.info(`${t('marketing.sending')} (${recipients.length})...`);
    load();

    let successCount = 0;
    let failCount = 0;

    const batchSize = 5;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const promises = batch.map(async (client) => {
        try {
          const { data, error } = await supabase.functions.invoke("send-email", {
            body: {
              to: client.email,
              subject: campaign.subject || campaign.name,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#1a1a1a;">${campaign.subject || campaign.name}</h2>
                <div style="color:#333;line-height:1.6;white-space:pre-wrap;">${campaign.content || ''}</div>
                <hr style="margin:20px 0;border:none;border-top:1px solid #eee;"/>
                <p style="color:#999;font-size:12px;">Enviado via GarageFlow</p>
              </div>`,
            },
          });
          if (error) throw error;
          successCount++;
          await supabase.from("email_logs").insert({
            shop_id: activeShopId, to_email: client.email,
            subject: campaign.subject || campaign.name,
            status: 'sent', entity_type: 'campaign', entity_id: campaign.id,
          });
        } catch (err: any) {
          failCount++;
          await supabase.from("email_logs").insert({
            shop_id: activeShopId, to_email: client.email,
            subject: campaign.subject || campaign.name,
            status: 'failed', error_message: err?.message || 'Unknown error',
            entity_type: 'campaign', entity_id: campaign.id,
          });
        }
      });
      await Promise.all(promises);
    }

    await supabase.from("campaigns").update({
      status: 'sent', sent_at: new Date().toISOString(), recipients_count: successCount,
    } as any).eq("id", campaign.id);

    if (failCount > 0) {
      toast.warning(`${successCount} ${t('marketing.emailsSent')}, ${failCount} ${t('marketing.emailsFailed')}`);
    } else {
      toast.success(`${successCount} ${t('marketing.emailsSent')}!`);
    }
    load();
  };

  const cancelCampaign = async (id: string) => {
    await supabase.from("campaigns").update({ status: 'cancelled' } as any).eq("id", id);
    toast.success(t('marketing.campaignCancelled'));
    load();
  };

  const deleteCampaign = async (id: string) => {
    await supabase.from("campaigns").delete().eq("id", id);
    toast.success(t('common.deleted'));
    load();
  };


  const totalSent = campaigns.filter(c => c.status === 'sent').length;
  const totalRecipients = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (c.recipients_count || 0), 0);
  const totalOpened = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (c.opened_count || 0), 0);
  const openRate = totalRecipients > 0 ? ((totalOpened / totalRecipients) * 100).toFixed(1) : '0';

  const filteredCampaigns = campaigns
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.subject || '').toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-primary" />{t('marketing.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('marketing.subtitle')}</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-2" />{t('marketing.newCampaign')}</Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('marketing.totalCampaigns'), value: campaigns.length, icon: Send, color: "text-primary" },
          { label: t('marketing.sentCampaigns'), value: totalSent, icon: Mail, color: "text-green-500" },
          { label: t('marketing.totalReached'), value: totalRecipients, icon: Users, color: "text-blue-500" },
          { label: t('marketing.openRate'), value: `${openRate}%`, icon: TrendingUp, color: "text-yellow-500" },
        ].map((kpi, i) => (
          <Card key={i}>
            <CardContent className="pt-3 pb-2 px-4">
              <div className="flex items-center gap-2 mb-1">
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                <p className="text-[11px] text-muted-foreground truncate">{kpi.label}</p>
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs px-3 h-7">{t('common.all')}</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs px-3 h-7">{t('marketing.st_draft')}</TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs px-3 h-7">{t('marketing.st_scheduled')}</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs px-3 h-7">{t('marketing.st_sent')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 max-w-xs">
          <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t('common.search')}
            className="pl-8 h-9 text-sm"
          />
        </div>
      </div>

      {/* Campaigns */}
      {dataLoading && campaigns.length === 0 ? (
        <ListSkeleton rows={5} />
      ) : filteredCampaigns.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Send className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
            <h3 className="text-lg font-semibold mb-1">{t('marketing.empty')}</h3>
            <p className="text-sm text-muted-foreground">{t('marketing.subtitle')}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>{t('marketing.campaignName')}</TableHead>
                  <TableHead>{t('marketing.type')}</TableHead>
                  <TableHead>{t('marketing.segment')}</TableHead>
                  <TableHead className="text-center">{t('marketing.recipients')}</TableHead>
                  <TableHead>{t('marketing.status')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredCampaigns.map(c => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div>
                          <p className="font-medium">{c.name}</p>
                          {c.subject && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{c.subject}</p>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{c.type}</Badge></TableCell>
                      <TableCell className="text-sm">{t(`marketing.seg_${c.target_segment}`)}</TableCell>
                      <TableCell className="text-center font-medium">{c.recipients_count}</TableCell>
                      <TableCell><Badge variant="secondary" className={STATUS_COLORS[c.status]}>{t(`marketing.st_${c.status}`)}</Badge></TableCell>
                      <TableCell>
                        <div className="flex gap-1 justify-end">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setDetailCampaign(c)}>
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          {['draft', 'scheduled'].includes(c.status) && (
                            <>
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => sendCampaign(c)}>
                                <Send className="w-3 h-3 mr-1" />{t('marketing.send')}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => cancelCampaign(c.id)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </>
                          )}
                          {['cancelled', 'sent'].includes(c.status) && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteCampaign(c.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Mobile Cards */}
          <div className="sm:hidden space-y-3">
            {filteredCampaigns.map(c => (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4 space-y-3" onClick={() => setDetailCampaign(c)}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm truncate">{c.name}</p>
                    {c.subject && <p className="text-xs text-muted-foreground truncate">{c.subject}</p>}
                  </div>
                  <Badge variant="secondary" className={`shrink-0 ${STATUS_COLORS[c.status]}`}>{t(`marketing.st_${c.status}`)}</Badge>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <Badge variant="outline" className="capitalize text-[10px]">{c.type}</Badge>
                  <span>{t(`marketing.seg_${c.target_segment}`)}</span>
                  <span className="ml-auto font-medium text-foreground">{c.recipients_count} <Users className="w-3 h-3 inline" /></span>
                </div>
                <div className="flex gap-2 pt-1 border-t border-border">
                  {['draft', 'scheduled'].includes(c.status) && (
                    <Button variant="outline" size="sm" className="h-9 text-xs flex-1" onClick={(e) => { e.stopPropagation(); sendCampaign(c); }}>
                      <Send className="w-3.5 h-3.5 mr-1.5" />{t('marketing.send')}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={(e) => { e.stopPropagation(); setDetailCampaign(c); }}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  {['draft', 'scheduled'].includes(c.status) && (
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); cancelCampaign(c.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  {['cancelled', 'sent'].includes(c.status) && (
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id); }}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Campaign detail dialog */}
      <Dialog open={!!detailCampaign} onOpenChange={() => setDetailCampaign(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detailCampaign?.name}</DialogTitle></DialogHeader>
          {detailCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">{t('marketing.type')}:</span> <Badge variant="outline" className="ml-1 capitalize">{detailCampaign.type}</Badge></div>
                <div><span className="text-muted-foreground">{t('marketing.segment')}:</span> <span className="ml-1 font-medium">{t(`marketing.seg_${detailCampaign.target_segment}`)}</span></div>
                <div><span className="text-muted-foreground">{t('marketing.recipients')}:</span> <span className="ml-1 font-bold">{detailCampaign.recipients_count}</span></div>
                <div><span className="text-muted-foreground">{t('marketing.status')}:</span> <Badge className={`ml-1 ${STATUS_COLORS[detailCampaign.status]}`}>{t(`marketing.st_${detailCampaign.status}`)}</Badge></div>
              </div>
              {detailCampaign.subject && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('marketing.subject')}</p>
                  <p className="text-sm font-medium">{detailCampaign.subject}</p>
                </div>
              )}
              {detailCampaign.content && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('marketing.content')}</p>
                  <div className="bg-muted rounded-lg p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">{detailCampaign.content}</div>
                </div>
              )}
              {detailCampaign.sent_at && (
                <p className="text-xs text-muted-foreground">{t('marketing.sentAt')}: {new Date(detailCampaign.sent_at).toLocaleString()}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create campaign dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{t('marketing.newCampaign')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('marketing.campaignName')} *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('marketing.namePlaceholder')} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t('marketing.type')}</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms" disabled>SMS ({t('common.comingSoon')})</SelectItem>
                    <SelectItem value="whatsapp" disabled>WhatsApp ({t('common.comingSoon')})</SelectItem>
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
                    <SelectItem value="vip">{t('marketing.seg_vip')}</SelectItem>
                    <SelectItem value="revision_due">{t('marketing.seg_revision_due')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>{t('marketing.subject')} *</Label><Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder={t('marketing.subjectPlaceholder')} /></div>
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
