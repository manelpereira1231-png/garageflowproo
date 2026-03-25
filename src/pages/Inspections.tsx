import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ClipboardCheck, Plus, Eye, CheckCircle, AlertTriangle, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChecklistItem {
  name: string;
  status: "ok" | "attention" | "repair" | "na";
  notes: string;
}

const DEFAULT_ITEM_KEYS = [
  'inspections.item.frontBrakes',
  'inspections.item.rearBrakes',
  'inspections.item.brakeDiscs',
  'inspections.item.frontLeftTire',
  'inspections.item.frontRightTire',
  'inspections.item.rearLeftTire',
  'inspections.item.rearRightTire',
  'inspections.item.engineOil',
  'inspections.item.airFilter',
  'inspections.item.oilFilter',
  'inspections.item.cabinFilter',
  'inspections.item.frontSuspension',
  'inspections.item.rearSuspension',
  'inspections.item.battery',
  'inspections.item.belts',
  'inspections.item.coolant',
  'inspections.item.exhaust',
  'inspections.item.lights',
  'inspections.item.wipers',
  'inspections.item.brakeFluid',
];

interface Checklist {
  id: string; shop_id: string; work_order_id: string; items: ChecklistItem[];
  technician: string | null; completed_at: string | null; created_at: string;
}

