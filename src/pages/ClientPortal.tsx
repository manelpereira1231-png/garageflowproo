import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Car, User, Wrench, FileText, Receipt, Clock, CheckCircle, Truck, XCircle, Calendar, Phone, Mail, Building2, CalendarPlus, ClipboardCheck, CreditCard, Eye, ChevronRight, AlertCircle, Globe, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PortalPushToggle } from "@/components/PortalPushToggle";
import { format } from "date-fns";
import { toast } from "sonner";
import { sendEmail } from "@/lib/emailService";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { MessageCircle, RefreshCw, PackageCheck } from "lucide-react";
import NextServiceSummary from '@/components/NextServiceSummary';
import { hasActiveReminderNotice, type ServiceReminder } from '@/lib/serviceReminder';
import { reminderDaysUntil } from '@/lib/serviceReminderMessage';

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
    describeService: "Descreva o serviço de que precisa",
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
    describeService: "Describe the service you need",
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
    describeService: "Describa el servicio que necesita",
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
    describeService: "Descreva o serviço de que precisa",
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

/** Chaves adicionais (aprovação digital + pagamento online). */
const extraTranslations: Record<string, Record<string, string>> = {
  pt: {
    approveQuote: "Aprovar", rejectQuote: "Rejeitar",
    confirmApproveTitle: "Aprovar orçamento?", confirmRejectTitle: "Rejeitar orçamento?",
    confirmApproveBody: "Ao aprovar, autoriza a oficina a avançar com os trabalhos descritos neste orçamento.",
    confirmRejectBody: "Ao rejeitar, a oficina será notificada de que não pretende avançar com este orçamento.",
    confirm: "Confirmar", cancel: "Cancelar",
    quoteApproved: "Orçamento aprovado. A oficina foi notificada.",
    quoteRejected: "Orçamento rejeitado.",
    quoteDecisionError: "Não foi possível registar a sua decisão.",
    payNow: "Pagar agora",
    payNotice: "Pagamento processado de forma segura pela plataforma GarageFlow em nome da oficina.",
    paymentSuccess: "Pagamento confirmado. A fatura está paga.",
    paymentError: "Não foi possível iniciar o pagamento.",
    paymentCanceled: "Pagamento cancelado.",
    photo: "Foto",
  },
  "pt-BR": {
    approveQuote: "Aprovar", rejectQuote: "Recusar",
    confirmApproveTitle: "Aprovar orçamento?", confirmRejectTitle: "Recusar orçamento?",
    confirmApproveBody: "Ao aprovar, você autoriza a oficina a executar os serviços descritos neste orçamento.",
    confirmRejectBody: "Ao recusar, a oficina será avisada de que você não deseja seguir com este orçamento.",
    confirm: "Confirmar", cancel: "Cancelar",
    quoteApproved: "Orçamento aprovado. A oficina foi avisada.",
    quoteRejected: "Orçamento recusado.",
    quoteDecisionError: "Não foi possível registrar sua decisão.",
    payNow: "Pagar agora",
    payNotice: "Pagamento processado com segurança pela plataforma GarageFlow em nome da oficina.",
    paymentSuccess: "Pagamento confirmado. A fatura está paga.",
    paymentError: "Não foi possível iniciar o pagamento.",
    paymentCanceled: "Pagamento cancelado.",
    photo: "Foto",
  },
  en: {
    approveQuote: "Approve", rejectQuote: "Reject",
    confirmApproveTitle: "Approve quote?", confirmRejectTitle: "Reject quote?",
    confirmApproveBody: "By approving, you authorise the workshop to proceed with the work in this quote.",
    confirmRejectBody: "By rejecting, the workshop will be notified that you do not wish to proceed.",
    confirm: "Confirm", cancel: "Cancel",
    quoteApproved: "Quote approved. The workshop has been notified.",
    quoteRejected: "Quote rejected.",
    quoteDecisionError: "We could not record your decision.",
    payNow: "Pay now",
    payNotice: "Payment is securely processed by the GarageFlow platform on behalf of the workshop.",
    paymentSuccess: "Payment confirmed. The invoice is paid.",
    paymentError: "We could not start the payment.",
    paymentCanceled: "Payment canceled.",
    photo: "Photo",
  },
  es: {
    approveQuote: "Aprobar", rejectQuote: "Rechazar",
    confirmApproveTitle: "¿Aprobar presupuesto?", confirmRejectTitle: "¿Rechazar presupuesto?",
    confirmApproveBody: "Al aprobar, autoriza al taller a realizar los trabajos de este presupuesto.",
    confirmRejectBody: "Al rechazar, el taller sabrá que no desea continuar con este presupuesto.",
    confirm: "Confirmar", cancel: "Cancelar",
    quoteApproved: "Presupuesto aprobado. El taller ha sido notificado.",
    quoteRejected: "Presupuesto rechazado.",
    quoteDecisionError: "No se pudo registrar su decisión.",
    payNow: "Pagar ahora",
    payNotice: "El pago se procesa de forma segura por la plataforma GarageFlow en nombre del taller.",
    paymentSuccess: "Pago confirmado. La factura está pagada.",
    paymentError: "No se pudo iniciar el pago.",
    paymentCanceled: "Pago cancelado.",
    photo: "Foto",
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
  return <>
    <Helmet>
      <title>Portal do cliente | GarageFlow</title>
      <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
      <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet" />
      <meta name="bingbot" content="noindex, nofollow, noarchive, nosnippet" />
      <meta name="referrer" content="no-referrer" />
    </Helmet>
    <ClientPortalContent />
  </>;
}

function ClientPortalContent() {
  const { token } = useParams<{ token: string }>();
  const [client, setClient] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [reminders, setReminders] = useState<ServiceReminder[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [quoteDecision, setQuoteDecision] = useState<{ quote: any; action: 'approved' | 'rejected' } | null>(null);
  const [decisionLoading, setDecisionLoading] = useState(false);
  const [decisionNote, setDecisionNote] = useState("");
  const [expandedQuotes, setExpandedQuotes] = useState<Record<string, boolean>>({});
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
  const [bookingData, setBookingData] = useState({ vehicle_id: '', date: '', time: '09:00', service_type: '', service_id: '', notes: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [portalServices, setPortalServices] = useState<{ id: string; name: string }[] | null>(null);

  useEffect(() => {
    if (!bookingOpen || !token || portalServices) return;
    supabase.rpc("get_client_portal_services" as any, { _token: token }).then(({ data, error }) => {
      setPortalServices(error ? [] : ((data as any[]) || []));
    });
  }, [bookingOpen, token, portalServices]);

  const t = (key: string) =>
    translations[lang]?.[key] ||
    extraTranslations[lang]?.[key] ||
    translations.pt[key] ||
    extraTranslations.pt[key] ||
    key;


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
      const { data: reminderData, error: reminderError } = await supabase.rpc('get_client_portal_reminders', { _token: token });
      if (!reminderError && Array.isArray(reminderData)) setReminders(reminderData as unknown as ServiceReminder[]);
      else if (reminderError) toast.error('Não foi possível carregar as próximas revisões.');
      // Inspeções feitas em Modo Oficina (checklists) associadas a este cliente
      setInspections(
        (payload.inspections || []).map((i: any) => ({
          ...i,
          work_orders: { number: i.work_order_number, vehicles: i.vehicle || null },
        })),
      );
      const { data: apptData } = await supabase.rpc('get_client_portal_appointments' as any, { _token: token });
      setAppointments(Array.isArray(apptData) ? apptData : []);
      setPayments([]);
      setLastUpdated(new Date());
      setRefreshing(false);
      setLoading(false);
    };
    load();
  }, [token, reloadKey]);

  // Mantém o portal atualizado sem o cliente ter de ligar: a cada 60 s com a página visível e ao voltar à página.
  useEffect(() => {
    if (!token) return;
    const refresh = () => { if (document.visibilityState === 'visible') setReloadKey(k => k + 1); };
    const id = window.setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', refresh); };
  }, [token]);

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

  const confirmQuoteDecision = async () => {
    if (!quoteDecision || !token) return;
    setDecisionLoading(true);
    try {
      const { error: rpcErr } = await supabase.rpc("portal_respond_to_quote", {
        _portal_token: token,
        _quote_id: quoteDecision.quote.id,
        _action: quoteDecision.action,
        _client_notes: decisionNote.trim() ? decisionNote.trim().slice(0, 1000) : null,
      });
      if (rpcErr) throw rpcErr;
      // Aviso à oficina — igual para aprovação e rejeição (o sino é gravado pelo trigger da BD)
      if (shop?.email) {
        try {
          const approved = quoteDecision.action === 'approved';
          await sendEmail({
            to: shop.email,
            shop_id: shop.id,
            subject: `${approved ? '✅' : '❌'} Orçamento ${quoteDecision.quote.number} ${approved ? 'aprovado' : 'rejeitado'} pelo cliente`,
            html: `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
              <h2 style="margin:0 0 12px">Orçamento ${approved ? 'aprovado' : 'rejeitado'}</h2>
              <p>O cliente ${approved ? 'aprovou' : 'rejeitou'} o orçamento <strong>${quoteDecision.quote.number}</strong> através do portal.</p>
            </div>`,
          });
        } catch (e) { console.error('quote decision notify email error', e); }
      }
      toast.success(quoteDecision.action === 'approved' ? t('quoteApproved') : t('quoteRejected'));
      setQuoteDecision(null);
      setDecisionNote("");
      setReloadKey((k) => k + 1);
    } catch (e: any) {
      toast.error(e?.message === 'expired' ? pendingText.expired : e?.message === 'already_processed' ? t('quoteDecisionError') : (e?.message || t('quoteDecisionError')));
    } finally {
      setDecisionLoading(false);
    }
  };

  const handlePayInvoice = async (inv: any) => {
    if (!token) return;
    setPayingId(inv.id);
    try {
      const { data: prep, error: prepErr } = await supabase.rpc("portal_prepare_invoice_payment", {
        _portal_token: token,
        _invoice_id: inv.id,
      });
      if (prepErr) throw prepErr;
      const invoiceToken = (prep as any)?.token;
      if (!invoiceToken) throw new Error(t('paymentError'));

      const { data, error: fnErr } = await supabase.functions.invoke("invoice-pay", {
        body: {
          token: invoiceToken,
          action: "checkout",
          origin: window.location.origin,
          return_url: `${window.location.origin}/portal/${token}`,
        },
      });
      if (fnErr) throw fnErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.url;
      if (!url) throw new Error(t('paymentError'));
      window.location.assign(url);
    } catch (e: any) {
      toast.error(e?.message || t('paymentError'));
      setPayingId(null);
    }
  };

  const handleBooking = async () => {

    if (!bookingData.vehicle_id || !bookingData.date || !bookingData.time || (!bookingData.service_id && !bookingData.service_type.trim())) return;
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
        service_type: bookingData.service_type.trim(),
        service_id: bookingData.service_id || null,
        notes: bookingData.notes,
        status: 'pending',
        source: 'portal',
      } as any);
      if (error) throw error;
      toast.success(t('appointmentSuccess'));
      setBookingOpen(false);
      setBookingData({ vehicle_id: '', date: '', time: '09:00', service_type: '', service_id: '', notes: '' });
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

  const todayStr = new Date().toLocaleDateString('en-CA');
  const canDecideQuote = (q: any) =>
    (q.status === 'sent' || q.status === 'draft') && !(q.validity_date && String(q.validity_date) < todayStr);
  const pendingQuotes = quotes.filter(canDecideQuote);
  const pendingText = lang === 'en'
    ? { banner: (n: number) => n === 1 ? '1 quote awaiting your approval' : `${n} quotes awaiting your approval`, cta: 'Review', valid: 'Valid until', note: 'Comment for the workshop (optional)', all: 'Show all lines', less: 'Show less', expired: 'This quote has expired. Please contact the workshop.' }
    : lang === 'es'
    ? { banner: (n: number) => n === 1 ? '1 presupuesto pendiente de su aprobación' : `${n} presupuestos pendientes de su aprobación`, cta: 'Revisar', valid: 'Válido hasta', note: 'Comentario para el taller (opcional)', all: 'Ver todas las líneas', less: 'Ver menos', expired: 'Este presupuesto ha caducado. Contacte con el taller.' }
    : { banner: (n: number) => n === 1 ? '1 orçamento aguarda a sua aprovação' : `${n} orçamentos aguardam a sua aprovação`, cta: 'Ver e aprovar', valid: 'Válido até', note: 'Comentário para a oficina (opcional)', all: 'Ver todas as linhas', less: 'Ver menos', expired: lang === 'pt-BR' ? 'Este orçamento expirou. Entre em contato com a oficina.' : 'Este orçamento expirou. Contacte a oficina.' };

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
            <div className="min-w-0 flex-1">
              {shop?.logo_url && (
                <img src={shop.logo_url} alt={shop.name} className="block h-16 w-auto max-w-full object-contain object-left mb-3" />
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

        {/* Ponto de situação — tudo o que está a acontecer agora */}
        {(() => {
          const L = lang === 'en'
            ? { now: 'Right now', inShop: 'In the workshop', ready: 'Ready for pickup', readyMsg: 'Your vehicle is ready. You can pick it up.', upcoming: 'Upcoming appointments', updated: 'Updated at', call: 'Call', email: 'Email', nothing: 'No vehicle in the workshop at the moment.', at: 'at', dropoff: 'Vehicle drop-off', pickup: 'Vehicle pickup', pendingConf: 'Awaiting confirmation', step: 'Step', of: 'of', open: 'Details' }
            : lang === 'es'
            ? { now: 'Ahora mismo', inShop: 'En el taller', ready: 'Listo para recoger', readyMsg: 'Su vehículo está listo. Puede recogerlo.', upcoming: 'Próximas citas', updated: 'Actualizado a las', call: 'Llamar', email: 'Email', nothing: 'Ningún vehículo en el taller en este momento.', at: 'a las', dropoff: 'Entrega del vehículo', pickup: 'Recogida del vehículo', pendingConf: 'Pendiente de confirmación', step: 'Paso', of: 'de', open: 'Detalle' }
            : { now: 'Ponto de situação', inShop: 'Na oficina', ready: 'Pronto para levantar', readyMsg: lang === 'pt-BR' ? 'Seu veículo está pronto. Já pode retirar.' : 'A sua viatura está pronta. Já pode levantar.', upcoming: 'Próximas marcações', updated: 'Atualizado às', call: 'Ligar', email: 'Email', nothing: lang === 'pt-BR' ? 'Nenhum veículo na oficina neste momento.' : 'Nenhuma viatura na oficina neste momento.', at: 'às', dropoff: lang === 'pt-BR' ? 'Entrega do veículo' : 'Entrega da viatura', pickup: lang === 'pt-BR' ? 'Retirada do veículo' : 'Levantamento da viatura', pendingConf: 'A aguardar confirmação', step: 'Passo', of: 'de', open: 'Detalhe' };
          const active = services.filter(sv => !['completed', 'delivered', 'cancelled'].includes(sv.status));
          const ready = services.filter(sv => sv.status === 'completed' && !sv.delivered_at);
          const waUrl = shop?.phone ? buildWhatsAppUrl({ phone: shop.phone, type: 'client', customMessage: `${client.name ? `Olá, sou ${client.name}. ` : 'Olá. '}` } as any) : null;
          const vLabel = (v: any) => v ? `${v.make || ''} ${v.model || ''}${v.plate ? ` — ${v.plate}` : ''}`.trim() : '';
          const fmtD = (d: string) => { const [y, m, dd] = String(d).split('-'); return dd ? `${dd}/${m}/${y}` : d; };
          return (
            <div className="bg-card border border-border rounded-xl p-4 mb-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold">{L.now}</h3>
                <button type="button" onClick={() => { setRefreshing(true); setReloadKey(k => k + 1); }} className="flex items-center gap-1 text-[11px] text-muted-foreground min-h-9 px-1" aria-label="refresh">
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                  {lastUpdated ? `${L.updated} ${format(lastUpdated, 'HH:mm')}` : ''}
                </button>
              </div>

              {ready.map(sv => (
                <button key={sv.id} type="button" onClick={() => setSelectedService(sv)} className="w-full text-left rounded-lg border border-success/40 bg-success/10 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-success"><PackageCheck className="h-4 w-4" />{L.ready}</p>
                  <p className="text-xs mt-0.5">{vLabel(sv.vehicles)} · <span className="font-mono">{sv.number}</span></p>
                  <p className="text-xs text-muted-foreground mt-0.5">{L.readyMsg}</p>
                </button>
              ))}

              {active.map(sv => {
                const idx = Math.max(0, statusFlow.indexOf(sv.status));
                return (
                  <button key={sv.id} type="button" onClick={() => setSelectedService(sv)} className="w-full text-left rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-semibold"><Wrench className="h-4 w-4 text-primary" />{L.inShop}</p>
                      <Badge variant="secondary" className={serviceStatusColors[sv.status] || ''}>{t(sv.status)}</Badge>
                    </div>
                    <p className="text-xs mt-0.5">{vLabel(sv.vehicles)} · <span className="font-mono">{sv.number}</span></p>
                    <ServiceTimeline status={sv.status} />
                    <p className="text-[11px] text-muted-foreground mt-1">{L.step} {idx + 1} {L.of} {statusFlow.length} · {L.open} <ChevronRight className="inline h-3 w-3" /></p>
                  </button>
                );
              })}

              {!active.length && !ready.length && <p className="text-xs text-muted-foreground">{L.nothing}</p>}

              {appointments.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <p className="text-xs font-semibold flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{L.upcoming}</p>
                  {appointments.slice(0, 5).map(a => (
                    <div key={a.id} className="flex items-start justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium">{fmtD(a.date)} {L.at} {String(a.time).slice(0, 5)}</p>
                        <p className="text-muted-foreground truncate">{(a.auto_kind === 'reception' || a.auto_kind === 'claim_in') ? L.dropoff : (a.auto_kind === 'delivery' || a.auto_kind === 'claim_out') ? L.pickup : (({ revision: lang === 'en' ? 'Service' : lang === 'es' ? 'Revisión' : 'Revisão', maintenance: lang === 'en' ? 'Maintenance' : 'Manutenção', inspection: lang === 'en' ? 'Inspection' : 'Inspeção', repair: lang === 'en' ? 'Repair' : 'Reparação' } as Record<string, string>)[a.service_type] || a.service_type)}{a.vehicle ? ` · ${vLabel(a.vehicle)}` : ''}</p>
                      </div>
                      {a.status === 'pending' && <Badge variant="secondary" className="shrink-0 bg-warning/10 text-warning">{L.pendingConf}</Badge>}
                    </div>
                  ))}
                </div>
              )}

              {(shop?.phone || shop?.email) && (
                <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                  {shop?.phone && <Button asChild size="sm" variant="outline" className="min-h-11 flex-1"><a href={`tel:${shop.phone}`}><Phone className="h-4 w-4 mr-1.5" />{L.call}</a></Button>}
                  {waUrl && <Button asChild size="sm" variant="outline" className="min-h-11 flex-1"><a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-4 w-4 mr-1.5" />WhatsApp</a></Button>}
                  {shop?.email && <Button asChild size="sm" variant="outline" className="min-h-11 flex-1"><a href={`mailto:${shop.email}`}><Mail className="h-4 w-4 mr-1.5" />{L.email}</a></Button>}
                </div>
              )}
            </div>
          );
        })()}

        {/* Tabs */}
        {reminders.filter(r => hasActiveReminderNotice(r, new Date().toLocaleDateString('en-CA'))).map(r => {
          const v = vehicles.find(v => v.id === r.vehicle_id);
          return <div key={r.id} className="border-l-2 border-primary py-2 px-3 mb-4 text-sm">
            <p className="font-medium">{t('notifications')} · {v?.make} {v?.model} · {v?.plate}</p>
            {r.next_service_date && <p className="text-muted-foreground">{(() => {
              const days = reminderDaysUntil(r.next_service_date, r.local_date || new Date().toLocaleDateString('en-CA'));
              if (days === null || days < 0) return null;
              if (lang === 'en') return days === 0 ? 'Next service is today' : days === 1 ? 'Next service is tomorrow' : `Next service in ${days} days`;
              if (lang === 'es') return days === 0 ? 'La próxima revisión es hoy' : days === 1 ? 'La próxima revisión es mañana' : `Próxima revisión dentro de ${days} días`;
              return days === 0 ? 'A próxima revisão é hoje' : days === 1 ? 'A próxima revisão é amanhã' : `Faltam ${days} dias para a próxima revisão`;
            })()}</p>}
            <NextServiceSummary reminder={r} language={lang} />
            <Button size="sm" variant="outline" className="mt-2 min-h-11" onClick={() => setActiveTab('vehicles')}><Car className="h-4 w-4 mr-2" />{t('vehicles')}</Button>
          </div>;
        })}
        {pendingQuotes.length > 0 && activeTab !== 'quotes' && (
          <div className="mb-4 rounded-xl border border-primary/40 bg-primary/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText className="h-5 w-5 text-primary shrink-0" />
              <p className="text-sm font-semibold">{pendingText.banner(pendingQuotes.length)}</p>
            </div>
            <Button size="sm" className="min-h-11" onClick={() => setActiveTab('quotes')}>{pendingText.cta}</Button>
          </div>
        )}
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
                    <p className="text-xs text-muted-foreground">{q.date}{q.validity_date ? ` · ${pendingText.valid} ${q.validity_date}` : ''}</p>
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
                    {(expandedQuotes[q.id] ? (q.lines as any[]) : (q.lines as any[]).slice(0, 3)).map((line: any, idx: number) => (
                      <div key={idx} className="flex justify-between">
                        <span className="truncate mr-2">{line.description}</span>
                        <span className="font-mono shrink-0">{cur}{(line.total || 0).toFixed(2)}</span>
                      </div>
                    ))}
                    {(q.lines as any[]).length > 3 && (
                      <button type="button" className="text-primary font-medium py-1" onClick={() => setExpandedQuotes(m => ({ ...m, [q.id]: !m[q.id] }))}>
                        {expandedQuotes[q.id] ? pendingText.less : `${pendingText.all} (${(q.lines as any[]).length})`}
                      </button>
                    )}
                  </div>
                )}
                {canDecideQuote(q) && (
                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
                    <Button
                      size="sm"
                      className="min-h-[40px] gap-1"
                      onClick={() => setQuoteDecision({ quote: q, action: 'approved' })}
                    >
                      <CheckCircle className="w-4 h-4" />
                      {t('approveQuote')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="min-h-[40px] gap-1 text-destructive border-destructive/40"
                      onClick={() => setQuoteDecision({ quote: q, action: 'rejected' })}
                    >
                      <XCircle className="w-4 h-4" />
                      {t('rejectQuote')}
                    </Button>
                    {q.token && (
                      <a
                        href={`${window.location.origin}/quote/${q.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium"
                      >
                        {lang === 'en' ? 'Full detail' : lang === 'es' ? 'Ver detalle' : 'Ver detalhe'}
                      </a>
                    )}
                  </div>
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
                  
                  {/* Pagamento online */}
                  {(inv.status === 'issued' || inv.status === 'partial') && !inv.paid_online_at && (
                    <Button
                      size="sm"
                      className="w-full min-h-[44px] gap-2"
                      disabled={payingId === inv.id}
                      onClick={() => handlePayInvoice(inv)}
                    >
                      {payingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                      {t('payNow')}
                    </Button>
                  )}
                  {(inv.status === 'issued' || inv.status === 'partial') && !inv.paid_online_at && (
                    <p className="text-[11px] text-muted-foreground leading-snug">{t('payNotice')}</p>
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
                  <NextServiceSummary reminder={reminders.find(r => r.vehicle_id === v.id)} language={lang} />
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
                        <span className="truncate flex-1">{item.label || item.name}</span>
                        {item.photo_url && (
                          <a href={item.photo_url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                            <img
                              src={item.photo_url}
                              alt={`${t('photo')} — ${item.label || item.name}`}
                              loading="lazy"
                              className="w-8 h-8 rounded object-cover border border-border"
                            />
                          </a>
                        )}
                      </div>
                    ))}
                  </div>

                </div>
              );
            })
          )}
        </div>

        {/* Confirmação da decisão sobre o orçamento */}
        <AlertDialog open={!!quoteDecision} onOpenChange={(o) => { if (!o) { setQuoteDecision(null); setDecisionNote(""); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {quoteDecision?.action === 'approved' ? t('confirmApproveTitle') : t('confirmRejectTitle')}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {quoteDecision?.quote?.number ? `${quoteDecision.quote.number} · ` : ''}
                {quoteDecision?.action === 'approved' ? t('confirmApproveBody') : t('confirmRejectBody')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {quoteDecision?.quote && (
              <p className="text-sm font-semibold font-mono">{cur}{Number(quoteDecision.quote.total || 0).toFixed(2)}</p>
            )}
            <div className="space-y-1">
              <Label className="text-xs">{pendingText.note}</Label>
              <Textarea value={decisionNote} maxLength={1000} rows={2} onChange={(e) => setDecisionNote(e.target.value)} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={decisionLoading}>{t('cancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={(e) => { e.preventDefault(); confirmQuoteDecision(); }} disabled={decisionLoading}>
                {decisionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Footer */}

        <div className="text-center py-6 border-t border-border">
          {shop?.logo_url && <img src={shop.logo_url} alt={shop.name} className="block h-12 w-auto max-w-full object-contain mx-auto mb-2" />}
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
              {portalServices === null ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /></div>
              ) : portalServices.length === 0 ? (
                <Input value={bookingData.service_type} onChange={e => setBookingData(prev => ({ ...prev, service_type: e.target.value }))} placeholder={t('describeService')} />
              ) : (
                <Select value={bookingData.service_id} onValueChange={v => setBookingData(prev => ({ ...prev, service_id: v, service_type: portalServices.find(s => s.id === v)?.name || '' }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {portalServices.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t('notes')}</Label>
              <Textarea value={bookingData.notes} onChange={e => setBookingData(prev => ({ ...prev, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBookingOpen(false)}>{t('cancel')}</Button>
            <Button onClick={handleBooking} disabled={bookingLoading || !bookingData.vehicle_id || !bookingData.date || (!bookingData.service_id && !bookingData.service_type.trim())}>
              {bookingLoading && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
              {t('submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
