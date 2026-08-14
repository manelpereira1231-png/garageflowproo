import { useRealtimeTable } from "@/hooks/useRealtimeTable";
import { useServerList } from "@/hooks/useServerList";
import { useState, useEffect, useCallback } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { formatDuration, totalEstMinutes } from "@/lib/duration";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ArrowRightLeft, FileDown, Pencil, Mail, Loader2, AlertTriangle, Copy, Receipt, MessageCircle, X } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { QuoteStatus } from "@/types/garage";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { toastError } from "@/lib/errorMessages";
import { generatePdf, exportToCsv } from "@/lib/pdfGenerator";
import { formatLocalDate } from "@/lib/marketPrice";
import { sendEmail, quoteEmailHtml, isValidEmail } from "@/lib/emailService";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import ListSkeleton from "@/components/ListSkeleton";
import { useTableState } from "@/hooks/useTableState";
import { SortableHeader } from "@/components/table/SortableHeader";
import { TablePagination } from "@/components/table/TablePagination";
import { formatMoney } from "@/lib/money";
import { getTaxLabel } from "@/lib/regionConfig";

const statusColors: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  converted: "bg-primary/10 text-primary",
};

const PAGE_SIZE = 50;

type QuotesFilters = { search: string; status: string; clientId: string; dateFrom: string; dateTo: string };
const defaultQuotesFilters: QuotesFilters = { search: "", status: "all", clientId: "", dateFrom: "", dateTo: "" };

