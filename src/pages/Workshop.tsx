import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/i18n/LanguageContext";
import { useShopContext } from "@/hooks/useShopContext";
import { Play, Pause, CheckCircle, Wrench, Clock, Car, User, Stethoscope, ThumbsUp, Truck, Timer, ClipboardCheck, MessageSquare, ChevronRight, Brain, Package } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import WorkshopTimeline from "@/components/WorkshopTimeline";
import type { ServiceStatus } from "@/types/garage";
import { sendPushNotification } from "@/lib/pushNotifications";
import { pageCache } from "@/lib/pageCache";
import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { autoCreateInvoiceFromWorkOrder } from "@/lib/autoCreateInvoiceFromWorkOrder";

// Lazy-load heavy panels — only when the detail dialog is opened
const AIDiagnosisPanel = lazy(() => import("@/components/AIDiagnosisPanel"));
const LaborTimer = lazy(() => import("@/components/LaborTimer"));

const statusFlow: ServiceStatus[] = ['open', 'diagnosis', 'waiting_approval', 'approved', 'in_progress', 'completed', 'delivered'];

const getStatusConfig = (t: (key: string) => string) => ({
  open: { label: t('workshop.status.open'), icon: Wrench, color: "text-info", bg: "bg-info/10" },
  diagnosis: { label: t('workshop.status.diagnosis'), icon: Stethoscope, color: "text-warning", bg: "bg-warning/10" },
  waiting_approval: { label: t('workshop.status.waiting'), icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  approved: { label: t('workshop.status.approved'), icon: ThumbsUp, color: "text-success", bg: "bg-success/10" },
  in_progress: { label: t('workshop.status.inProgress'), icon: Play, color: "text-primary", bg: "bg-primary/10" },
  completed: { label: t('workshop.status.completed'), icon: CheckCircle, color: "text-success", bg: "bg-success/10" },
  delivered: { label: t('workshop.status.delivered'), icon: Truck, color: "text-muted-foreground", bg: "bg-muted" },
});

export default function Workshop() {
  const { language, t } = useLanguage();
  const { activeShopId } = useShopContext();
  const statusConfig = getStatusConfig(t);
  const filterTabs = [
    { key: 'active', label: t('workshop.filterActive') },
    { key: 'completed', label: t('workshop.filterCompleted') },
    { key: 'all', label: t('workshop.filterAll') },
  ];
  const [filter, setFilter] = useState('active');
  const _initShop = typeof window !== "undefined" ? localStorage.getItem("garageflow_active_shop") : null;
  const _wCache = pageCache.get<any[]>(`workshop:${_initShop}:active`);
  const [workOrders, setWorkOrders] = useState<any[]>(_wCache ?? []);
  const [loading, setLoading] = useState(!_wCache);
  const [selected, setSelected] = useState<any>(null);
  const [checklist, setChecklist] = useState<any>(null);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [diagnosisText, setDiagnosisText] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  

  const isPt = language === 'pt';

  const fetchOrders = useCallback(async () => {
    if (!activeShopId) {
      // No shop yet — don't keep skeletons forever
      setLoading(false);
      return;
    }
    const cacheKey = `workshop:${activeShopId}:${filter}`;
    const c = pageCache.get<any[]>(cacheKey);
    if (c) { setWorkOrders(c); setLoading(false); }
    else { setLoading(true); }

    let query = supabase
      .from("work_orders")
      // Drop heavy `lines` JSON from list — only fetched on demand for the dialog
      .select("id, number, status, total, created_at, completed_at, delivered_at, technician, diagnosis, client_description, entry_mileage, labor_hours, clients(name, phone), vehicles(make, model, plate, year, fuel)")
      .eq("shop_id", activeShopId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (filter === 'active') {
      query = query.in("status", ['open', 'diagnosis', 'waiting_approval', 'approved', 'in_progress']);
    } else if (filter === 'completed') {
      query = query.in("status", ['completed', 'delivered']);
    }

    try {
      const { data, error } = await query;
      if (error) throw error;
      const rows = data || [];
      setWorkOrders(rows);
      pageCache.set(cacheKey, rows);
    } catch (e) {
      console.error('[Workshop] fetch failed', e);
    } finally {
      setLoading(false);
    }
  }, [activeShopId, filter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Realtime: work order status changes / new orders reflect without refresh.
  useRealtimeTable("work_orders", { shopId: activeShopId, onChange: fetchOrders });

  const advanceStatus = async (wo: any) => {
    const currentIdx = statusFlow.indexOf(wo.status as ServiceStatus);
    if (currentIdx === -1 || currentIdx >= statusFlow.length - 1) return;
    const nextStatus = statusFlow[currentIdx + 1];
    setActionLoading(true);
    
    const updates: any = { status: nextStatus };
    if (nextStatus === 'completed') updates.completed_at = new Date().toISOString();
    if (nextStatus === 'delivered') updates.delivered_at = new Date().toISOString();
    if (nextStatus === 'diagnosis' && diagnosisText) updates.diagnosis = diagnosisText;

    const { error } = await supabase.from("work_orders").update(updates).eq("id", wo.id);
    if (error) {
      toast.error(t('workshop.errorUpdating'));
    } else {
      toast.success(`${wo.number} → ${statusConfig[nextStatus]?.label || nextStatus}`);
      // Push notification for status change
      if (activeShopId) {
        const vehicle = wo.vehicles ? `${(wo.vehicles as any)?.make} ${(wo.vehicles as any)?.model}` : '';
        sendPushNotification(
          activeShopId,
          `OS ${wo.number} — ${statusConfig[nextStatus]?.label || nextStatus}`,
          `${vehicle} (${(wo.clients as any)?.name || ''})`,
          '/workshop'
        );
      }
      // Auto-criar fatura ao concluir o serviço
      if (nextStatus === 'completed') {
        const invRes = await autoCreateInvoiceFromWorkOrder(wo.id);
        if (invRes.error) toast.error(`Fatura não criada: ${invRes.error}`);
        else if (invRes.created) toast.success("Fatura criada automaticamente");
      }
      fetchOrders();
      if (selected?.id === wo.id) setSelected({ ...wo, ...updates });
    }
    setActionLoading(false);
  };

  const loadChecklist = async (woId: string) => {
    const { data } = await supabase
      .from("inspection_checklists")
      .select("*")
      .eq("work_order_id", woId)
      .maybeSingle();
    
    if (data) {
      setChecklist(data);
      setChecklistItems(Array.isArray(data.items) ? data.items as any[] : []);
    } else {
      // Create default checklist
      const defaultItems = [
        { label: t('workshop.checklist.engineOil'), status: "pending" },
        { label: t('workshop.checklist.airFilter'), status: "pending" },
        { label: t('workshop.checklist.oilFilter'), status: "pending" },
        { label: t('workshop.checklist.frontBrakes'), status: "pending" },
        { label: t('workshop.checklist.rearBrakes'), status: "pending" },
        { label: t('workshop.checklist.frontTires'), status: "pending" },
        { label: t('workshop.checklist.rearTires'), status: "pending" },
        { label: t('workshop.checklist.suspension'), status: "pending" },
        { label: t('workshop.checklist.battery'), status: "pending" },
        { label: t('workshop.checklist.lights'), status: "pending" },
        { label: t('workshop.checklist.wipers'), status: "pending" },
        { label: t('workshop.checklist.fluidLevels'), status: "pending" },
      ];
      setChecklist(null);
      setChecklistItems(defaultItems);
    }
  };

  const toggleChecklistItem = (idx: number, status: string) => {
    setChecklistItems(prev => prev.map((item, i) => i === idx ? { ...item, status } : item));
  };

  /** Upload opcional de foto por item do checklist (não bloqueia a gravação). */
  const uploadItemPhoto = async (idx: number, file: File) => {
    if (!activeShopId || !selected) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Ficheiro inválido: escolha uma imagem.");
      return;
    }
    setUploadingPhotoIdx(idx);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${activeShopId}/${selected.id}/${Date.now()}-${idx}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("inspection-files")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      // URL assinada de longa duração para poder ser vista no Portal do Cliente.
      const { data: signed, error: signErr } = await supabase.storage
        .from("inspection-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      if (signErr) throw signErr;
      setChecklistItems(prev =>
        prev.map((item, i) => (i === idx ? { ...item, photo_path: path, photo_url: signed?.signedUrl } : item)),
      );
      toast.success("Foto adicionada. Grave o checklist para publicar no portal.");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar a foto.");
    } finally {
      setUploadingPhotoIdx(null);
    }
  };


  const saveChecklist = async (woId: string) => {
    setActionLoading(true);
    if (checklist) {
      await supabase.from("inspection_checklists").update({ items: checklistItems as any }).eq("id", checklist.id);
    } else {
      await supabase.from("inspection_checklists").insert({
        work_order_id: woId,
        shop_id: activeShopId!,
        items: checklistItems as any,
        technician: selected?.technician || null,
      });
    }
    toast.success(t('workshop.checklistSaved'));
    setActionLoading(false);
  };

  const getNextAction = (status: string) => {
    const map: Record<string, { label: string; icon: any; color: string }> = {
      open: { label: t('workshop.startDiagnosis'), icon: Stethoscope, color: "bg-warning text-warning-foreground" },
      diagnosis: { label: t('workshop.sendApproval'), icon: Clock, color: "bg-muted text-muted-foreground" },
      waiting_approval: { label: t('workshop.markApproved'), icon: ThumbsUp, color: "bg-success text-success-foreground" },
      approved: { label: t('workshop.startWork'), icon: Play, color: "bg-primary text-primary-foreground" },
      in_progress: { label: t('workshop.complete'), icon: CheckCircle, color: "bg-success text-success-foreground" },
      completed: { label: t('workshop.deliver'), icon: Truck, color: "bg-muted text-foreground" },
    };
    return map[status] || null;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-card border-b border-border px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-lg font-bold leading-tight">{t('nav.workshop')}</h1>
              <p className="text-[11px] text-muted-foreground leading-tight">Execução na bancada · timer, checklist, fotos</p>
            </div>
          </div>
          <div className="flex gap-1">
            {filterTabs.map(ft => (
              <button
                key={ft.key}
                onClick={() => setFilter(ft.key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  filter === ft.key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
                }`}
              >
                {ft.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Quer emitir faturas, imprimir OS ou exportar CSV?{" "}
          <a href="/services" className="text-primary hover:underline font-medium">Abrir Serviços (gestão) →</a>
        </p>
      </div>

      {/* Work orders grid - tablet optimized */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {loading && workOrders.length === 0 ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border-2 border-border rounded-2xl p-4 space-y-3 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-8 w-24 bg-muted rounded-lg" />
                  <div className="h-6 w-20 bg-muted rounded-full" />
                </div>
                <div className="h-4 w-3/4 bg-muted rounded" />
                <div className="h-3 w-1/2 bg-muted rounded" />
                <div className="h-9 w-full bg-muted rounded-lg" />
              </div>
            ))}
          </>
        ) : !loading && workOrders.length === 0 ? (
          <div className="col-span-full text-center py-20 text-muted-foreground">
            {t('workshop.noOrders')}
          </div>
        ) : workOrders.map(wo => {
          const cfg = statusConfig[wo.status] || statusConfig.open;
          const Icon = cfg.icon;
          const nextAction = getNextAction(wo.status);
          return (
            <div key={wo.id} className={`bg-card border-2 rounded-2xl p-4 space-y-3 transition-all hover:shadow-lg ${
              wo.status === 'in_progress' ? 'border-primary shadow-md' : 'border-border'
            }`}>
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${cfg.bg} flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                  </div>
                  <div>
                    <span className="font-bold text-sm font-mono">{wo.number}</span>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(wo.created_at), 'dd/MM HH:mm')}</p>
                  </div>
                </div>
                <Badge variant="secondary" className={`${cfg.bg} ${cfg.color}`}>
                  {cfg.label}
                </Badge>
              </div>

              {/* Vehicle + Client */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  <Car className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="font-medium">{(wo.vehicles as any)?.make} {(wo.vehicles as any)?.model}</span>
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-xs font-semibold">{(wo.vehicles as any)?.plate}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4 shrink-0" />
                  <span>{(wo.clients as any)?.name}</span>
                  {(wo.clients as any)?.phone && <span className="text-xs">📞 {(wo.clients as any).phone}</span>}
                </div>
              </div>

              {/* Quick info */}
              <div className="flex gap-3 text-xs text-muted-foreground">
                {wo.technician && <span className="flex items-center gap-1">🔧 {wo.technician}</span>}
                {wo.entry_mileage > 0 && <span>{wo.entry_mileage.toLocaleString()} km</span>}
                {wo.labor_hours > 0 && <span className="flex items-center gap-1"><Timer className="w-3 h-3" />{wo.labor_hours}h</span>}
              </div>

              {/* Client description */}
              {wo.client_description && (
                <p className="text-xs bg-muted rounded-lg p-2 line-clamp-2">
                  <MessageSquare className="w-3 h-3 inline mr-1" />{wo.client_description}
                </p>
              )}

              {/* Visual Timeline */}
              <WorkshopTimeline
                currentStatus={wo.status}
                createdAt={wo.created_at}
                completedAt={wo.completed_at}
                deliveredAt={wo.delivered_at}
              />

              {/* Actions */}
              <div className="flex gap-2">
                {nextAction && (
                  <Button
                    size="sm"
                    className={`flex-1 ${nextAction.color}`}
                    onClick={() => advanceStatus(wo)}
                    disabled={actionLoading}
                  >
                    <nextAction.icon className="w-4 h-4 mr-1" />
                    {nextAction.label}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelected(wo); loadChecklist(wo.id); }}
                >
                  <ClipboardCheck className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(wo)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail / Checklist Dialog */}
      <Dialog open={!!selected} onOpenChange={() => { setSelected(null); setChecklistItems([]); setChecklist(null); setDiagnosisText(''); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{selected?.number}</span>
              {selected && (
                <Badge variant="secondary" className={`${statusConfig[selected.status]?.bg} ${statusConfig[selected.status]?.color}`}>
                  {statusConfig[selected.status]?.label}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          
          {selected && (
            <div className="space-y-4">
              {/* Vehicle + Client info */}
              <div className="bg-muted rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Car className="w-4 h-4 text-primary" />
                  {(selected.vehicles as any)?.make} {(selected.vehicles as any)?.model} — {(selected.vehicles as any)?.plate}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-4 h-4" />
                  {(selected.clients as any)?.name}
                  {(selected.clients as any)?.phone && <span>📞 {(selected.clients as any).phone}</span>}
                </div>
              </div>

              {/* Diagnosis input for 'open' status */}
              {selected.status === 'open' && (
                <div className="space-y-2">
                  <Label>{t('workshop.diagnosis')}</Label>
                  <Textarea
                    value={diagnosisText}
                    onChange={e => setDiagnosisText(e.target.value)}
                    placeholder={t('workshop.diagnosisPlaceholder')}
                    rows={3}
                  />
                </div>
              )}

              {/* AI Diagnosis Panel (lazy) */}
              {(selected.status === 'open' || selected.status === 'diagnosis') && activeShopId && (
                <Suspense fallback={<div className="h-20 bg-muted/40 rounded-xl animate-pulse" />}>
                  <AIDiagnosisPanel
                    vehicle={selected.vehicles ? {
                      make: (selected.vehicles as any).make,
                      model: (selected.vehicles as any).model,
                      year: (selected.vehicles as any).year || 2024,
                      fuel: (selected.vehicles as any).fuel || 'Gasolina',
                      mileage: selected.entry_mileage || 0,
                    } : undefined}
                    clientDescription={selected.client_description || ''}
                    shopId={activeShopId}
                    onApplyDiagnosis={(text) => setDiagnosisText(prev => prev ? `${prev}\n\n${text}` : text)}
                  />
                </Suspense>
              )}

              {/* Existing diagnosis */}
              {selected.diagnosis && selected.status !== 'open' && (
                <div>
                  <Label className="text-xs text-muted-foreground">{t('workshop.diagnosis')}</Label>
                  <p className="text-sm bg-muted rounded-lg p-3 mt-1">{selected.diagnosis}</p>
                </div>
              )}

              {/* Labor Timer */}
              {activeShopId && selected.status !== 'delivered' && (
                <Suspense fallback={<div className="h-16 bg-muted/40 rounded-xl animate-pulse" />}>
                  <LaborTimer
                    workOrderId={selected.id}
                    shopId={activeShopId}
                    technicianName={selected.technician || ''}
                  />
                </Suspense>
              )}

              {/* Checklist */}
              {checklistItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="flex items-center gap-1">
                      <ClipboardCheck className="w-4 h-4" />
                      {t('workshop.inspectionChecklist')}
                    </Label>
                    <span className="text-xs text-muted-foreground">
                      {checklistItems.filter(i => i.status === 'pass').length}/{checklistItems.length} OK
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    {checklistItems.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-muted/50 rounded-lg p-2.5">
                        <span className="text-sm">{item.label}</span>
                        <div className="flex gap-1">
                          <button
                            onClick={() => toggleChecklistItem(idx, item.status === 'pass' ? 'pending' : 'pass')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              item.status === 'pass' ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground hover:bg-success/20'
                            }`}
                          >
                            OK
                          </button>
                          <button
                            onClick={() => toggleChecklistItem(idx, item.status === 'fail' ? 'pending' : 'fail')}
                            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                              item.status === 'fail' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-destructive/20'
                            }`}
                          >
                            NOK
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full mt-2"
                    onClick={() => saveChecklist(selected.id)}
                    disabled={actionLoading}
                  >
                    {t('workshop.saveChecklist')}
                  </Button>
                </div>
              )}

              {/* Action button */}
              {getNextAction(selected.status) && (
                <Button
                  className={`w-full ${getNextAction(selected.status)!.color}`}
                  onClick={() => advanceStatus(selected)}
                  disabled={actionLoading}
                >
                  {(() => { const na = getNextAction(selected.status)!; return <><na.icon className="w-4 h-4 mr-2" />{na.label}</>; })()}
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
