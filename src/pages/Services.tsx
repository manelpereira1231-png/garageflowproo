import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, FileDown, ChevronRight, Pencil } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import type { ServiceStatus } from "@/types/garage";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { generatePdf, exportToCsv } from "@/lib/pdfGenerator";

const statusColors: Record<ServiceStatus, string> = {
  open: "bg-info/10 text-info",
  diagnosis: "bg-warning/10 text-warning",
  waiting_approval: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusFlow: ServiceStatus[] = ['open', 'diagnosis', 'waiting_approval', 'approved', 'in_progress', 'completed', 'delivered'];

export default function Services() {
  const { t } = useLanguage();
  const { limits, plan } = useSubscription();
  const [services, setServices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [shop, setShop] = useState<any>(null);

  const fetchServices = async () => {
    const activeId = localStorage.getItem("garageflow_active_shop");
    if (!activeId) return;
    const { data: shopData } = await supabase.from("shops").select("*").eq("id", activeId).maybeSingle();
    if (shopData) setShop(shopData);

    const { data } = await supabase
      .from("work_orders")
      .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)")
      .order("created_at", { ascending: false });
    if (data) setServices(data);
  };

  useEffect(() => { fetchServices(); }, []);

  const advanceStatus = async (service: any) => {
    const currentIdx = statusFlow.indexOf(service.status);
    if (currentIdx === -1 || currentIdx >= statusFlow.length - 1) return;
    const nextStatus = statusFlow[currentIdx + 1];
    const updates: any = { status: nextStatus };
    if (nextStatus === 'completed') updates.completed_at = new Date().toISOString();
    if (nextStatus === 'delivered') updates.delivered_at = new Date().toISOString();

    const { error } = await supabase.from("work_orders").update(updates).eq("id", service.id);
    if (error) toast.error(error.message);
    else { toast.success(`${t(`service.${nextStatus}`)}`); fetchServices(); }
  };

  const cancelService = async (id: string) => {
    const { error } = await supabase.from("work_orders").update({ status: 'cancelled' }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(t('service.cancelled')); fetchServices(); }
  };

  const downloadPdf = async (s: any) => {
    if (!shop) return;
    const lines = (Array.isArray(s.lines) ? s.lines : []) as any[];
    const doc = await generatePdf({
      type: 'service',
      number: s.number,
      date: new Date(s.created_at).toLocaleDateString('pt-PT'),
      shopName: shop.name, shopEmail: shop.email, shopPhone: shop.phone,
      shopNif: (shop as any).nif, shopAddress: (shop as any).address, shopLogoUrl: (shop as any).logo_url,
      clientName: (s.clients as any)?.name || '',
      clientEmail: (s.clients as any)?.email,
      clientPhone: (s.clients as any)?.phone,
      clientNif: (s.clients as any)?.nif,
      vehicleMake: (s.vehicles as any)?.make || '',
      vehicleModel: (s.vehicles as any)?.model || '',
      vehiclePlate: (s.vehicles as any)?.plate || '',
      lines, subtotal: s.subtotal, vatTotal: s.vat_total, total: s.total, profit: s.profit,
      notes: s.notes, technician: s.technician, diagnosis: s.diagnosis, laborHours: s.labor_hours,
      currency: shop.currency || 'EUR',
      plan: plan,
    }, limits.pdfWatermark);
    doc.save(`${s.number}.pdf`);
  };

  const handleExportCsv = () => {
    const csvData = services.map(s => ({
      Número: s.number,
      Cliente: (s.clients as any)?.name,
      Veículo: `${(s.vehicles as any)?.make} ${(s.vehicles as any)?.model}`,
      Matrícula: (s.vehicles as any)?.plate,
      Status: s.status,
      Subtotal: s.subtotal,
      IVA: s.vat_total,
      Total: s.total,
      Lucro: s.profit,
      Data: new Date(s.created_at).toLocaleDateString('pt-PT'),
    }));
    exportToCsv(csvData, 'servicos');
    toast.success(t('common.exported'));
  };

  const filtered = services.filter(s =>
    s.number?.toLowerCase().includes(search.toLowerCase()) ||
    (s.clients as any)?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('services.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{services.length} {t('services.title').toLowerCase()}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileDown className="w-4 h-4 mr-1" />CSV
          </Button>
          <Link to="/services/new">
            <Button><Plus className="w-4 h-4 mr-2" />{t('services.new')}</Button>
          </Link>
        </div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('services.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                  {services.length === 0 ? t('services.empty') : t('services.noResults')}
                </TableCell>
              </TableRow>
            ) : filtered.map(s => (
              <TableRow key={s.id} className="hover:bg-muted/50">
                <TableCell className="font-medium mono">{s.number}</TableCell>
                <TableCell>{(s.clients as any)?.name}</TableCell>
                <TableCell>{(s.vehicles as any)?.make} {(s.vehicles as any)?.model} — <span className="mono">{(s.vehicles as any)?.plate}</span></TableCell>
                <TableCell className="font-semibold mono">€{s.total?.toFixed(2)}</TableCell>
                <TableCell className="mono text-success">€{s.profit?.toFixed(2)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[s.status as ServiceStatus]}>
                    {t(`service.${s.status}`)}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {!['delivered', 'cancelled'].includes(s.status) && (
                      <Link to={`/services/edit/${s.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs">
                          <Pencil className="w-3.5 h-3.5 mr-1" />
                          {t('common.edit')}
                        </Button>
                      </Link>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => downloadPdf(s)} className="text-xs">
                      PDF
                    </Button>
                    {!['delivered', 'cancelled'].includes(s.status) && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => advanceStatus(s)} className="text-xs">
                          <ChevronRight className="w-3.5 h-3.5 mr-0.5" />
                          {t(`service.${statusFlow[statusFlow.indexOf(s.status as ServiceStatus) + 1] || s.status}`)}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => cancelService(s.id)} className="text-xs text-destructive">
                          ✕
                        </Button>
                      </>
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
