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
import { Zap, Plus, Play, Pause, Trash2, Clock, Mail, Bell, Activity } from "lucide-react";
import { useShopContext } from "@/hooks/useShopContext";
import { useLanguage } from "@/i18n/LanguageContext";
import { toast } from "sonner";

const TRIGGER_TYPES = [
  { value: "quote_approved", label: "Orçamento Aprovado", labelEn: "Quote Approved" },
  { value: "service_completed", label: "Serviço Concluído", labelEn: "Service Completed" },
  { value: "invoice_overdue", label: "Fatura Vencida", labelEn: "Invoice Overdue" },
  { value: "client_inactive", label: "Cliente Inativo (90 dias)", labelEn: "Client Inactive (90 days)" },
  { value: "low_stock", label: "Stock Baixo", labelEn: "Low Stock" },
  { value: "service_reminder", label: "Lembrete de Revisão", labelEn: "Service Reminder" },
  { value: "quote_pending", label: "Orçamento Pendente (3 dias)", labelEn: "Quote Pending (3 days)" },
];

const ACTION_TYPES = [
  { value: "send_email", label: "Enviar Email", labelEn: "Send Email", icon: Mail },
  { value: "create_alert", label: "Criar Alerta", labelEn: "Create Alert", icon: Bell },
  { value: "create_notification", label: "Notificação Interna", labelEn: "Internal Notification", icon: Bell },
];

export default function Automations() {
  const { language } = useLanguage();
  const { activeShopId } = useShopContext();
  const [rules, setRules] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [createDialog, setCreateDialog] = useState(false);
  const [form, setForm] = useState({ name: "", trigger_type: "quote_approved", action_type: "send_email" });
  const isPt = language === 'pt';

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
    toast.success(isPt ? "Automação criada!" : "Automation created!");
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
    toast.success(isPt ? "Automação removida." : "Automation deleted.");
    load();
  };

  const totalRuns = rules.reduce((s, r) => s + (r.run_count || 0), 0);
  const activeCount = rules.filter(r => r.active).length;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-2"><Zap className="w-6 h-6 text-primary" /> {isPt ? "Automações" : "Automations"}</h1>
          <p className="text-muted-foreground text-sm">{isPt ? "Configure ações automáticas baseadas em eventos da oficina." : "Set up automatic actions based on workshop events."}</p>
        </div>
        <Button onClick={() => setCreateDialog(true)}><Plus className="w-4 h-4 mr-2" /> {isPt ? "Nova Automação" : "New Automation"}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Zap className="w-5 h-5 text-primary" /><div><p className="text-xs text-muted-foreground">{isPt ? "Automações Ativas" : "Active"}</p><p className="text-2xl font-bold">{activeCount}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Activity className="w-5 h-5 text-success" /><div><p className="text-xs text-muted-foreground">{isPt ? "Total Execuções" : "Total Runs"}</p><p className="text-2xl font-bold">{totalRuns}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-5"><div className="flex items-center gap-3"><Clock className="w-5 h-5 text-info" /><div><p className="text-xs text-muted-foreground">{isPt ? "Últimos Logs" : "Recent Logs"}</p><p className="text-2xl font-bold">{logs.length}</p></div></div></CardContent></Card>
      </div>

      {/* Rules table */}
      <Card>
        <CardHeader><CardTitle className="text-base">{isPt ? "Regras de Automação" : "Automation Rules"}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader><TableRow>
              <TableHead>{isPt ? "Nome" : "Name"}</TableHead>
              <TableHead>{isPt ? "Gatilho" : "Trigger"}</TableHead>
              <TableHead>{isPt ? "Ação" : "Action"}</TableHead>
              <TableHead className="text-center">{isPt ? "Execuções" : "Runs"}</TableHead>
              <TableHead className="text-center">{isPt ? "Ativa" : "Active"}</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {rules.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{isPt ? "Nenhuma automação configurada." : "No automations configured."}</TableCell></TableRow>
              ) : rules.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{TRIGGER_TYPES.find(t => t.value === r.trigger_type)?.[isPt ? 'label' : 'labelEn'] || r.trigger_type}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="text-xs">{ACTION_TYPES.find(a => a.value === r.action_type)?.[isPt ? 'label' : 'labelEn'] || r.action_type}</Badge></TableCell>
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

      {/* Logs */}
      {logs.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">{isPt ? "Histórico de Execuções" : "Execution History"}</CardTitle></CardHeader>
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

      {/* Create dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{isPt ? "Nova Automação" : "New Automation"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{isPt ? "Nome" : "Name"}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={isPt ? "Ex: Lembrete de revisão" : "E.g. Service reminder"} /></div>
            <div><Label>{isPt ? "Gatilho" : "Trigger"}</Label>
              <Select value={form.trigger_type} onValueChange={v => setForm({ ...form, trigger_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TRIGGER_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{isPt ? t.label : t.labelEn}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{isPt ? "Ação" : "Action"}</Label>
              <Select value={form.action_type} onValueChange={v => setForm({ ...form, action_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ACTION_TYPES.map(a => <SelectItem key={a.value} value={a.value}>{isPt ? a.label : a.labelEn}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter><Button onClick={createRule} disabled={!form.name}>{isPt ? "Criar Automação" : "Create Automation"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
