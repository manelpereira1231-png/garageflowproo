import { useState, useEffect } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ArrowRightLeft, FileDown, Pencil, Mail, Loader2, ChevronLeft, ChevronRight, AlertTriangle, Copy, Receipt, MessageCircle } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { QuoteStatus } from "@/types/garage";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { toastError } from "@/lib/errorMessages";
import { generatePdf, exportToCsv } from "@/lib/pdfGenerator";
import { formatLocalDate } from "@/lib/marketPrice";
import { sendEmail, quoteEmailHtml } from "@/lib/emailService";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import ListSkeleton from "@/components/ListSkeleton";
import { pageCache } from "@/lib/pageCache";

const statusColors: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  converted: "bg-primary/10 text-primary",
};

const PAGE_SIZE = 25;

export default function Quotes() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { limits, plan, shopId, checkQuoteLimit, canUseFeature } = useSubscription();
  const _shopInit = typeof window !== "undefined" ? localStorage.getItem("garageflow_active_shop") : null;
  const _qCache = pageCache.get<{ rows: any[]; count: number; shop: any }>(`quotes:${_shopInit}:0`);
  const [quotes, setQuotes] = useState<any[]>(_qCache?.rows ?? []);
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [shop, setShop] = useState<any>(_qCache?.shop ?? null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(_qCache?.count ?? 0);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [dataLoading, setDataLoading] = useState(!_qCache);

  const activeShopId = useActiveShopId();

  const fetchQuotes = async () => {
    if (!activeShopId) { setDataLoading(false); return; }
    const key = `quotes:${activeShopId}:${page}`;
    const cc = pageCache.get<{ rows: any[]; count: number; shop: any }>(key);
    if (cc) {
      setQuotes(cc.rows); setTotalCount(cc.count); setShop(cc.shop); setDataLoading(false);
    } else {
      setDataLoading(true);
    }
    try {
      const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeShopId).maybeSingle();
      if (shopData) setShop(shopData);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await supabase
        .from("quotes")
        .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)", { count: "exact" })
        .eq("shop_id", activeShopId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (data) setQuotes(data);
      if (count !== null) setTotalCount(count);
      pageCache.set(key, { rows: data ?? [], count: count ?? 0, shop: shopData ?? null });

      if (limits.maxQuotesPerMonth !== Infinity) {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const { count: monthCount } = await supabase
          .from("quotes")
          .select("id", { count: "exact", head: true })
          .eq("shop_id", activeShopId)
          .gte("created_at", monthStart);
        setMonthlyUsed(monthCount || 0);
      }
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { fetchQuotes(); }, [page, limits.maxQuotesPerMonth, activeShopId]);

  const isLimitReached = plan === 'free' && monthlyUsed >= limits.maxQuotesPerMonth;

  const handleNewQuote = async () => {
    if (plan === 'free') {
      const canCreate = await checkQuoteLimit();
      if (!canCreate) {
        setShowLimitModal(true);
        return;
      }
    }
    navigate("/quotes/new");
  };

  const duplicateQuote = async (q: any) => {
    if (plan === 'free') {
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
    const { error: insertError } = await supabase.from("work_orders").insert({
      shop_id: shopId, number: num, origin: 'quote', quote_id: quote.id,
      client_id: quote.client_id, vehicle_id: quote.vehicle_id, entry_mileage: 0,
      lines: quote.lines, labor_hours: quote.labor_hours || 0, subtotal: quote.subtotal, vat_total: quote.vat_total,
      total: quote.total, cost_total: quote.cost_total, profit: quote.profit, status: 'approved', notes: quote.notes,
    });
    if (insertError) { toastError(insertError, "Não foi possível converter em serviço"); setConverting(null); return; }
    await supabase.from("quotes").update({ status: 'converted' }).eq("id", quote.id);
    toast.success(t('quotes.converted'));
    setConverting(null);
    fetchQuotes();
  };

  const sendQuoteEmail = async (q: any) => {
    const clientEmail = (q.clients as any)?.email;
    if (!clientEmail) { toast.error(t('quotes.noClientEmail')); return; }
    if (!shop) return;
    setSendingEmail(q.id);
    try {
      const lines = (Array.isArray(q.lines) ? q.lines : []) as any[];
      const vehicleInfo = `${(q.vehicles as any)?.make} ${(q.vehicles as any)?.model} — ${(q.vehicles as any)?.plate}`;
      const approvalUrl = q.token && canUseFeature('quoteApproval') ? `${window.location.origin}/quote/${q.token}` : undefined;
      const lang = shop.language || 'pt';
      const langLabels: Record<string, string> = { pt: 'Orçamento', en: 'Quote', es: 'Presupuesto' };
      const subject = `${langLabels[lang] || langLabels.pt} ${q.number} — ${shop.name}`;
      const html = quoteEmailHtml({
        shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone, shopNif: shop.nif,
        shopAddress: shop.address, shopLogoUrl: shop.logo_url, clientName: (q.clients as any)?.name || '',
        quoteNumber: q.number, quoteDate: q.date || formatLocalDate(q.created_at),
        validityDate: q.validity_date, lines, subtotal: q.subtotal, vatTotal: q.vat_total, total: q.total,
        currency: shop.currency || 'EUR', vehicleInfo, notes: q.notes, approvalUrl, lang,
        status: q.status,
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
      toast.error(t('quotes.emailError'));
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
    const approvalUrl = q.token ? `${window.location.origin}/quote/${q.token}` : undefined;
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
    });
  };

  const handleExportCsv = () => {
    const csvData = quotes.map(q => ({
      Número: q.number, Cliente: (q.clients as any)?.name,
      Veículo: `${(q.vehicles as any)?.make} ${(q.vehicles as any)?.model}`,
      Matrícula: (q.vehicles as any)?.plate, Status: q.status, Subtotal: q.subtotal,
      IVA: q.vat_total, Total: q.total, Lucro: q.profit, Data: q.date, Validade: q.validity_date,
    }));
    exportToCsv(csvData, 'orcamentos');
    toast.success(t('common.exported'));
  };

  const filtered = quotes.filter(q =>
    q.number?.toLowerCase().includes(search.toLowerCase()) ||
    (q.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusLabel = (status: QuoteStatus) => t(`status.${status}`);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('quotes.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalCount} {t('quotes.title').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          {plan === 'free' && limits.maxQuotesPerMonth !== Infinity && (
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('quotes.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                <span className="text-sm font-semibold mono">€{q.total?.toFixed(2)}</span>
                <span className="text-sm mono text-success">+€{q.profit?.toFixed(2)}</span>
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
      <div className="hidden sm:block bg-card border border-border rounded-xl overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap">{t('quotes.number')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('quotes.client')}</TableHead>
              <TableHead className="hidden md:table-cell whitespace-nowrap">{t('quotes.vehicle')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('quotes.total')}</TableHead>
              <TableHead className="hidden lg:table-cell whitespace-nowrap">{t('quotes.profit')}</TableHead>
              <TableHead className="whitespace-nowrap">{t('quotes.status')}</TableHead>
              <TableHead className="whitespace-nowrap text-right">{t('common.actions') || 'Ações'}</TableHead>
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
                <TableCell className="font-medium mono whitespace-nowrap">{q.number}</TableCell>
                <TableCell className="whitespace-nowrap">{(q.clients as any)?.name}</TableCell>
                <TableCell className="hidden md:table-cell whitespace-nowrap">{(q.vehicles as any)?.make} {(q.vehicles as any)?.model} — <span className="mono">{(q.vehicles as any)?.plate}</span></TableCell>
                <TableCell className="font-semibold mono whitespace-nowrap">€{q.total?.toFixed(2)}</TableCell>
                <TableCell className="hidden lg:table-cell mono text-success whitespace-nowrap">€{q.profit?.toFixed(2)}</TableCell>
                <TableCell className="whitespace-nowrap">
                  <Badge variant="secondary" className={statusColors[q.status as QuoteStatus]}>
                    {getStatusLabel(q.status as QuoteStatus)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1 min-w-[280px]">
                    {!['converted'].includes(q.status) && (
                      <Link to={`/quotes/edit/${q.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Pencil className="w-3.5 h-3.5 mr-1" />{t('common.edit')}
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => downloadPdf(q)} className="text-xs">PDF</Button>
                    {q.token && canUseFeature('quoteApproval') && !['converted', 'rejected', 'expired'].includes(q.status) && (
                      <Button variant="ghost" size="sm" className="text-xs" onClick={async () => {
                        const url = `${window.location.origin}/quote/${q.token}`;
                        try { await navigator.clipboard.writeText(url); toast.success('Link copiado'); }
                        catch { window.prompt('Copie o link:', url); }
                      }}>
                        <Copy className="w-3.5 h-3.5 mr-1" />Link
                      </Button>
                    )}
                    {!['converted', 'rejected', 'expired'].includes(q.status) && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => sendQuoteEmail(q)} disabled={sendingEmail === q.id} className="text-xs">
                          {sendingEmail === q.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                          {sendingEmail === q.id ? t('quotes.sending') : t('quotes.sendEmail')}
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => sendQuoteWhatsApp(q)}>
                          <MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp
                        </Button>
                      </>
                    )}
                    {['draft', 'sent', 'approved'].includes(q.status) && (
                      <Button variant="ghost" size="sm" onClick={() => convertToService(q)} disabled={converting === q.id} className="text-xs">
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                        {converting === q.id ? t('quotes.converting') : t('quotes.convert')}
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => duplicateQuote(q)} className="text-xs" title={t('quotes.duplicate')}>
                      <Copy className="w-3.5 h-3.5 mr-1" />{t('quotes.duplicate')}
                    </Button>
                    {['approved', 'converted'].includes(q.status) && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/invoices/new?from_quote=${q.id}`)} className="text-xs">
                        <Receipt className="w-3.5 h-3.5 mr-1" />{t('invoices.convertToInvoice')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} {t('common.of')} {totalCount}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

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
