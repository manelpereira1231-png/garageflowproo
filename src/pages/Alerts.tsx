import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Bell, Search, CheckCircle, Clock, AlertTriangle, Download, Info, Plus, Phone, ExternalLink, CheckCheck } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";
import ListSkeleton from "@/components/ListSkeleton";
import ClientCommsDialog from "@/components/workshop/ClientCommsDialog";
import { useShopAlerts, type UnifiedAlert } from "@/hooks/useShopAlerts";
import { CompactFilterBar, FilterCombobox } from "@/components/filters/CompactFilters";


const alertTypeIcons: Record<string, any> = {
  revision: Clock,
  oil: AlertTriangle,
  inspection: AlertTriangle,
  warranty: AlertTriangle,
  inactive_client: Bell,
  expired_quote: Clock,
  payment_failed: AlertTriangle,
  service_due: Clock,
  quote_pending: Clock,
  stock_low: AlertTriangle,
  custom: Bell,
};

const alertStatusStyles: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  sent: "bg-info/10 text-info border-info/30",
  resolved: "bg-success/10 text-success border-success/30",
  dismissed: "bg-muted text-muted-foreground border-border",
};

const alertTypeColors: Record<string, string> = {
  payment_failed: "text-destructive",
  warranty: "text-destructive",
  expired_quote: "text-warning",
  revision: "text-warning",
  oil: "text-warning",
  service_due: "text-warning",
  quote_pending: "text-warning",
  stock_low: "text-warning",
  inspection: "text-info",
  inactive_client: "text-info",
  custom: "text-primary",
  stock_out: "text-destructive",
  invoice_overdue: "text-destructive",
  service_late: "text-destructive",
  vehicle_ready: "text-warning",
  appointment_new: "text-info",
  quote_approved: "text-info",
};

/** Rótulos dos alertas calculados a partir dos dados reais (sem tradução própria). */
const DERIVED_TYPE_LABELS: Record<string, string> = {
  stock_low: "Stock baixo",
  stock_out: "Rutura de stock",
  invoice_overdue: "Fatura vencida",
  appointment_new: "Nova marcação",
  vehicle_ready: "Veículo por levantar",
  service_late: "Serviço atrasado",
  quote_approved: "Orçamento aprovado",
  quote_pending: "Orçamento por aprovar",
  custom: "Manual",
};