export default function Quotes() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { limits, plan, shopId, checkQuoteLimit, canUseFeature, isEntryPlan } = useSubscription();
  const [refreshKey, setRefreshKey] = useState(0);
  const [clientOptions, setClientOptions] = useState<[string, string][]>([]);
  const [converting, setConverting] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [shop, setShop] = useState<any>(null);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const activeShopId = useActiveShopId();

  const table = useTableState<QuotesFilters>({
    storageKey: "table:quotes",
    defaultFilters: defaultQuotesFilters,
    defaultSort: { key: "created_at", dir: "desc" },
    pageSize: PAGE_SIZE,
  });
  const { filters, updateFilter, clearFilters, hasActiveFilters, sort, toggleSort, page, setPage } = table;
  const search = filters.search;

  const SORT_COLUMNS: Record<string, string> = {
    number: "number", created_at: "created_at", total: "total",
    profit: "profit", status: "status",
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
    rows: quotes,
    total: totalCount,
    loading: dataLoading,
  } = useServerList<any>({
    table: "quotes",
    shopId: activeShopId,
    select: "*, clients(name, email, phone, nif), vehicles(make, model, plate)",
    page,
    pageSize: PAGE_SIZE,
    orderBy,
    ascending,
    search,
    searchColumns: ["number"],
    searchExtraClauses,
    eq: { client_id: filters.clientId || undefined },
    inFilters: { status: filters.status !== "all" ? [filters.status] : undefined },
    compare,
    refreshKey,
  });

  const fetchQuotes = useCallback(() => { setRefreshKey((k) => k + 1); }, []);

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

      if (limits.maxQuotesPerMonth !== Infinity) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count: monthCount } = await supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", activeShopId)
          .gte("created_at", monthStart);
        if (alive) setMonthlyUsed(monthCount || 0);
      }
    })();
    return () => { alive = false; };
  }, [activeShopId, limits.maxQuotesPerMonth, refreshKey]);

  useRealtimeTable("quotes", { shopId: activeShopId, onChange: fetchQuotes });

  const isLimitReached = isEntryPlan && monthlyUsed >= limits.maxQuotesPerMonth;

  const handleNewQuote = async () => {
    if (isEntryPlan) {
      const canCreate = await checkQuoteLimit();
      if (!canCreate) {
        setShowLimitModal(true);
        return;
      }
    }
    navigate("/quotes/new");
  };

  const duplicateQuote = async (q: any) => {
    if (isEntryPlan) {
      const canCreate = await checkQuoteLimit();
      if (!canCreate) { setShowLimitModal(true); return; }
    }
    const shopId = localStorage.getItem("garageflow_active_shop");
    if (!shopId) return;
    const { data: nextNum } = await supabase.rpc('next_number', { _shop_id: shopId, _prefix: 'ORC' });
    const { error } = await supabase.from("quotes").insert({
      shop_id: shopId, number: nextNum || `ORC-COPY`, client_id: q.client_id, vehicle_id: q.vehicle_id,
      lines: q.lines, labor_hours: q.labor_hours || 0, notes: q.notes, subtotal: q.subtotal, vat_total: q.vat_total,
      total: q.total, cost_total: q.cost_total, profit: q.profit, status: 'draft',
    });
    if (error) { toastError(error, "Não foi possível duplicar o orçamento"); return; }
    toast.success(t('quotes.duplicated'));
    fetchQuotes();
  };

  const convertToService = async (quote: any) => {
    if (quote.status === 'converted') return;
    setConverting(quote.id);
    const shopId = localStorage.getItem("garageflow_active_shop");
    if (!shopId) { toast.error(t('common.configureShop')); setConverting(null); return; }
    const { data: countData } = await supabase.from("work_orders").select("id", { count: "exact" }).eq("shop_id", shopId);
    const num = `SRV-${String((countData?.length || 0) + 1).padStart(4, '0')}`;
    // Enviar ≠ Aprovar: só um orçamento efetivamente aprovado pelo cliente autoriza a execução.
    // Orçamentos em rascunho/enviados geram uma OS que fica a aguardar aprovação.
    const clientApproved = quote.status === 'approved';
    const { error: insertError } = await supabase.from("work_orders").insert({
      shop_id: shopId, number: num, origin: 'quote', quote_id: quote.id,
      client_id: quote.client_id, vehicle_id: quote.vehicle_id, entry_mileage: 0,
      lines: quote.lines, labor_hours: quote.labor_hours || 0, subtotal: quote.subtotal, vat_total: quote.vat_total,
      total: quote.total, cost_total: quote.cost_total, profit: quote.profit,
      status: clientApproved ? 'approved' : 'waiting_approval', notes: quote.notes,
    });
    if (insertError) { toastError(insertError, "Não foi possível converter em serviço"); setConverting(null); return; }
    // Só marcamos como 'converted' quando o cliente já aprovou — caso contrário o orçamento
    // continua no pipeline (rascunho/enviado) até haver decisão do cliente.
    if (clientApproved) {
      await supabase.from("quotes").update({ status: 'converted' }).eq("id", quote.id);
    }
    toast.success(clientApproved ? t('quotes.converted') : 'Serviço criado — aguarda aprovação do cliente');
    setConverting(null);
    fetchQuotes();
  };


  const sendQuoteEmail = async (q: any) => {
    const clientEmail = (q.clients as any)?.email;
    if (!clientEmail) { toast.error(t('quotes.noClientEmail')); return; }
    // Evita falhas silenciosas do provedor de email com endereços mal formados.
    if (!isValidEmail(clientEmail)) { toast.error(`Email inválido: ${clientEmail}`); return; }
    if (!shop) return;
    setSendingEmail(q.id);
    try {
      const lines = (Array.isArray(q.lines) ? q.lines : []) as any[];
      const vehicleInfo = `${(q.vehicles as any)?.make} ${(q.vehicles as any)?.model} — ${(q.vehicles as any)?.plate}`;
      const lang = shop.language || 'pt';
      const langLabels: Record<string, string> = { pt: 'Orçamento', en: 'Quote', es: 'Presupuesto' };
      const isResolved = ['approved', 'converted', 'rejected', 'expired'].includes(q.status);
      // Only include approval link when the quote is still actionable — never on resolved quotes.
      const approvalUrl = !isResolved && q.token && canUseFeature('quoteApproval') ? `${window.location.origin}/quote/${q.token}` : undefined;
      // Reflect the resolved state in the subject so the recipient sees it immediately.
      const subjectPrefix: Record<string, Record<string, string>> = {
        pt: { approved: '✅ Aprovado — ', converted: '✅ Aprovado — ', rejected: '❌ Rejeitado — ', expired: '⌛ Expirado — ' },
        en: { approved: '✅ Approved — ', converted: '✅ Approved — ', rejected: '❌ Rejected — ', expired: '⌛ Expired — ' },
        es: { approved: '✅ Aprobado — ', converted: '✅ Aprobado — ', rejected: '❌ Rechazado — ', expired: '⌛ Expirado — ' },
      };
      const prefix = (subjectPrefix[lang] || subjectPrefix.pt)[q.status] || '';
      const subject = `${prefix}${langLabels[lang] || langLabels.pt} ${q.number} — ${shop.name}`;
      const html = quoteEmailHtml({
        shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone, shopNif: shop.nif,
        shopAddress: shop.address, shopLogoUrl: shop.logo_url, clientName: (q.clients as any)?.name || '',
        quoteNumber: q.number, quoteDate: q.date || formatLocalDate(q.created_at),
        validityDate: q.validity_date, lines, subtotal: q.subtotal, vatTotal: q.vat_total, total: q.total,
        currency: shop.currency || 'EUR', vehicleInfo, notes: q.notes, approvalUrl, lang,
        status: q.status,
        // Mesmo cálculo usado na app e na página pública do orçamento.
        estimatedTime: totalEstMinutes(lines, Number(q.labor_hours) || 0) > 0
          ? formatDuration(totalEstMinutes(lines, Number(q.labor_hours) || 0))
          : undefined,
      });
      await sendEmail({ to: clientEmail, subject, html });
      // Log email send
      const activeId = localStorage.getItem("garageflow_active_shop");
      if (activeId) {
        await supabase.from("email_logs").insert({
          shop_id: activeId, to_email: clientEmail, subject, status: 'sent',
          entity_type: 'quote', entity_id: q.id,
        });
      }
      if (q.status === 'draft') await supabase.from("quotes").update({ status: 'sent' }).eq("id", q.id);
      toast.success(t('quotes.emailSent'));
      fetchQuotes();
    } catch (err: any) {
      console.error('Email error:', err);
      // Log email failure
      const activeId = localStorage.getItem("garageflow_active_shop");
      if (activeId) {
        await supabase.from("email_logs").insert({
          shop_id: activeId, to_email: clientEmail, subject: `${q.number} — email failed`, status: 'failed',
          error_message: err.message, entity_type: 'quote', entity_id: q.id,
        });
      }
      toast.error(err?.message ? `${t('quotes.emailError')}: ${err.message}` : t('quotes.emailError'));
    }
    finally { setSendingEmail(null); }
  };

  /**
   * Gera o jsPDF do orçamento a partir do estado atual da linha da lista.
   * Partilhado por `downloadPdf` (guarda no disco) e pelo botão WhatsApp
   * (converte para Blob e envia como anexo real via Web Share / download
   * automático em desktop — paridade com o email, que já envia o PDF).
   */
  const buildQuotePdfDoc = async (q: any) => {
    if (!shop) throw new Error('shop_not_loaded');
    const lines = (Array.isArray(q.lines) ? q.lines : []) as any[];
    return generatePdf({
      type: 'quote', number: q.number, date: q.date || formatLocalDate(q.created_at),
      validityDate: q.validity_date, shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone,
      shopNif: shop.nif, shopAddress: shop.address, shopLogoUrl: shop.logo_url,
      clientName: (q.clients as any)?.name || '', clientEmail: (q.clients as any)?.email,
      clientPhone: (q.clients as any)?.phone, clientNif: (q.clients as any)?.nif,
      vehicleMake: (q.vehicles as any)?.make || '', vehicleModel: (q.vehicles as any)?.model || '',
      vehiclePlate: (q.vehicles as any)?.plate || '', lines, subtotal: q.subtotal, vatTotal: q.vat_total,
      total: q.total, profit: q.profit, notes: q.notes, currency: shop.currency || 'EUR', plan: plan,
      laborHours: q.labor_hours, laborRate: shop.labor_rate,
    }, limits.pdfWatermark);
  };

  const downloadPdf = async (q: any) => {
    if (!shop) {
      toast.error("Dados da oficina não carregados. Recarregue a página.");
      return;
    }
    try {
      const doc = await buildQuotePdfDoc(q);
      doc.save(`${q.number}.pdf`);
    } catch (err: any) {
      console.error('PDF error', err);
      toast.error(`Falha a gerar PDF: ${err?.message || err}`);
    }
  };

  /** Devolve o PDF do orçamento como Blob para partilha (WhatsApp). Não bloqueia se falhar — o WhatsApp abre na mesma com a mensagem. */
  const buildQuotePdfBlob = async (q: any): Promise<{ blob: Blob; filename: string } | null> => {
    try {
      const doc = await buildQuotePdfDoc(q);
      return { blob: doc.output('blob'), filename: `${q.number}.pdf` };
    } catch (err) {
      console.warn('[quotes] pdf blob build failed', err);
      return null;
    }
  };

  const sendQuoteWhatsApp = async (q: any) => {
    const phone = (q.clients as any)?.phone;
    if (!phone) { toast.error(t('quotes.noClientPhone') || 'Cliente sem telefone'); return; }
    const isResolved = ['approved', 'converted', 'rejected', 'expired'].includes(q.status);
    const approvalUrl = !isResolved && q.token ? `${window.location.origin}/quote/${q.token}` : undefined;
    const pdf = await buildQuotePdfBlob(q);
    openWhatsApp({
      phone,
      clientName: (q.clients as any)?.name,
      type: 'quote',
      number: q.number,
      plate: (q.vehicles as any)?.plate,
      link: approvalUrl,
      pdfBlob: pdf?.blob ?? null,
      pdfFilename: pdf?.filename,
      quoteStatus: q.status,
      total: q.total,
    });
  };

  const handleExportCsv = async () => {
    if (!activeShopId) return;
    const { data: all } = await supabase
      .from("quotes")
      .select("*, clients(name), vehicles(make, model, plate)")
      .eq("shop_id", activeShopId)
      .order("created_at", { ascending: false })
      .limit(5000);
    const csvData = (all || []).map((q: any) => ({
      Número: q.number, Cliente: (q.clients as any)?.name,
      Veículo: `${(q.vehicles as any)?.make} ${(q.vehicles as any)?.model}`,
      Matrícula: (q.vehicles as any)?.plate, Status: q.status, Subtotal: q.subtotal,
      [getTaxLabel()]: q.vat_total, Total: q.total, Lucro: q.profit, Data: q.date, Validade: q.validity_date,
    }));
    exportToCsv(csvData, 'orcamentos');
    toast.success(t('common.exported'));
  };

  // Filtering, sorting and paging are handled by Postgres (useServerList).
  const filtered = quotes;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);

  // 'sent' num orçamento significa que foi enviado ao cliente e aguarda decisão —
  // mostramos "Aguarda aprovação" para não ser confundido com "aprovado".
  const getStatusLabel = (status: QuoteStatus) =>
    status === 'sent' ? t('status.awaitingApproval') : t(`status.${status}`);


  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('quotes.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalCount} {t('quotes.title').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          {isEntryPlan && limits.maxQuotesPerMonth !== Infinity && (
            <Badge variant="outline" className={isLimitReached ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted text-muted-foreground"}>
              {t('quotes.quotesUsed').replace('{used}', String(monthlyUsed)).replace('{limit}', String(limits.maxQuotesPerMonth))}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileDown className="w-4 h-4 mr-1" />CSV
          </Button>
          <Button onClick={handleNewQuote} disabled={isLimitReached}>
            <Plus className="w-4 h-4 mr-2" />{t('quotes.new')}
          </Button>
        </div>
      </div>

      {/* Limit reached banner */}
      {isLimitReached && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/30 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-destructive">{t('quotes.limitReached')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('quotes.limitMessage').replace('{limit}', String(limits.maxQuotesPerMonth))}
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("/billing")}>{t('quotes.upgrade')}</Button>
        </div>
      )}

      {/* Smart filters row */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 mb-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('quotes.search') || 'Pesquisar…'} value={search} onChange={e => updateFilter('search', e.target.value)} className="pl-9" />
        </div>
        <select value={filters.status} onChange={e => updateFilter('status', e.target.value)} className="h-10 px-3 rounded-md bg-background border border-input text-sm">
          <option value="all">Todos os estados</option>
          <option value="draft">{t('status.draft')}</option>
          <option value="sent">{t('status.awaitingApproval')}</option>
          <option value="approved">{t('status.approved')}</option>
          <option value="rejected">{t('status.rejected')}</option>
          <option value="expired">{t('status.expired')}</option>
          <option value="converted">{t('status.converted')}</option>
        </select>
        <select value={filters.clientId} onChange={e => updateFilter('clientId', e.target.value)} className="h-10 px-3 rounded-md bg-background border border-input text-sm">
          <option value="">Todos os clientes</option>
          {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <Input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} title="Data desde" />
        <div className="flex gap-1">
          <Input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} title="Data até" />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} title="Limpar filtros"><X className="w-4 h-4" /></Button>
          )}
        </div>
      </div>

      {/* Empty state CTA */}
      {dataLoading && quotes.length === 0 && (
        <ListSkeleton rows={5} />
      )}

      {!dataLoading && totalCount === 0 && (
        <div className="text-center py-10 sm:py-14 bg-card border-2 border-dashed border-primary/20 rounded-2xl mb-4">
          <span className="text-4xl sm:text-5xl block mb-3">📋</span>
          <h3 className="text-lg font-bold mb-1">{t('quotes.empty') || 'Ainda sem orçamentos'}</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
            {'Crie o seu primeiro orçamento e comece a gerar receita'}
          </p>
          <Button size="lg" onClick={handleNewQuote} disabled={isLimitReached} className="px-6">
            <Plus className="w-4 h-4 mr-2" />{t('quotes.new')}
          </Button>
        </div>
      )}

      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2">
        {totalCount > 0 && filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5">
            {t('quotes.noResults')}
          </div>
        ) : filtered.map(q => (
          <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium mono text-sm">{q.number}</span>
              <Badge variant="secondary" className={statusColors[q.status as QuoteStatus]}>
                {getStatusLabel(q.status as QuoteStatus)}
              </Badge>
            </div>
            <div>
              <p className="text-sm font-semibold">{(q.clients as any)?.name}</p>
              <p className="text-xs text-muted-foreground">{(q.vehicles as any)?.make} {(q.vehicles as any)?.model} — {(q.vehicles as any)?.plate}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <span className="text-sm font-semibold mono">{formatMoney(q.total)}</span>
                <span className="text-sm mono text-success">+{formatMoney(q.profit)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
              {!['converted'].includes(q.status) && (
                <Link to={`/quotes/edit/${q.id}`}>
                  <Button variant="ghost" size="sm" className="text-xs h-7"><Pencil className="w-3 h-3 mr-1" />{t('common.edit')}</Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={() => downloadPdf(q)} className="text-xs h-7">PDF</Button>
              {q.token && canUseFeature('quoteApproval') && !['converted', 'rejected', 'expired'].includes(q.status) && (
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={async () => {
                  const url = `${window.location.origin}/quote/${q.token}`;
                  try { await navigator.clipboard.writeText(url); toast.success('Link copiado'); }
                  catch { window.prompt('Copie o link:', url); }
                }}>
                  <Copy className="w-3 h-3 mr-1" />Link
                </Button>
              )}
              {!['converted', 'rejected', 'expired'].includes(q.status) && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => sendQuoteEmail(q)} disabled={sendingEmail === q.id} className="text-xs h-7">
                    {sendingEmail === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                    Email
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" onClick={() => sendQuoteWhatsApp(q)}>
                    <MessageCircle className="w-3 h-3 mr-1" />WhatsApp
                  </Button>
                </>
              )}
              {['draft', 'sent', 'approved'].includes(q.status) && (
                <Button variant="ghost" size="sm" onClick={() => convertToService(q)} disabled={converting === q.id} className="text-xs h-7">
                  <ArrowRightLeft className="w-3 h-3 mr-1" />{t('quotes.convert')}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => duplicateQuote(q)} className="text-xs h-7">
                <Copy className="w-3 h-3 mr-1" />{t('quotes.duplicate')}
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table view */}
      {totalCount > 0 && (
      <div className="hidden sm:block w-full min-w-0 bg-card border border-border rounded-xl overflow-hidden sticky-thead">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[9%]" />
            <col className="w-[20%]" />
            <col className="w-[19%]" />
            <col className="w-[9%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[23%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <SortableHeader sortKey="number" currentSort={sort} onToggle={toggleSort}>{t('quotes.number')}</SortableHeader>
              <SortableHeader sortKey="client" currentSort={sort} onToggle={toggleSort}>{t('quotes.client')}</SortableHeader>
              <SortableHeader sortKey="vehicle" currentSort={sort} onToggle={toggleSort} className="hidden md:table-cell">{t('quotes.vehicle')}</SortableHeader>
              <SortableHeader sortKey="total" currentSort={sort} onToggle={toggleSort}>{t('quotes.total')}</SortableHeader>
              <SortableHeader sortKey="profit" currentSort={sort} onToggle={toggleSort} className="hidden lg:table-cell">{t('quotes.profit')}</SortableHeader>
              <SortableHeader sortKey="status" currentSort={sort} onToggle={toggleSort}>{t('quotes.status')}</SortableHeader>
              <TableHead className="px-2 text-right">{t('common.actions') || 'Ações'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {t('quotes.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(q => (
              <TableRow key={q.id} className="hover:bg-muted/50">
                <TableCell className="px-3 py-3 font-medium mono">{q.number}</TableCell>
                <TableCell className="px-3 py-3 whitespace-normal break-words">{(q.clients as any)?.name}</TableCell>
                <TableCell className="hidden md:table-cell px-3 py-3 whitespace-normal">
                  <span className="break-words">{(q.vehicles as any)?.make} {(q.vehicles as any)?.model}</span>
                  <span className="mono text-xs text-muted-foreground ml-1 whitespace-nowrap">({(q.vehicles as any)?.plate})</span>
                </TableCell>
                <TableCell className="px-3 py-3 font-semibold mono">{formatMoney(q.total)}</TableCell>
                <TableCell className="hidden lg:table-cell px-3 py-3 mono text-success">{formatMoney(q.profit)}</TableCell>
                <TableCell className="px-3 py-3">
                  <Badge variant="secondary" className={statusColors[q.status as QuoteStatus]}>
                    {getStatusLabel(q.status as QuoteStatus)}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 py-3 text-right">
                  <div className="flex items-center gap-0.5 justify-end flex-nowrap">
                    {!['converted'].includes(q.status) && (
                      <Link to={`/quotes/edit/${q.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('common.edit') || 'Editar'} title={t('common.edit') || 'Editar'}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => downloadPdf(q)} title="PDF" aria-label="PDF">
                      <FileDown className="w-3.5 h-3.5" />
                    </Button>
                    {q.token && canUseFeature('quoteApproval') && !['converted', 'rejected', 'expired'].includes(q.status) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" title="Copiar link" aria-label="Copiar link" onClick={async () => {
                        const url = `${window.location.origin}/quote/${q.token}`;
                        try { await navigator.clipboard.writeText(url); toast.success('Link copiado'); }
                        catch { window.prompt('Copie o link:', url); }
                      }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {!['converted', 'rejected', 'expired'].includes(q.status) && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => sendQuoteEmail(q)} disabled={sendingEmail === q.id} title={t('quotes.sendEmail') || 'Email'} aria-label="Email">
                          {sendingEmail === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => sendQuoteWhatsApp(q)} title="WhatsApp" aria-label="WhatsApp">
                          <MessageCircle className="w-3.5 h-3.5" />
                        </Button>
                      </>
                    )}
                    {['draft', 'sent', 'approved'].includes(q.status) && (
                      <Button variant="default" size="icon" className="h-8 w-8" onClick={() => convertToService(q)} disabled={converting === q.id} title={t('quotes.convert') || 'Converter em serviço'} aria-label={t('quotes.convert') || 'Converter'}>
                        {converting === q.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRightLeft className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    {['approved', 'converted'].includes(q.status) && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/invoices/new?from_quote=${q.id}`)} title={t('invoices.convertToInvoice') || 'Faturar'} aria-label="Faturar">
                        <Receipt className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateQuote(q)} title={t('quotes.duplicate') || 'Duplicar'} aria-label={t('quotes.duplicate') || 'Duplicar'}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}

      <TablePagination page={safePage} totalPages={totalPages} total={totalCount} pageSize={PAGE_SIZE} start={safePage * PAGE_SIZE} onPageChange={setPage} labelOf={t('common.of') || 'de'} />

      {/* Upgrade Modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('quotes.limitReached')}
            </DialogTitle>
            <DialogDescription>
              {t('quotes.limitMessage').replace('{limit}', String(limits.maxQuotesPerMonth))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimitModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => { setShowLimitModal(false); navigate("/billing"); }}>{t('quotes.upgrade')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
