import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Car, Wrench, ClipboardCheck, FileText, Receipt, AlertTriangle, TrendingDown, Shield, Image as ImageIcon, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { pt, ptBR, enUS, es, hi } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";
import { formatMoney } from "@/lib/money";
import { autoFormatPlate, detectRegionFromCurrency, canonicalPlate } from "@/lib/plateFormat";
import { getLocaleForCurrency } from "@/lib/regionLabels";

interface VehiclePassportProps {
  vehicleId: string;
  open: boolean;
  onClose: () => void;
}

interface HistoryEvent {
  id: string;
  event_type: string;
  event_date: string;
  mileage: number | null;
  title: string;
  description: string | null;
  parts_replaced: any[];
  reference_type: string | null;
  created_at: string;
}

const eventIcons: Record<string, any> = {
  service: Wrench,
  inspection: ClipboardCheck,
  quote: FileText,
  invoice: Receipt,
  mileage_update: Car,
  part_replacement: Shield,
};

const eventColors: Record<string, string> = {
  service: "bg-primary/10 text-primary",
  inspection: "bg-warning/10 text-warning",
  quote: "bg-info/10 text-info",
  invoice: "bg-success/10 text-success",
  mileage_update: "bg-muted text-muted-foreground",
  part_replacement: "bg-accent text-accent-foreground",
};

/** Deteta se um anexo existente é uma fotografia (sem criar novo sistema de ficheiros). */
function isImageAttachment(a: any): boolean {
  const type = String(a?.file_type || "").toLowerCase();
  if (type.startsWith("image/")) return true;
  const url = String(a?.file_url || a?.file_name || "").toLowerCase();
  return /\.(png|jpe?g|webp|gif|heic|avif)(\?|$)/.test(url);
}

