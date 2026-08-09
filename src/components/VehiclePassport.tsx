import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Car, Wrench, ClipboardCheck, FileText, Receipt, AlertTriangle, TrendingDown, Shield } from "lucide-react";
import { format } from "date-fns";
import { pt, ptBR, enUS, es, hi } from "date-fns/locale";
import { useLanguage } from "@/i18n/LanguageContext";

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

export default function VehiclePassport({ vehicleId, open, onClose }: VehiclePassportProps) {
  const { t, language } = useLanguage();
  const locale = language === "pt" ? pt
    : language === "pt-BR" ? ptBR
    : language === "es" ? es
    : language === "hi" ? hi
    : enUS;
  const [vehicle, setVehicle] = useState<any>(null);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [photos, setPhotos] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [warranties, setWarranties] = useState<any[]>([]);
  const [kmFraudWarning, setKmFraudWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !vehicleId) return;
    const load = async () => {
      setLoading(true);
      const [vRes, hRes, woRes, remRes, warRes] = await Promise.all([
        supabase.from("vehicles").select("*, clients(name)").eq("id", vehicleId).maybeSingle(),
        supabase.from("vehicle_global_history").select("*").eq("vehicle_id", vehicleId).order("event_date", { ascending: false }).limit(200),
        supabase.from("work_orders").select("id, number, status, total, created_at, completed_at, entry_mileage, technician, diagnosis, notes, lines").eq("vehicle_id", vehicleId).order("created_at", { ascending: false }).limit(50),
        supabase.from("service_reminders").select("id, service_type, next_service_date, next_service_km, status").eq("vehicle_id", vehicleId).eq("status", "pending").order("next_service_date", { ascending: true }).limit(10),
        // Garantias — relação direta existente (warranties.vehicle_id). Sem tabela nova.
        supabase.from("warranties").select("id, type, description, start_date, end_date, status, work_order_id").eq("vehicle_id", vehicleId).order("start_date", { ascending: false }).limit(20),
      ]);

      setVehicle(vRes.data);
      setHistory((hRes.data || []) as HistoryEvent[]);
      setWorkOrders(woRes.data || []);
      setReminders(remRes.data || []);
      setWarranties(warRes.data || []);

      // Fotos das intervenções — reutiliza work_order_attachments (RLS por shop_id).
      const woIds = (woRes.data || []).map((w: any) => w.id);
      if (woIds.length > 0) {
        const { data: att } = await supabase
          .from("work_order_attachments")
          .select("id, file_url, file_name, context, created_at")
          .in("work_order_id", woIds)
          .order("created_at", { ascending: false })
          .limit(24);
        setPhotos(att || []);
      } else {
        setPhotos([]);
      }

      // Faturas — relação existente invoices.vehicle_id OU invoices.work_order_id.
      // Deduplicadas por id para nunca listar a mesma fatura duas vezes.
      const invQueries: any[] = [
        supabase.from("invoices").select("id, number, status, total, created_at, work_order_id").eq("vehicle_id", vehicleId).limit(100),
      ];
      if (woIds.length > 0) {
        invQueries.push(
          supabase.from("invoices").select("id, number, status, total, created_at, work_order_id").in("work_order_id", woIds).limit(100)
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

  const timeline = [
    ...history.map(h => ({
      id: h.id,
      type: h.event_type,
      date: h.event_date,
      title: h.title,
      description: h.description,
      mileage: h.mileage,
      parts: h.parts_replaced,
      note: null as string | null,
    })),
    ...workOrders.map(wo => {
      const label = t(`wo.status.${wo.status}`, wo.status);
      return {
        id: wo.id,
        type: "service",
        date: wo.created_at,
        title: `${wo.number} — ${label}`,
        description: wo.diagnosis || null,
        mileage: wo.entry_mileage || null,
        parts: [],
        // Nota do mecânico — texto existente em work_orders.notes (sem duplicação).
        note: (wo.notes && String(wo.notes).trim()) || null,
      };
    }),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const seen = new Set();
  const uniqueTimeline = timeline.filter(t => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  // Peças utilizadas — agregadas a partir das linhas existentes das OS (work_orders.lines).
  // Apenas apresentação: não altera cálculos financeiros.
  const usedParts = (() => {
    const map = new Map<string, { name: string; qty: number; total: number }>();
    workOrders.forEach((wo: any) => {
      const lines = Array.isArray(wo.lines) ? wo.lines : [];
      lines.forEach((l: any) => {
        if (l?.type && l.type !== "part") return;
        const name = (l?.name || "").trim();
        if (!name) return;
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
            <div className="space-y-4 pb-4">
              <div className="bg-muted rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold">{vehicle.make} {vehicle.model}</h3>
                    <p className="text-sm text-muted-foreground">{vehicle.year} · {vehicle.fuel}</p>
                  </div>
                  <Badge variant="secondary" className="font-mono text-base px-3 py-1">{vehicle.plate}</Badge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div><span className="text-muted-foreground">{t("passport.mileage", "Quilometragem")}</span><p className="font-semibold">{vehicle.mileage?.toLocaleString()} km</p></div>
                  <div><span className="text-muted-foreground">{t("passport.vin", "VIN")}</span><p className="font-mono text-xs">{vehicle.vin || "—"}</p></div>
                  <div><span className="text-muted-foreground">{t("passport.owner", "Proprietário")}</span><p className="font-medium">{(vehicle.clients as any)?.name || "—"}</p></div>
                  <div><span className="text-muted-foreground">{t("passport.services", "Serviços")}</span><p className="font-semibold">{workOrders.length}</p></div>
                </div>
              </div>

              {kmFraudWarning && (
                <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-destructive">{t("passport.antiFraud", "Alerta Anti-Fraude")}</p>
                    <p className="text-xs text-destructive/80 mt-0.5">{kmFraudWarning}</p>
                  </div>
                </div>
              )}

              {mileagePoints.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <TrendingDown className="w-4 h-4" />
                    {t("passport.mileageHistory", "Evolução Quilometragem")}
                  </h4>
                  <div className="flex items-end gap-1 h-16">
                    {mileagePoints.map((p, i) => {
                      const max = Math.max(...mileagePoints.map(mp => mp.km));
                      const heightPct = max > 0 ? (p.km / max) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${format(new Date(p.date), "dd/MM/yy", { locale })}: ${p.km.toLocaleString()} km`}>
                          <div className="w-full bg-primary/60 rounded-t" style={{ height: `${heightPct}%`, minHeight: 2 }} />
                          <span className="text-[8px] text-muted-foreground">{format(new Date(p.date), "MM/yy", { locale })}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Próxima manutenção — apenas quando existe registo real (service_reminders). */}
              {reminders.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("passport.nextService", "Próxima manutenção")}</h4>
                  <ul className="space-y-1.5">
                    {reminders.map((r: any) => (
                      <li key={r.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2 text-sm">
                        <span>{r.service_type || t("passport.service", "Revisão")}</span>
                        <span className="text-xs text-muted-foreground">
                          {r.next_service_date ? format(new Date(r.next_service_date), "dd/MM/yyyy", { locale }) : "—"}
                          {r.next_service_km ? ` · ${Number(r.next_service_km).toLocaleString()} km` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Fotos das intervenções (work_order_attachments) */}
              {photos.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("passport.photos", "Fotos das intervenções")}</h4>
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {photos.map((p: any) => (
                      <a key={p.id} href={p.file_url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={p.file_url}
                          alt={p.context || p.file_name || "Foto da intervenção"}
                          loading="lazy"
                          className="w-full aspect-square object-cover rounded-lg border border-border"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Faturas — relação existente (vehicle_id / work_order_id). Sem secção vazia. */}
              {invoices.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("passport.invoices", "Faturas")}</h4>
                  <ul className="space-y-1.5">
                    {invoices.map((inv: any) => (
                      <li key={inv.id}>
                        <a
                          href={`/invoices/${inv.id}`}
                          className="flex items-center justify-between gap-2 bg-muted/50 hover:bg-muted rounded-lg px-3 py-2 text-sm"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="font-mono text-xs text-muted-foreground">{inv.number || "—"}</span>
                            <Badge variant="outline" className="text-[10px] shrink-0">{t(`invoice.status.${inv.status}`, inv.status)}</Badge>
                          </span>
                          <span className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">
                              {inv.created_at ? format(new Date(inv.created_at), "dd/MM/yyyy", { locale }) : "—"}
                            </span>
                            <span className="font-semibold tabular-nums">{Number(inv.total || 0).toFixed(2)}</span>
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Garantias — tabela warranties existente, ligada por vehicle_id. */}
              {warranties.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                    <Shield className="w-4 h-4" />
                    {t("passport.warranties", "Garantias")}
                  </h4>
                  <ul className="space-y-1.5">
                    {warranties.map((w: any) => (
                      <li key={w.id} className="bg-muted/50 rounded-lg px-3 py-2 text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{w.description || w.type || t("passport.warranty", "Garantia")}</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground">
                            {w.start_date ? format(new Date(w.start_date), "dd/MM/yyyy", { locale }) : "—"}
                            {w.end_date ? ` → ${format(new Date(w.end_date), "dd/MM/yyyy", { locale })}` : ""}
                          </span>
                          <Badge variant={w.status === "active" ? "default" : "outline"} className="text-[10px]">
                            {t(`warranty.status.${w.status}`, w.status)}
                          </Badge>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Peças utilizadas — agregadas das linhas das OS existentes. */}
              {usedParts.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("passport.usedParts", "Peças utilizadas")}</h4>
                  <ul className="space-y-1.5">
                    {usedParts.map((p) => (
                      <li key={p.name} className="flex items-center justify-between gap-2 bg-muted/50 rounded-lg px-3 py-2 text-sm">
                        <span className="truncate">{p.name}</span>
                        <span className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          <span>{t("passport.qty", "Qtd.")} {p.qty}</span>
                          <span className="font-semibold text-foreground tabular-nums">{p.total.toFixed(2)}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}


              <div>
                <h4 className="text-sm font-semibold mb-2">{t("passport.fullHistory", "Histórico Completo")}</h4>
                {uniqueTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{t("passport.noHistory", "Sem histórico registado.")}</p>
                ) : (
                  <div className="space-y-2">
                    {uniqueTimeline.map(event => {
                      const Icon = eventIcons[event.type] || Wrench;
                      const color = eventColors[event.type] || "bg-muted text-muted-foreground";
                      return (
                        <div key={event.id} className="flex gap-3 items-start">
                          <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shrink-0 mt-0.5`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{event.title}</p>
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(event.date), "dd/MM/yyyy", { locale })}</span>
                            </div>
                            {event.description && <p className="text-xs text-muted-foreground line-clamp-2">{event.description}</p>}
                            <div className="flex gap-2 mt-0.5">
                              {event.mileage && event.mileage > 0 && <span className="text-[10px] text-muted-foreground">{event.mileage.toLocaleString()} km</span>}
                              {event.parts?.length > 0 && <span className="text-[10px] text-muted-foreground">🔧 {event.parts.length} {t("passport.parts", "peças")}</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
