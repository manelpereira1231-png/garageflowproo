import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Car, User, Wrench, FileText, Receipt, Clock, CheckCircle, Truck, XCircle, Calendar, Phone, Mail, Building2, CalendarPlus, ClipboardCheck, CreditCard, Eye, ChevronRight, AlertCircle, Globe, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PortalPushToggle } from "@/components/PortalPushToggle";
import { format } from "date-fns";
import { toast } from "sonner";

const translations: Record<string, Record<string, string>> = {
  pt: {
    loading: "A carregar portal...",
    notFound: "Portal não encontrado",
    notFoundDesc: "Este link de portal é inválido ou expirou.",
    welcome: "Bem-vindo ao seu Portal",
    serviceHistory: "Serviços",
    quotes: "Orçamentos",
    invoices: "Faturas",
    vehicles: "Veículos",
    inspections: "Inspeções",
    bookAppointment: "Agendar",
    noServices: "Sem serviços registados.",
    noQuotes: "Sem orçamentos.",
    noInvoices: "Sem faturas.",
    noVehicles: "Sem veículos registados.",
    noInspections: "Sem inspeções registadas.",
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
    paid: "Pago", pending: "Pendente", remaining: "Restante",
    paymentHistory: "Histórico de Pagamentos",
    noPayments: "Sem pagamentos registados.",
    scheduleService: "Agendar Revisão",
    selectVehicle: "Selecionar Veículo",
    selectDate: "Selecionar Data",
    selectTime: "Selecionar Hora",
    serviceType: "Tipo de Serviço",
    notes: "Notas",
    submit: "Submeter",
    cancel: "Cancelar",
    appointmentSuccess: "Marcação criada com sucesso!",
    appointmentError: "Erro ao criar marcação.",
    revision: "Revisão", oilChange: "Mudança de Óleo", brakes: "Travões", tires: "Pneus", general: "Geral",
    inspectionItems: "Itens de Inspeção",
    pass: "OK", fail: "NOK", na: "N/A",
    viewDetails: "Ver Detalhes",
    serviceTimeline: "Timeline",
    totalPaid: "Total Pago",
    totalDue: "Total em Dívida",
    descriptionLabel: "Descrição",
    items: "Itens",
    lastService: "Último serviço",
    dueLabel: "Vence",
    notifications: "Notificações",
  },
  en: {
    loading: "Loading portal...",
    notFound: "Portal not found",
    notFoundDesc: "This portal link is invalid or expired.",
    welcome: "Welcome to your Portal",
    serviceHistory: "Services",
    quotes: "Quotes",
    invoices: "Invoices",
    vehicles: "Vehicles",
    inspections: "Inspections",
    bookAppointment: "Book",
    noServices: "No services found.",
    noQuotes: "No quotes found.",
    noInvoices: "No invoices found.",
    noVehicles: "No vehicles found.",
    noInspections: "No inspections found.",
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
    paid: "Paid", pending: "Pending", remaining: "Remaining",
    paymentHistory: "Payment History",
    noPayments: "No payments found.",
    scheduleService: "Schedule Service",
    selectVehicle: "Select Vehicle",
    selectDate: "Select Date",
    selectTime: "Select Time",
    serviceType: "Service Type",
    notes: "Notes",
    submit: "Submit",
    cancel: "Cancel",
    appointmentSuccess: "Appointment created successfully!",
    appointmentError: "Error creating appointment.",
    revision: "Revision", oilChange: "Oil Change", brakes: "Brakes", tires: "Tires", general: "General",
    inspectionItems: "Inspection Items",
    pass: "OK", fail: "NOK", na: "N/A",
    viewDetails: "View Details",
    serviceTimeline: "Timeline",
    totalPaid: "Total Paid",
    totalDue: "Total Due",
    descriptionLabel: "Description",
    items: "Items",
    lastService: "Last service",
    dueLabel: "Due",
    notifications: "Notifications",
  },
  es: {
    loading: "Cargando portal...",
    notFound: "Portal no encontrado",
    notFoundDesc: "Este enlace de portal es inválido o ha expirado.",
    welcome: "Bienvenido a su Portal",
    serviceHistory: "Servicios",
    quotes: "Presupuestos",
    invoices: "Facturas",
    vehicles: "Vehículos",
    inspections: "Inspecciones",
    bookAppointment: "Agendar",
    noServices: "Sin servicios registrados.",
    noQuotes: "Sin presupuestos.",
    noInvoices: "Sin facturas.",
    noVehicles: "Sin vehículos registrados.",
    noInspections: "Sin inspecciones registradas.",
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
    paid: "Pagado", pending: "Pendiente", remaining: "Restante",
    paymentHistory: "Historial de Pagos",
    noPayments: "Sin pagos registrados.",
    scheduleService: "Agendar Servicio",
    selectVehicle: "Seleccionar Vehículo",
    selectDate: "Seleccionar Fecha",
    selectTime: "Seleccionar Hora",
    serviceType: "Tipo de Servicio",
    notes: "Notas",
    submit: "Enviar",
    cancel: "Cancelar",
    appointmentSuccess: "¡Cita creada con éxito!",
    appointmentError: "Error al crear la cita.",
    revision: "Revisión", oilChange: "Cambio de Aceite", brakes: "Frenos", tires: "Neumáticos", general: "General",
    inspectionItems: "Elementos de Inspección",
    pass: "OK", fail: "NOK", na: "N/A",
    viewDetails: "Ver Detalles",
    serviceTimeline: "Timeline",
    totalPaid: "Total Pagado",
    totalDue: "Total Pendiente",
    descriptionLabel: "Descripción",
    items: "Elementos",
    lastService: "Último servicio",
    dueLabel: "Vence",
    notifications: "Notificaciones",
  },
  'pt-BR': {
    loading: "Carregando portal...",
    notFound: "Portal não encontrado",
    notFoundDesc: "Este link de portal é inválido ou expirou.",
    welcome: "Bem-vindo ao seu Portal",
    serviceHistory: "Serviços",
    quotes: "Orçamentos",
    invoices: "Faturas",
    vehicles: "Veículos",
    inspections: "Inspeções",
    bookAppointment: "Agendar",
    noServices: "Sem serviços registrados.",
    noQuotes: "Sem orçamentos.",
    noInvoices: "Sem faturas.",
    noVehicles: "Sem veículos registrados.",
    noInspections: "Sem inspeções registradas.",
    status: "Status",
    total: "Total",
    date: "Data",
    number: "Nº",
    vehicle: "Veículo",
    plate: "Placa",
    technician: "Técnico",
    footer: "Gestão profissional de oficinas",
    open: "Aberto", diagnosis: "Diagnóstico", waiting_approval: "Aguardando Aprovação",
    approved: "Aprovado", in_progress: "Em Execução", completed: "Concluído",
    delivered: "Entregue", cancelled: "Cancelado",
    draft: "Rascunho", sent: "Enviado", rejected: "Rejeitado", expired: "Expirado", converted: "Convertido",
    status_draft: "Rascunho", status_issued: "Emitida", status_paid: "Paga", status_cancelled: "Anulada", status_partial: "Parcial",
    mileage: "km", year: "Ano", fuel: "Combustível",
    paid: "Pago", pending: "Pendente", remaining: "Restante",
    paymentHistory: "Histórico de Pagamentos",
    noPayments: "Sem pagamentos registrados.",
    scheduleService: "Agendar Revisão",
    selectVehicle: "Selecionar Veículo",
    selectDate: "Selecionar Data",
    selectTime: "Selecionar Hora",
    serviceType: "Tipo de Serviço",
    notes: "Notas",
    submit: "Enviar",
    cancel: "Cancelar",
    appointmentSuccess: "Agendamento criado com sucesso!",
    appointmentError: "Erro ao criar agendamento.",
    revision: "Revisão", oilChange: "Troca de Óleo", brakes: "Freios", tires: "Pneus", general: "Geral",
    inspectionItems: "Itens de Inspeção",
    pass: "OK", fail: "NOK", na: "N/A",
    viewDetails: "Ver Detalhes",
    serviceTimeline: "Timeline",
    totalPaid: "Total Pago",
    totalDue: "Total em Dívida",
    descriptionLabel: "Descrição",
    items: "Itens",
    lastService: "Último serviço",
    dueLabel: "Vence",
    notifications: "Notificações",
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

const statusFlow = ['open', 'diagnosis', 'waiting_approval', 'approved', 'in_progress', 'completed', 'delivered'];

type Tab = 'services' | 'quotes' | 'invoices' | 'vehicles' | 'inspections' | 'book';

function ServiceTimeline({ status }: { status: string }) {
  const idx = statusFlow.indexOf(status);
  return (
    <div className="flex items-center gap-0.5 mt-2">
      {statusFlow.map((s, i) => (
        <div key={s} className="flex items-center gap-0.5">
          <div className={`w-2.5 h-2.5 rounded-full ${i <= idx ? 'bg-primary' : i === idx + 1 ? 'bg-primary/30' : 'bg-muted-foreground/20'}`} />
          {i < statusFlow.length - 1 && <div className={`w-3 h-0.5 ${i < idx ? 'bg-primary' : 'bg-muted-foreground/20'}`} />}
        </div>
      ))}
    </div>
  );
}

export default function ClientPortal() {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [quoteDecision, setQuoteDecision] = useState<{ quote: any; action: 'approved' | 'rejected' } | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const getInitialLang = (): string => {
    try {
      const stored = localStorage.getItem(`garageflow_portal_lang_${token}`);
      if (stored && translations[stored]) return stored;
    } catch {}
    try {
      const country = localStorage.getItem('garageflow_country');
      if (country === 'PT') return 'pt';
      if (country === 'BR') return 'pt-BR';
      if (['ES', 'MX', 'AR', 'CL', 'CO', 'PE'].includes(country || '')) return 'es';
      if (['UK', 'US', 'AU', 'CA', 'IE', 'NZ', 'SG', 'ZA', 'IN'].includes(country || '')) return 'en';
    } catch {}
    const b = (typeof navigator !== 'undefined' ? navigator.language : '').toLowerCase();
    if (b === 'pt-br') return 'pt-BR';
    if (b.startsWith('pt')) return 'pt';
    if (b.startsWith('es')) return 'es';
    if (b.startsWith('en')) return 'en';
    return 'en';
  };
  const [lang, setLangState] = useState<string>(getInitialLang);
  const [langPicked, setLangPicked] = useState<boolean>(() => {
    try { return !!localStorage.getItem(`garageflow_portal_lang_${token}`); } catch { return false; }
  });
  const setLang = (l: string) => {
    setLangState(l);
    setLangPicked(true);
    try { localStorage.setItem(`garageflow_portal_lang_${token}`, l); } catch {}
  };
  const [activeTab, setActiveTab] = useState<Tab>("services");
  
  // Service detail
  const [selectedService, setSelectedService] = useState<any>(null);
  
  // Invoice detail  
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoicePayments, setInvoicePayments] = useState<any[]>([]);
  
  // Booking dialog
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingData, setBookingData] = useState({ vehicle_id: '', date: '', time: '09:00', service_type: 'revision', notes: '' });
  const [bookingLoading, setBookingLoading] = useState(false);

  const t = (key: string) => translations[lang]?.[key] || translations.pt[key] || key;

  useEffect(() => {
    const load = async () => {
      if (!token) { setError(true); setLoading(false); return; }

      const { data: rpcData, error: rpcErr } = await supabase
        .rpc("get_client_portal_data", { _token: token });

      if (rpcErr || !rpcData) { setError(true); setLoading(false); return; }

      const payload = rpcData as any;
      const c = payload.client;
      const s = payload.shop;
      if (!c) { setError(true); setLoading(false); return; }

      setClient(c);
      if (!langPicked && s?.language && translations[s.language]) setLangState(s.language);
      setShop(s);

      const normalizeWithVehicle = (rows: any[]) =>
        (rows || []).map((r: any) => ({ ...r, vehicles: r.vehicle || null }));

      setServices(normalizeWithVehicle(payload.work_orders || []));
      setQuotes(normalizeWithVehicle(payload.quotes || []));
      setInvoices(normalizeWithVehicle(payload.invoices || []));
      setVehicles(payload.vehicles || []);
      // Inspeções feitas em Modo Oficina (checklists) associadas a este cliente
      setInspections(
        (payload.inspections || []).map((i: any) => ({
          ...i,
          work_orders: { number: i.work_order_number, vehicles: i.vehicle || null },
        })),
      );
      setPayments([]);
      setLoading(false);
    };
    load();
  }, [token, reloadKey]);

  // Confirmação do pagamento online no regresso do Stripe
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invoiceToken = params.get("invoice_token");
    const sessionId = params.get("session_id");
    if (params.get("canceled")) {
      toast.error(t("paymentCanceled"));
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!invoiceToken || !sessionId) return;
    (async () => {
      const { data, error: fnErr } = await supabase.functions.invoke("invoice-pay", {
        body: { token: invoiceToken, action: "confirm", session_id: sessionId },
      });
      window.history.replaceState({}, "", window.location.pathname);
      if (fnErr || (data as any)?.error) {
        toast.error((data as any)?.error || t("paymentError"));
        return;
      }
      if ((data as any)?.paid) {
        toast.success(t("paymentSuccess"));
        setActiveTab("invoices");
        setReloadKey((k) => k + 1);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const loadInvoicePayments = async (invoiceId: string) => {
    const relevant = payments.filter(p => p.invoice_id === invoiceId);
    setInvoicePayments(relevant);
  };

  const handleBooking = async () => {
    if (!bookingData.vehicle_id || !bookingData.date || !bookingData.time) return;
    setBookingLoading(true);
    try {
      const { error } = await supabase.from("appointments").insert({
        shop_id: client.shop_id,
        client_id: client.id,
        client_name: client.name,
        client_email: client.email,
        client_phone: client.phone,
        vehicle_id: bookingData.vehicle_id,
        date: bookingData.date,
        time: bookingData.time,
        service_type: bookingData.service_type,
        notes: bookingData.notes,
        status: 'pending',
        source: 'portal',
      } as any);
      if (error) throw error;
      toast.success(t('appointmentSuccess'));
      setBookingOpen(false);
      setBookingData({ vehicle_id: '', date: '', time: '09:00', service_type: 'revision', notes: '' });
    } catch {
      toast.error(t('appointmentError'));
    }
    setBookingLoading(false);
  };

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

  const cur = shop?.currency === 'EUR' ? '€' : shop?.currency === 'BRL' ? 'R$' : shop?.currency === 'USD' ? '$' : (shop?.currency || '€');

  // Calculate financial summary
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const invoiceIds = invoices.map(i => i.id);
  const totalPaid = payments.filter(p => invoiceIds.includes(p.invoice_id)).reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalDue = Math.max(0, totalInvoiced - totalPaid);

  const tabs: { key: Tab; label: string; icon: any; count: number }[] = [
    { key: 'services', label: t('serviceHistory'), icon: Wrench, count: services.length },
    { key: 'quotes', label: t('quotes'), icon: FileText, count: quotes.length },
    { key: 'invoices', label: t('invoices'), icon: Receipt, count: invoices.length },
    { key: 'vehicles', label: t('vehicles'), icon: Car, count: vehicles.length },
    { key: 'inspections', label: t('inspections'), icon: ClipboardCheck, count: inspections.length },
    { key: 'book', label: t('bookAppointment'), icon: CalendarPlus, count: 0 },
  ];

  const getInvoicePaidAmount = (invoiceId: string) => {
    return payments.filter(p => p.invoice_id === invoiceId).reduce((sum, p) => sum + (p.amount || 0), 0);
  };

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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold uppercase text-background/80 hover:bg-background/10 transition-colors" aria-label="Language">
                  <Globe className="h-4 w-4" />
                  <span>{lang === 'pt-BR' ? 'BR' : lang.toUpperCase()}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                {[
                  { code: 'pt', label: 'Português', flag: '🇵🇹' },
                  { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
                  { code: 'en', label: 'English', flag: '🇬🇧' },
                  { code: 'es', label: 'Español', flag: '🇪🇸' },
                ].map((l) => (
                  <DropdownMenuItem key={l.code} onClick={() => setLang(l.code)} className="cursor-pointer flex items-center gap-2">
                    <span className="text-base leading-none">{l.flag}</span>
                    <span className="flex-1">{l.label}</span>
                    {l.code === lang && <Check className="h-4 w-4 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-6">
        {/* Client Card + Financial Summary */}
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-lg mb-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{client.name}</h2>
              <p className="text-xs text-muted-foreground">{t('welcome')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {client.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{client.email}</span>}
            {client.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{client.phone}</span>}
            {client.company && <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" />{client.company}</span>}
          </div>
          
          {/* Financial Summary */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('total')}</p>
              <p className="text-sm font-bold font-mono">{cur}{totalInvoiced.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('totalPaid')}</p>
              <p className="text-sm font-bold font-mono text-success">{cur}{totalPaid.toFixed(2)}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">{t('totalDue')}</p>
              <p className={`text-sm font-bold font-mono ${totalDue > 0 ? 'text-destructive' : 'text-success'}`}>{cur}{totalDue.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Push Notifications */}
        <div className="mb-4">
          <PortalPushToggle
            shopId={client.shop_id}
            clientId={client.id}
            labels={{
              pushNotifications: t('notifications'),
              pushDescription: lang === 'en' ? 'Receive alerts about your services' : lang === 'es' ? 'Reciba alertas sobre sus servicios' : 'Receba alertas sobre os seus serviços',
              pushNotSupported: lang === 'en' ? 'Push notifications not supported' : lang === 'es' ? 'Notificaciones no soportadas' : 'Notificações push não suportadas',
              active: lang === 'en' ? 'Active' : lang === 'es' ? 'Activo' : 'Ativo',
            }}
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'book') {
                  setBookingOpen(true);
                } else {
                  setActiveTab(tab.key);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all shrink-0 ${
                tab.key === 'book'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : activeTab === tab.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'bg-card border border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-3 pb-10">
          {/* SERVICES TAB */}
          {activeTab === 'services' && (
            services.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noServices')}</div>
            ) : services.map(s => (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4 space-y-2 cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedService(s)}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm font-mono">{s.number}</span>
                    <p className="text-xs text-muted-foreground">{format(new Date(s.created_at), 'dd/MM/yyyy')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={serviceStatusColors[s.status] || ''}>
                      {t(s.status) || s.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {(s.vehicles as any)?.make} {(s.vehicles as any)?.model} — {(s.vehicles as any)?.plate}
                    {s.technician && <span className="ml-2">🔧 {s.technician}</span>}
                  </span>
                  <span className="font-semibold font-mono">{cur}{s.total?.toFixed(2)}</span>
                </div>
                <ServiceTimeline status={s.status} />
              </div>
            ))
          )}

          {/* QUOTES TAB */}
          {activeTab === 'quotes' && (
            quotes.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noQuotes')}</div>
            ) : quotes.map(q => (
              <div key={q.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm font-mono">{q.number}</span>
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
                  <span className="font-semibold font-mono">{cur}{q.total?.toFixed(2)}</span>
                </div>
                {/* Line items preview */}
                {Array.isArray(q.lines) && q.lines.length > 0 && (
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                    {(q.lines as any[]).slice(0, 3).map((line: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate mr-2">{line.description}</span>
                        <span className="font-mono shrink-0">{cur}{(line.total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {(q.lines as any[]).length > 3 && <p className="text-muted-foreground/50">+{(q.lines as any[]).length - 3} mais...</p>}
                  </div>
                )}
                {q.status === 'sent' && q.token && (
                  <a
                    href={`${window.location.origin}/quote/${q.token}`}
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

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            invoices.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noInvoices')}</div>
            ) : invoices.map(inv => {
              const paidAmount = getInvoicePaidAmount(inv.id);
              const remaining = Math.max(0, (inv.total || 0) - paidAmount);
              return (
                <div key={inv.id} className="bg-card border border-border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm font-mono">{inv.number}</span>
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
                    <span className="font-semibold font-mono">{cur}{inv.total?.toFixed(2)}</span>
                  </div>
                  
                  {/* Payment progress bar */}
                  {inv.status !== 'draft' && inv.status !== 'cancelled' && (
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-success">{t('paid')}: {cur}{paidAmount.toFixed(2)}</span>
                        {remaining > 0 && <span className="text-destructive">{t('remaining')}: {cur}{remaining.toFixed(2)}</span>}
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-success rounded-full transition-all" 
                          style={{ width: `${Math.min(100, (paidAmount / (inv.total || 1)) * 100)}%` }} 
                        />
                      </div>
                    </div>
                  )}
                  
                  {inv.due_date && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {t('dueLabel')}: {inv.due_date}
                    </p>
                  )}
                  
                  {/* View payments detail */}
                  {paidAmount > 0 && (
                    <button
                      onClick={() => { setSelectedInvoice(inv); loadInvoicePayments(inv.id); }}
                      className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                    >
                      <CreditCard className="w-3 h-3" /> {t('paymentHistory')}
                    </button>
                  )}
                </div>
              );
            })
          )}

          {/* VEHICLES TAB */}
          {activeTab === 'vehicles' && (
            vehicles.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noVehicles')}</div>
            ) : vehicles.map(v => {
              const vServices = services.filter(s => (s.vehicles as any)?.plate === v.plate);
              const lastService = vServices[0];
              return (
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
                      {lastService && (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                          <Wrench className="w-3 h-3" />
                          {t('lastService')}: {format(new Date(lastService.created_at), 'dd/MM/yyyy')}
                          <Badge variant="secondary" className={`ml-1 text-[10px] py-0 ${serviceStatusColors[lastService.status]}`}>
                            {t(lastService.status)}
                          </Badge>
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{vServices.length} {t('serviceHistory').toLowerCase()}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* INSPECTIONS TAB */}
          {activeTab === 'inspections' && (
            inspections.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">{t('noInspections')}</div>
            ) : inspections.map(insp => {
              const items = Array.isArray(insp.items) ? insp.items as any[] : [];
              const passed = items.filter((it: any) => it.status === 'pass').length;
              const failed = items.filter((it: any) => it.status === 'fail').length;
              const wo = insp.work_orders as any;
              return (
                <div key={insp.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium text-sm font-mono">{wo?.number}</span>
                      <p className="text-xs text-muted-foreground">
                        {insp.completed_at ? format(new Date(insp.completed_at), 'dd/MM/yyyy') : format(new Date(insp.created_at), 'dd/MM/yyyy')}
                        {insp.technician && ` · 🔧 ${insp.technician}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="bg-success/10 text-success">{t('pass')}: {passed}</Badge>
                      {failed > 0 && <Badge variant="secondary" className="bg-destructive/10 text-destructive">{t('fail')}: {failed}</Badge>}
                    </div>
                  </div>
                  {wo?.vehicles && (
                    <p className="text-xs text-muted-foreground">
                      {wo.vehicles.make} {wo.vehicles.model} — {wo.vehicles.plate}
                    </p>
                  )}
                  {/* Inspection items grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                    {items.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-xs py-1 px-2 rounded bg-muted/50">
                        {item.status === 'pass' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-success shrink-0" />
                        ) : item.status === 'fail' ? (
                          <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        )}
                        <span className="truncate">{item.label || item.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="text-center py-6 border-t border-border">
          {shop?.logo_url && <img src={shop.logo_url} alt={shop.name} className="max-h-6 mx-auto mb-2 opacity-50" />}
          <p className="text-xs text-muted-foreground">{shop?.name} · {t('footer')}</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1">Powered by GarageFlow</p>
        </div>
      </div>

      {/* Service Detail Dialog */}
      <Dialog open={!!selectedService} onOpenChange={() => setSelectedService(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-mono">{selectedService?.number}</DialogTitle>
          </DialogHeader>
          {selectedService && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className={serviceStatusColors[selectedService.status] || ''}>
                  {t(selectedService.status)}
                </Badge>
                <span className="font-bold font-mono">{cur}{selectedService.total?.toFixed(2)}</span>
              </div>
              <ServiceTimeline status={selectedService.status} />
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('vehicle')}</span>
                  <span>{(selectedService.vehicles as any)?.make} {(selectedService.vehicles as any)?.model} — {(selectedService.vehicles as any)?.plate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('date')}</span>
                  <span>{format(new Date(selectedService.created_at), 'dd/MM/yyyy HH:mm')}</span>
                </div>
                {selectedService.technician && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('technician')}</span>
                    <span>{selectedService.technician}</span>
                  </div>
                )}
                {selectedService.completed_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('completed')}</span>
                    <span>{format(new Date(selectedService.completed_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                )}
                {selectedService.delivered_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t('delivered')}</span>
                    <span>{format(new Date(selectedService.delivered_at), 'dd/MM/yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
              {selectedService.client_description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('descriptionLabel')}</p>
                  <p className="text-sm bg-muted rounded-lg p-3">{selectedService.client_description}</p>
                </div>
              )}
              {selectedService.diagnosis && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">{t('diagnosis')}</p>
                  <p className="text-sm bg-muted rounded-lg p-3">{selectedService.diagnosis}</p>
                </div>
              )}
              {/* Service lines */}
              {Array.isArray(selectedService.lines) && selectedService.lines.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">{t('items')}</p>
                  <div className="space-y-1.5">
                    {(selectedService.lines as any[]).map((line: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm bg-muted/50 rounded-lg p-2">
                        <span className="truncate mr-2">{line.description}</span>
                        <span className="font-mono shrink-0">{cur}{(line.total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Payments Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('paymentHistory')} — {selectedInvoice?.number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {invoicePayments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t('noPayments')}</p>
            ) : invoicePayments.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                <div>
                  <p className="text-sm font-medium">{cur}{p.amount?.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(p.paid_at), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <Badge variant="secondary">{p.method}</Badge>
              </div>
            ))}
            {selectedInvoice && (
              <div className="pt-2 border-t border-border flex justify-between text-sm font-medium">
                <span>{t('remaining')}</span>
                <span className="font-mono">
                  {cur}{Math.max(0, (selectedInvoice.total || 0) - invoicePayments.reduce((s: number, p: any) => s + (p.amount || 0), 0)).toFixed(2)}
                </span>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Booking Dialog */}
      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('scheduleService')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('selectVehicle')}</Label>
              <Select value={bookingData.vehicle_id} onValueChange={v => setBookingData(prev => ({ ...prev, vehicle_id: v }))}>
                <SelectTrigger><SelectValue placeholder={t('selectVehicle')} /></SelectTrigger>
                <SelectContent>
                  {vehicles.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t('selectDate')}</Label>
                <Input type="date" value={bookingData.date} onChange={e => setBookingData(prev => ({ ...prev, date: e.target.value }))} min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-2">
                <Label>{t('selectTime')}</Label>
                <Input type="time" value={bookingData.time} onChange={e => setBookingData(prev => ({ ...prev, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('serviceType')}</Label>
              <Select value={bookingData.service_type} onValueChange={v => setBookingData(prev => ({ ...prev, service_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revision">{t('revision')}</SelectItem>
                  <SelectItem value="oil_change">{t('oilChange')}</SelectItem>
                  <SelectItem value="brakes">{t('brakes')}</SelectItem>
                  <SelectItem value="tires">{t('tires')}</SelectItem>
                  <SelectItem value="general">{t('general')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea value={bookingData.notes} onChange={e => setBookingData(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleBooking} disabled={bookingLoading || !bookingData.vehicle_id || !bookingData.date}>
              {bookingLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
