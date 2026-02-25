import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ArrowRightLeft, FileDown } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { QuoteStatus } from "@/types/garage";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { generatePdf, exportToCsv } from "@/lib/pdfGenerator";

const statusColors: Record<QuoteStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-muted text-muted-foreground",
  converted: "bg-primary/10 text-primary",
};

export default function Quotes() {
  const { t } = useLanguage();
  const { limits, plan } = useSubscription();
  const [quotes, setQuotes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<string | null>(null);
  const [shop, setShop] = useState<any>(null);

  const fetchQuotes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: shopData } = await supabase.from("shops").select("*").eq("user_id", user.id).single();
    if (shopData) setShop(shopData);

    const { data } = await supabase
      .from("quotes")
      .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)")
      .order("created_at", { ascending: false });
    if (data) setQuotes(data);
  };

  useEffect(() => { fetchQuotes(); }, []);

  const convertToService = async (quote: any) => {
    if (quote.status === 'converted') return;
    setConverting(quote.id);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t('common.sessionExpired')); setConverting(null); return; }
    const { data: shopData } = await supabase.from("shops").select("id").eq("user_id", user.id).single();
    if (!shopData) { toast.error(t('common.configureShop')); setConverting(null); return; }

    const { data: countData } = await supabase.from("work_orders").select("id", { count: "exact" }).eq("shop_id", shopData.id);
    const num = `SRV-${String((countData?.length || 0) + 1).padStart(4, '0')}`;

    const { error: insertError } = await supabase.from("work_orders").insert({
      shop_id: shopData.id, number: num, origin: 'quote', quote_id: quote.id,
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

  const downloadPdf = async (q: any) => {
    if (!shop) return;
    const lines = (Array.isArray(q.lines) ? q.lines : []) as any[];
    const doc = await generatePdf({
      type: 'quote',
      number: q.number,
      date: q.date || new Date(q.created_at).toLocaleDateString('pt-PT'),
      validityDate: q.validity_date,
      shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone,
      shopNif: (shop as any).nif, shopAddress: (shop as any).address, shopLogoUrl: (shop as any).logo_url,
      clientName: (q.clients as any)?.name || '',
      clientEmail: (q.clients as any)?.email,
      clientPhone: (q.clients as any)?.phone,
      clientNif: (q.clients as any)?.nif,
      vehicleMake: (q.vehicles as any)?.make || '',
      vehicleModel: (q.vehicles as any)?.model || '',
      vehiclePlate: (q.vehicles as any)?.plate || '',
      lines, subtotal: q.subtotal, vatTotal: q.vat_total, total: q.total, profit: q.profit,
      notes: q.notes, currency: shop.currency || 'EUR',
      plan: plan,
    }, limits.pdfWatermark);
    doc.save(`${q.number}.pdf`);
  };

  const handleExportCsv = () => {
    const csvData = quotes.map(q => ({
      Número: q.number,
      Cliente: (q.clients as any)?.name,
      Veículo: `${(q.vehicles as any)?.make} ${(q.vehicles as any)?.model}`,
      Matrícula: (q.vehicles as any)?.plate,
      Status: q.status,
      Subtotal: q.subtotal,
      IVA: q.vat_total,
      Total: q.total,
      Lucro: q.profit,
      Data: q.date,
      Validade: q.validity_date,
    }));
    exportToCsv(csvData, 'orcamentos');
    toast.success(t('common.exported'));
  };

  const filtered = quotes.filter(q =>
    q.number?.toLowerCase().includes(search.toLowerCase()) ||
    (q.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusLabel = (status: QuoteStatus) => t(`status.${status}`);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('quotes.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{quotes.length} {t('quotes.title').toLowerCase()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileDown className="w-4 h-4 mr-1" />CSV
          </Button>
          <Link to="/quotes/new">
            <Button><Plus className="w-4 h-4 mr-2" />{t('quotes.new')}</Button>
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('quotes.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('quotes.number')}</TableHead>
              <TableHead>{t('quotes.client')}</TableHead>
              <TableHead>{t('quotes.vehicle')}</TableHead>
              <TableHead>{t('quotes.total')}</TableHead>
              <TableHead>{t('quotes.profit')}</TableHead>
              <TableHead>{t('quotes.status')}</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  {quotes.length === 0 ? t('quotes.empty') : t('quotes.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(q => (
              <TableRow key={q.id} className="hover:bg-muted/50">
                <TableCell className="font-medium mono">{q.number}</TableCell>
                <TableCell>{(q.clients as any)?.name}</TableCell>
                <TableCell>{(q.vehicles as any)?.make} {(q.vehicles as any)?.model} — <span className="mono">{(q.vehicles as any)?.plate}</span></TableCell>
                <TableCell className="font-semibold mono">€{q.total?.toFixed(2)}</TableCell>
                <TableCell className="mono text-success">€{q.profit?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[q.status as QuoteStatus]}>
                    {getStatusLabel(q.status as QuoteStatus)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => downloadPdf(q)} className="text-xs">
                      PDF
                    </Button>
                    {['draft', 'sent', 'approved'].includes(q.status) && (
                      <Button
                        variant="ghost" size="sm"
                        onClick={() => convertToService(q)}
                        disabled={converting === q.id}
                        className="text-xs"
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5 mr-1" />
                        {converting === q.id ? t('quotes.converting') : t('quotes.convert')}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
