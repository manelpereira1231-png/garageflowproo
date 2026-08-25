import { useState, useEffect, useCallback, useRef } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, FileDown, ChevronRight as ChevronRightIcon, Pencil, CalendarClock, Wrench, Clock, CheckCircle, Truck, XCircle, Stethoscope, ThumbsUp, Play, MessageCircle, Mail, Loader2, X } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { ensureQuoteTokenForWorkOrder } from "@/lib/ensureQuoteForWorkOrder";

import { sendEmail, quoteEmailHtml } from "@/lib/emailService";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { ServiceStatus } from "@/types/garage";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { toastError } from "@/lib/errorMessages";
import { generatePdf, exportToCsv } from "@/lib/pdfGenerator";
import { formatLocalDate } from "@/lib/marketPrice";
import { format } from "date-fns";
import ListSkeleton from "@/components/ListSkeleton";
import EmptyState from "@/components/EmptyState";
import { autoCreateInvoiceFromWorkOrder } from "@/lib/autoCreateInvoiceFromWorkOrder";
import { consumeWorkOrderParts } from "@/lib/consumeWorkOrderParts";
import { messageTemplates, renderTemplate } from "@/lib/messageTemplates";
import { useTableState } from "@/hooks/useTableState";
import { useServerList } from "@/hooks/useServerList";
import { SortableHeader } from "@/components/table/SortableHeader";
import { TablePagination } from "@/components/table/TablePagination";
import { useShopRole } from "@/hooks/useShopRole";
import ClientCommsDialog from "@/components/workshop/ClientCommsDialog";
import { formatMoney } from "@/lib/money";
import { getTaxLabel } from "@/lib/regionConfig";

