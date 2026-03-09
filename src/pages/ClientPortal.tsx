import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2, Car, User, Wrench, FileText, Receipt, Clock, CheckCircle, Truck, XCircle, Calendar, Phone, Mail, Building2 } from "lucide-react";
import { format } from "date-fns";

const translations: Record<string, Record<string, string>> = {
  pt: {
    loading: "A carregar portal...",
    notFound: "Portal não encontrado",
    notFoundDesc: "Este link de portal é inválido ou expirou.",
    welcome: "Bem-vindo ao seu Portal",
    serviceHistory: "Histórico de Serviços",
    quotes: "Orçamentos",
    invoices: "Faturas",
    vehicles: "Veículos",
    noServices: "Sem serviços registados.",
    noQuotes: "Sem orçamentos.",
    noInvoices: "Sem faturas.",
    noVehicles: "Sem veículos registados.",
    status: "Estado",
    total: "Total",
    date: "Data",
    number: "Nº",
    vehicle: "Veículo",
    plate: "Matrícula",
    technician: "Técnico",
    footer: "Gestão profissional de oficinas",
    open: "Aberto", diagnosis: "Diagnóstico", waiting_approval: "Aguardando Aprovação",
    approved: "Aprovado", in_progress: "Em Execução", completed: "Concluído",
    delivered: "Entregue", cancelled: "Cancelado",
    draft: "Rascunho", sent: "Enviado", rejected: "Rejeitado", expired: "Expirado", converted: "Convertido",
    status_draft: "Rascunho", status_issued: "Emitida", status_paid: "Paga", status_cancelled: "Anulada", status_partial: "Parcial",
    mileage: "km", year: "Ano", fuel: "Combustível",
  },
  en: {
    loading: "Loading portal...",
    notFound: "Portal not found",
    notFoundDesc: "This portal link is invalid or expired.",
    welcome: "Welcome to your Portal",
    serviceHistory: "Service History",
    quotes: "Quotes",
    invoices: "Invoices",
    vehicles: "Vehicles",
    noServices: "No services found.",
    noQuotes: "No quotes found.",
    noInvoices: "No invoices found.",
    noVehicles: "No vehicles found.",
    status: "Status",
    total: "Total",
    date: "Date",
    number: "No.",
    vehicle: "Vehicle",
    plate: "Plate",
    technician: "Technician",
    footer: "Professional workshop management",
    open: "Open", diagnosis: "Diagnosis", waiting_approval: "Awaiting Approval",
    approved: "Approved", in_progress: "In Progress", completed: "Completed",
    delivered: "Delivered", cancelled: "Cancelled",
    draft: "Draft", sent: "Sent", rejected: "Rejected", expired: "Expired", converted: "Converted",
    status_draft: "Draft", status_issued: "Issued", status_paid: "Paid", status_cancelled: "Cancelled", status_partial: "Partial",
    mileage: "km", year: "Year", fuel: "Fuel",
  },
  es: {
    loading: "Cargando portal...",
    notFound: "Portal no encontrado",
    notFoundDesc: "Este enlace de portal es inválido o ha expirado.",
    welcome: "Bienvenido a su Portal",
    serviceHistory: "Historial de Servicios",
    quotes: "Presupuestos",
    invoices: "Facturas",
    vehicles: "Vehículos",
    noServices: "Sin servicios registrados.",
    noQuotes: "Sin presupuestos.",
    noInvoices: "Sin facturas.",
    noVehicles: "Sin vehículos registrados.",
    status: "Estado",
    total: "Total",
    date: "Fecha",
    number: "Nº",
    vehicle: "Vehículo",
    plate: "Matrícula",
    technician: "Técnico",
    footer: "Gestión profesional de talleres",
    open: "Abierto", diagnosis: "Diagnóstico", waiting_approval: "Esperando Aprobación",
    approved: "Aprobado", in_progress: "En Ejecución", completed: "Completado",
    delivered: "Entregado", cancelled: "Cancelado",
    draft: "Borrador", sent: "Enviado", rejected: "Rechazado", expired: "Expirado", converted: "Convertido",
    status_draft: "Borrador", status_issued: "Emitida", status_paid: "Pagada", status_cancelled: "Anulada", status_partial: "Parcial",
    mileage: "km", year: "Año", fuel: "Combustible",
  },
};

const serviceStatusColors: Record<string, string> = {
  open: "bg-info/10 text-info",
  diagnosis: "bg-warning/10 text-warning",
  waiting_approval: "bg-muted text-muted-foreground",
  approved: "bg-success/10 text-success",
  in_progress: "bg-primary/10 text-primary",
  completed: "bg-success/10 text-success",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const quoteStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-info/10 text-info",
  approved: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-warning/10 text-warning",
  converted: "bg-primary/10 text-primary",
};

const invoiceStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
};

