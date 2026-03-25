import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, Plus, Trash2, Clock, Mail, Bell, Activity } from "lucide-react";
import { useShopContext } from "@/hooks/useShopContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const TRIGGER_KEYS = [
  { value: "quote_approved", key: "automations.trigger.quoteApproved" },
  { value: "service_completed", key: "automations.trigger.serviceCompleted" },
  { value: "invoice_overdue", key: "automations.trigger.invoiceOverdue" },
  { value: "client_inactive", key: "automations.trigger.clientInactive" },
  { value: "low_stock", key: "automations.trigger.lowStock" },
  { value: "service_reminder", key: "automations.trigger.serviceReminder" },
  { value: "quote_pending", key: "automations.trigger.quotePending" },
];

const ACTION_KEYS = [
  { value: "send_email", key: "automations.action.sendEmail", icon: Mail },
  { value: "create_alert", key: "automations.action.createAlert", icon: Bell },
  { value: "create_notification", key: "automations.action.createNotification", icon: Bell },
];

export default function Automations() {
  const { t } = useLanguage();
  const { activeShopId } = useShopContext();
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_type: "quote_approved", action_type: "send_email" });

  const load = async () => {
    if (!activeShopId) return;
    const [rulesRes, logsRes] = await Promise.all([
      supabase.from("automation_rules").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
      supabase.from("automation_logs").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(50),
    ]);
    if (rulesRes.data) setRules(rulesRes.data);
    if (logsRes.data) setLogs(logsRes.data);
  };

  useEffect(() => { load(); }, [activeShopId]);

  const createRule = async () => {
    if (!activeShopId || !form.name) return;
    const { error } = await supabase.from("automation_rules").insert({
      shop_id: activeShopId,
      name: form.name,
      trigger_type: form.trigger_type,
      action_type: form.action_type,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(t('automations.created'));
    setCreateDialog(false);
    setForm({ name: "", trigger_type: "quote_approved", action_type: "send_email" });
    load();
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

  const totalRuns = rules.reduce((s, r) => s + (r.run_count || 0), 0);
  const activeCount = rules.filter(r => r.active).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Zap className="w-6 h-6 text-primary" /> {t('automations.title')}</h1>
          <p className="text-muted-foreground text-sm">{t('automations.subtitle')}</p>
        </div>
        <Button onClick={() => setCreateDialog(true)}><Plus className="w-4 h-4 mr-2" /> {t('automations.new')}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Zap className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">{t('automations.active')}</p><p className="text-2xl font-bold">{activeCount}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Activity className="w-5 h-5 text-success" /><div><p className="text-xs text-muted-foreground">{t('automations.totalRuns')}</p><p className="text-2xl font-bold">{totalRuns}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Clock className="w-5 h-5 text-info" /><div><p className="text-xs text-muted-foreground">{t('automations.recentLogs')}</p><p className="text-2xl font-bold">{logs.length}</p></div></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{t('automations.rules')}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{t('automations.name')}</TableHead>
              <TableHead>{t('automations.trigger')}</TableHead>
              <TableHead>{t('automations.action')}</TableHead>
              <TableHead className="text-center">{t('automations.runs')}</TableHead>
              <TableHead className="text-center">{t('automations.activeCol')}</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('automations.empty')}</TableCell></TableRow>
              ) : rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{t(TRIGGER_KEYS.find(tk => tk.value === r.trigger_type)?.key || r.trigger_type)}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{t(ACTION_KEYS.find(ak => ak.value === r.action_type)?.key || r.action_type)}</Badge></TableCell>
                  <TableCell className="text-center">{r.run_count}</TableCell>
                  <TableCell className="text-center"><Switch checked={r.active} onCheckedChange={() => toggleRule(r.id, r.active)} /></TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="text-destructive h-7 w-7 p-0" onClick={() => deleteRule(r.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t('automations.history')}</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {logs.map(log => (
                <div key={log.id} className="flex items-center justify-between text-sm border-b border-border/50 pb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={log.status === 'success' ? 'default' : 'destructive'} className="text-[10px]">{log.status}</Badge>
                    <span className="text-muted-foreground">{log.trigger_type} → {log.action_type}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t('automations.new')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t('automations.name')}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('automations.namePlaceholder')} /></div>
            <div><Label>{t('automations.trigger')}</Label>
              <Select value={form.trigger_type} onValueChange={v => setForm({ ...form, trigger_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGER_KEYS.map(tk => <SelectItem key={tk.value} value={tk.value}>{t(tk.key)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('automations.action')}</Label>
              <Select value={form.action_type} onValueChange={v => setForm({ ...form, action_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTION_KEYS.map(ak => <SelectItem key={ak.value} value={ak.value}>{t(ak.key)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={createRule} disabled={!form.name}>{t('automations.create')}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}