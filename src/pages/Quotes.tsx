import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, ArrowRightLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { QuoteStatus } from "@/types/garage";
import { Link } from "react-router-dom";
import { toast } from "sonner";

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
  const [quotes, setQuotes] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [converting, setConverting] = useState<string | null>(null);

  const fetchQuotes = async () => {
    const { data } = await supabase
      .from("quotes")
      .select("*, clients(name), vehicles(make, model, plate)")
      .order("created_at", { ascending: false });
    if (data) setQuotes(data);
  };

  useEffect(() => { fetchQuotes(); }, []);

  const convertToService = async (quote: any) => {
    if (quote.status === 'converted') return;
    setConverting(quote.id);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t('common.sessionExpired')); setConverting(null); return; }
    const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).single();
    if (!shop) { toast.error(t('common.configureShop')); setConverting(null); return; }

    // Generate service number
    const { data: countData } = await supabase.from("work_orders").select("id", { count: "exact" }).eq("shop_id", shop.id);
    const num = `SRV-${String((countData?.length || 0) + 1).padStart(4, '0')}`;

    const { error: insertError } = await supabase.from("work_orders").insert({
      shop_id: shop.id,
      number: num,
      origin: 'quote',
      quote_id: quote.id,
      client_id: quote.client_id,
      vehicle_id: quote.vehicle_id,
      entry_mileage: 0,
      lines: quote.lines,
      labor_hours: 0,
      subtotal: quote.subtotal,
      vat_total: quote.vat_total,
      total: quote.total,
      cost_total: quote.cost_total,
      profit: quote.profit,
      status: 'approved',
      notes: quote.notes,
    });

    if (insertError) { toast.error(insertError.message); setConverting(null); return; }

    // Update quote status
    await supabase.from("quotes").update({ status: 'converted' }).eq("id", quote.id);
    toast.success(t('quotes.converted'));
    setConverting(null);
    fetchQuotes();
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
        <Link to="/quotes/new">
          <Button><Plus className="w-4 h-4 mr-2" />{t('quotes.new')}</Button>
        </Link>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
