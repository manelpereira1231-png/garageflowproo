import { useState, useEffect } from "react";
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
import { generatePdf, exportToCsv } from "@/lib/pdfGenerator";
import { sendEmail, quoteEmailHtml } from "@/lib/emailService";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

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
  const [quotes, setQuotes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [shop, setShop] = useState<any>(null);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [monthlyUsed, setMonthlyUsed] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);

  const fetchQuotes = async () => {
    const activeId = localStorage.getItem("garageflow_active_shop");
    if (!activeId) return;
    const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeId).maybeSingle();
    if (shopData) setShop(shopData);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("quotes")
      .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)", { count: "exact" })
      .eq("shop_id", activeId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data) setQuotes(data);
    if (count !== null) setTotalCount(count);

    // Count monthly quotes for limit display
    if (limits.maxQuotesPerMonth !== Infinity) {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { count: monthCount } = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", activeId)
        .gte("created_at", monthStart);
      setMonthlyUsed(monthCount || 0);
    }
  };

  useEffect(() => { fetchQuotes(); }, [page, limits.maxQuotesPerMonth]);

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
      lines: q.lines, notes: q.notes, subtotal: q.subtotal, vat_total: q.vat_total,
      total: q.total, cost_total: q.cost_total, profit: q.profit, status: 'draft',
    });
    if (error) { toast.error(error.message); return; }
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
      lines: quote.lines, labor_hours: 0, subtotal: quote.subtotal, vat_total: quote.vat_total,
      total: quote.total, cost_total: quote.cost_total, profit: quote.profit, status: 'approved', notes: quote.notes,
    });
    if (insertError) { toast.error(insertError.message); setConverting(null); return; }
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
      const approvalUrl = q.token && canUseFeature('quoteApproval') ? `https://garageflow.pt/quote/${q.token}` : undefined;
      const lang = shop.language || 'pt';
      const langLabels: Record<string, string> = { pt: 'Orçamento', en: 'Quote', es: 'Presupuesto' };
      const subject = `${langLabels[lang] || langLabels.pt} ${q.number} — ${shop.name}`;
      const html = quoteEmailHtml({
        shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone, shopNif: shop.nif,
        shopAddress: shop.address, shopLogoUrl: shop.logo_url, clientName: (q.clients as any)?.name || '',
        quoteNumber: q.number, quoteDate: q.date || new Date(q.created_at).toLocaleDateString('pt-PT'),
        validityDate: q.validity_date, lines, subtotal: q.subtotal, vatTotal: q.vat_total, total: q.total,
        currency: shop.currency || 'EUR', vehicleInfo, notes: q.notes, approvalUrl, lang,
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

  const downloadPdf = async (q: any) => {
    if (!shop) return;
    const lines = (Array.isArray(q.lines) ? q.lines : []) as any[];
    const doc = await generatePdf({
      type: 'quote', number: q.number, date: q.date || new Date(q.created_at).toLocaleDateString('pt-PT'),
      validityDate: q.validity_date, shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone,
      shopNif: shop.nif, shopAddress: shop.address, shopLogoUrl: shop.logo_url,
      clientName: (q.clients as any)?.name || '', clientEmail: (q.clients as any)?.email,
      clientPhone: (q.clients as any)?.phone, clientNif: (q.clients as any)?.nif,
      vehicleMake: (q.vehicles as any)?.make || '', vehicleModel: (q.vehicles as any)?.model || '',
      vehiclePlate: (q.vehicles as any)?.plate || '', lines, subtotal: q.subtotal, vatTotal: q.vat_total,
      total: q.total, profit: q.profit, notes: q.notes, currency: shop.currency || 'EUR', plan: plan,
    }, limits.pdfWatermark);
    doc.save(`${q.number}.pdf`);
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

      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5">
            {totalCount === 0 ? t('quotes.empty') : t('quotes.noResults')}
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
              {!['converted', 'rejected', 'expired'].includes(q.status) && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => sendQuoteEmail(q)} disabled={sendingEmail === q.id} className="text-xs h-7">
                    {sendingEmail === q.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}
                    Email
                  </Button>
                  <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" onClick={() => {
                    const phone = (q.clients as any)?.phone;
                    if (!phone) { toast.error(t('quotes.noClientPhone') || 'Cliente sem telefone'); return; }
                    const approvalUrl = q.token ? `https://garageflow.pt/quote/${q.token}` : undefined;
                    openWhatsApp({ phone, clientName: (q.clients as any)?.name, type: 'quote', number: q.number, plate: (q.vehicles as any)?.plate, link: approvalUrl });
                  }}>
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
      <div className="hidden sm:block bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('quotes.number')}</TableHead>
              <TableHead>{t('quotes.client')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('quotes.vehicle')}</TableHead>
              <TableHead>{t('quotes.total')}</TableHead>
              <TableHead className="hidden lg:table-cell">{t('quotes.profit')}</TableHead>
              <TableHead>{t('quotes.status')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {totalCount === 0 ? t('quotes.empty') : t('quotes.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(q => (
              <TableRow key={q.id} className="hover:bg-muted/50">
                <TableCell className="font-medium mono">{q.number}</TableCell>
                <TableCell>{(q.clients as any)?.name}</TableCell>
                <TableCell className="hidden md:table-cell">{(q.vehicles as any)?.make} {(q.vehicles as any)?.model} — <span className="mono">{(q.vehicles as any)?.plate}</span></TableCell>
                <TableCell className="font-semibold mono">€{q.total?.toFixed(2)}</TableCell>
                <TableCell className="hidden lg:table-cell mono text-success">€{q.profit?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[q.status as QuoteStatus]}>
                    {getStatusLabel(q.status as QuoteStatus)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!['converted'].includes(q.status) && (
                      <Link to={`/quotes/edit/${q.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Pencil className="w-3.5 h-3.5 mr-1" />{t('common.edit')}
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => downloadPdf(q)} className="text-xs">PDF</Button>
                    {!['converted', 'rejected', 'expired'].includes(q.status) && (
                      <Button variant="ghost" size="sm" onClick={() => sendQuoteEmail(q)} disabled={sendingEmail === q.id} className="text-xs">
                        {sendingEmail === q.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                        {sendingEmail === q.id ? t('quotes.sending') : t('quotes.sendEmail')}
                      </Button>
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

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
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
