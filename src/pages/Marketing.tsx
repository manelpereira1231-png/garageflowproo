import { useState, useEffect, useMemo } from "react";
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
import { Megaphone, Plus, Send, Mail, Users, TrendingUp, Trash2, Eye, Search, Sparkles, Calendar, Cake, Snowflake, Wrench, HeartHandshake, Gauge } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useShopContext } from "@/hooks/useShopContext";
import { toast } from "sonner";
import ListSkeleton from "@/components/ListSkeleton";
import MarketingAIAssistant, { type AIInsight } from "@/components/marketing/MarketingAIAssistant";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  sending: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  sent: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-destructive/10 text-destructive",
};

const MARKETING_QUERY_TIMEOUT_MS = 3000;

function timeoutResult<T>(value: T, ms = MARKETING_QUERY_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
}

type CampaignTemplate = {
  id: string;
  icon: typeof Wrench;
  name: string;
  segment: string;
  subject: string;
  content: string;
  accent: string;
};

const TEMPLATES: CampaignTemplate[] = [
  {
    id: "revisao",
    icon: Wrench,
    name: "Revisão em atraso",
    segment: "revision_due",
    subject: "A sua revisão está em atraso — {{shop_name}}",
    content: "Olá {{client_name}},\n\nDetetámos que a revisão do seu {{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}}) está em atraso.\n\nAgende connosco para manter o seu veículo em segurança.",
    accent: "from-amber-500/20 to-amber-500/0",
  },
  {
    id: "inatividade",
    icon: HeartHandshake,
    name: "Recuperar clientes",
    segment: "inactive",
    subject: "Sentimos a sua falta — voltamos a cuidar do seu carro?",
    content: "Olá {{client_name}},\n\nJá passou algum tempo desde a última visita. Preparámos uma condição especial para voltar a receber o seu veículo.",
    accent: "from-rose-500/20 to-rose-500/0",
  },
  {
    id: "inverno",
    icon: Snowflake,
    name: "Preparação inverno",
    segment: "all",
    subject: "Prepare o {{vehicle_make}} para o inverno",
    content: "Olá {{client_name}},\n\nCheck-up de pneus, líquidos e travões com condições especiais este mês. Marque a sua vinda.",
    accent: "from-sky-500/20 to-sky-500/0",
  },
  {
    id: "aniversario",
    icon: Cake,
    name: "Aniversário do cliente",
    segment: "vip",
    subject: "Parabéns, {{client_name}} 🎉",
    content: "Da equipa {{shop_name}}, os nossos parabéns! Como oferta, um check-up gratuito na sua próxima visita.",
    accent: "from-fuchsia-500/20 to-fuchsia-500/0",
  },
];

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
        Promise.race([
          supabase.from("campaigns").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
          timeoutResult({ data: [] }),
        ]),
        Promise.race([
          supabase.from("clients").select("id, email, name").eq("shop_id", activeShopId).is("deleted_at", null).neq("email", ""),
          timeoutResult({ data: [] }),
        ]),
      ]);
      if (campRes.data) setCampaigns(campRes.data);
      if (clientRes.data) setClients(clientRes.data);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeShopId]);

  const applyTemplate = (tpl: CampaignTemplate) => {
    setForm({
      name: tpl.name,
      type: "email",
      subject: tpl.subject,
      content: tpl.content,
      target_segment: tpl.segment,
      scheduled_at: "",
    });
    setDialogOpen(true);
  };

  const openBlank = () => {
    setForm({ name: "", type: "email", subject: "", content: "", target_segment: "all", scheduled_at: "" });
    setDialogOpen(true);
  };

  const applyAIInsight = (it: AIInsight) => {
    setForm({
      name: it.headline.slice(0, 60),
      type: it.channel,
      subject: it.subject,
      content: it.content,
      target_segment: it.segment,
      scheduled_at: "",
    });
    setDialogOpen(true);
  };

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

    // Fetch shop name once and each recipient's most recent vehicle so
    // template variables ({{shop_name}}, {{vehicle_*}}, {{client_name}})
    // are always replaced. Emails must never leave with raw placeholders.
    const { data: shopData } = await supabase
      .from("shops").select("name").eq("id", activeShopId).maybeSingle();
    const shopName = (shopData as any)?.name || "";

    const clientIds = recipients.map(r => r.id).filter(Boolean);
    const vehicleByClient: Record<string, { make?: string; model?: string; plate?: string }> = {};
    if (clientIds.length) {
      const { data: vehData } = await supabase
        .from("vehicles").select("client_id, make, model, plate, created_at")
        .in("client_id", clientIds).order("created_at", { ascending: false });
      for (const v of (vehData || []) as any[]) {
        if (!vehicleByClient[v.client_id]) {
          vehicleByClient[v.client_id] = { make: v.make, model: v.model, plate: v.plate };
        }
      }
    }

    const interpolate = (raw: string, client: any): string => {
      const veh = vehicleByClient[client.id] || {};
      return (raw || "")
        .replace(/\{\{\s*client_name\s*\}\}/g, client.name || "")
        .replace(/\{\{\s*shop_name\s*\}\}/g, shopName)
        .replace(/\{\{\s*vehicle_make\s*\}\}/g, veh.make || "")
        .replace(/\{\{\s*vehicle_model\s*\}\}/g, veh.model || "")
        .replace(/\{\{\s*vehicle_plate\s*\}\}/g, veh.plate || "")
        // Collapse leftover spacing from empty vars and any unknown placeholders.
        .replace(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/\(\s*\)/g, "")
        .trim();
    };

    let successCount = 0;
    let failCount = 0;

    const batchSize = 5;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const promises = batch.map(async (client) => {
        const personalSubject = interpolate(campaign.subject || campaign.name, client);
        const personalContent = interpolate(campaign.content || "", client);
        try {
          const { data, error } = await supabase.functions.invoke("send-email", {
            body: {
              to: client.email,
              subject: personalSubject,
              html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                <h2 style="color:#1a1a1a;">${personalSubject}</h2>
                <div style="color:#333;line-height:1.6;white-space:pre-wrap;">${personalContent}</div>
                <hr style="margin:20px 0;border:none;border-top:1px solid #eee;"/>
                <p style="color:#999;font-size:12px;">Enviado via ${shopName || 'GarageFlow'}</p>
              </div>`,
            },
          });
          if (error) throw error;
          successCount++;
          await supabase.from("email_logs").insert({
            shop_id: activeShopId, to_email: client.email,
            subject: personalSubject,
            status: 'sent', entity_type: 'campaign', entity_id: campaign.id,
          });
        } catch (err: any) {
          failCount++;
          await supabase.from("email_logs").insert({
            shop_id: activeShopId, to_email: client.email,
            subject: personalSubject,
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

  const kpis = useMemo(() => {
    const totalSent = campaigns.filter(c => c.status === 'sent').length;
    const totalRecipients = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (c.recipients_count || 0), 0);
    const totalOpened = campaigns.filter(c => c.status === 'sent').reduce((s, c) => s + (c.opened_count || 0), 0);
    const openRate = totalRecipients > 0 ? ((totalOpened / totalRecipients) * 100).toFixed(1) : '0';
    const scheduled = campaigns.filter(c => c.status === 'scheduled').length;
    return { totalSent, totalRecipients, totalOpened, openRate, scheduled };
  }, [campaigns]);

  const filteredCampaigns = campaigns
    .filter(c => statusFilter === 'all' || c.status === statusFilter)
    .filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || (c.subject || '').toLowerCase().includes(searchQuery.toLowerCase()));

  const previewSubject = form.subject
    .replace(/\{\{client_name\}\}/g, "João Silva")
    .replace(/\{\{shop_name\}\}/g, "Oficina Exemplo")
    .replace(/\{\{vehicle_make\}\}/g, "BMW")
    .replace(/\{\{vehicle_model\}\}/g, "320d")
    .replace(/\{\{vehicle_plate\}\}/g, "AB-12-CD");
  const previewBody = form.content
    .replace(/\{\{client_name\}\}/g, "João Silva")
    .replace(/\{\{shop_name\}\}/g, "Oficina Exemplo")
    .replace(/\{\{vehicle_make\}\}/g, "BMW")
    .replace(/\{\{vehicle_model\}\}/g, "320d")
    .replace(/\{\{vehicle_plate\}\}/g, "AB-12-CD");

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-6">
        <div className="absolute -right-16 -top-16 w-56 h-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Megaphone className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
                {t('marketing.title')}
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">{t('marketing.subtitle')}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1"><Users className="w-3 h-3" />{clients.length} contactos</span>
                <span className="opacity-40">•</span>
                <span className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" />{kpis.scheduled} agendadas</span>
                <span className="opacity-40">•</span>
                <span className="inline-flex items-center gap-1"><Gauge className="w-3 h-3" />{kpis.openRate}% taxa abertura</span>
              </div>
            </div>
          </div>
          <Button onClick={openBlank} size="lg" className="shadow-sm">
            <Plus className="w-4 h-4 mr-2" />{t('marketing.newCampaign')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('marketing.totalCampaigns'), value: campaigns.length, icon: Send, tint: "text-primary", bg: "bg-primary/10" },
          { label: t('marketing.sentCampaigns'), value: kpis.totalSent, icon: Mail, tint: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: t('marketing.totalReached'), value: kpis.totalRecipients.toLocaleString(), icon: Users, tint: "text-blue-500", bg: "bg-blue-500/10" },
          { label: t('marketing.openRate'), value: `${kpis.openRate}%`, icon: TrendingUp, tint: "text-amber-500", bg: "bg-amber-500/10" },
        ].map((kpi, i) => (
          <Card key={i} className="border-border/60 hover:border-border transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate uppercase tracking-wide font-medium">{kpi.label}</p>
                  <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{kpi.value}</p>
                </div>
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                  <kpi.icon className={`w-4 h-4 ${kpi.tint}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick templates */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold">Campanhas rápidas</h2>
          <span className="text-xs text-muted-foreground">— clique para pré-preencher</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {TEMPLATES.map(tpl => {
            const Icon = tpl.icon;
            return (
              <button
                key={tpl.id}
                onClick={() => applyTemplate(tpl)}
                className={`group relative overflow-hidden text-left rounded-xl border border-border/60 bg-card hover:border-primary/50 hover:shadow-md transition-all p-4 min-h-[110px]`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${tpl.accent} opacity-60 group-hover:opacity-100 transition-opacity`} />
                <div className="relative">
                  <div className="w-8 h-8 rounded-lg bg-background/80 backdrop-blur border border-border/60 flex items-center justify-center mb-2">
                    <Icon className="w-4 h-4 text-foreground" />
                  </div>
                  <p className="font-semibold text-sm leading-tight">{tpl.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{tpl.subject}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3">{t('common.all')}</TabsTrigger>
            <TabsTrigger value="draft" className="text-xs px-3">{t('marketing.st_draft')}</TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs px-3">{t('marketing.st_scheduled')}</TabsTrigger>
            <TabsTrigger value="sent" className="text-xs px-3">{t('marketing.st_sent')}</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative flex-1 sm:flex-none sm:w-72 max-w-full">
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
        <Card className="border-dashed">
          <CardContent className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
              <Send className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">{t('marketing.empty')}</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm mx-auto">Escolha um template acima ou crie uma campanha do zero para começar a comunicar com os seus clientes.</p>
            <Button onClick={openBlank}><Plus className="w-4 h-4 mr-2" />{t('marketing.newCampaign')}</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden sm:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>{t('marketing.campaignName')}</TableHead>
                    <TableHead>{t('marketing.type')}</TableHead>
                    <TableHead>{t('marketing.segment')}</TableHead>
                    <TableHead className="text-center">{t('marketing.recipients')}</TableHead>
                    <TableHead>{t('marketing.status')}</TableHead>
                    <TableHead className="text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCampaigns.map(c => (
                    <TableRow key={c.id} className="hover:bg-muted/50">
                      <TableCell>
                        <div className="min-w-0">
                          <p className="font-medium truncate max-w-[240px]">{c.name}</p>
                          {c.subject && <p className="text-xs text-muted-foreground truncate max-w-[240px]">{c.subject}</p>}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{c.type}</Badge></TableCell>
                      <TableCell className="text-sm">{t(`marketing.seg_${c.target_segment}`)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{c.recipients_count}</TableCell>
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

      {/* Create campaign dialog with live preview */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              {t('marketing.newCampaign')}
            </DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-5">
            {/* Form column */}
            <div className="space-y-3">
              <div>
                <Label>{t('marketing.campaignName')} *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('marketing.namePlaceholder')} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('marketing.type')}</Label>
                  <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms" disabled>SMS ({t('common.comingSoon')})</SelectItem>
                      <SelectItem value="whatsapp" disabled>WhatsApp ({t('common.comingSoon')})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('marketing.segment')}</Label>
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
              <div>
                <Label>{t('marketing.subject')} *</Label>
                <Input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder={t('marketing.subjectPlaceholder')} />
              </div>
              <div>
                <Label>{t('marketing.content')}</Label>
                <Textarea value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={6} placeholder={t('marketing.contentPlaceholder')} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Variáveis: <code className="text-[10px]">{"{{client_name}}"}</code> <code className="text-[10px]">{"{{shop_name}}"}</code> <code className="text-[10px]">{"{{vehicle_plate}}"}</code>
                </p>
              </div>
              <div>
                <Label>{t('marketing.scheduleAt')}</Label>
                <Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
              </div>
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 border border-border/60">
                <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{clients.length}</span> {t('marketing.eligibleClients')}
                </p>
              </div>
            </div>

            {/* Preview column */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Pré-visualização</Label>
              <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm">
                <div className="bg-muted/50 border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
                      <Mail className="w-3 h-3 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">Oficina Exemplo</span>
                    <span className="ml-auto">agora</span>
                  </div>
                  <p className="text-sm font-semibold mt-1.5 truncate">{previewSubject || <span className="text-muted-foreground italic">Assunto do email…</span>}</p>
                </div>
                <div className="p-4 text-sm whitespace-pre-wrap min-h-[240px] leading-relaxed">
                  {previewBody || <span className="text-muted-foreground italic">O conteúdo do email aparece aqui à medida que escreve…</span>}
                </div>
                <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground text-center">
                  Enviado via GarageFlow
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)}>{t('common.cancel') || 'Cancelar'}</Button>
            <Button onClick={createCampaign}>
              {form.scheduled_at ? <><Calendar className="w-4 h-4 mr-2" />Agendar</> : <><Send className="w-4 h-4 mr-2" />{t('marketing.create')}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