export default function Alerts() {
  const { t } = useLanguage();
  const { shopId, loading: subLoading } = useSubscription();
  const { alerts, unreadCount, countsByPriority, loading, reload, markRead, markAllRead, resolve, dismiss } = useShopAlerts();
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [commsAlert, setCommsAlert] = useState<UnifiedAlert | null>(null);
  const [newAlert, setNewAlert] = useState({ title: "", message: "", type: "custom", priority: "medium" });

  // t() humaniza a chave quando não há tradução (e.g. "Stock Low"),
  // o que deixaria tipos derivados em inglês. Passamos o rótulo PT como
  // defaultValue: só é usado quando a tradução alerts.type.<type> não existe.
  const typeLabel = (type: string) => t(`alerts.type.${type}`, DERIVED_TYPE_LABELS[type]);


  const handleCreateAlert = async () => {
    if (!shopId || !newAlert.title.trim() || !newAlert.message.trim()) return;
    setCreating(true);
    try {
      const { data: canCreate, error: rpcError } = await supabase.rpc("validate_plan_limit", {
        _action_type: "create_basic_alert",
        _shop_id: shopId,
      });
      if (rpcError) { toast.error(rpcError.message); return; }
      if (!canCreate) { toast.error(t("alerts.planLimitReached")); return; }

      const { error } = await supabase.from("alerts").insert({
        shop_id: shopId,
        title: newAlert.title.trim(),
        message: newAlert.message.trim(),
        type: newAlert.type,
        priority: newAlert.priority,
        status: "pending",
      });
      if (error) { toast.error(error.message); return; }
      toast.success(t("alerts.created"));
      setCreateOpen(false);
      setNewAlert({ title: "", message: "", type: "custom", priority: "medium" });
      void reload();
    } finally {
      setCreating(false);
    }
  };

  /* Opções construídas a partir dos alertas reais — nunca listas fixas
     desatualizadas. Cada opção mostra quantos alertas existem. */
  const typeOptions = useMemo(() => {
    const counts = new Map<string, number>();
    alerts.forEach((a) => counts.set(a.type, (counts.get(a.type) || 0) + 1));
    return [
      { value: "all", label: `${t("alerts.allTypes")} (${alerts.length})` },
      ...[...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([type, n]) => ({ value: type, label: `${typeLabel(type)} (${n})` })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  const priorityOptions = useMemo(() => [
    { value: "all", label: "Todas as prioridades" },
    { value: "critical", label: `Críticos (${countsByPriority.critical})` },
    { value: "high", label: `Importantes (${countsByPriority.high})` },
    { value: "low", label: `Atenção (${countsByPriority.low})` },
  ], [countsByPriority]);

  const statusOptions = useMemo(() => {
    const n = (s: string) => alerts.filter((a) => a.status === s).length;
    const openN = alerts.filter((a) => a.status === "pending" || a.status === "sent").length;
    return [
      { value: "open", label: `Por tratar (${openN})` },
      { value: "all", label: `${t("alerts.allStatus")} (${alerts.length})` },
      { value: "pending", label: `${t("alerts.statusPending")} (${n("pending")})` },
      { value: "sent", label: `${t("alerts.statusSent")} (${n("sent")})` },
      { value: "resolved", label: `${t("alerts.statusResolved")} (${n("resolved")})` },
      { value: "dismissed", label: `${t("alerts.statusDismissed")} (${n("dismissed")})` },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  const activeFilterCount =
    (search.trim() ? 1 : 0) +
    (filterType !== "all" ? 1 : 0) +
    (filterPriority !== "all" ? 1 : 0) +
    (filterStatus !== "open" ? 1 : 0);

  const clearFilters = () => {
    setSearch("");
    setFilterType("all");
    setFilterPriority("all");
    setFilterStatus("open");
  };

  const filtered = alerts.filter((a) => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q
      || a.title?.toLowerCase().includes(q)
      || (a.subtitle || "").toLowerCase().includes(q)
      || (a.message || "").toLowerCase().includes(q)
      || (a.clientName || "").toLowerCase().includes(q)
      || (a.plate || "").toLowerCase().includes(q);
    const matchType = filterType === "all" || a.type === filterType;
    const matchStatus =
      filterStatus === "all"
        ? true
        : filterStatus === "open"
          ? a.status === "pending" || a.status === "sent"
          : a.status === filterStatus;
    const matchPriority = filterPriority === "all" || a.priority === filterPriority;
    return matchSearch && matchType && matchStatus && matchPriority;
  });


  const exportCSV = () => {
    const headers = [t("alerts.typeCol"), t("alerts.titleCol"), t("alerts.clientCol"), t("alerts.vehicleCol"), t("alerts.dateCol"), t("alerts.statusCol")];
    const rows = filtered.map((a) => [
      typeLabel(a.type),
      a.title,
      a.clientName || "",
      a.make ? `${a.make} ${a.model ?? ""}`.trim() : "",
      a.dueDate || new Date(a.createdAt).toLocaleDateString(),
      a.status,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `alertas_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("common.exported"));
  };

  

  if (subLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pendingCount = alerts.filter((a) => a.status === "pending").length;
  const resolvedCount = alerts.filter((a) => a.status === "resolved").length;
  const sentCount = alerts.filter((a) => a.status === "sent").length;
  const dismissedCount = alerts.filter((a) => a.status === "dismissed").length;

  const OpenLink = ({ a, className, children }: { a: UnifiedAlert; className?: string; children: React.ReactNode }) =>
    a.link ? (
      <Link to={a.link} className={className} onClick={() => void markRead(a)}>{children}</Link>
    ) : (
      <span className={className}>{children}</span>
    );

  return (
    <div>
      <div className="page-header flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">{t("alerts.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {pendingCount} {t("alerts.pending")}{unreadCount > 0 ? ` · ${unreadCount} por abrir` : ""}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={() => void markAllRead()} className="gap-2">
              <CheckCheck className="w-4 h-4" /> Marcar como lidos
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="w-4 h-4" />
            {t("alerts.export")}
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t("alerts.create")}
          </Button>
        </div>
      </div>

      {/* Resumo por prioridade real — clicar filtra a lista. */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {([
          { key: "critical", label: "Críticos", value: countsByPriority.critical, color: "text-destructive" },
          { key: "high", label: "Importantes", value: countsByPriority.high, color: "text-warning" },
          { key: "low", label: "Atenção", value: countsByPriority.low, color: "text-info" },
        ] as const).map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setFilterPriority(filterPriority === c.key ? "all" : c.key)}
            className={`bg-card border rounded-lg p-3 text-center transition-colors ${filterPriority === c.key ? "border-primary" : "border-border hover:bg-muted/50"}`}
          >
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </button>
        ))}
        <div className="bg-card border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">{resolvedCount}</p>
          <p className="text-xs text-muted-foreground">{t("alerts.statusResolved")}</p>
        </div>
      </div>

      <CompactFilterBar
        activeCount={activeFilterCount}
        onClear={clearFilters}
        search={
          <>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("alerts.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </>
        }
        filters={(stacked) => (
          <>
            <FilterCombobox
              value={filterType}
              onChange={setFilterType}
              options={typeOptions}
              placeholder={t("alerts.allTypes")}
              searchPlaceholder={t("alerts.filterType")}
              fullWidth={stacked}
            />
            <FilterCombobox
              value={filterPriority}
              onChange={setFilterPriority}
              options={priorityOptions}
              placeholder="Prioridade"
              fullWidth={stacked}
            />
            <FilterCombobox
              value={filterStatus}
              onChange={setFilterStatus}
              options={statusOptions}
              placeholder={t("alerts.allStatus")}
              fullWidth={stacked}
            />
          </>
        )}
      />


      {/* Desktop table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("alerts.typeCol")}</TableHead>
              <TableHead>{t("alerts.titleCol")}</TableHead>
              <TableHead>{t("alerts.clientCol")}</TableHead>
              <TableHead>{t("alerts.vehicleCol")}</TableHead>
              <TableHead>{t("alerts.dateCol")}</TableHead>
              <TableHead>{t("alerts.statusCol")}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && alerts.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-6"><ListSkeleton rows={4} variant="row" /></TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("alerts.empty")}</TableCell></TableRow>
            ) : filtered.map((a) => {
              const Icon = alertTypeIcons[a.type] || Bell;
              const typeColor = alertTypeColors[a.type] || "text-warning";
              return (
                <TableRow key={a.id} className={`hover:bg-muted/50 ${a.read ? "" : "bg-warning/5"}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${typeColor}`} />
                      <span className="text-xs">{typeLabel(a.type)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {!a.read && <span className="w-2 h-2 rounded-full bg-warning shrink-0" />}
                      <div className="min-w-0">
                        <p className={`truncate ${a.read ? "font-medium" : "font-semibold"}`}>{a.title}</p>
                        {a.subtitle && <p className="text-xs text-muted-foreground line-clamp-1">{a.subtitle}</p>}
                        {a.message && <p className="text-xs text-muted-foreground line-clamp-1">{a.message}</p>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{a.clientName || "—"}</TableCell>
                  <TableCell>{a.make ? `${a.make} ${a.model ?? ""}`.trim() : "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {a.dueDate || new Date(a.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={alertStatusStyles[a.status] || ""}>
                      {a.status === "pending" && <Clock className="w-3 h-3 mr-1" />}
                      {a.status === "sent" && <Info className="w-3 h-3 mr-1" />}
                      {a.status === "resolved" && <CheckCircle className="w-3 h-3 mr-1" />}
                      {t(`alerts.status${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {a.link && (
                        <OpenLink a={a}>
                          <Button variant="ghost" size="sm" className="text-xs gap-1">
                            <ExternalLink className="w-3.5 h-3.5" />
                            {t("common.open") || "Abrir"}
                          </Button>
                        </OpenLink>
                      )}
                      {a.clientName && a.clientId && (
                        <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={() => setCommsAlert(a)}>
                          <Phone className="w-3.5 h-3.5" />
                          {t("alerts.contact") || "Contactar"}
                        </Button>
                      )}
                      {!a.derived && a.status === "pending" && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => void resolve(a)} className="text-xs text-success">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" />
                            {t("alerts.resolve")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void dismiss(a)} className="text-xs text-muted-foreground">
                            {t("alerts.dismiss")}
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards — mesma informação e mesmas ações do desktop */}
      <div className="sm:hidden space-y-3">
        {loading && alerts.length === 0 ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">{t("alerts.empty")}</div>
        ) : filtered.map((a) => {
          const Icon = alertTypeIcons[a.type] || Bell;
          const typeColor = alertTypeColors[a.type] || "text-warning";
          return (
            <div key={a.id} className={`bg-card border rounded-xl p-4 space-y-3 ${a.read ? "border-border" : "border-warning/40 bg-warning/5"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${typeColor}`} />
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${a.read ? "font-medium" : "font-semibold"}`}>{a.title}</p>
                    <p className="text-xs text-muted-foreground">{typeLabel(a.type)}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 text-[10px] ${alertStatusStyles[a.status] || ""}`}>
                  {t(`alerts.status${a.status.charAt(0).toUpperCase() + a.status.slice(1)}`)}
                </Badge>
              </div>
              {a.subtitle && <p className="text-xs font-medium">{a.subtitle}</p>}
              {a.message && <p className="text-xs text-muted-foreground">{a.message}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {a.clientName && <span>👤 {a.clientName}</span>}
                {a.make && <span>🚗 {a.make} {a.model}</span>}
                <span>📅 {a.dueDate || new Date(a.createdAt).toLocaleDateString()}</span>
              </div>
              {a.link && (
                <OpenLink a={a} className="block">
                  <Button variant="default" size="sm" className="w-full text-xs h-11 gap-1">
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t("common.open") || "Abrir"}
                  </Button>
                </OpenLink>
              )}
              {a.clientName && a.clientId && (
                <Button variant="outline" size="sm" className="w-full text-xs h-11 gap-1" onClick={() => setCommsAlert(a)}>
                  <Phone className="w-3.5 h-3.5" />
                  {t("alerts.contact") || "Contactar"}
                </Button>
              )}
              {!a.read && (a.status === "pending" || a.status === "sent") && (
                <Button variant="ghost" size="sm" onClick={() => void markRead(a)} className="w-full text-xs h-11 gap-1">
                  <CheckCheck className="w-3.5 h-3.5" /> Marcar como lida
                </Button>
              )}
              {(a.status === "pending" || a.status === "sent") && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => void resolve(a)} className="flex-1 text-xs text-success h-11">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" />
                    {t("alerts.resolve")}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => void dismiss(a)} className="text-xs text-muted-foreground h-11">
                    {t("alerts.dismiss")}
                  </Button>
                </div>
              )}
              {(a.status === "resolved" || a.status === "dismissed") && (
                <Button variant="ghost" size="sm" onClick={() => void reopen(a)} className="w-full text-xs h-11 gap-1">
                  <RotateCcw className="w-3.5 h-3.5" /> Reabrir
                </Button>
              )}

            </div>
          );
        })}
      </div>

      {commsAlert && shopId && (
        <ClientCommsDialog
          open={!!commsAlert}
          onOpenChange={(v) => { if (!v) setCommsAlert(null); }}
          ctx={{
            workOrderId: commsAlert.id,
            number: commsAlert.title || "—",
            status: "pending",
            shopId,
            clientName: commsAlert.clientName ?? undefined,
            clientPhone: commsAlert.clientPhone ?? undefined,
            clientEmail: commsAlert.clientEmail ?? undefined,
            vehicleMake: commsAlert.make ?? undefined,
            vehicleModel: commsAlert.model ?? undefined,
            plate: commsAlert.plate ?? undefined,
          }}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{t("alerts.create")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("alerts.titleCol")} *</Label>
              <Input
                value={newAlert.title}
                onChange={(e) => setNewAlert((p) => ({ ...p, title: e.target.value }))}
                placeholder={t("alerts.titlePlaceholder")}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t("alerts.messageLabel")} *</Label>
              <Textarea
                value={newAlert.message}
                onChange={(e) => setNewAlert((p) => ({ ...p, message: e.target.value }))}
                placeholder={t("alerts.messagePlaceholder")}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{t("alerts.typeCol")}</Label>
                <Select value={newAlert.type} onValueChange={(v) => setNewAlert((p) => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="custom">{typeLabel("custom")}</SelectItem>
                    <SelectItem value="revision">{typeLabel("revision")}</SelectItem>
                    <SelectItem value="service_due">{typeLabel("service_due")}</SelectItem>
                    <SelectItem value="inspection">{typeLabel("inspection")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{t("alerts.priorityLabel")}</Label>
                <Select value={newAlert.priority} onValueChange={(v) => setNewAlert((p) => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">{t("alerts.priorityLow")}</SelectItem>
                    <SelectItem value="medium">{t("alerts.priorityMedium")}</SelectItem>
                    <SelectItem value="high">{t("alerts.priorityHigh")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleCreateAlert} disabled={!newAlert.title.trim() || !newAlert.message.trim() || creating}>
              {creating ? t("common.loading") : t("alerts.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
