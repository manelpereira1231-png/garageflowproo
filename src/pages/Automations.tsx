import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, Plus, Trash2, Clock, Mail, Bell, Activity, MessageSquare, Phone, Eye, Pencil, Send } from "lucide-react";
import { useShopContext } from "@/hooks/useShopContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { VisualFlowBuilder, type FlowConditions } from "@/components/automations/VisualFlowBuilder";

const TRIGGER_KEYS = [
  { value: "quote_created", label: "automations.trigger.quoteCreated" },
  { value: "quote_pending", label: "automations.trigger.quotePending" },
  { value: "quote_approved", label: "automations.trigger.quoteApproved" },
  { value: "service_completed", label: "automations.trigger.serviceCompleted" },
  { value: "vehicle_ready", label: "automations.trigger.vehicleReady" },
  { value: "invoice_created", label: "automations.trigger.invoiceCreated" },
  { value: "invoice_overdue", label: "automations.trigger.invoiceOverdue" },
  { value: "service_reminder", label: "automations.trigger.serviceReminder" },
  { value: "client_inactive", label: "automations.trigger.clientInactive" },
  { value: "low_stock", label: "automations.trigger.lowStock" },
  { value: "inspection_completed", label: "automations.trigger.inspectionCompleted" },
  { value: "appointment_reminder", label: "automations.trigger.appointmentReminder" },
  { value: "post_service_followup", label: "automations.trigger.postServiceFollowup" },
];

const ACTION_KEYS = [
  { value: "send_email", label: "automations.action.sendEmail", icon: Mail, ready: true },
  { value: "create_alert", label: "automations.action.createAlert", icon: Bell, ready: true },
  { value: "create_notification", label: "automations.action.createNotification", icon: Bell, ready: true },
  { value: "send_sms", label: "automations.action.sendSms", icon: Phone, ready: false },
  { value: "send_whatsapp", label: "automations.action.sendWhatsapp", icon: MessageSquare, ready: false },
];

const TEMPLATE_VARIABLES = [
  "{{client_name}}", "{{vehicle_plate}}", "{{vehicle_make}}", "{{vehicle_model}}",
  "{{shop_name}}", "{{total}}", "{{portal_link}}", "{{next_service_date}}",
  "{{invoice_number}}", "{{quote_number}}", "{{service_number}}",
];

