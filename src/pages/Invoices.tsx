import { useState, useEffect } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileDown, Eye, Receipt, MessageCircle, FileArchive, Loader2, Mail, X } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
import { sendEmail } from "@/lib/emailService";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/pdfGenerator";
import { generateInvoicePdf } from "@/lib/invoicePdfGenerator";
import { getCurrencySymbol, getTaxLabelLocal } from "@/lib/marketPrice";
import { useSubscription } from "@/hooks/useSubscription";
import ListSkeleton from "@/components/ListSkeleton";
import CertifiedBadge from "@/components/CertifiedBadge";
import { pageCache } from "@/lib/pageCache";
import { useTableState } from "@/hooks/useTableState";
import { SortableHeader } from "@/components/table/SortableHeader";
import { TablePagination } from "@/components/table/TablePagination";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
};

const PAGE_SIZE = 50;
const FETCH_LIMIT = 2000;

type InvoicesFilters = { search: string; status: string; clientId: string; dateFrom: string; dateTo: string; minTotal: string; maxTotal: string };
const defaultInvoicesFilters: InvoicesFilters = { search: "", status: "all", clientId: "", dateFrom: "", dateTo: "", minTotal: "", maxTotal: "" };

export default function Invoices() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const _shopInit = typeof window !== "undefined" ? localStorage.getItem("garageflow_active_shop") : null;
  const _iCache = pageCache.get<{ rows: any[]; shop: any }>(`invoices-all:${_shopInit}`);
  const [invoices, setInvoices] = useState<any[]>(_iCache?.rows ?? []);
  const [shop, setShop] = useState<any>(_iCache?.shop ?? null);
  const [dataLoading, setDataLoading] = useState(!_iCache);

  const activeShopId = useActiveShopId();

  const table = useTableState<InvoicesFilters>({
    storageKey: "table:invoices",
    defaultFilters: defaultInvoicesFilters,
    defaultSort: { key: "created_at", dir: "desc" },
    pageSize: PAGE_SIZE,
  });
  const { filters, updateFilter, clearFilters, hasActiveFilters, sort, toggleSort, page, setPage, apply } = table;
  const search = filters.search;

  const fetchInvoices = async () => {
    if (!activeShopId) { setDataLoading(false); return; }
    const key = `invoices-all:${activeShopId}`;
    const cc = pageCache.get<{ rows: any[]; shop: any }>(key);
    if (cc) {
      setInvoices(cc.rows); setShop(cc.shop); setDataLoading(false);
    } else {
      setDataLoading(true);
    }
    try {
      const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeShopId).maybeSingle();
      if (shopData) setShop(shopData);

      const { data } = await supabase
        .from("invoices")
        .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)")
        .eq("shop_id", activeShopId)
        .order("created_at", { ascending: false })
        .limit(FETCH_LIMIT);
      if (data) setInvoices(data);
      pageCache.set(key, { rows: data ?? [], shop: shopData ?? null });
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [activeShopId]);

  const preFiltered = invoices.filter((inv) => {
    const s = filters.search.toLowerCase();
    if (s) {
      const hay = `${inv.number ?? ""} ${(inv.clients as any)?.name ?? ""} ${(inv.vehicles as any)?.plate ?? ""}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (filters.status !== "all" && inv.status !== filters.status) return false;
    if (filters.clientId && inv.client_id !== filters.clientId) return false;
    if (filters.dateFrom && new Date(inv.created_at) < new Date(filters.dateFrom)) return false;
    if (filters.dateTo && new Date(inv.created_at) > new Date(filters.dateTo + "T23:59:59")) return false;
    if (filters.minTotal && Number(inv.total) < Number(filters.minTotal)) return false;
    if (filters.maxTotal && Number(inv.total) > Number(filters.maxTotal)) return false;
    return true;
  });
  const view = apply(preFiltered, {
    number: (i) => i.number,
    created_at: (i) => new Date(i.created_at).getTime(),
    client: (i) => (i.clients as any)?.name || "",
    vehicle: (i) => `${(i.vehicles as any)?.make || ""} ${(i.vehicles as any)?.model || ""}`,
    total: (i) => Number(i.total) || 0,
    due_date: (i) => i.due_date || "",
    status: (i) => i.status,
  });
  const filtered = view.rows;
  const totalCount = invoices.length;

  const clientOptions: [string, string][] = Array.from(
    new Map(invoices.map((i) => [i.client_id, (i.clients as any)?.name]).filter(([id, n]) => id && n) as [string, string][]).entries()
  );

  const handleExportCsv = () => {
    const csvData = invoices.map(inv => ({
      Número: inv.number, Cliente: (inv.clients as any)?.name,
      Status: inv.status, Subtotal: inv.subtotal, [getTaxLabelLocal()]: inv.vat_total,
      Total: inv.total, Vencimento: inv.due_date, Data: inv.created_at?.slice(0, 10),
    }));
    exportToCsv(csvData, 'faturas');
    toast.success(t('common.exported'));
  };

  const [saftLoading, setSaftLoading] = useState(false);
  const handleExportSaft = async () => {
    if (!activeShopId) return;
    if (!confirm("Exportar SAF-T PT do ano atual?\n\nAviso: se emites faturas com InvoiceXpress, exporta o SAF-T oficial diretamente do InvoiceXpress — este ficheiro é apenas informativo e não substitui o SAF-T do provider certificado.")) return;
    setSaftLoading(true);
    try {
      const year = new Date().getFullYear();
      const { data, error } = await supabase.functions.invoke("export-saft", {
        body: { shop_id: activeShopId, year },
      });
      if (error) throw error;
      const xml = typeof data === "string" ? data : (data?.xml || "");
      if (!xml) throw new Error("SAF-T vazio");
      const blob = new Blob([xml], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `SAFT_${activeShopId}_${year}.xml`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("SAF-T exportado (informativo)");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao exportar SAF-T");
    } finally {
      setSaftLoading(false);
    }
  };

  const cur = getCurrencySymbol(shop?.currency);
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const { plan } = useSubscription();

  const buildInvoicePdfBlob = async (inv: any): Promise<Blob | null> => {
    if (!shop) return null;
    try {
      const { data: items } = await supabase
        .from("invoice_items")
        .select("*")
        .eq("invoice_id", inv.id)
        .order("created_at", { ascending: true });
      const doc = await generateInvoicePdf({
        invoice: inv,
        items: items || [],
        shop,
        clientName: (inv.clients as any)?.name || '',
        clientEmail: (inv.clients as any)?.email,
        clientPhone: (inv.clients as any)?.phone,
        clientNif: (inv.clients as any)?.nif,
        vehicleMake: (inv.vehicles as any)?.make,
        vehicleModel: (inv.vehicles as any)?.model,
        vehiclePlate: (inv.vehicles as any)?.plate,
        totalPaid: Number(inv.total_paid || 0),
        plan,
      });
      return doc.output('blob');
    } catch (err) {
      console.warn('[invoices] pdf generation failed', err);
      return null;
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const result = String(reader.result || "");
      const b64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(b64);
    };
    reader.readAsDataURL(blob);
  });

  const [sendingInvoice, setSendingInvoice] = useState<string | null>(null);

  const sendInvoiceOnWhatsApp = async (inv: any) => {
    const phone = (inv.clients as any)?.phone;
    if (!phone) { toast.error(t('quotes.noClientPhone')); return; }
    setSendingInvoice(inv.id);
    try {
      const pdfBlob = await buildInvoicePdfBlob(inv);
      if (!pdfBlob) { toast.error('Não foi possível gerar o PDF da fatura.'); return; }
      await openWhatsApp({
        phone,
        clientName: (inv.clients as any)?.name,
        type: 'invoice',
        number: inv.number,
        plate: (inv.vehicles as any)?.plate,
        pdfBlob,
        pdfFilename: `${inv.number}.pdf`,
      });
    } finally {
      setSendingInvoice(null);
    }
  };

  const sendInvoiceByEmail = async (inv: any) => {
    const email = (inv.clients as any)?.email;
    if (!email) { toast.error(t('quotes.noClientEmail') || 'Cliente sem email'); return; }
    if (!shop) { toast.error('Dados da oficina não carregados'); return; }
    setSendingInvoice(inv.id);
    try {
      const pdfBlob = await buildInvoicePdfBlob(inv);
      if (!pdfBlob) { toast.error('Não foi possível gerar o PDF da fatura.'); return; }
      const base64 = await blobToBase64(pdfBlob);
      const vehicle = `${(inv.vehicles as any)?.make || ''} ${(inv.vehicles as any)?.model || ''} — ${(inv.vehicles as any)?.plate || ''}`.trim();
      const subject = `Fatura ${inv.number} — ${shop.name}`;
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;color:#111">
          <h2 style="margin:0 0 12px">Fatura ${inv.number}</h2>
          <p>Olá ${(inv.clients as any)?.name || ''},</p>
          <p>Segue em anexo a sua fatura${vehicle ? ` referente a <strong>${vehicle}</strong>` : ''}.</p>
          <p><strong>Total:</strong> €${Number(inv.total || 0).toFixed(2)}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>
          <p style="color:#666;font-size:12px">${shop.name}${shop.phone ? ` · ${shop.phone}` : ''}${shop.email ? ` · ${shop.email}` : ''}</p>
        </div>`;
      await sendEmail({
        to: email,
        subject,
        html,
        attachments: [{ filename: `${inv.number}.pdf`, content: base64, content_type: 'application/pdf' }],
      });
      if (activeShopId) {
        await supabase.from("email_logs").insert({
          shop_id: activeShopId, to_email: email, subject, status: 'sent',
          entity_type: 'invoice', entity_id: inv.id,
        });
      }
      toast.success('Email enviado com o PDF em anexo.');
    } catch (err: any) {
      console.error('[invoices] email error', err);
      toast.error('Erro ao enviar email: ' + (err?.message || 'desconhecido'));
    } finally {
      setSendingInvoice(null);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('invoices.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {totalCount} {t('invoices.title').toLowerCase()} · <span className="text-success font-medium">Certificadas</span> têm valor fiscal · <span className="text-muted-foreground italic">Rascunhos</span> são internos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileDown className="w-4 h-4 mr-1" />CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportSaft} disabled={saftLoading} title="SAF-T PT (informativo)">
            {saftLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileArchive className="w-4 h-4 mr-1" />}
            SAF-T
          </Button>
          <Button onClick={() => navigate("/invoices/new")}>
            <Plus className="w-4 h-4 mr-2" />{t('invoices.new')}
          </Button>
        </div>
      </div>

      {/* Smart filters row */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-2 mb-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder={t('invoices.search') || 'Pesquisar…'} value={search} onChange={e => updateFilter('search', e.target.value)} className="pl-9" />
        </div>
        <select value={filters.status} onChange={e => updateFilter('status', e.target.value)} className="h-10 px-3 rounded-md bg-background border border-input text-sm">
          <option value="all">Todos os estados</option>
          <option value="draft">{t('invoices.status_draft')}</option>
          <option value="issued">{t('invoices.status_issued')}</option>
          <option value="paid">{t('invoices.status_paid')}</option>
          <option value="partial">{t('invoices.status_partial')}</option>
          <option value="cancelled">{t('invoices.status_cancelled')}</option>
        </select>
        <select value={filters.clientId} onChange={e => updateFilter('clientId', e.target.value)} className="h-10 px-3 rounded-md bg-background border border-input text-sm">
          <option value="">Todos os clientes</option>
          {clientOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
        <Input type="date" value={filters.dateFrom} onChange={e => updateFilter('dateFrom', e.target.value)} title="Data desde" />
        <Input type="date" value={filters.dateTo} onChange={e => updateFilter('dateTo', e.target.value)} title="Data até" />
        <div className="flex gap-1">
          <Input type="number" placeholder="Total min" value={filters.minTotal} onChange={e => updateFilter('minTotal', e.target.value)} />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} title="Limpar filtros"><X className="w-4 h-4" /></Button>
          )}
        </div>
      </div>

      {/* Mobile: Card view */}
      <div className="sm:hidden space-y-2">
        {dataLoading && invoices.length === 0 ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5">
            {totalCount === 0 ? t('invoices.empty') : t('invoices.noResults')}
          </div>
        ) : filtered.map(inv => (
          <div key={inv.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
            <Link to={`/invoices/${inv.id}`} className="block">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-medium mono text-sm">{inv.number}</span>
                <div className="flex items-center gap-1">
                  <CertifiedBadge legalStatus={inv.legal_status} atcud={inv.atcud} series={inv.certified_series} />
                  <Badge variant="secondary" className={statusColors[inv.status] || ''}>
                    {t(`invoices.status_${inv.status}`)}
                  </Badge>
                </div>
              </div>
              <p className="text-sm font-semibold">{(inv.clients as any)?.name}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="text-sm font-semibold mono text-foreground">{cur}{inv.total?.toFixed(2)}</span>
                <span>{inv.due_date || '—'}</span>
              </div>
            </Link>
            <div className="flex gap-1 pt-1 border-t border-border">
              <Link to={`/invoices/${inv.id}`} className="flex-1">
                <Button variant="ghost" size="sm" className="w-full text-xs h-7"><Eye className="w-3 h-3 mr-1" />{t('common.view')}</Button>
              </Link>
              <Button variant="ghost" size="sm" className="text-xs h-7" disabled={sendingInvoice === inv.id} onClick={() => sendInvoiceByEmail(inv)}>
                {sendingInvoice === inv.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Mail className="w-3 h-3 mr-1" />}Email
              </Button>
              <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" disabled={sendingInvoice === inv.id} onClick={() => sendInvoiceOnWhatsApp(inv)}>
                {sendingInvoice === inv.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <MessageCircle className="w-3 h-3 mr-1" />}WhatsApp
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop: Table view */}
      <div className="hidden sm:block w-full min-w-0 bg-card border border-border rounded-xl overflow-hidden">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-[10%]" />
            <col className="w-[22%]" />
            <col className="w-[22%]" />
            <col className="w-[10%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="px-3">{t('invoices.number')}</TableHead>
              <TableHead className="px-3">{t('invoices.client')}</TableHead>
              <TableHead className="hidden md:table-cell px-3">{t('invoices.vehicle')}</TableHead>
              <TableHead className="px-3">{t('invoices.total')}</TableHead>
              <TableHead className="hidden md:table-cell px-3">{t('invoices.dueDate')}</TableHead>
              <TableHead className="px-3">Legal</TableHead>
              <TableHead className="px-3">{t('invoices.status')}</TableHead>
              <TableHead className="px-2 text-right">{t('common.actions') || 'Ações'}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dataLoading && invoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  <span className="inline-block w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {totalCount === 0 ? t('invoices.empty') : t('invoices.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(inv => (
              <TableRow key={inv.id} className="hover:bg-muted/50">
                <TableCell className="px-3 py-3 font-medium mono">{inv.number}</TableCell>
                <TableCell className="px-3 py-3 whitespace-normal break-words">{(inv.clients as any)?.name}</TableCell>
                <TableCell className="hidden md:table-cell px-3 py-3 whitespace-normal">
                  {(inv.vehicles as any) ? (
                    <>
                      <span className="break-words">{(inv.vehicles as any)?.make} {(inv.vehicles as any)?.model}</span>
                      <span className="mono text-xs text-muted-foreground ml-1 whitespace-nowrap">({(inv.vehicles as any)?.plate})</span>
                    </>
                  ) : '—'}
                </TableCell>
                <TableCell className="px-3 py-3 font-semibold mono">{cur}{inv.total?.toFixed(2)}</TableCell>
                <TableCell className="hidden md:table-cell px-3 py-3 whitespace-nowrap">{inv.due_date || '—'}</TableCell>
                <TableCell className="px-3 py-3">
                  <CertifiedBadge legalStatus={inv.legal_status} atcud={inv.atcud} series={inv.certified_series} />
                </TableCell>
                <TableCell className="px-3 py-3">
                  <Badge variant="secondary" className={statusColors[inv.status] || ''}>
                    {t(`invoices.status_${inv.status}`)}
                  </Badge>
                </TableCell>
                <TableCell className="px-2 py-3 text-right">
                  <div className="flex items-center gap-0.5 justify-end flex-nowrap">
                    <Link to={`/invoices/${inv.id}`}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" title={t('common.view') || 'Ver'} aria-label={t('common.view') || 'Ver'}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={sendingInvoice === inv.id} onClick={(e) => { e.preventDefault(); sendInvoiceByEmail(inv); }} title="Email" aria-label="Email">
                      {sendingInvoice === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" disabled={sendingInvoice === inv.id} onClick={(e) => { e.preventDefault(); sendInvoiceOnWhatsApp(inv); }} title="WhatsApp" aria-label="WhatsApp">
                      {sendingInvoice === inv.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
                    </Button>
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
    </div>
  );
}
