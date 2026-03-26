import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardCheck, Plus, Eye, CheckCircle, AlertTriangle, XCircle,
  Loader2, Wrench, Car, ChevronDown, ChevronUp, FileText, Send, Save, StickyNote, MessageSquare
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

interface ChecklistItem {
  name: string;
  key: string;
  category: string;
  status: "ok" | "attention" | "repair" | "na";
  notes: string;
}

const CHECKLIST_CATEGORIES = [
  {
    id: 'braking',
    labelKey: 'inspections.category.braking',
    icon: '🛑',
    items: [
      { key: 'frontBrakes', labelKey: 'inspections.item.frontBrakes' },
      { key: 'rearBrakes', labelKey: 'inspections.item.rearBrakes' },
      { key: 'brakeDiscs', labelKey: 'inspections.item.brakeDiscs' },
      { key: 'brakeFluid', labelKey: 'inspections.item.brakeFluid' },
    ],
  },
  {
    id: 'tires',
    labelKey: 'inspections.category.tires',
    icon: '🔘',
    items: [
      { key: 'frontLeftTire', labelKey: 'inspections.item.frontLeftTire' },
      { key: 'frontRightTire', labelKey: 'inspections.item.frontRightTire' },
      { key: 'rearLeftTire', labelKey: 'inspections.item.rearLeftTire' },
      { key: 'rearRightTire', labelKey: 'inspections.item.rearRightTire' },
    ],
  },
  {
    id: 'engine',
    labelKey: 'inspections.category.engine',
    icon: '⚙️',
    items: [
      { key: 'engineOil', labelKey: 'inspections.item.engineOil' },
      { key: 'airFilter', labelKey: 'inspections.item.airFilter' },
      { key: 'oilFilter', labelKey: 'inspections.item.oilFilter' },
      { key: 'cabinFilter', labelKey: 'inspections.item.cabinFilter' },
      { key: 'belts', labelKey: 'inspections.item.belts' },
      { key: 'coolant', labelKey: 'inspections.item.coolant' },
    ],
  },
  {
    id: 'suspension',
    labelKey: 'inspections.category.suspension',
    icon: '🔩',
    items: [
      { key: 'frontSuspension', labelKey: 'inspections.item.frontSuspension' },
      { key: 'rearSuspension', labelKey: 'inspections.item.rearSuspension' },
      { key: 'exhaust', labelKey: 'inspections.item.exhaust' },
    ],
  },
  {
    id: 'electrical',
    labelKey: 'inspections.category.electrical',
    icon: '⚡',
    items: [
      { key: 'battery', labelKey: 'inspections.item.battery' },
      { key: 'lights', labelKey: 'inspections.item.lights' },
      { key: 'wipers', labelKey: 'inspections.item.wipers' },
    ],
  },
];

interface Checklist {
  id: string;
  shop_id: string;
  work_order_id: string;
  items: ChecklistItem[];
  technician: string | null;
  completed_at: string | null;
  created_at: string;
}

const STATUS_CONFIG = {
  ok: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-500", bgLight: "bg-green-100 dark:bg-green-900/30", border: "border-green-300 dark:border-green-700", ring: "ring-green-400", labelKey: "inspections.status.ok" },
  attention: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-500", bgLight: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-300 dark:border-amber-700", ring: "ring-amber-400", labelKey: "inspections.status.attention" },
  repair: { icon: XCircle, color: "text-red-600", bg: "bg-red-500", bgLight: "bg-red-100 dark:bg-red-900/30", border: "border-red-300 dark:border-red-700", ring: "ring-red-400", labelKey: "inspections.status.repair" },
  na: { icon: null, color: "text-muted-foreground", bg: "bg-muted", bgLight: "bg-muted", border: "border-border", ring: "ring-border", labelKey: "inspections.status.na" },
};

