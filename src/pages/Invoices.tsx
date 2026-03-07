import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileDown, Eye, ChevronLeft, ChevronRight, Receipt } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/pdfGenerator";

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
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [shop, setShop] = useState<any>(null);

  const fetchInvoices = async () => {
    const activeId = localStorage.getItem("garageflow_active_shop");
    if (!activeId) return;
    const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeId).maybeSingle();
    if (shopData) setShop(shopData);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, count } = await supabase
      .from("invoices")
      .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)", { count: "exact" })
      .eq("shop_id", activeId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data) setInvoices(data);
    if (count !== null) setTotalCount(count);
  };

  useEffect(() => { fetchInvoices(); }, [page]);

  const filtered = invoices.filter(inv =>
    inv.number?.toLowerCase().includes(search.toLowerCase()) ||
    (inv.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleExportCsv = () => {
    const csvData = invoices.map(inv => ({
      Número: inv.number, Cliente: (inv.clients as any)?.name,
      Status: inv.status, Subtotal: inv.subtotal, IVA: inv.vat_total,
      Total: inv.total, Vencimento: inv.due_date, Data: inv.created_at?.slice(0, 10),
    }));
    exportToCsv(csvData, 'faturas');
    toast.success(t('common.exported'));
  };

  const cur = shop?.currency === 'EUR' ? '€' : (shop?.currency || '€');
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('invoices.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalCount} {t('invoices.title').toLowerCase()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileDown className="w-4 h-4 mr-1" />CSV
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

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('invoices.number')}</TableHead>
              <TableHead>{t('invoices.client')}</TableHead>
              <TableHead>{t('invoices.vehicle')}</TableHead>
              <TableHead>{t('invoices.total')}</TableHead>
              <TableHead>{t('invoices.dueDate')}</TableHead>
              <TableHead>{t('invoices.status')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {totalCount === 0 ? t('invoices.empty') : t('invoices.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(inv => (
              <TableRow key={inv.id} className="hover:bg-muted/50">
                <TableCell className="font-medium mono">{inv.number}</TableCell>
                <TableCell>{(inv.clients as any)?.name}</TableCell>
                <TableCell>
                  {(inv.vehicles as any) ? `${(inv.vehicles as any)?.make} ${(inv.vehicles as any)?.model} — ${(inv.vehicles as any)?.plate}` : '—'}
                </TableCell>
                <TableCell className="font-semibold mono">{cur}{inv.total?.toFixed(2)}</TableCell>
                <TableCell>{inv.due_date || '—'}</TableCell>
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
    </div>
  );
}
