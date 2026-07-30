import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
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
  Loader2, Wrench, Car, ChevronDown, ChevronUp, FileText, Send, Save,
  StickyNote, MessageSquare, Camera, ImageIcon, Download
} from "lucide-react";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotifications";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import ListSkeleton from "@/components/ListSkeleton";
import { pageCache } from "@/lib/pageCache";

interface ChecklistItem {
  name: string;
  key: string;
  category: string;
  status: "ok" | "attention" | "repair" | "na";
  notes: string;
  photoUrl?: string;
}

const CHECKLIST_CATEGORIES = [
  {
    id: 'braking', labelKey: 'inspections.category.braking', icon: '🛑',
    items: [
      { key: 'frontBrakes', labelKey: 'inspections.item.frontBrakes' },
      { key: 'rearBrakes', labelKey: 'inspections.item.rearBrakes' },
      { key: 'brakeDiscs', labelKey: 'inspections.item.brakeDiscs' },
      { key: 'brakeFluid', labelKey: 'inspections.item.brakeFluid' },
    ],
  },
  {
    id: 'tires', labelKey: 'inspections.category.tires', icon: '🔘',
    items: [
      { key: 'frontLeftTire', labelKey: 'inspections.item.frontLeftTire' },
      { key: 'frontRightTire', labelKey: 'inspections.item.frontRightTire' },
      { key: 'rearLeftTire', labelKey: 'inspections.item.rearLeftTire' },
      { key: 'rearRightTire', labelKey: 'inspections.item.rearRightTire' },
    ],
  },
  {
    id: 'engine', labelKey: 'inspections.category.engine', icon: '⚙️',
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
    id: 'suspension', labelKey: 'inspections.category.suspension', icon: '🔩',
    items: [
      { key: 'frontSuspension', labelKey: 'inspections.item.frontSuspension' },
      { key: 'rearSuspension', labelKey: 'inspections.item.rearSuspension' },
      { key: 'exhaust', labelKey: 'inspections.item.exhaust' },
    ],
  },
  {
    id: 'electrical', labelKey: 'inspections.category.electrical', icon: '⚡',
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

export default function Inspections() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const _shopInit = typeof window !== "undefined" ? localStorage.getItem("garageflow_active_shop") : null;
  const _inCache = pageCache.get<{ checklists: Checklist[]; workOrders: any[] }>(`inspections:${_shopInit}`);
  const [checklists, setChecklists] = useState<Checklist[]>(_inCache?.checklists ?? []);
  const [workOrders, setWorkOrders] = useState<any[]>(_inCache?.workOrders ?? []);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [selectedWO, setSelectedWO] = useState("");
  const [technician, setTechnician] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [clientRecommendation, setClientRecommendation] = useState("");
  const [saving, setSaving] = useState(false);
  const [dataLoading, setDataLoading] = useState(!_inCache);
  const [expandedNotes, setExpandedNotes] = useState<Record<number, boolean>>({});
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [uploadingPhoto, setUploadingPhoto] = useState<number | null>(null);
  const [sharingId, setSharingId] = useState<string | null>(null);

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
        photoUrl: "",
      }))
    );
  }, [t]);

  const [items, setItems] = useState<ChecklistItem[]>(buildDefaultItems());

  useEffect(() => {
    setItems(buildDefaultItems());
  }, [buildDefaultItems]);

  const load = async () => {
    if (!activeShopId) { setDataLoading(false); return; }
    const key = `inspections:${activeShopId}`;
    const cc = pageCache.get<{ checklists: Checklist[]; workOrders: any[] }>(key);
    if (cc) {
      setChecklists(cc.checklists); setWorkOrders(cc.workOrders); setDataLoading(false);
    } else {
      setDataLoading(true);
    }
    try {
      const [clRes, woRes] = await Promise.all([
        supabase.from("inspection_checklists").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
        supabase.from("work_orders").select("id, number, status, client_id, vehicle_id, clients(name), vehicles(make, model, plate)").eq("shop_id", activeShopId).order("created_at", { ascending: false }),
      ]);
      const cl = (clRes.data ?? []).map((c: any) => ({
        ...c,
        items: (Array.isArray(c.items) ? c.items : JSON.parse(c.items)).map((item: any) => ({
          ...item,
          key: item.key || '',
          category: item.category || '',
          notes: item.notes || '',
          photoUrl: item.photoUrl || '',
        })),
      })) as Checklist[];
      const wo = woRes.data ?? [];
      setChecklists(cl);
      setWorkOrders(wo);
      pageCache.set(key, { checklists: cl, workOrders: wo });
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { load(); }, [activeShopId]);

  const availableWOs = workOrders.filter(wo =>
    !checklists.some(cl => cl.work_order_id === wo.id)
  );

  const handleCreate = async (asDraft = false) => {
    if (!activeShopId || !selectedWO) { toast.error(t('inspections.selectWO')); return; }
    setSaving(true);
    const itemsToSave = items.map(i => ({ ...i }));
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
    // Push notification for completed inspection
    if (!asDraft && activeShopId) {
      const wo = workOrders.find(w => w.id === selectedWO);
      sendPushNotification(
        activeShopId,
        `Inspeção concluída`,
        wo ? `${wo.number} — ${(wo.vehicles as any)?.make || ''} ${(wo.vehicles as any)?.model || ''} (${(wo.vehicles as any)?.plate || ''})` : 'Nova inspeção concluída',
        '/inspections'
      );
    }
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

  /** Gera (se necessário) e copia o link público da inspeção para o cliente. */
  const handleShare = async (checklistId: string) => {
    setSharingId(checklistId);
    try {
      const { data, error } = await supabase
        .from("inspection_checklists")
        .update({ shared_at: new Date().toISOString() } as any)
        .eq("id", checklistId)
        .select("public_token")
        .maybeSingle();
      if (error) throw error;
      const token = (data as any)?.public_token;
      if (!token) throw new Error("Não foi possível gerar o link de partilha");
      const url = `${window.location.origin}/inspection/${token}`;
      try {
        if (navigator.share) {
          await navigator.share({ title: "Relatório de inspeção", url });
        } else {
          await navigator.clipboard.writeText(url);
        }
        toast.success("Link da inspeção pronto a enviar ao cliente", { description: url });
      } catch {
        window.open(url, "_blank", "noopener");
        toast.success("Relatório aberto numa nova janela");
      }
      load();
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível partilhar a inspeção");
    } finally {
      setSharingId(null);
    }
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

  const handlePhotoUpload = async (index: number, file: File, isView = false) => {
    if (!activeShopId) return;
    setUploadingPhoto(index);
    const path = `${activeShopId}/inspections/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("inspection-files").upload(path, file);
    if (error) { toast.error(t('inspections.photoError')); setUploadingPhoto(null); return; }
    // inspection-files is a private bucket - use createSignedUrl for access
    const { data: signedData } = await supabase.storage.from("inspection-files").createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
    const photoUrl = signedData?.signedUrl || '';

    if (isView && viewChecklist) {
      const updated = [...viewChecklist.items];
      updated[index] = { ...updated[index], photoUrl };
      const newChecklist = { ...viewChecklist, items: updated };
      setViewChecklist(newChecklist);
      autoSaveChecklist(newChecklist, updated);
    } else {
      setItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], photoUrl };
        return updated;
      });
    }
    setUploadingPhoto(null);
    toast.success(t('inspections.photoAdded'));
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

  const updateViewItemNotes = (index: number, notes: string) => {
    if (!viewChecklist) return;
    const updated = [...viewChecklist.items];
    updated[index] = { ...updated[index], notes };
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
    if (s.repair > 0) return { labelKey: "inspections.overall.repairsNeeded", variant: "repair" as const };
    if (s.attention > 0) return { labelKey: "inspections.overall.attentionRecommended", variant: "attention" as const };
    if (s.pct === 100) return { labelKey: "inspections.overall.allOk", variant: "ok" as const };
    return { labelKey: "inspections.overall.inProgress", variant: "na" as const };
  };

  const overallStyles = {
    ok: "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700",
    attention: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
    repair: "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
    na: "bg-muted text-muted-foreground border-border",
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

  // ============ PREMIUM STATUS BUTTON ============
  const StatusButton = ({ status, currentStatus, onClick, size = "default" }: {
    status: "ok" | "attention" | "repair";
    currentStatus: string;
    onClick: () => void;
    size?: "default" | "sm";
  }) => {
    const isActive = currentStatus === status;
    const configs = {
      ok: {
        activeClass: "bg-green-500 text-white shadow-green-500/30 border-green-500",
        inactiveClass: "text-green-600 dark:text-green-400 border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20",
        Icon: CheckCircle,
      },
      attention: {
        activeClass: "bg-amber-500 text-white shadow-amber-500/30 border-amber-500",
        inactiveClass: "text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-900/20",
        Icon: AlertTriangle,
      },
      repair: {
        activeClass: "bg-red-500 text-white shadow-red-500/30 border-red-500",
        inactiveClass: "text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20",
        Icon: XCircle,
      },
    };

    const cfg = configs[status];
    const Icon = cfg.Icon;
    const sizeClasses = size === "sm"
      ? "h-7 px-2 text-[10px] gap-1 min-w-[52px]"
      : "h-8 px-3 text-xs gap-1.5 min-w-[64px]";

    return (
      <motion.button
        whileHover={{ scale: 1.06, y: -1 }}
        whileTap={{ scale: 0.94 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerDown={(e) => e.stopPropagation()}
        className={`
          inline-flex items-center justify-center ${sizeClasses} rounded-full font-bold border-2
          transition-all duration-200 select-none cursor-pointer
          ${isActive
            ? `${cfg.activeClass} shadow-lg ring-2 ring-offset-1 ring-offset-background ring-current/20`
            : `${cfg.inactiveClass} bg-background opacity-60 hover:opacity-100`
          }
        `}
      >
        <Icon className={size === "sm" ? "w-3 h-3 shrink-0" : "w-3.5 h-3.5 shrink-0"} />
        <span>{t(`inspections.status.${status}`)}</span>
      </motion.button>
    );
  };

  // ============ RENDER CATEGORY ITEMS ============
  const renderCategoryItems = (
    itemsList: ChecklistItem[],
    onStatusChange: (index: number, status: ChecklistItem["status"]) => void,
    onNotesChange?: (index: number, notes: string) => void,
    isReadOnly = false,
    noteState?: Record<number, boolean>,
    setNoteState?: (s: Record<number, boolean>) => void,
    isViewMode = false,
  ) => {
    return CHECKLIST_CATEGORIES.map(cat => {
      const categoryItems = cat.items.map((catItem) => {
        const idx = itemsList.findIndex(item => item.key === catItem.key || item.name === t(catItem.labelKey));
        return idx >= 0 ? { item: itemsList[idx], idx } : null;
      }).filter(Boolean) as { item: ChecklistItem; idx: number }[];

      if (categoryItems.length === 0) return null;

      const catSummary = getSummary(categoryItems.map(ci => ci.item));
      const isCollapsed = collapsedCategories[cat.id];
      const catComplete = catSummary.checked === catSummary.total;

      return (
        <div key={cat.id} className="space-y-1">
          {/* Category header */}
          <button
            onClick={() => toggleCategory(cat.id)}
            className={`flex items-center justify-between w-full px-4 py-3 rounded-xl transition-all duration-200 ${
              catComplete
                ? 'bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800'
                : 'bg-muted/50 hover:bg-muted border border-transparent'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{cat.icon}</span>
              <span className="text-sm font-bold text-foreground">{t(cat.labelKey)}</span>
              {catComplete && <CheckCircle className="w-4 h-4 text-green-500" />}
            </div>
            <div className="flex items-center gap-3">
              {/* Mini summary pills */}
              <div className="flex items-center gap-1">
                {catSummary.ok > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                    <CheckCircle className="w-2.5 h-2.5" />{catSummary.ok}
                  </span>
                )}
                {catSummary.attention > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="w-2.5 h-2.5" />{catSummary.attention}
                  </span>
                )}
                {catSummary.repair > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
                    <XCircle className="w-2.5 h-2.5" />{catSummary.repair}
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground font-medium tabular-nums">
                {catSummary.checked}/{catSummary.total}
              </span>
              {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {/* Items */}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="overflow-hidden"
              >
                <div className="space-y-1 pl-2">
                  {categoryItems.map(({ item, idx }) => {
                    const showNotes = noteState?.[idx];
                    const hasContent = item.notes || item.photoUrl;

                    return (
                      <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.02 * categoryItems.indexOf(categoryItems.find(ci => ci.idx === idx)!) }}
                      >
                        {/* Item row */}
                        <div className={`
                          flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 transition-all duration-300
                          ${item.status === 'ok' ? 'border-green-200 bg-green-50/50 dark:border-green-800/60 dark:bg-green-900/10' :
                            item.status === 'attention' ? 'border-amber-200 bg-amber-50/50 dark:border-amber-800/60 dark:bg-amber-900/10' :
                            item.status === 'repair' ? 'border-red-200 bg-red-50/50 dark:border-red-800/60 dark:bg-red-900/10' :
                            'border-border bg-background hover:bg-muted/20'}
                        `}>
                          {/* Status indicator dot */}
                          <div className={`w-2 h-2 rounded-full shrink-0 transition-colors duration-300 ${
                            item.status === 'ok' ? 'bg-green-500' :
                            item.status === 'attention' ? 'bg-amber-500' :
                            item.status === 'repair' ? 'bg-red-500' :
                            'bg-muted-foreground/20'
                          }`} />

                          {/* Item name */}
                          <span className={`text-sm font-medium flex-1 min-w-0 truncate transition-colors ${
                            item.status !== 'na' ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {item.name}
                          </span>

                          {/* Status buttons */}
                          <div className="flex items-center gap-1 shrink-0">
                            {!isReadOnly ? (
                              <>
                                <StatusButton status="ok" currentStatus={item.status} onClick={() => onStatusChange(idx, 'ok')} size="sm" />
                                <StatusButton status="attention" currentStatus={item.status} onClick={() => onStatusChange(idx, 'attention')} size="sm" />
                                <StatusButton status="repair" currentStatus={item.status} onClick={() => onStatusChange(idx, 'repair')} size="sm" />
                                {/* Notes + Photo toggle */}
                                <motion.button
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                  onClick={(e) => { e.stopPropagation(); setNoteState?.({ ...noteState, [idx]: !showNotes }); }}
                                  className={`p-1.5 rounded-full transition-all ${
                                    hasContent
                                      ? 'bg-primary/15 text-primary ring-1 ring-primary/20'
                                      : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted'
                                  }`}
                                >
                                  <StickyNote className="w-3.5 h-3.5" />
                                </motion.button>
                              </>
                            ) : (
                              <>
                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${
                                  item.status === 'ok' ? 'bg-green-500 text-white' :
                                  item.status === 'attention' ? 'bg-amber-500 text-white' :
                                  item.status === 'repair' ? 'bg-red-500 text-white' :
                                  'bg-muted text-muted-foreground'
                                }`}>
                                  {t(`inspections.status.${item.status}`)}
                                </span>
                                {hasContent && <StickyNote className="w-3.5 h-3.5 text-primary" />}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Expandable notes + photo */}
                        <AnimatePresence>
                          {showNotes && !isReadOnly && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1 ml-4 mr-1 p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                                <Input
                                  value={item.notes}
                                  onChange={(e) => onNotesChange?.(idx, e.target.value)}
                                  placeholder={t('inspections.itemNotePlaceholder')}
                                  className="text-xs h-8"
                                />
                                {/* Photo upload */}
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary cursor-pointer transition-colors">
                                    <Camera className="w-3.5 h-3.5" />
                                    <span>{item.photoUrl ? t('inspections.changePhoto') : t('inspections.addPhoto')}</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoUpload(idx, file, isViewMode);
                                      }}
                                    />
                                  </label>
                                  {uploadingPhoto === idx && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
                                </div>
                                {item.photoUrl && (
                                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-border">
                                    <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Read-only notes display */}
                        {isReadOnly && (item.notes || item.photoUrl) && (
                          <div className="ml-6 mt-1 space-y-1">
                            {item.notes && <p className="text-[11px] text-muted-foreground italic">📝 {item.notes}</p>}
                            {item.photoUrl && (
                              <div className="w-16 h-16 rounded-lg overflow-hidden border border-border">
                                <img src={item.photoUrl} alt="" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      );
    });
  };

  const summaryGlobal = getSummary(items);
  const overallGlobal = getOverallStatus(items);

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
      {dataLoading && checklists.length === 0 ? (
        <ListSkeleton rows={5} />
      ) : checklists.length === 0 ? (
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
                className="bg-card border border-border rounded-xl p-4 space-y-3 hover:shadow-lg hover:border-primary/20 transition-all duration-300 group"
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
                  <Progress value={s.pct} className="h-2.5" />
                </div>

                {/* Summary pills */}
                <div className="flex gap-1.5 text-xs flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 font-semibold">
                    <CheckCircle className="w-3 h-3" /> {s.ok}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold">
                    <AlertTriangle className="w-3 h-3" /> {s.attention}
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold">
                    <XCircle className="w-3 h-3" /> {s.repair}
                  </span>
                </div>

                <div className={`text-xs font-semibold px-3 py-2 rounded-xl border-2 text-center ${overallStyles[overall.variant]}`}>
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

            {/* Progress bar - premium */}
            <div className="bg-muted/30 rounded-2xl p-4 border border-border">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-foreground">{t('inspections.progress')}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${overallStyles[overallGlobal.variant]}`}>
                    {t(overallGlobal.labelKey)}
                  </span>
                </div>
                <span className="text-2xl font-black text-primary tabular-nums">{summaryGlobal.pct}%</span>
              </div>
              <Progress value={summaryGlobal.pct} className="h-3 rounded-full" />
              <div className="flex gap-3 mt-3">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400">
                  <CheckCircle className="w-3.5 h-3.5" /> {summaryGlobal.ok} OK
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" /> {summaryGlobal.attention} {t('inspections.status.attention')}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400">
                  <XCircle className="w-3.5 h-3.5" /> {summaryGlobal.repair} {t('inspections.status.repair')}
                </span>
              </div>
            </div>

            <Separator />

            {/* Checklist by categories */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <ClipboardCheck className="w-4 h-4 text-primary" />
                {t('inspections.checklist')}
              </h3>
              <div className="space-y-2">
                {renderCategoryItems(items, updateItemStatus, updateItemNotes, false, expandedNotes, setExpandedNotes, false)}
              </div>
            </div>

            <Separator />

            {/* Client recommendation */}
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Button variant="outline" onClick={() => handleCreate(true)} disabled={saving} className="gap-1.5 text-xs">
                <Save className="w-3.5 h-3.5" />
                {t('inspections.saveDraft')}
              </Button>
              <Button onClick={() => handleCreate(false)} disabled={saving} className="gap-1.5 text-xs">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                {t('inspections.create')}
              </Button>
              <Button variant="secondary" className="gap-1.5 text-xs" disabled={!selectedWO} onClick={() => {
                if (selectedWO) {
                  navigate(`/services/edit/${selectedWO}`);
                }
              }}>
                <Send className="w-3.5 h-3.5" />
                {t('inspections.sendToWO')}
              </Button>
              <Button variant="secondary" className="gap-1.5 text-xs" disabled>
                <Download className="w-3.5 h-3.5" />
                {t('inspections.generatePDF')}
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
            const isCompleted = !!viewChecklist.completed_at;

            return (
              <div className="px-6 pb-6 space-y-4">
                {/* WO Info */}
                {wo && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-xl px-4 py-3 border border-border">
                    <Car className="w-4 h-4 text-primary" />
                    <span className="font-mono font-bold text-foreground">{wo.number}</span>
                    {wo.clients && <span>— {(wo.clients as any)?.name}</span>}
                    {wo.vehicles && <span>— {(wo.vehicles as any)?.make} {(wo.vehicles as any)?.model} ({(wo.vehicles as any)?.plate})</span>}
                  </div>
                )}

                {/* Progress */}
                <div className="bg-muted/30 rounded-2xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold">{t('inspections.progress')}</span>
                    <span className="text-2xl font-black text-primary tabular-nums">{s.pct}%</span>
                  </div>
                  <Progress value={s.pct} className="h-3" />
                  <div className="flex gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400"><CheckCircle className="w-3 h-3" /> {s.ok}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400"><AlertTriangle className="w-3 h-3" /> {s.attention}</span>
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400"><XCircle className="w-3 h-3" /> {s.repair}</span>
                  </div>
                </div>

                {/* Overall status */}
                <div className={`text-sm font-bold px-4 py-3 rounded-xl border-2 text-center ${overallStyles[overall.variant]}`}>
                  {t(overall.labelKey)}
                </div>

                {/* Items by category */}
                <div className="space-y-2">
                  {renderCategoryItems(
                    viewChecklist.items,
                    (idx, status) => updateViewItem(idx, status),
                    (idx, notes) => updateViewItemNotes(idx, notes),
                    isCompleted,
                    expandedNotes,
                    setExpandedNotes,
                    true
                  )}
                </div>

                {/* Actions */}
                {!isCompleted && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    <Button variant="outline" className="gap-1.5 text-xs" onClick={() => { setViewChecklist(null); load(); }}>
                      <Save className="w-3.5 h-3.5" />{t('inspections.saveDraft')}
                    </Button>
                    <Button className="gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => { handleComplete(viewChecklist.id); setViewChecklist(null); }}>
                      <CheckCircle className="w-3.5 h-3.5" />{t('inspections.markComplete')}
                    </Button>
                    <Button variant="secondary" className="gap-1.5 text-xs" onClick={() => { setViewChecklist(null); navigate(`/services/edit/${viewChecklist.work_order_id}`); }}>
                      <Send className="w-3.5 h-3.5" />{t('inspections.sendToWO')}
                    </Button>
                    <Button variant="secondary" className="gap-1.5 text-xs" disabled>
                      <Download className="w-3.5 h-3.5" />{t('inspections.generatePDF')}
                    </Button>
                  </div>
                )}

                {!isCompleted && (
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