const STATUS_CONFIG_KEYS = {
  ok: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30", border: "border-green-300 dark:border-green-700", labelKey: "inspections.status.ok" },
  attention: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-300 dark:border-amber-700", labelKey: "inspections.status.attention" },
  repair: { icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30", border: "border-red-300 dark:border-red-700", labelKey: "inspections.status.repair" },
  na: { icon: null, color: "text-muted-foreground", bg: "bg-muted", border: "border-border", labelKey: "inspections.status.na" },
};

export default function Inspections() {
  const { t } = useLanguage();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [selectedWO, setSelectedWO] = useState("");
  const DEFAULT_ITEMS: ChecklistItem[] = DEFAULT_ITEM_KEYS.map(key => ({ name: t(key), status: "na", notes: "" }));
  const [items, setItems] = useState<ChecklistItem[]>([...DEFAULT_ITEMS]);
  const [technician, setTechnician] = useState("");
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const activeShopId = useActiveShopId();

  const load = async () => {
    if (!activeShopId) return;
    const [clRes, woRes] = await Promise.all([
      supabase.from("inspection_checklists").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
      supabase.from("work_orders").select("id, number, status, client_id, vehicles(make, model, plate)").eq("shop_id", activeShopId).in("status", ["open", "diagnosis", "in_progress", "approved"]).order("created_at", { ascending: false }),
    ]);
    if (clRes.data) setChecklists(clRes.data.map((c: any) => ({ ...c, items: Array.isArray(c.items) ? c.items : JSON.parse(c.items) })) as Checklist[]);
    if (woRes.data) setWorkOrders(woRes.data);
  };

  useEffect(() => { load(); }, [activeShopId]);

  const handleCreate = async () => {
    if (!activeShopId || !selectedWO) { toast.error(t('inspections.selectWO')); return; }
    setSaving(true);
    const { error } = await supabase.from("inspection_checklists").insert({
      shop_id: activeShopId, work_order_id: selectedWO,
      items: JSON.stringify(items), technician: technician || null,
    } as any);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(t('inspections.created'));
    setSaving(false);
    setDialogOpen(false); setItems(DEFAULT_ITEM_KEYS.map(key => ({ name: t(key), status: "na" as const, notes: "" }))); setSelectedWO(""); setTechnician(""); load();
  };

  const handleComplete = async (id: string) => {
    await supabase.from("inspection_checklists").update({ completed_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(t('inspections.completed'));
    load();
  };

  const updateItemStatus = (index: number, status: ChecklistItem["status"]) => {
    const updated = [...items];
    updated[index] = { ...updated[index], status };
    setItems(updated);
  };

  const updateItemNotes = (index: number, notes: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], notes };
    setItems(updated);
  };

  // Auto-save for view/edit mode
  const autoSaveChecklist = useCallback(async (checklist: Checklist, updatedItems: ChecklistItem[]) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await supabase.from("inspection_checklists").update({ items: JSON.stringify(updatedItems) } as any).eq("id", checklist.id);
    }, 800);
  }, []);

  const updateViewItem = (index: number, status: ChecklistItem["status"]) => {
    if (!viewChecklist) return;
    const updated = [...viewChecklist.items];
    updated[index] = { ...updated[index], status };
    setViewChecklist({ ...viewChecklist, items: updated });
    autoSaveChecklist(viewChecklist, updated);
  };

  const getSummary = (items: ChecklistItem[]) => {
    const ok = items.filter(i => i.status === "ok").length;
    const attention = items.filter(i => i.status === "attention").length;
    const repair = items.filter(i => i.status === "repair").length;
    const checked = ok + attention + repair;
    const total = items.length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { ok, attention, repair, checked, total, pct };
  };

  const getOverallStatus = (items: ChecklistItem[]) => {
    const s = getSummary(items);
    if (s.repair > 0) return { label: "Reparações necessárias", color: "bg-red-100 text-red-700 border-red-300" };
    if (s.attention > 0) return { label: "Atenção recomendada", color: "bg-amber-100 text-amber-700 border-amber-300" };
    if (s.pct === 100) return { label: "Tudo OK", color: "bg-green-100 text-green-700 border-green-300" };
    return { label: "Em progresso", color: "bg-muted text-muted-foreground border-border" };
  };

  const StatusButton = ({ status, currentStatus, onClick }: { status: ChecklistItem["status"]; currentStatus: string; onClick: () => void }) => {
    const cfg = STATUS_CONFIG[status];
    const isActive = currentStatus === status;
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${
          isActive ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current/20` : `bg-background border-border ${cfg.color} opacity-40 hover:opacity-80`
        }`}
      >
        {cfg.icon && <cfg.icon className="w-3.5 h-3.5" />}
        {cfg.label}
      </button>
    );
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            {t('inspections.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('inspections.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />{t('inspections.new')}</Button>
      </div>

      {/* Checklist cards - more visual than table */}
      {checklists.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-card border border-border rounded-xl">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t('inspections.empty')}</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />{t('inspections.new')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {checklists.map(cl => {
            const s = getSummary(cl.items);
            const wo = workOrders.find(w => w.id === cl.work_order_id);
            const overall = getOverallStatus(cl.items);
            return (
              <div key={cl.id} className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm font-mono">{wo?.number || cl.work_order_id.slice(0, 8)}</span>
                  <Badge variant={cl.completed_at ? "default" : "secondary"}>
                    {cl.completed_at ? t('inspections.done') : t('inspections.inProgress')}
                  </Badge>
                </div>

                {wo?.vehicles && (
                  <p className="text-xs text-muted-foreground">
                    {(wo.vehicles as any)?.make} {(wo.vehicles as any)?.model} — <span className="font-mono font-semibold">{(wo.vehicles as any)?.plate}</span>
                  </p>
                )}

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.checked}/{s.total} verificados</span>
                    <span className="font-semibold">{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-2" />
                </div>

                {/* Summary pills */}
                <div className="flex gap-2 text-xs">
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-medium">
                    <CheckCircle className="w-3 h-3" /> {s.ok}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-medium">
                    <AlertTriangle className="w-3 h-3" /> {s.attention}
                  </span>
                  <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-medium">
                    <XCircle className="w-3 h-3" /> {s.repair}
                  </span>
                </div>

                {/* Overall status */}
                <div className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${overall.color} text-center`}>
                  {overall.label}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setViewChecklist(cl)}>
                    <Eye className="w-3.5 h-3.5 mr-1" />{t('common.view')}
                  </Button>
                  {!cl.completed_at && (
                    <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleComplete(cl.id)}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />{t('inspections.markComplete') || 'Concluir'}
                    </Button>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {cl.technician && `🔧 ${cl.technician} · `}{format(new Date(cl.created_at), "dd/MM/yy HH:mm")}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('inspections.new')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('inspections.workOrder')} *</Label>
                <Select value={selectedWO} onValueChange={setSelectedWO}>
                  <SelectTrigger><SelectValue placeholder={t('inspections.selectWO')} /></SelectTrigger>
                  <SelectContent>
                    {workOrders.map(wo => <SelectItem key={wo.id} value={wo.id}>{wo.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('inspections.technician')}</Label>
                <Input value={technician} onChange={e => setTechnician(e.target.value)} />
              </div>
            </div>

            {/* Progress */}
            {(() => {
              const s = getSummary(items);
              return (
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.checked}/{s.total} verificados</span>
                    <span className="font-bold text-sm">{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-2.5" />
                </div>
              );
            })()}

            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                  item.status === 'ok' ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20' :
                  item.status === 'attention' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20' :
                  item.status === 'repair' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20' :
                  'border-border bg-background'
                }`}>
                  <span className="text-sm font-medium flex-1 min-w-0">{item.name}</span>
                  <div className="flex gap-1 shrink-0">
                    <StatusButton status="ok" currentStatus={item.status} onClick={() => updateItemStatus(i, item.status === 'ok' ? 'na' : 'ok')} />
                    <StatusButton status="attention" currentStatus={item.status} onClick={() => updateItemStatus(i, item.status === 'attention' ? 'na' : 'attention')} />
                    <StatusButton status="repair" currentStatus={item.status} onClick={() => updateItemStatus(i, item.status === 'repair' ? 'na' : 'repair')} />
                  </div>
                </div>
              ))}
            </div>

            <Button onClick={handleCreate} className="w-full" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {t('inspections.create')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View/Edit Dialog with auto-save */}
      <Dialog open={!!viewChecklist} onOpenChange={(o) => { if (!o) { setViewChecklist(null); load(); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('inspections.viewTitle')}</DialogTitle></DialogHeader>
          {viewChecklist && (() => {
            const s = getSummary(viewChecklist.items);
            const overall = getOverallStatus(viewChecklist.items);
            return (
              <div className="space-y-4">
                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">{s.checked}/{s.total} verificados</span>
                    <span className="font-bold text-sm">{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-2.5" />
                </div>

                {/* Overall status banner */}
                <div className={`text-sm font-semibold px-4 py-2.5 rounded-xl border-2 text-center ${overall.color}`}>
                  {overall.label}
                </div>

                {/* Items */}
                <div className="space-y-1.5">
                  {viewChecklist.items.map((item, i) => (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      item.status === 'ok' ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-900/20' :
                      item.status === 'attention' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-900/20' :
                      item.status === 'repair' ? 'border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-900/20' :
                      'border-border bg-background'
                    }`}>
                      <span className="text-sm font-medium flex-1">{item.name}</span>
                      {!viewChecklist.completed_at ? (
                        <div className="flex gap-1 shrink-0">
                          <StatusButton status="ok" currentStatus={item.status} onClick={() => updateViewItem(i, item.status === 'ok' ? 'na' : 'ok')} />
                          <StatusButton status="attention" currentStatus={item.status} onClick={() => updateViewItem(i, item.status === 'attention' ? 'na' : 'attention')} />
                          <StatusButton status="repair" currentStatus={item.status} onClick={() => updateViewItem(i, item.status === 'repair' ? 'na' : 'repair')} />
                        </div>
                      ) : (
                        <span className={`text-xs font-semibold ${STATUS_CONFIG[item.status].color}`}>
                          {STATUS_CONFIG[item.status].label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {!viewChecklist.completed_at && (
                  <p className="text-xs text-muted-foreground text-center italic">
                    ✓ Auto-guardado automaticamente
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