export default function Inspections() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [selectedWO, setSelectedWO] = useState("");
  const [technician, setTechnician] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [clientRecommendation, setClientRecommendation] = useState("");
  const [saving, setSaving] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);

  const activeShopId = useActiveShopId();

  const buildDefaultItems = useCallback((): ChecklistItem[] => {
    return CHECKLIST_CATEGORIES.flatMap(cat =>
      cat.items.map(item => ({
        name: t(item.labelKey),
        key: item.key,
        category: cat.id,
        status: "na" as const,
        notes: "",
      }))
    );
  }, [t]);

  const [items, setItems] = useState<ChecklistItem[]>(buildDefaultItems());

  useEffect(() => {
    setItems(buildDefaultItems());
  }, [buildDefaultItems]);

  const load = async () => {
    if (!activeShopId) return;
    const [clRes, woRes] = await Promise.all([
      supabase.from("inspection_checklists").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
      supabase.from("work_orders").select("id, number, status, client_id, vehicle_id, clients(name), vehicles(make, model, plate)").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
    ]);
    if (clRes.data) setChecklists(clRes.data.map((c: any) => ({
      ...c,
      items: (Array.isArray(c.items) ? c.items : JSON.parse(c.items)).map((item: any) => ({
        ...item,
        key: item.key || '',
        category: item.category || '',
        notes: item.notes || '',
      })),
    })) as Checklist[]);
    if (woRes.data) setWorkOrders(woRes.data);
  };

  useEffect(() => { load(); }, [activeShopId]);

  // Filter WOs that don't have an inspection yet
  const availableWOs = workOrders.filter(wo =>
    !checklists.some(cl => cl.work_order_id === wo.id)
  );

  const handleCreate = async (asDraft = false) => {
    if (!activeShopId || !selectedWO) { toast.error(t('inspections.selectWO')); return; }
    setSaving(true);
    const itemsToSave = items.map(i => ({ ...i, name: i.name }));
    const completed = !asDraft && items.every(i => i.status !== 'na') ? new Date().toISOString() : null;
    const { error } = await supabase.from("inspection_checklists").insert({
      shop_id: activeShopId,
      work_order_id: selectedWO,
      items: JSON.stringify(itemsToSave),
      technician: technician || null,
      completed_at: completed,
    } as any);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(asDraft ? t('inspections.draftSaved') : t('inspections.created'));
    setSaving(false);
    setDialogOpen(false);
    setItems(buildDefaultItems());
    setSelectedWO("");
    setTechnician("");
    setGeneralNotes("");
    setClientRecommendation("");
    load();
  };

  const handleComplete = async (id: string) => {
    await supabase.from("inspection_checklists").update({ completed_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(t('inspections.completed'));
    load();
  };

  const updateItemStatus = (index: number, status: ChecklistItem["status"]) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], status: updated[index].status === status ? 'na' : status };
      return updated;
    });
  };

  const updateItemNotes = (index: number, notes: string) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], notes };
      return updated;
    });
  };

  const autoSaveChecklist = useCallback(async (checklist: Checklist, updatedItems: ChecklistItem[]) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await supabase.from("inspection_checklists").update({ items: JSON.stringify(updatedItems) } as any).eq("id", checklist.id);
    }, 800);
  }, []);

  const updateViewItem = (index: number, status: ChecklistItem["status"]) => {
    if (!viewChecklist) return;
    const updated = [...viewChecklist.items];
    updated[index] = { ...updated[index], status: updated[index].status === status ? 'na' : status };
    const newChecklist = { ...viewChecklist, items: updated };
    setViewChecklist(newChecklist);
    autoSaveChecklist(newChecklist, updated);
  };

  const getSummary = (itemsList: ChecklistItem[]) => {
    const ok = itemsList.filter(i => i.status === "ok").length;
    const attention = itemsList.filter(i => i.status === "attention").length;
    const repair = itemsList.filter(i => i.status === "repair").length;
    const checked = ok + attention + repair;
    const total = itemsList.length;
    const pct = total > 0 ? Math.round((checked / total) * 100) : 0;
    return { ok, attention, repair, checked, total, pct };
  };

  const getOverallStatus = (itemsList: ChecklistItem[]) => {
    const s = getSummary(itemsList);
    if (s.repair > 0) return { labelKey: "inspections.overall.repairsNeeded", color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700" };
    if (s.attention > 0) return { labelKey: "inspections.overall.attentionRecommended", color: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700" };
    if (s.pct === 100) return { labelKey: "inspections.overall.allOk", color: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700" };
    return { labelKey: "inspections.overall.inProgress", color: "bg-muted text-muted-foreground border-border" };
  };

  const getWOLabel = (wo: any) => {
    const client = wo.clients?.name || '';
    const vehicle = wo.vehicles ? `${wo.vehicles.make} ${wo.vehicles.model}` : '';
    const plate = wo.vehicles?.plate || '';
    return `${wo.number} — ${client} — ${vehicle} — ${plate}`;
  };

  const toggleCategory = (catId: string) => {
    setCollapsedCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  // Status button component with premium animations
  const StatusButton = ({ status, currentStatus, onClick, size = "default" }: {
    status: "ok" | "attention" | "repair";
    currentStatus: string;
    onClick: () => void;
    size?: "default" | "sm";
  }) => {
    const cfg = STATUS_CONFIG[status];
    const isActive = currentStatus === status;
    const Icon = cfg.icon!;
    const sizeClasses = size === "sm" ? "px-2 py-1 text-[10px] gap-0.5" : "px-3 py-2 text-xs gap-1.5";

    return (
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`flex items-center ${sizeClasses} rounded-lg font-semibold border-2 transition-all duration-200 ${
          isActive
            ? `${cfg.bg} text-white border-transparent shadow-lg shadow-current/20 ring-2 ${cfg.ring} ring-offset-1 ring-offset-background`
            : `bg-background border-border ${cfg.color} opacity-50 hover:opacity-90 hover:${cfg.bgLight}`
        }`}
      >
        <Icon className={size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"} />
        {t(cfg.labelKey)}
      </motion.button>
    );
  };

  // Render checklist items grouped by category
  const renderCategoryItems = (
    itemsList: ChecklistItem[],
    onStatusChange: (index: number, status: ChecklistItem["status"]) => void,
    onNotesChange?: (index: number, notes: string) => void,
    isReadOnly = false,
    noteState?: Record<number, boolean>,
    setNoteState?: (s: Record<number, boolean>) => void,
  ) => {
    let globalIndex = 0;

    return CHECKLIST_CATEGORIES.map(cat => {
      const catItems = itemsList.filter(item => item.category === cat.id);
      // If items don't have category (legacy), match by key
      const startIdx = globalIndex;
      const categoryItems = catItems.length > 0
        ? catItems.map((item) => {
          const idx = itemsList.indexOf(item);
          return { item, idx };
        })
        : cat.items.map((catItem) => {
          const idx = itemsList.findIndex(item => item.key === catItem.key || item.name === t(catItem.labelKey));
          globalIndex++;
          return idx >= 0 ? { item: itemsList[idx], idx } : null;
        }).filter(Boolean) as { item: ChecklistItem; idx: number }[];

      if (categoryItems.length === 0) return null;

      const catSummary = getSummary(categoryItems.map(ci => ci.item));
      const isCollapsed = collapsedCategories[cat.id];

      return (
        <div key={cat.id} className="space-y-1">
          <button
            onClick={() => toggleCategory(cat.id)}
            className="flex items-center justify-between w-full px-3 py-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{cat.icon}</span>
              <span className="text-sm font-bold text-foreground">{t(cat.labelKey)}</span>
              <span className="text-[10px] text-muted-foreground ml-1">
                {catSummary.checked}/{catSummary.total}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {catSummary.ok > 0 && <span className="flex items-center gap-0.5 text-[10px] text-green-600 font-medium"><CheckCircle className="w-3 h-3" />{catSummary.ok}</span>}
              {catSummary.attention > 0 && <span className="flex items-center gap-0.5 text-[10px] text-amber-600 font-medium"><AlertTriangle className="w-3 h-3" />{catSummary.attention}</span>}
              {catSummary.repair > 0 && <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-medium"><XCircle className="w-3 h-3" />{catSummary.repair}</span>}
              {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-1 overflow-hidden"
              >
                {categoryItems.map(({ item, idx }) => {
                  const showNotes = noteState?.[idx];
                  return (
                    <div key={idx}>
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                        item.status === 'ok' ? 'border-green-200 bg-green-50/60 dark:border-green-800 dark:bg-green-900/20' :
                        item.status === 'attention' ? 'border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/20' :
                        item.status === 'repair' ? 'border-red-200 bg-red-50/60 dark:border-red-800 dark:bg-red-900/20' :
                        'border-border bg-background hover:bg-muted/30'
                      }`}>
                        <span className="text-sm font-medium flex-1 min-w-0 truncate">{item.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {!isReadOnly ? (
                            <>
                              <StatusButton status="ok" currentStatus={item.status} onClick={() => onStatusChange(idx, 'ok')} size="sm" />
                              <StatusButton status="attention" currentStatus={item.status} onClick={() => onStatusChange(idx, 'attention')} size="sm" />
                              <StatusButton status="repair" currentStatus={item.status} onClick={() => onStatusChange(idx, 'repair')} size="sm" />
                              <motion.button
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.9 }}
                                onClick={() => setNoteState?.({ ...noteState, [idx]: !showNotes })}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  item.notes ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                              >
                                <StickyNote className="w-3.5 h-3.5" />
                              </motion.button>
                            </>
                          ) : (
                            <>
                              <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
                                item.status === 'ok' ? 'bg-green-500 text-white' :
                                item.status === 'attention' ? 'bg-amber-500 text-white' :
                                item.status === 'repair' ? 'bg-red-500 text-white' :
                                'bg-muted text-muted-foreground'
                              }`}>
                                {t(STATUS_CONFIG[item.status].labelKey)}
                              </span>
                              {item.notes && (
                                <span className="text-primary"><StickyNote className="w-3.5 h-3.5" /></span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <AnimatePresence>
                        {showNotes && !isReadOnly && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <Input
                              value={item.notes}
                              onChange={(e) => onNotesChange?.(idx, e.target.value)}
                              placeholder={t('inspections.itemNotePlaceholder')}
                              className="mt-1 text-xs h-8"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      {isReadOnly && item.notes && (
                        <p className="text-[11px] text-muted-foreground ml-3 mt-0.5 italic">📝 {item.notes}</p>
                      )}
                    </div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  const summaryGlobal = getSummary(items);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            {t('inspections.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('inspections.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
          <Plus className="w-4 h-4" />{t('inspections.new')}
        </Button>
      </div>

      {/* Checklist cards */}
      {checklists.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <ClipboardCheck className="w-14 h-14 mx-auto mb-4 text-muted-foreground/30" />
          <p className="font-medium text-foreground mb-1">{t('inspections.empty')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('inspections.emptyDesc')}</p>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />{t('inspections.new')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {checklists.map(cl => {
            const s = getSummary(cl.items);
            const wo = workOrders.find(w => w.id === cl.work_order_id);
            const overall = getOverallStatus(cl.items);
            return (
              <motion.div
                key={cl.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-lg transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm font-mono text-primary">{wo?.number || cl.work_order_id.slice(0, 8)}</span>
                  <Badge variant={cl.completed_at ? "default" : "secondary"} className={cl.completed_at ? "bg-green-600" : ""}>
                    {cl.completed_at ? t('inspections.done') : t('inspections.inProgress')}
                  </Badge>
                </div>

                {wo?.vehicles && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Car className="w-3 h-3" />
                    {(wo.vehicles as any)?.make} {(wo.vehicles as any)?.model} — <span className="font-mono font-semibold">{(wo.vehicles as any)?.plate}</span>
                  </p>
                )}
                {wo?.clients && (
                  <p className="text-xs text-muted-foreground">👤 {(wo.clients as any)?.name}</p>
                )}

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{s.checked}/{s.total} {t('inspections.checked')}</span>
                    <span className="font-bold text-foreground">{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-2" />
                </div>

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

                <div className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border ${overall.color} text-center`}>
                  {t(overall.labelKey)}
                </div>

                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setViewChecklist(cl)}>
                    <Eye className="w-3.5 h-3.5 mr-1" />{t('common.view')}
                  </Button>
                  {!cl.completed_at && (
                    <Button size="sm" className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => handleComplete(cl.id)}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1" />{t('inspections.markComplete')}
                    </Button>
                  )}
                </div>

                <p className="text-[10px] text-muted-foreground">
                  {cl.technician && `🔧 ${cl.technician} · `}{format(new Date(cl.created_at), "dd/MM/yy HH:mm")}
                </p>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ============ CREATE DIALOG ============ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                {t('inspections.new')}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{t('inspections.newDesc')}</p>
            </DialogHeader>
          </div>

          <div className="px-6 pb-6 space-y-5">
            {/* Block 1 - Inspection Data */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {t('inspections.inspectionData')}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium">{t('inspections.workOrder')} *</Label>
                  <Select value={selectedWO} onValueChange={setSelectedWO}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder={t('inspections.selectWO')} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableWOs.length === 0 ? (
                        <div className="px-3 py-4 text-center">
                          <Wrench className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
                          <p className="text-xs text-muted-foreground mb-2">{t('inspections.noWOAvailable')}</p>
                          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDialogOpen(false); navigate('/services'); }}>
                            <Plus className="w-3 h-3 mr-1" />{t('inspections.createWO')}
                          </Button>
                        </div>
                      ) : (
                        availableWOs.map(wo => (
                          <SelectItem key={wo.id} value={wo.id} className="text-xs">
                            {getWOLabel(wo)}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium">{t('inspections.technician')}</Label>
                  <Input value={technician} onChange={e => setTechnician(e.target.value)} className="mt-1" placeholder={t('inspections.technicianPlaceholder')} />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-xs font-medium">{t('inspections.generalNotes')}</Label>
                  <Textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} className="mt-1 text-xs" rows={2} placeholder={t('inspections.generalNotesPlaceholder')} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Block 2 - Progress bar */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium">{summaryGlobal.checked}/{summaryGlobal.total} {t('inspections.checked')}</span>
                <span className="font-bold text-sm text-foreground">{summaryGlobal.pct}%</span>
              </div>
              <Progress value={summaryGlobal.pct} className="h-3 rounded-full" />
              <div className="flex gap-3 mt-2 text-[10px]">
                <span className="text-green-600 font-medium">✓ {summaryGlobal.ok} OK</span>
                <span className="text-amber-600 font-medium">⚠ {summaryGlobal.attention} {t('inspections.status.attention')}</span>
                <span className="text-red-600 font-medium">✕ {summaryGlobal.repair} {t('inspections.status.repair')}</span>
              </div>
            </div>

            <Separator />

            {/* Block 3 - Checklist by categories */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                {t('inspections.checklist')}
              </h3>
              <div className="space-y-2">
                {renderCategoryItems(items, (idx, status) => updateItemStatus(idx, status), updateItemNotes, false, expandedNotes, setExpandedNotes)}
              </div>
            </div>

            <Separator />

            {/* Block 4 - Client recommendation */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                {t('inspections.clientRecommendation')}
              </h3>
              <Textarea
                value={clientRecommendation}
                onChange={e => setClientRecommendation(e.target.value)}
                rows={3}
                className="text-xs"
                placeholder={t('inspections.clientRecommendationPlaceholder')}
              />
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => handleCreate(true)} disabled={saving} className="flex-1 gap-1.5">
                <Save className="w-4 h-4" />
                {t('inspections.saveDraft')}
              </Button>
              <Button onClick={() => handleCreate(false)} disabled={saving} className="flex-1 gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                {t('inspections.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ VIEW/EDIT DIALOG ============ */}
      <Dialog open={!!viewChecklist} onOpenChange={(o) => { if (!o) { setViewChecklist(null); load(); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-0">
          <div className="sticky top-0 z-10 bg-background border-b border-border px-6 py-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                {t('inspections.viewTitle')}
              </DialogTitle>
            </DialogHeader>
          </div>

          {viewChecklist && (() => {
            const s = getSummary(viewChecklist.items);
            const overall = getOverallStatus(viewChecklist.items);
            const wo = workOrders.find(w => w.id === viewChecklist.work_order_id);
            return (
              <div className="px-6 pb-6 space-y-4">
                {/* WO Info */}
                {wo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                    <Car className="w-3.5 h-3.5" />
                    <span className="font-mono font-bold text-foreground">{wo.number}</span>
                    {wo.clients && <span>— {(wo.clients as any)?.name}</span>}
                    {wo.vehicles && <span>— {(wo.vehicles as any)?.make} {(wo.vehicles as any)?.model} ({(wo.vehicles as any)?.plate})</span>}
                  </div>
                )}

                {/* Progress */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-muted-foreground">{s.checked}/{s.total} {t('inspections.checked')}</span>
                    <span className="font-bold text-sm">{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-3" />
                </div>

                {/* Overall status */}
                <div className={`text-sm font-semibold px-4 py-2.5 rounded-xl border-2 text-center ${overall.color}`}>
                  {t(overall.labelKey)}
                </div>

                {/* Items by category */}
                <div className="space-y-2">
                  {renderCategoryItems(
                    viewChecklist.items,
                    (idx, status) => updateViewItem(idx, status),
                    undefined,
                    !!viewChecklist.completed_at,
                    expandedNotes,
                    setExpandedNotes
                  )}
                </div>

                {!viewChecklist.completed_at && (
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Button variant="outline" className="flex-1 gap-1.5 text-xs" onClick={() => { setViewChecklist(null); load(); }}>
                      <Save className="w-3.5 h-3.5" />{t('inspections.saveDraft')}
                    </Button>
                    <Button className="flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => { handleComplete(viewChecklist.id); setViewChecklist(null); }}>
                      <CheckCircle className="w-3.5 h-3.5" />{t('inspections.markComplete')}
                    </Button>
                  </div>
                )}

                {!viewChecklist.completed_at && (
                  <p className="text-[10px] text-muted-foreground text-center italic">
                    ✓ {t('inspections.autoSaved')}
                  </p>
                )}

                {viewChecklist.technician && (
                  <p className="text-xs text-muted-foreground">🔧 {t('inspections.technician')}: {viewChecklist.technician}</p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
