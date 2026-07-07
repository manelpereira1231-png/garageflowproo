import { useState, useEffect } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileDown, Eye, ChevronLeft, ChevronRight, Receipt, MessageCircle, FileArchive, Loader2 } from "lucide-react";
import { openWhatsApp } from "@/lib/whatsapp";
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

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
};

const PAGE_SIZE = 25;

export default function Invoices() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const _shopInit = typeof window !== "undefined" ? localStorage.getItem("garageflow_active_shop") : null;
  const _iCache = pageCache.get<{ rows: any[]; count: number; shop: any }>(`invoices:${_shopInit}:0`);
  const [invoices, setInvoices] = useState<any[]>(_iCache?.rows ?? []);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(_iCache?.count ?? 0);
  const [shop, setShop] = useState<any>(_iCache?.shop ?? null);
  const [dataLoading, setDataLoading] = useState(!_iCache);

  const activeShopId = useActiveShopId();

  const fetchInvoices = async () => {
    if (!activeShopId) { setDataLoading(false); return; }
    const key = `invoices:${activeShopId}:${page}`;
    const cc = pageCache.get<{ rows: any[]; count: number; shop: any }>(key);
    if (cc) {
      setInvoices(cc.rows); setTotalCount(cc.count); setShop(cc.shop); setDataLoading(false);
    } else {
      setDataLoading(true);
    }
    try {
      const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeShopId).maybeSingle();
      if (shopData) setShop(shopData);

      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, count } = await supabase
        .from("invoices")
        .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)", { count: "exact" })
        .eq("shop_id", activeShopId)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (data) setInvoices(data);
      if (count !== null) setTotalCount(count);
      pageCache.set(key, { rows: data ?? [], count: count ?? 0, shop: shopData ?? null });
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [page, activeShopId]);

  const filtered = invoices.filter(inv =>
    inv.number?.toLowerCase().includes(search.toLowerCase()) ||
    (inv.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
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

  const sendInvoiceOnWhatsApp = async (inv: any) => {
    const phone = (inv.clients as any)?.phone;
    if (!phone) { toast.error(t('quotes.noClientPhone')); return; }
    let pdfBlob: Blob | null = null;
    try {
      if (shop) {
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
        pdfBlob = doc.output('blob');
      }
    } catch (err) {
      console.warn('[invoices] pdf generation failed for whatsapp', err);
      toast.error('Não foi possível gerar o PDF, a enviar apenas a mensagem.');
    }
    await openWhatsApp({
      phone,
      clientName: (inv.clients as any)?.name,
      type: 'invoice',
      number: inv.number,
      plate: (inv.vehicles as any)?.plate,
      pdfBlob,
      pdfFilename: `${inv.number}.pdf`,
    });
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

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('invoices.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
              <Button variant="ghost" size="sm" className="text-xs h-7 text-green-600" onClick={() => sendInvoiceOnWhatsApp(inv)}>
                <MessageCircle className="w-3 h-3 mr-1" />WhatsApp
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
              <TableHead>{t('invoices.number')}</TableHead>
              <TableHead>{t('invoices.client')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('invoices.vehicle')}</TableHead>
              <TableHead>{t('invoices.total')}</TableHead>
              <TableHead className="hidden md:table-cell">{t('invoices.dueDate')}</TableHead>
              <TableHead>Legal</TableHead>
              <TableHead>{t('invoices.status')}</TableHead>
              <TableHead></TableHead>
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
                <TableCell className="font-medium mono">{inv.number}</TableCell>
                <TableCell>{(inv.clients as any)?.name}</TableCell>
                <TableCell className="hidden md:table-cell">
                  {(inv.vehicles as any) ? `${(inv.vehicles as any)?.make} ${(inv.vehicles as any)?.model} — ${(inv.vehicles as any)?.plate}` : '—'}
                </TableCell>
                <TableCell className="font-semibold mono">{cur}{inv.total?.toFixed(2)}</TableCell>
                <TableCell className="hidden md:table-cell">{inv.due_date || '—'}</TableCell>
                <TableCell>
                  <CertifiedBadge legalStatus={inv.legal_status} atcud={inv.atcud} series={inv.certified_series} />
                </TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[inv.status] || ''}>
                    {t(`invoices.status_${inv.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Link to={`/invoices/${inv.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <Eye className="w-3.5 h-3.5 mr-1" />{t('common.view')}
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" className="text-xs text-green-600 hover:text-green-700 hover:bg-green-50" onClick={(e) => {
                      e.preventDefault();
                      const phone = (inv.clients as any)?.phone;
                      if (!phone) { toast.error(t('quotes.noClientPhone')); return; }
                      openWhatsApp({ phone, clientName: (inv.clients as any)?.name, type: 'invoice', number: inv.number, plate: (inv.vehicles as any)?.plate });
                    }}>
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />WhatsApp
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