type Tab = 'services' | 'quotes' | 'invoices' | 'vehicles';

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lang, setLang] = useState<string>("pt");
  const [activeTab, setActiveTab] = useState<Tab>("services");

  const t = (key: string) => translations[lang]?.[key] || translations.pt[key] || key;

  useEffect(() => {
    const load = async () => {
      if (!token) { setError(true); setLoading(false); return; }

      const { data: c, error: cErr } = await supabase
        .from("clients")
        .select("id, name, email, phone, company, shop_id")
        .eq("portal_token", token)
        .is("deleted_at", null)
        .maybeSingle();

      if (cErr || !c) { setError(true); setLoading(false); return; }
      setClient(c);

      const { data: s } = await supabase
        .from("shops")
        .select("name, email, phone, logo_url, currency, language")
        .eq("id", c.shop_id)
        .single();

      if (s?.language && translations[s.language]) setLang(s.language);
      setShop(s);

      // Load all data in parallel
      const [woRes, qRes, iRes, vRes] = await Promise.all([
        supabase.from("work_orders")
          .select("id, number, status, total, created_at, technician, vehicles(make, model, plate)")
          .eq("client_id", c.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("quotes")
          .select("id, number, status, total, date, validity_date, token, vehicles(make, model, plate)")
          .eq("client_id", c.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("invoices")
          .select("id, number, status, total, due_date, created_at, vehicles(make, model, plate)")
          .eq("client_id", c.id)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("vehicles")
          .select("id, make, model, plate, year, fuel, mileage")
          .eq("client_id", c.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
      ]);

      setServices(woRes.data || []);
      setQuotes(qRes.data || []);
      setInvoices(iRes.data || []);
      setVehicles(vRes.data || []);
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{translations.pt.loading}</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-md w-full shadow-lg">
          <XCircle className="w-14 h-14 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-bold mb-2">{translations.pt.notFound}</h1>
          <p className="text-muted-foreground">{translations.pt.notFoundDesc}</p>
        </div>
      </div>
    );
  }

  const cur = shop?.currency === 'EUR' ? '€' : (shop?.currency || '€');

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'services', label: t('serviceHistory'), icon: Wrench, count: services.length },
    { key: 'quotes', label: t('quotes'), icon: FileText, count: quotes.length },
    { key: 'invoices', label: t('invoices'), icon: Receipt, count: invoices.length },
    { key: 'vehicles', label: t('vehicles'), icon: Car, count: vehicles.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted">
      {/* Header */}
      <div className="bg-foreground">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              {shop?.logo_url && (
                <img src={shop.logo_url} alt={shop.name} className="max-h-10 mb-3 brightness-200 contrast-0 invert" />
              )}
              <h1 className="text-lg sm:text-xl font-bold text-background">{shop?.name}</h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-background/60">
                {shop?.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{shop.email}</span>}
                {shop?.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{shop.phone}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6">
        {/* Client Card */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-lg mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{client.name}</h2>
              <p className="text-xs text-muted-foreground">{t('welcome')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-sm text-muted-foreground">
            {client.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{client.email}</span>}
            {client.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{client.phone}</span>}
            {client.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{client.company}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-card border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === tab.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-3 pb-10">
          {activeTab === 'services' && (
            services.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noServices')}</div>
            ) : services.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm mono">{s.number}</span>
                    <p className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                  <Badge variant="secondary" className={serviceStatusColors[s.status] || ''}>
                    {t(s.status) || s.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(s.vehicles as any)?.make} {(s.vehicles as any)?.model} — {(s.vehicles as any)?.plate}
                    {s.technician && <span className="ml-2">🔧 {s.technician}</span>}
                  </span>
                  <span className="font-semibold mono">{cur}{s.total?.toFixed(2)}</span>
                </div>
              </div>
            ))
          )}

          {activeTab === 'quotes' && (
            quotes.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noQuotes')}</div>
            ) : quotes.map(q => (
              <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm mono">{q.number}</span>
                    <p className="text-xs text-muted-foreground">{q.date}</p>
                  </div>
                  <Badge variant="secondary" className={quoteStatusColors[q.status] || ''}>
                    {t(q.status) || q.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(q.vehicles as any)?.make} {(q.vehicles as any)?.model} — {(q.vehicles as any)?.plate}
                  </span>
                  <span className="font-semibold mono">{cur}{q.total?.toFixed(2)}</span>
                </div>
                {q.status === 'sent' && q.token && (
                  <a
                    href={`/quote/${q.token}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                  >
                    <CheckCircle className="w-3 h-3" />
                    {lang === 'en' ? 'Review & Approve' : lang === 'es' ? 'Revisar y Aprobar' : 'Rever e Aprovar'}
                  </a>
                )}
              </div>
            ))
          )}

          {activeTab === 'invoices' && (
            invoices.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noInvoices')}</div>
            ) : invoices.map(inv => (
              <div key={inv.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm mono">{inv.number}</span>
                    <p className="text-xs text-muted-foreground">{format(new Date(inv.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                  <Badge variant="secondary" className={invoiceStatusColors[inv.status] || ''}>
                    {t(`status_${inv.status}`) || inv.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(inv.vehicles as any)?.make} {(inv.vehicles as any)?.model}
                    {(inv.vehicles as any)?.plate && ` — ${(inv.vehicles as any).plate}`}
                  </span>
                  <span className="font-semibold mono">{cur}{inv.total?.toFixed(2)}</span>
                </div>
                {inv.due_date && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {lang === 'en' ? 'Due' : lang === 'es' ? 'Vence' : 'Vence'}: {inv.due_date}
                  </p>
                )}
              </div>
            ))
          )}

          {activeTab === 'vehicles' && (
            vehicles.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noVehicles')}</div>
            ) : vehicles.map(v => (
              <div key={v.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Car className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{v.make} {v.model}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded font-semibold">{v.plate}</span>
                      {v.year > 0 && <span>{t('year')}: {v.year}</span>}
                      {v.fuel && <span>{v.fuel}</span>}
                      {v.mileage > 0 && <span>{v.mileage.toLocaleString()} {t('mileage')}</span>}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-border">
          {shop?.logo_url && <img src={shop.logo_url} alt={shop.name} className="max-h-6 mx-auto mb-2 opacity-50" />}
          <p className="text-xs text-muted-foreground">{shop?.name} · {t('footer')}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Powered by GarageFlow</p>
        </div>
      </div>
    </div>
  );
}