const statusColors: Record<ServiceStatus, string> = {
  open: "bg-info/10 text-info",
  diagnosis: "bg-warning/10 text-warning",
  waiting_approval: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusIcons: Record<ServiceStatus, any> = {
  open: Wrench,
  diagnosis: Stethoscope,
  waiting_approval: Clock,
  approved: ThumbsUp,
  in_progress: Play,
  completed: CheckCircle,
  delivered: CheckCircle,
  cancelled: XCircle,
};

const statusFlow: ServiceStatus[] = ['open', 'diagnosis', 'waiting_approval', 'approved', 'in_progress', 'completed', 'delivered'];
const PAGE_SIZE = 50;

type ServicesFilters = {
  search: string;
  status: string;
  technician: string;
  clientId: string;
  dateFrom: string;
  dateTo: string;
};
const defaultServicesFilters: ServicesFilters = {
  search: "", status: "all", technician: "", clientId: "", dateFrom: "", dateTo: "",
};

function RepairTimeline({
  status,
  onAdvance,
  showAdvance,
}: {
  status: ServiceStatus;
  onAdvance?: () => void;
  showAdvance?: boolean;
}) {
  const currentIdx = statusFlow.indexOf(status);

  return (
    <div className="flex items-center gap-0 py-1">
      {statusFlow.map((s, i) => {
        const Icon = statusIcons[s];
        // When the WO is already delivered, the flow is complete — paint every step as done (green).
        const isFinal = status === 'delivered';
        const isActive = !isFinal && i === currentIdx;
        const isDone = isFinal || i < currentIdx;
        const isCancelled = status === 'cancelled';

        return (
          <div key={s} className="flex items-center">
            <div className={`flex items-center justify-center w-[18px] h-[18px] rounded-full border-2 transition-all shrink-0
              ${isCancelled ? 'border-destructive/30 bg-destructive/5' :
                isActive ? 'border-primary bg-primary text-primary-foreground scale-110 shadow-md shadow-primary/20' :
                isDone ? 'border-success bg-success/10 text-success' :
                'border-border bg-muted/30 text-muted-foreground/40'}`}
            >
              <Icon className="w-2 h-2" />
            </div>
            {i < statusFlow.length - 1 && (
              <div className={`w-1 h-0.5 ${isDone ? 'bg-success' : 'bg-border'}`} />
            )}
          </div>
        );
      })}
      {showAdvance && onAdvance && status !== 'cancelled' && status !== 'delivered' && (
        <>
          <div className={`w-1 h-0.5 ${currentIdx >= statusFlow.length - 1 ? 'bg-success' : 'bg-border'}`} />
          <Button
            variant="default"
            size="icon"
            onClick={onAdvance}
            className="h-[18px] w-[18px] shrink-0 ml-0.5"
            aria-label={`Avançar para ${statusFlow[statusFlow.indexOf(status) + 1] || status}`}
            title={`Avançar para ${statusFlow[statusFlow.indexOf(status) + 1] || status}`}
          >
            <ChevronRightIcon className="w-2 h-2" />
          </Button>
        </>
      )}
    </div>
  );
}

export default function Services() {
  const { t } = useLanguage();
  const { limits, plan, canUseFeature } = useSubscription();
  const { can } = useShopRole();
  const [shop, setShop] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [technicianOptions, setTechnicianOptions] = useState<string[]>([]);
  const [clientOptions, setClientOptions] = useState<[string, string][]>([]);
  const [reminderDialog, setReminderDialog] = useState<any>(null);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderKm, setReminderKm] = useState("");
  const [statusCountsAll, setStatusCountsAll] = useState<Record<string, number>>({});
  const [monthRevenue, setMonthRevenue] = useState<number>(0);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  // Comunicação com o cliente da OS (reutiliza a camada partilhada lib/clientComms.ts)
  const [commsService, setCommsService] = useState<any>(null);

  const table = useTableState<ServicesFilters>({
    storageKey: "table:services",
    defaultFilters: defaultServicesFilters,
    defaultSort: { key: "created_at", dir: "desc" },
    pageSize: PAGE_SIZE,
  });
  const { filters, updateFilter, clearFilters, hasActiveFilters, sort, toggleSort, page, setPage } = table;
  const search = filters.search;
  const statusFilter = filters.status;

  /**
   * Envia email da OS reutilizando exatamente o mesmo template dos Orçamentos
   * (`quoteEmailHtml`). Quando a OS está em `waiting_approval` e tem um quote
   * associado com token, inclui o botão de aprovação online — igual ao
   * comportamento do módulo de Orçamentos. Isto uniformiza o envio pelos dois
   * pontos de entrada (Orçamentos e Ordens de Serviço).
   */
  const sendServiceEmail = async (s: any) => {
    if (!can("work_orders.send_email")) return;
    const clientEmail = (s.clients as any)?.email;
    if (!clientEmail) { toast.error(t('quotes.noClientEmail') || 'Cliente sem email'); return; }
    if (!shop) { toast.error('Dados da oficina não carregados'); return; }
    setSendingEmail(s.id);
    try {
      // Resolver token do orçamento **desta** OS (para o botão Aprovar).
      // Nunca reutilizar o último orçamento do cliente — podia estar já
      // aprovado/convertido e a página pública mostrava "Aprovado".
      const quoteToken: string | undefined = (await ensureQuoteTokenForWorkOrder(s)) || undefined;
      let quoteRow: any = null;
      if (quoteToken) {
        const { data: qData } = await supabase.from('quotes').select('*').eq('token', quoteToken).maybeSingle();
        quoteRow = qData || null;
      }


      const approvalUrl = quoteToken && canUseFeature('quoteApproval')
        ? `${window.location.origin}/quote/${quoteToken}`
        : undefined;

      const lang = shop.language || 'pt';
      const langLabels: Record<string, string> = { pt: 'Orçamento', en: 'Quote', es: 'Presupuesto' };
      // Mapa status da OS -> template curto (estilo WhatsApp).
      // Todos os estágios usam mensagens curtas — nunca reenviar a tabela do orçamento.
      // O link de aprovação online é adicionado como CTA no estágio waiting_approval.
      const statusToTemplateId: Record<string, string> = {
        open: 'wo_received',
        diagnosis: 'wo_diagnosis',
        waiting_approval: 'wo_awaiting_approval',
        approved: 'wo_quote_approved',
        in_progress: 'wo_in_progress',
        completed: 'wo_completed',
        delivered: 'wo_delivered',
      };
      const tplId = statusToTemplateId[s.status];
      const tpl = tplId ? messageTemplates.find((m) => m.id === tplId) : undefined;

      const vehicleInfo = `${(s.vehicles as any)?.make || ''} ${(s.vehicles as any)?.model || ''}`.trim();
      const plate = (s.vehicles as any)?.plate || '';
      const vehicleFull = `${vehicleInfo}${plate ? ` — ${plate}` : ''}`.trim();
      const clientName = (s.clients as any)?.name || '';

      let subject: string;
      let html: string;

      if (tpl) {
        // === Email curto e profissional, alinhado com o WhatsApp ===
        const subjectTpl = (lang === 'pt' ? tpl.subjectPt : tpl.subject) || tpl.subject;
        const bodyTpl = (lang === 'pt' ? tpl.bodyPt : tpl.body) || tpl.body;
        const vars: Record<string, string> = {
          wo_number: s.number || '',
          client_name: clientName,
          shop_name: shop.name || '',
          vehicle: vehicleInfo,
          plate,
          quote_total: Number(s.total || 0).toFixed(2),
        };
        const renderedSubject = renderTemplate(subjectTpl, vars);
        const renderedBody = renderTemplate(bodyTpl, vars);
        subject = `${renderedSubject} — ${s.number} — ${shop.name}`;

        const bodyHtml = renderedBody
          .split('\n')
          .map((line) => line.trim() === ''
            ? '<div style="height:8px;"></div>'
            : `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 10px;">${line}</p>`)
          .join('');

        const ctaHtml = (s.status === 'waiting_approval' && approvalUrl)
          ? `<div style="text-align:center;margin:20px 0 6px;">
               <a href="${approvalUrl}" style="display:inline-block;background-color:#ffb41e;color:#262626;font-weight:700;font-size:15px;text-decoration:none;padding:12px 28px;border-radius:8px;">Ver e aprovar orçamento</a>
             </div>`
          : '';

        html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background-color:#ffffff;">
            <div style="background-color:#262626;padding:22px 28px;border-radius:12px 12px 0 0;">
              ${shop.logo_url ? `<img src="${shop.logo_url}" alt="${shop.name}" style="max-height:40px;margin-bottom:8px;display:block;" />` : ''}
              <div style="color:#ffb41e;font-size:18px;font-weight:700;">${shop.name}</div>
              <div style="color:#ffffff;font-size:14px;font-weight:600;margin-top:4px;">${renderedSubject}</div>
            </div>
            <div style="padding:26px 28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
              ${bodyHtml}
              ${ctaHtml}
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:22px 0 14px;" />
              <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">
                ${shop.name}${shop.phone ? ` · ${shop.phone}` : ''}${shop.email ? ` · ${shop.email}` : ''}
              </p>
            </div>
          </div>`;
      } else {
        // === Estágio de aprovação: mantém o email tabela completa com botão de aprovar ===
        const lines = (Array.isArray(s.lines) ? s.lines : (Array.isArray(quoteRow?.lines) ? quoteRow.lines : [])) as any[];
        subject = `${langLabels[lang] || langLabels.pt} ${s.number} — ${shop.name}`;
        html = quoteEmailHtml({
          shopName: shop.name,
          shopEmail: shop.email,
          shopPhone: shop.phone,
          shopNif: shop.nif,
          shopAddress: shop.address,
          shopLogoUrl: shop.logo_url,
          clientName,
          quoteNumber: s.number,
          quoteDate: formatLocalDate(s.created_at),
          validityDate: quoteRow?.validity_date || '',
          lines,
          subtotal: Number(s.subtotal || 0),
          vatTotal: Number(s.vat_total || 0),
          total: Number(s.total || 0),
          currency: shop.currency || 'EUR',
          vehicleInfo: vehicleFull,
          notes: s.notes || s.diagnosis || undefined,
          approvalUrl,
          lang,
          laborHours: Number(s.labor_hours ?? quoteRow?.labor_hours) || 0,
          laborRate: Number(shop.labor_rate) || 0,
        });
      }

      await sendEmail({ to: clientEmail, subject, html });

      const activeId = localStorage.getItem("garageflow_active_shop");
      if (activeId) {
        await supabase.from("email_logs").insert({
          shop_id: activeId, to_email: clientEmail, subject, status: 'sent',
          entity_type: 'service', entity_id: s.id,
        });
      }
      toast.success(t('quotes.emailSent') || 'Email enviado');
    } catch (err: any) {
      console.error('Email error:', err);
      const activeId = localStorage.getItem("garageflow_active_shop");
      if (activeId) {
        await supabase.from("email_logs").insert({
          shop_id: activeId, to_email: clientEmail, subject: `${s.number} — email failed`, status: 'failed',
          error_message: err.message, entity_type: 'service', entity_id: s.id,
        });
      }
      toast.error(t('quotes.emailError') || 'Erro ao enviar email');
    } finally {
      setSendingEmail(null);
    }
  };

  /**
   * WhatsApp handler shared by the list actions. Usa sempre o orçamento
   * ligado a esta OS (criando-o se a OS aguarda aprovação e ainda não tem),
   * nunca um orçamento antigo do mesmo cliente.
   */
  const sendServiceWhatsApp = async (s: any) => {
    if (!can("work_orders.send_whatsapp")) return;
    const phone = (s.clients as any)?.phone;
    if (!phone) { toast.error(t('quotes.noClientPhone') || 'Cliente sem telefone'); return; }
    const quoteToken: string | undefined = (await ensureQuoteTokenForWorkOrder(s)) || undefined;

    const link = quoteToken ? `${window.location.origin}/quote/${quoteToken}` : undefined;
    // Anexa o PDF: no mobile via Web Share (partilha nativa direta para o WhatsApp),
    // no desktop faz download automático para arrastar para o WhatsApp Web.
    // O URL já é wa.me (abre app / WhatsApp Web diretamente, sem página intermédia).
    const pdf = await buildServicePdfBlob(s);
    openWhatsApp({
      phone,
      clientName: (s.clients as any)?.name,
      type: 'service',
      number: s.number,
      plate: (s.vehicles as any)?.plate,
      model: `${(s.vehicles as any)?.make ?? ''} ${(s.vehicles as any)?.model ?? ''}`.trim(),
      serviceStage: s.status as any,
      total: s.total,
      link,
      pdfBlob: pdf?.blob ?? null,
      pdfFilename: pdf?.filename,
    });
  };

  const activeShopId = useActiveShopId();
  const pdfBusyRef = useRef(false);

  const fetchStats = async (shopId: string) => {
    // Agregação feita no servidor (RPC) — evita descarregar milhares de OS
    // para o browser só para contar estados e somar a receita do mês.
    const { data, error } = await supabase.rpc("work_order_status_stats" as any, { _shop_id: shopId });
    if (error || !data) return;
    const result = data as any;
    setStatusCountsAll((result.counts ?? {}) as Record<string, number>);
    setMonthRevenue(Number(result.month_revenue ?? 0));
  };

  const SORT_COLUMNS: Record<string, string> = {
    number: "number", created_at: "created_at", total: "total", status: "status",
  };
  const orderBy = (sort.key && SORT_COLUMNS[sort.key]) || "created_at";
  const ascending = sort.key && sort.dir ? sort.dir === "asc" : false;

  const compare = [
    filters.dateFrom ? { col: "created_at", op: "gte" as const, value: filters.dateFrom } : null,
    filters.dateTo ? { col: "created_at", op: "lte" as const, value: `${filters.dateTo}T23:59:59` } : null,
  ].filter(Boolean) as { col: string; op: "gte" | "lte"; value: string }[];

  const searchExtraClauses = useCallback(async (term: string) => {
    if (!activeShopId) return [];
    const [{ data: cs }, { data: vs }] = await Promise.all([
      supabase.from("clients").select("id").eq("shop_id", activeShopId).ilike("name", `%${term}%`).limit(50),
      supabase.from("vehicles").select("id").eq("shop_id", activeShopId)
        .or(`plate.ilike.%${term}%,make.ilike.%${term}%,model.ilike.%${term}%`).limit(50),
    ]);
    const clauses: string[] = [];
    if (cs?.length) clauses.push(`client_id.in.(${cs.map((c: any) => c.id).join(",")})`);
    if (vs?.length) clauses.push(`vehicle_id.in.(${vs.map((v: any) => v.id).join(",")})`);
    return clauses;
  }, [activeShopId]);

  const {
    rows: services,
    total: totalCount,
    loading: dataLoading,
  } = useServerList<any>({
    table: "work_orders",
    shopId: activeShopId,
    select: "*, clients(name, email, phone, nif), vehicles(make, model, plate), quotes(token)",
    page,
    pageSize: PAGE_SIZE,
    orderBy,
    ascending,
    search,
    searchColumns: ["number", "technician"],
    searchExtraClauses,
    eq: {
      client_id: filters.clientId || undefined,
      technician: filters.technician || undefined,
    },
    inFilters: { status: filters.status !== "all" ? [filters.status] : undefined },
    compare,
    refreshKey,
  });

  const fetchServices = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (!activeShopId) return;
    let alive = true;
    (async () => {
      const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeShopId).maybeSingle();
      if (!alive) return;
      if (shopData) setShop(shopData);

      const { data: cs } = await supabase.from("clients").select("id, name").eq("shop_id", activeShopId).is("deleted_at", null).order("name").limit(1000);
      if (!alive) return;
      setClientOptions(((cs || []) as any[]).map((c) => [c.id, c.name] as [string, string]));

      const { data: tech } = await supabase.from("work_orders").select("technician").eq("shop_id", activeShopId).not("technician", "is", null).limit(2000);
      if (!alive) return;
      setTechnicianOptions(Array.from(new Set(((tech || []) as any[]).map((r) => r.technician).filter(Boolean))) as string[]);
    })();
    return () => { alive = false; };
  }, [activeShopId, refreshKey]);

  const advanceStatus = async (service: any) => {
    const currentIdx = statusFlow.indexOf(service.status);
    if (currentIdx === -1 || currentIdx >= statusFlow.length - 1) return;
    const nextStatus = statusFlow[currentIdx + 1];

    if (nextStatus === 'completed') {
      setReminderDialog(service);
      const defaultDate = new Date();
      defaultDate.setMonth(defaultDate.getMonth() + 6);
      setReminderDate(defaultDate.toISOString().split('T')[0]);
      setReminderKm("");
      return;
    }

    const updates: any = { status: nextStatus };
    if (nextStatus === 'delivered') updates.delivered_at = new Date().toISOString();
    const { error } = await supabase.from("work_orders").update(updates).eq("id", service.id);
    if (error) toastError(error, "Não foi possível atualizar o estado do serviço");
    else { toast.success(`${t(`service.${nextStatus}`)}`); fetchServices(); }
  };

  const completeWithReminder = async (createReminder: boolean) => {
    if (!reminderDialog) return;
    const service = reminderDialog;
    const updates: any = { status: 'completed', completed_at: new Date().toISOString() };
    const { error } = await supabase.from("work_orders").update(updates).eq("id", service.id);
    if (error) { toastError(error, "Não foi possível concluir o serviço"); return; }

    // Descontar peças do stock — fluxo oficial partilhado (idempotente por OS).
    try {
      const activeId = localStorage.getItem("garageflow_active_shop");
      const res = await consumeWorkOrderParts({
        workOrderId: service.id,
        shopId: activeId,
        lines: service.lines,
        reference: service.number,
      });
      if (res.error) {
        toast.error(`Consumo de stock falhou (nenhuma alteração aplicada): ${res.error}`);
      } else if (res.insufficient.length > 0) {
        toast.warning(`Stock ficou negativo: ${res.insufficient.join(', ')}`);
      } else if (res.consumed > 0) {
        toast.success(`${res.consumed} peça(s) descontada(s) do stock`);
      }
    } catch (e) {
      console.error("Erro ao descontar stock:", e);
    }

    // Auto-criar fatura (rascunho) ligada à OS concluída
    const invRes = await autoCreateInvoiceFromWorkOrder(service.id);
    if (invRes.error) {
      toast.error(`Serviço concluído, mas falhou a criar fatura: ${invRes.error}`);
    } else if (invRes.created) {
      toast.success("Fatura criada automaticamente");
    }

    if (createReminder && reminderDate) {
      const activeId = localStorage.getItem("garageflow_active_shop");
      await supabase.from("service_reminders").insert({
        shop_id: activeId,
        vehicle_id: service.vehicle_id,
        client_id: service.client_id,
        work_order_id: service.id,
        next_service_date: reminderDate,
        next_service_km: reminderKm ? parseInt(reminderKm) : null,
      } as any);
      toast.success(t('reminders.created'));
    } else {
      toast.success(t('service.completed'));
    }
    setReminderDialog(null);
    fetchServices();
  };

  const cancelService = async (id: string) => {
    if (!can("work_orders.delete")) return;
    const { error } = await supabase.from("work_orders").update({ status: 'cancelled' }).eq("id", id).eq("shop_id", activeShopId);
    if (error) toastError(error, "Não foi possível cancelar o serviço");
    else { toast.success(t('service.cancelled')); fetchServices(); }
  };

  /**
   * Gera o jsPDF da OS. Partilhado por `downloadPdf` (guarda no disco) e pelo
   * botão WhatsApp (converte para Blob e anexa via Web Share / download em
   * desktop — paridade com o envio por email, que já entrega o PDF).
   */
  const buildServicePdfDoc = async (s: any) => {
    if (!shop) throw new Error('shop_not_loaded');
    const lines = (Array.isArray(s.lines) ? s.lines : []) as any[];
    return generatePdf({
      type: 'service', number: s.number, date: formatLocalDate(s.created_at),
      shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone,
      shopNif: shop.nif, shopAddress: shop.address, shopLogoUrl: shop.logo_url,
      clientName: (s.clients as any)?.name || '', clientEmail: (s.clients as any)?.email,
      clientPhone: (s.clients as any)?.phone, clientNif: (s.clients as any)?.nif,
      vehicleMake: (s.vehicles as any)?.make || '', vehicleModel: (s.vehicles as any)?.model || '',
      vehiclePlate: (s.vehicles as any)?.plate || '', lines, subtotal: s.subtotal, vatTotal: s.vat_total,
      total: s.total, profit: s.profit, notes: s.notes, technician: s.technician, diagnosis: s.diagnosis,
      laborHours: s.labor_hours, laborRate: shop.labor_rate, currency: shop.currency || 'EUR', plan: plan,
    }, limits.pdfWatermark);
  };

  const downloadPdf = async (s: any) => {
    if (!can("work_orders.print")) return;
    if (!shop) return;
    // Evita que um duplo-clique gere e transfira o mesmo PDF duas vezes.
    if (pdfBusyRef.current) return;
    pdfBusyRef.current = true;
    try {
      const doc = await buildServicePdfDoc(s);
      doc.save(`${s.number}.pdf`);
    } catch (err: any) {
      console.error('PDF error', err);
      toast.error(`Falha a gerar PDF: ${err?.message || err}`);
    } finally {
      pdfBusyRef.current = false;
    }
  };

  /** Blob do PDF da OS para partilha (WhatsApp). Retorna null se falhar. */
  const buildServicePdfBlob = async (s: any): Promise<{ blob: Blob; filename: string } | null> => {
    try {
      const doc = await buildServicePdfDoc(s);
      return { blob: doc.output('blob'), filename: `${s.number}.pdf` };
    } catch (err) {
      console.warn('[services] pdf blob build failed', err);
      return null;
    }
  };

  const handleExportCsv = async () => {
    if (!can("work_orders.export") || !activeShopId) return;
    // A grelha só tem uma página — a exportação lê a lista completa no servidor.
    const { data: all } = await supabase
      .from("work_orders")
      .select("*, clients(name), vehicles(make, model, plate)")
      .eq("shop_id", activeShopId)
      .order("created_at", { ascending: false })
      .limit(5000);
    const csvData = (all || []).map((s: any) => ({
      Número: s.number, Cliente: (s.clients as any)?.name,

      Veículo: `${(s.vehicles as any)?.make} ${(s.vehicles as any)?.model}`,
      Matrícula: (s.vehicles as any)?.plate, Status: s.status, Subtotal: s.subtotal,
      [getTaxLabel()]: s.vat_total, Total: s.total, Lucro: s.profit,
      Data: formatLocalDate(s.created_at),
    }));
    exportToCsv(csvData, 'servicos');
    toast.success(t('common.exported'));
  };

  // Filtering, sorting and paging are handled by Postgres (useServerList).
  const filtered = services;
  const totalFiltered = totalCount;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);


  return (
    <div className="w-full min-w-0">
      <div className="page-header flex-wrap gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{t('services.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            <span className="font-medium text-foreground">Gestão administrativa</span> · {totalCount} ordens · emitir faturas, imprimir, exportar
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            Precisa registar tempo, checklist, fotos ou trabalhar na bancada?{" "}
            <Link to="/workshop" className="text-primary hover:underline font-medium">Abrir Modo Oficina →</Link>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileDown className="w-4 h-4 mr-1" />CSV
          </Button>
          <Link to="/services/new">
            <Button><Plus className="w-4 h-4 mr-2" />{t('services.new')}</Button>
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t('service.in_progress')}</p>
          <p className="text-2xl font-bold mt-1">{statusCountsAll.in_progress || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t('service.waiting_approval')}</p>
          <p className="text-2xl font-bold mt-1 text-warning">{statusCountsAll.waiting_approval || 0}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{t('service.open')}</p>
          <p className="text-2xl font-bold mt-1 text-info">{statusCountsAll.open || 0}</p>
        </div>
        {can("finance.view_profits") && (
          <div className="bg-card border border-border rounded-xl p-3">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Este mês</p>
            <p className="text-2xl font-bold mt-1 text-success mono">{formatMoney(monthRevenue, shop?.currency)}</p>
          </div>
        )}
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        <Button
          variant={statusFilter === "all" ? "default" : "outline"}
          size="sm"
          onClick={() => updateFilter("status", "all")}
          className="text-xs shrink-0"
        >
          {t('services.allStatuses') || 'Todos'} ({Object.values(statusCountsAll).reduce((a,b)=>a+b,0) || totalCount})
        </Button>
        {statusFlow.filter(s => s !== 'cancelled').map(s => {
          const Icon = statusIcons[s];
          const c = statusCountsAll[s] || 0;
          return (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => updateFilter("status", s)}
              className="text-xs shrink-0 gap-1"
            >
              <Icon className="w-3 h-3" />
              {t(`service.${s}`)}
              {c > 0 && <span className="ml-1 opacity-70">({c})</span>}
            </Button>
          );
        })}
      </div>

      {/* Smart filters row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2 mb-4">
        <div className="relative sm:col-span-2 xl:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('services.search') || 'Pesquisar…'} value={search} onChange={e => updateFilter('search', e.target.value)} className="pl-9" />
        </div>
        <select
          value={filters.clientId}
          onChange={(e) => updateFilter('clientId', e.target.value)}
          className="h-10 px-3 rounded-md bg-background border border-input text-sm"
        >
          <option value="">Todos os clientes</option>
          {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <select
          value={filters.technician}
          onChange={(e) => updateFilter('technician', e.target.value)}
          className="h-10 px-3 rounded-md bg-background border border-input text-sm"
        >
          <option value="">Todos os técnicos</option>
          {technicianOptions.map(tName => <option key={tName} value={tName}>{tName}</option>)}
        </select>
        <Input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} title="Data desde" />
        <div className="flex gap-1">
          <Input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} title="Data até" />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0" title="Limpar filtros">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>


      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2">
        {dataLoading && services.length === 0 ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          totalCount === 0 ? (
            <EmptyState
              icon="🔧"
              title={t('services.empty') || 'Ainda sem serviços'}
              description={'Cria a primeira ordem de serviço a partir de um orçamento ou diretamente.'}
              action={
                <Link to="/services/new">
                  <Button size="lg" className="px-6">
                    <Plus className="w-4 h-4 mr-2" />{t('services.new') || 'Novo serviço'}
                  </Button>
                </Link>
              }
            />
          ) : (
            <EmptyState variant="inline" icon="🔍" title={t('services.noResults') || 'Sem resultados'} />
          )
        ) : filtered.map(s => (
          <div key={s.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium mono text-sm">{s.number}</span>
                <p className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yyyy')}</p>
              </div>
              <Badge variant="secondary" className={statusColors[s.status as ServiceStatus]}>
                {t(`service.${s.status}`)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold">{(s.clients as any)?.name}</p>
              <p className="text-xs text-muted-foreground">
                {(s.vehicles as any)?.make} {(s.vehicles as any)?.model} — {(s.vehicles as any)?.plate}
                {s.technician && <span> · 🔧 {s.technician}</span>}
              </p>
            </div>
            <RepairTimeline
              status={s.status as ServiceStatus}
              onAdvance={() => advanceStatus(s)}
              showAdvance={can("work_orders.complete") && !['delivered', 'cancelled'].includes(s.status)}
            />
            <div className="flex flex-col gap-2 pt-1 border-t border-border">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold mono whitespace-nowrap shrink-0">{formatMoney(s.total)}</span>
                <div className="flex flex-wrap items-center gap-1 justify-end min-w-0">
                  {can("work_orders.edit") && !['delivered', 'cancelled'].includes(s.status) && (
                    <Link to={`/services/edit/${s.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs h-7"><Pencil className="w-3 h-3" /></Button>
                    </Link>
                  )}
                  {can("work_orders.print") && <Button variant="ghost" size="sm" onClick={() => downloadPdf(s)} className="text-xs h-7">PDF</Button>}
                  {can("work_orders.send_email") && (
                    <Button variant="ghost" size="sm" onClick={() => sendServiceEmail(s)} disabled={sendingEmail === s.id} className="text-xs h-7">
                      {sendingEmail === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Mail className="w-3 h-3 mr-1" />Email</>}
                    </Button>
                  )}
                  {can("work_orders.send_whatsapp") && (
                    <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" onClick={() => sendServiceWhatsApp(s)}>
                      <MessageCircle className="w-3 h-3 mr-1" />WhatsApp
                    </Button>
                  )}
                  {(can("work_orders.send_email") || can("work_orders.send_whatsapp")) && (
                    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCommsService(s)}>
                      <MessageCircle className="w-3 h-3 mr-1" />Cliente
                    </Button>
                  )}
                </div>
              </div>
              {can("work_orders.delete") && (
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive" onClick={() => cancelService(s.id)}>
                    <XCircle className="w-3 h-3 mr-1" />Cancelar
                  </Button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden sm:block w-full min-w-0 bg-card border border-border rounded-xl overflow-x-auto sticky-thead">
        <Table className="table-fixed min-w-[850px]">
          <colgroup>
            <col className="w-[8%]" />
            <col className="w-[16%]" />
            <col className="w-[13%]" />
            <col className="w-[30%]" />
            <col className="w-[7%]" />
            <col className="w-[8%]" />
            <col className="w-[18%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <SortableHeader sortKey="number" currentSort={sort} onToggle={toggleSort}>{t('quotes.number')}</SortableHeader>
              <SortableHeader sortKey="client" currentSort={sort} onToggle={toggleSort}>{t('quotes.client')}</SortableHeader>
              <SortableHeader sortKey="vehicle" currentSort={sort} onToggle={toggleSort} className="hidden xl:table-cell">{t('quotes.vehicle')}</SortableHeader>
              <TableHead className="hidden lg:table-cell px-2">{t('services.timeline')}</TableHead>
              <SortableHeader sortKey="total" currentSort={sort} onToggle={toggleSort}>{t('quotes.total')}</SortableHeader>
              <SortableHeader sortKey="status" currentSort={sort} onToggle={toggleSort}>{t('quotes.status')}</SortableHeader>
              <TableHead className="px-2 text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataLoading && services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-2">
                  {totalCount === 0 ? (
                    <EmptyState
                      icon="🔧"
                      title={t('services.empty') || 'Ainda sem serviços'}
                      description={'Cria a primeira ordem de serviço a partir de um orçamento ou diretamente.'}
                      action={
                        <Link to="/services/new">
                          <Button size="lg" className="px-6">
                            <Plus className="w-4 h-4 mr-2" />{t('services.new') || 'Novo serviço'}
                          </Button>
                        </Link>
                      }
                    />
                  ) : (
                    <EmptyState variant="inline" icon="🔍" title={t('services.noResults') || 'Sem resultados'} />
                  )}
                </TableCell>
              </TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/50">
                <TableCell className="px-3 py-3 overflow-hidden">
                  <div className="min-w-0">
                    <span className="font-medium mono whitespace-nowrap">{s.number}</span>
                    <p className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(s.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-3 whitespace-normal overflow-hidden">
                  <div className="min-w-0 leading-tight">
                    <span className="font-medium break-words">{(s.clients as any)?.name}</span>
                    {s.technician && <p className="text-xs text-muted-foreground break-words">🔧 {s.technician}</p>}
                  </div>
                </TableCell>
                <TableCell className="hidden xl:table-cell px-3 py-3 whitespace-normal overflow-hidden">
                  <div className="min-w-0 leading-tight">
                    <span className="break-words">{(s.vehicles as any)?.make} {(s.vehicles as any)?.model}</span>
                    <span className="mono text-xs text-muted-foreground ml-1 whitespace-nowrap">({(s.vehicles as any)?.plate})</span>
                  </div>
                </TableCell>
                <TableCell className="hidden lg:table-cell px-2 py-3 min-w-0">
                  <RepairTimeline
                    status={s.status as ServiceStatus}
                    onAdvance={() => advanceStatus(s)}
                    showAdvance={can("work_orders.complete") && !['delivered', 'cancelled'].includes(s.status)}
                  />
                </TableCell>
                <TableCell className="px-3 py-3 font-semibold mono whitespace-nowrap overflow-hidden">{formatMoney(s.total)}</TableCell>
                <TableCell className="px-2 py-3 overflow-hidden">
                  <Badge
                    variant="secondary"
                    title={t(`service.${s.status}`)}
                    className={`${statusColors[s.status as ServiceStatus]} whitespace-nowrap truncate text-[10px] leading-tight px-1.5 py-0.5 inline-block max-w-full`}
                  >
                    {t(`service.${s.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <div className="inline-flex items-center justify-end gap-0.5 flex-wrap">
                      {can("work_orders.edit") && !['delivered', 'cancelled'].includes(s.status) && (
                        <Link to={`/services/edit/${s.id}`}>
                          <Button variant="ghost" size="icon" aria-label={t('common.edit') || 'Editar'} className="h-8 w-8 shrink-0" title={t('common.edit') || 'Editar'}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                      )}
                      {can("work_orders.print") && (
                        <Button variant="ghost" size="icon" aria-label="PDF" className="h-8 w-8 shrink-0" title="PDF" onClick={() => downloadPdf(s)}>
                          <FileDown className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {can("work_orders.send_email") && (
                        <Button variant="ghost" size="icon" aria-label="Email" className="h-8 w-8 shrink-0" title="Email" onClick={() => sendServiceEmail(s)} disabled={sendingEmail === s.id}>
                          {sendingEmail === s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        </Button>
                      )}
                      {can("work_orders.send_whatsapp") && (
                        <Button variant="ghost" size="icon" aria-label="WhatsApp" className="h-8 w-8 shrink-0 text-green-600" title="WhatsApp" onClick={() => sendServiceWhatsApp(s)}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {(can("work_orders.send_email") || can("work_orders.send_whatsapp")) && (
                        <Button variant="ghost" size="icon" aria-label="Comunicar com cliente" className="h-8 w-8 shrink-0" title="Comunicar com cliente" onClick={() => setCommsService(s)}>
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {can("work_orders.delete") && (
                      <div className="inline-flex items-center justify-end gap-0.5">
                        <Button variant="ghost" size="icon" aria-label={t('common.cancel') || 'Cancelar'} className="h-8 w-8 shrink-0 text-destructive" title={t('common.cancel') || 'Cancelar'} onClick={() => cancelService(s.id)}>
                          <XCircle className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={safePage}
        totalPages={totalPages}
        total={totalCount}
        pageSize={PAGE_SIZE}
        start={safePage * PAGE_SIZE}
        onPageChange={setPage}
        labelOf={t('common.of') || 'de'}
      />

      {/* Comunicação com o cliente da OS — camada partilhada, cliente sempre o do serviço */}
      {commsService && activeShopId && (
        <ClientCommsDialog
          open={!!commsService}
          onOpenChange={(v) => { if (!v) setCommsService(null); }}
          ctx={{
            workOrderId: commsService.id,
            number: commsService.number,
            status: commsService.status,
            shopId: activeShopId,
            shopName: shop?.name,
            clientName: (commsService.clients as any)?.name,
            clientPhone: (commsService.clients as any)?.phone,
            clientEmail: (commsService.clients as any)?.email,
            vehicleMake: (commsService.vehicles as any)?.make,
            vehicleModel: (commsService.vehicles as any)?.model,
            plate: (commsService.vehicles as any)?.plate,
            total: Number(commsService.total || 0),
          }}
        />
      )}

      {/* Reminder Dialog */}
      <Dialog open={!!reminderDialog} onOpenChange={(o) => !o && setReminderDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-primary" />
              {t('reminders.scheduleTitle')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{t('reminders.scheduleDescription')}</p>
          <div className="space-y-4 mt-2">
            <div>
              <Label>{t('reminders.nextDate')}</Label>
              <Input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)} />
            </div>
            <div>
              <Label>{t('reminders.nextKm')}</Label>
              <Input type="number" placeholder="ex: 120000" value={reminderKm} onChange={e => setReminderKm(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-4">
            <Button variant="outline" onClick={() => completeWithReminder(false)}>
              {t('reminders.skipReminder')}
            </Button>
            <Button onClick={() => completeWithReminder(true)} disabled={!reminderDate}>
              <CalendarClock className="w-4 h-4 mr-2" />
              {t('reminders.createReminder')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