export default function VehiclePassport({ vehicleId, open, onClose }: VehiclePassportProps) {
  const { t, language } = useLanguage();
  const locale = language === "pt" ? pt
    : language === "pt-BR" ? ptBR
    : language === "es" ? es
    : language === "hi" ? hi
    : enUS;
  const [vehicle, setVehicle] = useState<any>(null);
  const [shopMeta, setShopMeta] = useState<{ currency?: string; country?: string } | null>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [quotesByWo, setQuotesByWo] = useState<Record<string, { id: string; number: string }>>({});
  const [attachments, setAttachments] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [timesByWo, setTimesByWo] = useState<Record<string, number>>({});
  const [kmFraudWarning, setKmFraudWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !vehicleId) return;
    const load = async () => {
      setLoading(true);
      const [vRes, hRes, woRes, remRes, warRes] = await Promise.all([
        supabase.from("vehicles").select("*, clients(name, nif)").eq("id", vehicleId).maybeSingle(),
        supabase.from("vehicle_global_history").select("*").eq("vehicle_id", vehicleId).order("event_date", { ascending: false }).limit(200),
        supabase.from("work_orders").select("id, number, status, total, created_at, completed_at, entry_mileage, technician, diagnosis, client_description, notes, lines, quote_id").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }).limit(50),
        supabase.from("service_reminders").select("id, service_type, next_service_date, next_service_km, status").eq("vehicle_id", vehicleId).eq("status", "pending").order("next_service_date", { ascending: true }).limit(10),
        // Garantias — relação direta existente (warranties.vehicle_id). Sem tabela nova.
        supabase.from("warranties").select("id, type, description, start_date, end_date, status, work_order_id").eq("vehicle_id", vehicleId).order("start_date", { ascending: false }).limit(20),
      ]);

      setVehicle(vRes.data);
      setHistory((hRes.data || []) as HistoryEvent[]);
      setWorkOrders(woRes.data || []);
      setReminders(remRes.data || []);
      setWarranties(warRes.data || []);

      // País/moeda da oficina — reutiliza os campos existentes em `shops`.
      const shopId = (vRes.data as any)?.shop_id;
      if (shopId) {
        const { data: s } = await supabase.from("shops").select("currency, country").eq("id", shopId).maybeSingle();
        if (s) setShopMeta({ currency: (s as any).currency, country: (s as any).country });
      }

      // Fotos/documentos das intervenções — reutiliza work_order_attachments (RLS por shop_id).
      const woIds = (woRes.data || []).map((w: any) => w.id);
      if (woIds.length > 0) {
        const { data: att } = await supabase
          .from("work_order_attachments")
          .select("id, work_order_id, file_url, file_name, file_type, context, created_at")
          .in("work_order_id", woIds)
          .order("created_at", { ascending: false })
          .limit(200);
        setAttachments(att || []);

        // Mão de obra real registada — work_order_times (query única agrupada, sem N+1).
        const { data: times } = await supabase
          .from("work_order_times")
          .select("work_order_id, duration_seconds")
          .in("work_order_id", woIds)
          .limit(500);
        const tMap: Record<string, number> = {};
        (times || []).forEach((tr: any) => {
          const s = Number(tr.duration_seconds || 0);
          if (s > 0) tMap[tr.work_order_id] = (tMap[tr.work_order_id] || 0) + s;
        });
        setTimesByWo(tMap);

        // Orçamentos relacionados — apenas relações reais (work_orders.quote_id).
        const quoteIds = Array.from(new Set((woRes.data || []).map((w: any) => w.quote_id).filter(Boolean)));
        if (quoteIds.length > 0) {
          const { data: qs } = await supabase.from("quotes").select("id, number").in("id", quoteIds as string[]);
          const map: Record<string, { id: string; number: string }> = {};
          (woRes.data || []).forEach((w: any) => {
            const q = (qs || []).find((x: any) => x.id === w.quote_id);
            if (q) map[w.id] = { id: q.id, number: q.number };
          });
          setQuotesByWo(map);
        } else {
          setQuotesByWo({});
        }
      } else {
        setAttachments([]);
        setQuotesByWo({});
        setTimesByWo({});
      }

      // Faturas — relação existente invoices.vehicle_id OU invoices.work_order_id.
      const invQueries: any[] = [
        supabase.from("invoices").select("id, number, status, total, currency, due_date, created_at, work_order_id").eq("vehicle_id", vehicleId).limit(100),
      ];
      if (woIds.length > 0) {
        invQueries.push(
          supabase.from("invoices").select("id, number, status, total, currency, due_date, created_at, work_order_id").in("work_order_id", woIds).limit(100)
        );
      }
      const invResults = await Promise.all(invQueries);
      const invMap = new Map<string, any>();
      invResults.forEach((r: any) => (r.data || []).forEach((inv: any) => invMap.set(inv.id, inv)));
      setInvoices(
        Array.from(invMap.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      );

      detectKmFraud(woRes.data || []);
      setLoading(false);
    };
    load();
  }, [open, vehicleId]);

  // ─── Formatação regional (PT / BR / ES / …) — reutiliza a lógica global ───
  const numberLocale = getLocaleForCurrency(shopMeta?.currency);
  const plateRegion = detectRegionFromCurrency(shopMeta?.currency, shopMeta?.country);
  const fmtKm = (km?: number | null) => {
    if (km === null || km === undefined || !isFinite(Number(km))) return null;
    try {
      // Alguns locales (pt-PT) usam espaço como separador de milhares; a
      // convenção esperada nas oficinas PT/BR/ES é o ponto (260.000 km).
      const n = new Intl.NumberFormat(numberLocale).format(Number(km)).replace(/[\s\u00A0\u202F]/g, ".");
      return `${n} km`;
    } catch { return `${Number(km).toLocaleString()} km`; }
  };
  const fmtMoney = (v: any, currency?: string | null) => formatMoney(Number(v || 0), currency || shopMeta?.currency || undefined, numberLocale);
  const fmtDate = (d?: string | null) => (d ? format(new Date(d), "dd/MM/yyyy", { locale }) : null);
  const statusLabel = (s?: string | null) =>
    s ? t(`passport.status.${s}`, t(`status.${s}`, s)) : "—";
  const invoiceStatus = (inv: any) => {
    const isOverdue = inv?.status === "issued" && inv?.due_date && new Date(inv.due_date) < new Date();
    return isOverdue ? t("passport.status.overdue", "Vencida") : statusLabel(inv?.status);
  };
  const taxLabel = (() => {
    const c = (shopMeta?.country || "").toUpperCase();
    if (c === "BR") return "CPF/CNPJ";
    if (c === "ES") return "NIF/CIF";
    return "NIF";
  })();
  const displayPlate = vehicle?.plate ? autoFormatPlate(canonicalPlate(vehicle.plate), plateRegion) || vehicle.plate : null;
  const notRegistered = t("passport.notRegistered", "Não registado");
  /** Duração real (work_order_times) — 2h30 / 45min. Nunca estimada. */
  const fmtDuration = (seconds?: number | null) => {
    const s = Number(seconds || 0);
    if (!s || s <= 0) return null;
    const mins = Math.round(s / 60);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h > 0) return m > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
    return `${m}min`;
  };
  /** Tipo de manutenção programada — label humano, sem concatenações técnicas. */
  const reminderTypeLabel = (type?: string | null) =>
    type ? t(`passport.reminderType.${type}`, t(`serviceType.${type}`, type)) : t("passport.nextService", "Próxima manutenção");

  const detectKmFraud = (orders: any[]) => {
    const mileages = orders
      .filter(wo => wo.entry_mileage > 0)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map(wo => ({ km: wo.entry_mileage, date: wo.created_at }));

    for (let i = 1; i < mileages.length; i++) {
      if (mileages[i].km < mileages[i - 1].km) {
        const diff = mileages[i - 1].km - mileages[i].km;
        if (diff > 500) {
          const prev = mileages[i - 1];
          const curr = mileages[i];
          setKmFraudWarning(
            `⚠️ ${t("passport.fraudMsg", "Possível fraude de quilometragem detetada!")} ${format(new Date(prev.date), "dd/MM/yyyy", { locale })}: ${prev.km.toLocaleString()} km → ${format(new Date(curr.date), "dd/MM/yyyy", { locale })}: ${curr.km.toLocaleString()} km (${t("passport.fraudDecrease", "redução")} ${diff.toLocaleString()} km)`
          );
          return;
        }
      }
    }
    setKmFraudWarning(null);
  };

  const photos = attachments.filter(isImageAttachment);
  const documents = attachments.filter(a => !isImageAttachment(a));
  const photosByWo = photos.reduce<Record<string, any[]>>((acc, p) => {
    (acc[p.work_order_id] ||= []).push(p);
    return acc;
  }, {});
  const invoicesByWo = invoices.reduce<Record<string, any[]>>((acc, inv) => {
    if (inv.work_order_id) (acc[inv.work_order_id] ||= []).push(inv);
    return acc;
  }, {});

  // Eventos do histórico global que NÃO são ordens de serviço (evita duplicação).
  const otherEvents = history.filter(h => h.event_type !== "service");

  /** Peças reais de uma OS — apenas linhas com type === 'part'. */
  const partLines = (wo: any) =>
    (Array.isArray(wo?.lines) ? wo.lines : []).filter((l: any) => l?.type === "part" && String(l?.name || "").trim());

  // Peças utilizadas — agregadas a partir das linhas reais das OS (type = 'part').
  const usedParts = (() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    workOrders.forEach((wo: any) => {
      partLines(wo).forEach((l: any) => {
        const name = String(l.name).trim();
        const qty = Number(l.quantity || 0);
        const total = qty * Number(l.unit_price || 0);
        const prev = map.get(name) || { name, qty: 0, total: 0 };
        map.set(name, { name, qty: prev.qty + qty, total: prev.total + total });
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 30);
  })();

  const mileagePoints = workOrders
    .filter(wo => wo.entry_mileage > 0)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .map(wo => ({ date: wo.created_at, km: wo.entry_mileage }));

  // Separação por estado real — nunca contar orçamento/pendente como intervenção concluída.
  const DONE = new Set(["completed", "delivered"]);
  const WAITING = new Set(["waiting_approval"]);
  const CANCELLED = new Set(["cancelled", "canceled"]);
  const doneOrders = workOrders.filter((w: any) => DONE.has(w.status));
  const waitingOrders = workOrders.filter((w: any) => WAITING.has(w.status));
  const cancelledOrders = workOrders.filter((w: any) => CANCELLED.has(w.status));
  const ongoingOrders = workOrders.filter(
    (w: any) => !DONE.has(w.status) && !WAITING.has(w.status) && !CANCELLED.has(w.status)
  );

  const countLabel = (n: number) =>
    n === 1
      ? t("passport.interventions_one", "1 intervenção")
      : t("passport.interventions_other", "{n} intervenções").replace("{n}", String(n));
  const interventionsLabel = countLabel(doneOrders.length);

  // Manutenções programadas: mostrar cada tipo de manutenção apenas uma vez
  // (a mais próxima). Nenhum registo é alterado ou apagado na base de dados —
  // apenas a apresentação é desduplicada. Se existirem registos extra, é
  // sinalizado ao utilizador.
  const uniqueReminders = (() => {
    const byType = new Map<string, any>();
    [...reminders]
      .sort((a: any, b: any) =>
        String(a.next_service_date || "").localeCompare(String(b.next_service_date || ""))
      )
      .forEach((r: any) => {
        const k = String(r.service_type || "").toLowerCase().trim();
        if (!byType.has(k)) byType.set(k, r);
      });
    return Array.from(byType.values());
  })();
  const duplicateReminders = uniqueReminders.length < reminders.length;



  const SectionTitle = ({ icon: Icon, children }: { icon?: any; children: React.ReactNode }) => (
    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
      {Icon && <Icon className="w-3.5 h-3.5" />}
      {children}
    </h4>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="w-5 h-5 text-primary" />
            {t("passport.title", "Passaporte do Veículo")}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : vehicle ? (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-5 pb-4">
              {/* ─── Identificação ─── */}
              <div className="bg-muted rounded-xl p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-lg font-bold break-words">
                      {vehicle.make} {[vehicle.model, (vehicle as any).version].filter(Boolean).join(" ")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {[vehicle.year, vehicle.fuel].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {displayPlate && (
                    <div className="text-right">
                      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{t("passport.plate", "Matrícula")}</span>
                      <Badge variant="secondary" className="font-mono text-base px-3 py-1 whitespace-nowrap">{displayPlate}</Badge>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm pt-1 border-t border-border/60">
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground block">{t("passport.mileage", "Quilometragem")}</span>
                    <p className="font-semibold break-words">{fmtKm(vehicle.mileage) || notRegistered}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground block">{t("passport.vin", "VIN")}</span>
                    <p className={vehicle.vin ? "font-mono text-xs break-all" : "text-xs text-muted-foreground"}>{vehicle.vin || notRegistered}</p>
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground block">{t("passport.owner", "Proprietário")}</span>
                    <p className="font-medium break-words">{(vehicle.clients as any)?.name || notRegistered}</p>
                    {(vehicle.clients as any)?.nif && (
                      <p className="text-[10px] text-muted-foreground">{taxLabel}: {(vehicle.clients as any).nif}</p>
                    )}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs text-muted-foreground block">{t("passport.services", "Serviços")}</span>
                    <p className="font-semibold">{interventionsLabel}</p>
                    {workOrders.length !== doneOrders.length && (
                      <p className="text-[10px] text-muted-foreground">
                        {t("passport.totalOrders", "{n} registos no total").replace("{n}", String(workOrders.length))}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {kmFraudWarning && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-destructive">{t("passport.antiFraud", "Alerta anti-fraude")}</p>
                    <p className="text-xs text-destructive/80 mt-0.5 break-words">{kmFraudWarning}</p>
                  </div>
                </div>
              )}

              {mileagePoints.length > 1 && (
                <div>
                  <SectionTitle icon={TrendingDown}>{t("passport.mileageHistory", "Evolução da quilometragem")}</SectionTitle>
                  <div className="flex items-end gap-1 h-16">
                    {mileagePoints.map((p, i) => {
                      const max = Math.max(...mileagePoints.map(mp => mp.km));
                      const heightPct = max > 0 ? (p.km / max) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${format(new Date(p.date), "dd/MM/yy", { locale })}: ${fmtKm(p.km)}`}>
                          <div className="w-full bg-primary/60 rounded-t" style={{ height: `${heightPct}%`, minHeight: 2 }} />
                          <span className="text-[8px] text-muted-foreground">{format(new Date(p.date), "MM/yy", { locale })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Próxima manutenção — apenas registos reais (service_reminders). */}
              {uniqueReminders.length > 0 && (
                <div>
                  <SectionTitle>{t("passport.nextService", "Próxima manutenção")}</SectionTitle>
                  {duplicateReminders && (
                    <p className="text-[11px] text-warning mb-1.5 flex items-start gap-1">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-[1px]" />
                      {t("passport.duplicateReminders", "Existem registos repetidos da mesma manutenção. É apresentada apenas a mais próxima de cada tipo.")}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {uniqueReminders.map((r: any) => (
                      <li key={r.id} className="bg-muted/50 rounded-lg px-3 py-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{t("passport.reminderTypeLabel", "Tipo")}</span>
                          <span className="font-medium break-words">{reminderTypeLabel(r.service_type)}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{t("passport.date", "Data")}</span>
                          <span className="font-medium">{fmtDate(r.next_service_date) || notRegistered}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{t("passport.mileage", "Quilometragem")}</span>
                          <span className="font-medium">{fmtKm(r.next_service_km) || notRegistered}</span>
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground block">{t("passport.state", "Estado")}</span>
                          <Badge variant="outline" className="text-[10px]">{statusLabel(r.status)}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ─── Fotografias (work_order_attachments — único sistema existente) ─── */}
              <div>
                <SectionTitle icon={ImageIcon}>{t("passport.photos", "Fotografias")}</SectionTitle>
                {photos.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("passport.noPhotos", "Sem fotografias registadas.")}</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {photos.slice(0, 20).map((p: any) => {
                      const wo = workOrders.find((w: any) => w.id === p.work_order_id);
                      const ctx = p.context ? t(`passport.photoContext.${p.context}`, p.context) : null;
                      return (
                        <a key={p.id} href={p.file_url} target="_blank" rel="noopener noreferrer" title={t("passport.openPhoto", "Abrir fotografia")} className="block">
                          <img
                            src={p.file_url}
                            alt={ctx || p.file_name || t("passport.photos", "Fotografias")}
                            loading="lazy"
                            className="w-full aspect-square object-cover rounded-lg border border-border hover:opacity-90 transition-opacity"
                          />
                          <span className="block text-[9px] text-muted-foreground truncate mt-0.5">
                            {[ctx, fmtDate(p.created_at), wo?.number].filter(Boolean).join(" · ")}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ─── Intervenções (agrupadas pelo estado real da OS) ─── */}
              {workOrders.length === 0 ? (
                <div>
                  <SectionTitle icon={Wrench}>{t("passport.history", "Histórico de intervenções")}</SectionTitle>
                  <p className="text-sm text-muted-foreground">{t("passport.noInterventions", "Sem intervenções registadas.")}</p>
                </div>
              ) : (
                <>
                  {([
                    { key: "history", icon: Wrench, title: t("passport.history", "Histórico de intervenções"), list: doneOrders },
                    { key: "ongoing", icon: Wrench, title: t("passport.ongoing", "Em curso"), list: ongoingOrders },
                    { key: "waiting", icon: FileText, title: t("passport.status.waiting_approval", "Aguarda aprovação"), list: waitingOrders },
                    { key: "cancelled", icon: FileText, title: t("passport.cancelledOrders", "Cancelados"), list: cancelledOrders },
                  ] as const).filter(g => g.list.length > 0).map(group => (
                    <div key={group.key}>
                      <SectionTitle icon={group.icon}>
                        {group.title} · {countLabel(group.list.length)}
                      </SectionTitle>
                      <div className="space-y-2">
                        {group.list.map((wo: any) => {
                          const woPhotos = photosByWo[wo.id] || [];
                          const woInvoices = invoicesByWo[wo.id] || [];
                          const quote = quotesByWo[wo.id];
                          const desc = wo.diagnosis || wo.client_description || null;
                          const parts = partLines(wo);
                          const labour = fmtDuration(timesByWo[wo.id]);
                          return (
                            <div key={wo.id} className="rounded-xl border border-border bg-card p-3 space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="flex items-center gap-2 min-w-0">
                                  <span className="font-mono text-sm font-semibold">{wo.number}</span>
                                  <Badge variant="outline" className="text-[10px] shrink-0">{statusLabel(wo.status)}</Badge>
                                </span>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {fmtDate(wo.completed_at || wo.created_at)}
                                  {" · "}
                                  {fmtKm(wo.entry_mileage > 0 ? wo.entry_mileage : null) || t("passport.mileageNotRegistered", "Quilometragem não registada")}
                                </span>
                              </div>

                              {desc && <p className="text-xs text-muted-foreground whitespace-pre-line break-words">{desc}</p>}

                              {wo.notes && String(wo.notes).trim() && (
                                <div className="border-l-2 border-primary/40 pl-2">
                                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("passport.mechanicNote", "Nota do mecânico")}</p>
                                  <p className="text-xs whitespace-pre-line break-words">{String(wo.notes).trim()}</p>
                                </div>
                              )}

                              {parts.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("passport.usedParts", "Peças utilizadas")}</p>
                                  <ul className="text-xs space-y-0.5">
                                    {parts.map((l: any, i: number) => (
                                      <li key={l.id || i} className="flex flex-wrap justify-between gap-2">
                                        <span className="break-words">• {String(l.name).trim()} ×{Number(l.quantity || 0)}</span>
                                        {Number(l.unit_price) > 0 && (
                                          <span className="tabular-nums text-muted-foreground">
                                            {fmtMoney(Number(l.quantity || 0) * Number(l.unit_price || 0))}
                                          </span>
                                        )}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                                {wo.technician && (
                                  <span><span className="text-muted-foreground">{t("passport.technician", "Técnico")}: </span>{wo.technician}</span>
                                )}
                                {labour && (
                                  <span><span className="text-muted-foreground">{t("passport.labour", "Mão de obra")}: </span>{labour}</span>
                                )}
                                {quote && (
                                  <span><span className="text-muted-foreground">{t("passport.quote", "Orçamento")}: </span><span className="font-mono">{quote.number}</span></span>
                                )}
                                {woInvoices.map((inv: any) => (
                                  <a key={inv.id} href={`/invoices/${inv.id}`} className="text-primary hover:underline">
                                    <span className="text-muted-foreground">{t("passport.invoice", "Fatura")}: </span>
                                    <span className="font-mono">{inv.number || "—"}</span>
                                  </a>
                                ))}
                                {Number(wo.total) > 0 && (
                                  <span className="font-semibold tabular-nums">{t("passport.total", "Total")}: {fmtMoney(wo.total)}</span>
                                )}
                                <a href={`/services?id=${wo.id}`} className="text-primary hover:underline">
                                  {t("passport.openOrder", "Abrir OS")}
                                </a>
                              </div>

                              {woPhotos.length > 0 && (
                                <div>
                                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t("passport.interventionPhotos", "Fotografias da intervenção")}</p>
                                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                                    {woPhotos.map((p: any) => (
                                      <a key={p.id} href={p.file_url} target="_blank" rel="noopener noreferrer" title={t("passport.openPhoto", "Abrir fotografia")}>
                                        <img src={p.file_url} alt={p.context || p.file_name || wo.number} loading="lazy" className="w-full aspect-square object-cover rounded-md border border-border" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ─── Outros eventos do histórico global (inspeções, etc.) ─── */}
              {otherEvents.length > 0 && (
                <div>
                  <SectionTitle icon={ClipboardCheck}>{t("passport.otherEvents", "Outros registos")}</SectionTitle>
                  <div className="space-y-2">
                    {otherEvents.map(event => {
                      const Icon = eventIcons[event.event_type] || Wrench;
                      const color = eventColors[event.event_type] || "bg-muted text-muted-foreground";
                      return (
                        <div key={event.id} className="flex gap-3 items-start">
                          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0 mt-0.5`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium break-words">{event.title}</p>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{fmtDate(event.event_date)}</span>
                            </div>
                            {event.description && <p className="text-xs text-muted-foreground break-words">{event.description}</p>}
                            <div className="flex gap-2 mt-0.5">
                              {event.mileage && event.mileage > 0 && <span className="text-[10px] text-muted-foreground">{fmtKm(event.mileage)}</span>}
                              {event.parts_replaced?.length > 0 && <span className="text-[10px] text-muted-foreground">🔧 {event.parts_replaced.length} {t("passport.parts", "peças")}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ─── Faturas ─── */}
              {invoices.length > 0 && (
                <div>
                  <SectionTitle icon={Receipt}>{t("passport.invoices", "Faturas")}</SectionTitle>
                  <ul className="space-y-1.5">
                    {invoices.map((inv: any) => (
                      <li key={inv.id}>
                        <a
                          href={`/invoices/${inv.id}`}
                          className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs">{inv.number || "—"}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{invoiceStatus(inv)}</Badge>
                          </span>
                          <span className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground">{fmtDate(inv.created_at)}</span>
                            <span className="font-semibold tabular-nums">{fmtMoney(inv.total, inv.currency)}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ─── Garantias ─── */}
              {warranties.length > 0 && (
                <div>
                  <SectionTitle icon={Shield}>{t("passport.warranties", "Garantias")}</SectionTitle>
                  <ul className="space-y-1.5">
                    {warranties.map((w: any) => (
                      <li key={w.id} className="bg-muted/50 rounded-lg px-3 py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                        <span className="break-words min-w-0">{w.description || w.type || t("passport.warranty", "Garantia")}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {fmtDate(w.start_date) || ""}
                            {w.end_date ? ` → ${fmtDate(w.end_date)}` : ""}
                          </span>
                          <Badge variant={w.status === "active" ? "default" : "outline"} className="text-[10px]">
                            {statusLabel(w.status)}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ─── Peças utilizadas ─── */}
              {usedParts.length > 0 && (
                <div>
                  <SectionTitle>{t("passport.usedParts", "Peças utilizadas")}</SectionTitle>
                  <ul className="space-y-1.5">
                    {usedParts.map((p) => (
                      <li key={p.name} className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                        <span className="break-words min-w-0">{p.name}</span>
                        <span className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          <span>{t("passport.qty", "Qtd.")} {p.qty}</span>
                          <span className="font-semibold text-foreground tabular-nums">{fmtMoney(p.total)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* ─── Documentos (anexos não-imagem já existentes) ─── */}
              {documents.length > 0 && (
                <div>
                  <SectionTitle icon={Paperclip}>{t("passport.documents", "Documentos")}</SectionTitle>
                  <ul className="space-y-1.5">
                    {documents.map((d: any) => (
                      <li key={d.id}>
                        <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 text-sm">
                          <span className="truncate">{d.file_name || d.context || t("passport.documents", "Documentos")}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{fmtDate(d.created_at)}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </ScrollArea>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-8">{t("passport.loadError", "Não foi possível carregar o passaporte deste veículo.")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