export default function Automations() {
  const { t } = useLanguage();
  const { activeShopId } = useShopContext();
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialog, setCreateDialog] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [previewDialog, setPreviewDialog] = useState(false);
  const [previewContent, setPreviewContent] = useState({ subject: "", body: "" });
  const [form, setForm] = useState({
    name: "",
    trigger_type: "quote_approved",
    action_type: "send_email",
    email_subject: "",
    email_body: "",
    conditions: {} as Record<string, any>,
  });

  const load = async () => {
    if (!activeShopId) return;
    const [rulesRes, logsRes] = await Promise.all([
      supabase.from("automation_rules").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
      supabase.from("automation_logs").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);
    if (logsRes.data) setLogs(logsRes.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeShopId]);

  const resetForm = () => setForm({
    name: "", trigger_type: "quote_approved", action_type: "send_email",
    email_subject: "", email_body: "", conditions: {},
  });

  const saveRule = async () => {
    if (!activeShopId || !form.name) return;
    const payload = {
      shop_id: activeShopId,
      name: form.name,
      trigger_type: form.trigger_type,
      action_type: form.action_type,
      action_config: {
        email_subject: form.email_subject || "",
        email_body: form.email_body || "",
      },
      conditions: form.conditions,
    };

    let error;
    if (editingRule) {
      ({ error } = await supabase.from("automation_rules").update(payload).eq("id", editingRule.id));
    } else {
      ({ error } = await supabase.from("automation_rules").insert(payload));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(editingRule ? t('automations.updated') : t('automations.created'));
    setCreateDialog(false);
    setEditingRule(null);
    resetForm();
    load();
  };

  const openEdit = (rule: any) => {
    const config = rule.action_config || {};
    setForm({
      name: rule.name,
      trigger_type: rule.trigger_type,
      action_type: rule.action_type,
      email_subject: config.email_subject || "",
      email_body: config.email_body || "",
      conditions: rule.conditions || {},
    });
    setEditingRule(rule);
    setCreateDialog(true);
  };

  const toggleRule = async (id: string, active: boolean) => {
    await supabase.from("automation_rules").update({ active: !active }).eq("id", id);
    load();
  };

  const deleteRule = async (id: string) => {
    await supabase.from("automation_rules").delete().eq("id", id);
    toast.success(t('automations.deleted'));
    load();
  };

  const showPreview = (rule: any) => {
    const config = rule.action_config || {};
    const subject = (config.email_subject || rule.name)
      .replace(/\{\{client_name\}\}/g, "João Silva")
      .replace(/\{\{shop_name\}\}/g, "Oficina Exemplo")
      .replace(/\{\{vehicle_plate\}\}/g, "AB-12-CD")
      .replace(/\{\{vehicle_make\}\}/g, "BMW")
      .replace(/\{\{vehicle_model\}\}/g, "320d");
    const body = (config.email_body || "")
      .replace(/\{\{client_name\}\}/g, "João Silva")
      .replace(/\{\{shop_name\}\}/g, "Oficina Exemplo")
      .replace(/\{\{vehicle_plate\}\}/g, "AB-12-CD")
      .replace(/\{\{vehicle_make\}\}/g, "BMW")
      .replace(/\{\{vehicle_model\}\}/g, "320d")
      .replace(/\{\{total\}\}/g, "€250.00")
      .replace(/\{\{portal_link\}\}/g, "https://garageflow.pt/portal/...")
      .replace(/\{\{next_service_date\}\}/g, "2026-06-15");
    setPreviewContent({ subject, body });
    setPreviewDialog(true);
  };

  const totalRuns = rules.reduce((s, r) => s + (r.run_count || 0), 0);
  const activeCount = rules.filter(r => r.active).length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> {t('automations.title')}
          </h1>
          <p className="text-muted-foreground text-sm">{t('automations.subtitle')}</p>
        </div>
        <Button onClick={() => { resetForm(); setEditingRule(null); setCreateDialog(true); }}>
          <Plus className="w-4 h-4 mr-2" /> {t('automations.new')}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Zap className="w-5 h-5 text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">{t('automations.active')}</p>
                <p className="text-2xl font-bold">{activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Activity className="w-5 h-5 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">{t('automations.totalRuns')}</p>
                <p className="text-2xl font-bold">{totalRuns}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-info" />
              <div>
                <p className="text-xs text-muted-foreground">{t('automations.recentLogs')}</p>
                <p className="text-2xl font-bold">{logs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules */}
      <Card>
        <CardHeader><CardTitle className="text-base">{t('automations.rules')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="text-center py-16">
              <Zap className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <h3 className="text-lg font-semibold mb-1">{t('automations.empty')}</h3>
              <p className="text-sm text-muted-foreground mb-4">{t('automations.emptyDesc') || 'Crie a sua primeira automação para trabalhar sem esforço.'}</p>
              <Button variant="outline" onClick={() => { resetForm(); setEditingRule(null); setCreateDialog(true); }}>
                <Plus className="w-4 h-4 mr-1" /> {t('automations.new')}
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {rules.map(r => {
                const actionInfo = ACTION_KEYS.find(ak => ak.value === r.action_type);
                const ActionIcon = actionInfo?.icon || Bell;
                return (
                  <div key={r.id} className="flex items-center justify-between px-4 py-3 gap-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <Switch checked={r.active} onCheckedChange={() => toggleRule(r.id, r.active)} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{r.name}</p>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <Badge variant="outline" className="text-[10px]">
                            {t(TRIGGER_KEYS.find(tk => tk.value === r.trigger_type)?.label || r.trigger_type)}
                          </Badge>
                          <span className="text-muted-foreground text-[10px]">→</span>
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <ActionIcon className="w-2.5 h-2.5" />
                            {t(actionInfo?.label || r.action_type)}
                            {actionInfo && !actionInfo.ready && (
                              <span className="text-[8px] text-warning ml-0.5">({t('common.comingSoon')})</span>
                            )}
                          </Badge>
                          {r.run_count > 0 && (
                            <span className="text-[10px] text-muted-foreground">{r.run_count}×</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {r.action_type === 'send_email' && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => showPreview(r)} title="Preview">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(r)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteRule(r.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('automations.history')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-[10px] shrink-0">{log.status}</Badge>
                    <span className="text-muted-foreground truncate text-xs">
                      {t(TRIGGER_KEYS.find(tk => tk.value === log.trigger_type)?.label || log.trigger_type)} → {t(ACTION_KEYS.find(ak => ak.value === log.action_type)?.label || log.action_type)}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createDialog} onOpenChange={o => { if (!o) { setCreateDialog(false); setEditingRule(null); resetForm(); } else setCreateDialog(true); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? t('automations.edit') : t('automations.new')}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="config" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="config">{t('automations.config') || 'Configuração'}</TabsTrigger>
              <TabsTrigger value="template">{t('automations.template') || 'Template'}</TabsTrigger>
            </TabsList>
            <TabsContent value="config" className="space-y-3 mt-3">
              <div>
                <Label>{t('automations.name')}</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('automations.namePlaceholder') || 'Ex: Lembrete de orçamento pendente'} />
              </div>
              <div>
                <Label>{t('automations.trigger')}</Label>
                <Select value={form.trigger_type} onValueChange={v => setForm({ ...form, trigger_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_KEYS.map(tk => (
                      <SelectItem key={tk.value} value={tk.value}>{t(tk.label)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('automations.action') || 'Canal / Ação'}</Label>
                <Select value={form.action_type} onValueChange={v => setForm({ ...form, action_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_KEYS.map(ak => {
                      const Icon = ak.icon;
                      return (
                        <SelectItem key={ak.value} value={ak.value} disabled={!ak.ready}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{t(ak.label)}</span>
                            {!ak.ready && <Badge variant="outline" className="text-[8px] ml-1">{t('common.comingSoon')}</Badge>}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            <TabsContent value="template" className="space-y-3 mt-3">
              <div>
                <Label>{t('automations.emailSubject') || 'Assunto'}</Label>
                <Input
                  value={form.email_subject}
                  onChange={e => setForm({ ...form, email_subject: e.target.value })}
                  placeholder="Ex: O seu orçamento está pronto — {{shop_name}}"
                />
              </div>
              <div>
                <Label>{t('automations.emailBody') || 'Corpo da mensagem'}</Label>
                <Textarea
                  value={form.email_body}
                  onChange={e => setForm({ ...form, email_body: e.target.value })}
                  rows={5}
                  placeholder="Olá {{client_name}}, o seu veículo {{vehicle_make}} {{vehicle_model}} ({{vehicle_plate}}) está pronto..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t('automations.variables') || 'Variáveis disponíveis'}</Label>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {TEMPLATE_VARIABLES.map(v => (
                    <Badge
                      key={v}
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => {
                        setForm(f => ({ ...f, email_body: f.email_body + " " + v }));
                      }}
                    >
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialog(false); setEditingRule(null); resetForm(); }}>
              {t('common.cancel')}
            </Button>
            <Button onClick={saveRule} disabled={!form.name}>
              {editingRule ? t('common.save') : t('automations.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialog} onOpenChange={setPreviewDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-4 h-4" /> {t('automations.preview') || 'Preview'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{t('automations.emailSubject') || 'Assunto'}:</p>
              <p className="text-sm font-medium">{previewContent.subject || '(sem assunto)'}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{t('automations.emailBody') || 'Corpo'}:</p>
              <p className="text-sm whitespace-pre-wrap">{previewContent.body || '(sem conteúdo — será usado o template padrão do sistema)'}</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
