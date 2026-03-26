import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, Wrench, Loader2, AlertTriangle, Car, User, Calendar, MessageSquare, FileText, PenTool } from "lucide-react";
import { sendEmail } from "@/lib/emailService";
import SignaturePad from "@/components/SignaturePad";

const translations: Record<string, Record<string, string>> = {
  pt: {
    loading: "A carregar...",
    error: "Erro",
    invalidToken: "Token inválido",
    notFound: "Orçamento não encontrado",
    expired: "Este orçamento expirou",
    expiredDesc: "O prazo de validade deste orçamento terminou. Contacte a oficina para um novo orçamento.",
    approved: "Orçamento Aprovado!",
    approvedDesc: "Obrigado pela sua aprovação. A oficina entrará em contacto em breve para agendar o serviço.",
    rejected: "Orçamento Rejeitado",
    rejectedDesc: "Agradecemos o seu feedback. A oficina poderá contactá-lo com alternativas.",
    alreadyProcessed: "Este orçamento já foi processado.",
    pending: "Pendente",
    client: "Cliente",
    vehicle: "Veículo",
    plate: "Matrícula",
    description: "Descrição",
    qty: "Qtd",
    price: "Preço Unit.",
    total: "Total",
    subtotal: "Subtotal",
    vat: "IVA",
    validUntil: "Válido até",
    notes: "Notas da oficina",
    approve: "✅ Aprovar Orçamento",
    reject: "❌ Rejeitar",
    requestChanges: "Solicitar Alterações",
    service: "Serviço",
    part: "Peça",
    footer: "Gestão profissional de oficinas",
    contact: "Contacto",
    clientComment: "Comentário (opcional)",
    clientCommentPlaceholder: "Deixe uma nota ou pedido de alteração...",
    quoteDetails: "Detalhes do Orçamento",
    vehicleInfo: "Informação do Veículo",
    approvedAt: "Aprovado em",
    rejectedAt: "Rejeitado em",
    estimatedTime: "Tempo estimado",
    hours: "horas",
    signatureTitle: "Assinatura Digital",
    signerName: "Nome do signatário",
    signerNamePlaceholder: "Introduza o seu nome completo",
    signatureClear: "Limpar",
    signatureConfirm: "Confirmar assinatura",
    signatureDrawHere: "Desenhe a sua assinatura aqui",
    signatureRequired: "Assinatura e nome são obrigatórios para aprovar.",
    signedBy: "Assinado por",
    signatureHash: "Hash de verificação",
  },
  en: {
    loading: "Loading...",
    error: "Error",
    invalidToken: "Invalid token",
    notFound: "Quote not found",
    expired: "This quote has expired",
    expiredDesc: "The validity period for this quote has ended. Contact the workshop for a new quote.",
    approved: "Quote Approved!",
    approvedDesc: "Thank you for your approval. The workshop will contact you soon to schedule the service.",
    rejected: "Quote Rejected",
    rejectedDesc: "We appreciate your feedback. The workshop may contact you with alternatives.",
    alreadyProcessed: "This quote has already been processed.",
    pending: "Pending",
    client: "Client",
    vehicle: "Vehicle",
    plate: "Plate",
    description: "Description",
    qty: "Qty",
    price: "Unit Price",
    total: "Total",
    subtotal: "Subtotal",
    vat: "VAT",
    validUntil: "Valid until",
    notes: "Workshop notes",
    approve: "✅ Approve Quote",
    reject: "❌ Reject",
    requestChanges: "Request Changes",
    service: "Service",
    part: "Part",
    footer: "Professional workshop management",
    contact: "Contact",
    clientComment: "Comment (optional)",
    clientCommentPlaceholder: "Leave a note or change request...",
    quoteDetails: "Quote Details",
    vehicleInfo: "Vehicle Information",
    approvedAt: "Approved on",
    rejectedAt: "Rejected on",
    estimatedTime: "Estimated time",
    hours: "hours",
    signatureTitle: "Digital Signature",
    signerName: "Signer name",
    signerNamePlaceholder: "Enter your full name",
    signatureClear: "Clear",
    signatureConfirm: "Confirm signature",
    signatureDrawHere: "Draw your signature here",
    signatureRequired: "Signature and name are required to approve.",
    signedBy: "Signed by",
    signatureHash: "Verification hash",
  },
  es: {
    loading: "Cargando...",
    error: "Error",
    invalidToken: "Token inválido",
    notFound: "Presupuesto no encontrado",
    expired: "Este presupuesto ha expirado",
    expiredDesc: "El plazo de validez ha terminado. Contacte el taller para uno nuevo.",
    approved: "¡Presupuesto Aprobado!",
    approvedDesc: "Gracias por su aprobación. El taller se pondrá en contacto pronto para programar el servicio.",
    rejected: "Presupuesto Rechazado",
    rejectedDesc: "Agradecemos su respuesta. El taller podrá contactarle con alternativas.",
    alreadyProcessed: "Este presupuesto ya ha sido procesado.",
    pending: "Pendiente",
    client: "Cliente",
    vehicle: "Vehículo",
    plate: "Matrícula",
    description: "Descripción",
    qty: "Cant",
    price: "Precio Unit.",
    total: "Total",
    subtotal: "Subtotal",
    vat: "IVA",
    validUntil: "Válido hasta",
    notes: "Notas del taller",
    approve: "✅ Aprobar Presupuesto",
    reject: "❌ Rechazar",
    requestChanges: "Solicitar Cambios",
    service: "Servicio",
    part: "Pieza",
    footer: "Gestión profesional de talleres",
    contact: "Contacto",
    clientComment: "Comentario (opcional)",
    clientCommentPlaceholder: "Deje una nota o solicitud de cambio...",
    quoteDetails: "Detalles del Presupuesto",
    vehicleInfo: "Información del Vehículo",
    approvedAt: "Aprobado en",
    rejectedAt: "Rechazado en",
    estimatedTime: "Tiempo estimado",
    hours: "horas",
    signatureTitle: "Firma Digital",
    signerName: "Nombre del firmante",
    signerNamePlaceholder: "Introduzca su nombre completo",
    signatureClear: "Borrar",
    signatureConfirm: "Confirmar firma",
    signatureDrawHere: "Dibuje su firma aquí",
    signatureRequired: "Firma y nombre son obligatorios para aprobar.",
    signedBy: "Firmado por",
    signatureHash: "Hash de verificación",
  },
};

export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'approved' | 'rejected' | 'expired' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<string>("pt");
  const [clientComment, setClientComment] = useState("");
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signerName, setSignerName] = useState<string>("");
  const t = (key: string) => translations[lang]?.[key] || translations.pt[key] || key;

  useEffect(() => {
    const load = async () => {
      if (!token) { setError(translations.pt.invalidToken); setLoading(false); return; }

      const { data: q, error: qErr } = await supabase
        .from("quotes")
        .select("*, clients(name, email, phone, company), vehicles(make, model, plate, year, fuel, mileage)")
        .eq("token", token)
        .single();

      if (qErr || !q) { setError(translations.pt.notFound); setLoading(false); return; }

      const { data: s } = await supabase
        .from("shops")
        .select("name, email, phone, nif, address, logo_url, currency, language")
        .eq("id", q.shop_id)
        .single();

      if (s?.language && translations[s.language]) {
        setLang(s.language);
      }

      setQuote(q);
      setShop(s);
      setLoading(false);

      if (['approved', 'rejected'].includes(q.status)) {
        setResult(q.status as 'approved' | 'rejected');
        return;
      }

      if (q.validity_date) {
        const today = new Date().toISOString().split("T")[0];
        if (q.validity_date < today) {
          setResult('expired');
          await supabase.from("quotes").update({ status: 'expired' }).eq("id", q.id);
          return;
        }
      }
    };
    load();
  }, [token]);

  const generateHash = async (data: string): Promise<string> => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleSignature = (data: string, name: string) => {
    setSignatureData(data);
    setSignerName(name);
  };

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!quote || !shop) return;
    
    // Require signature for approval
    if (action === 'approved' && (!signatureData || !signerName)) return;
    
    setSubmitting(true);

    const updateData: any = { status: action };
    if (clientComment.trim()) {
      updateData.client_notes = clientComment.trim();
    }

    // Add signature data for approvals
    if (action === 'approved' && signatureData) {
      const hashInput = `${quote.id}|${signerName}|${quote.total}|${new Date().toISOString()}`;
      updateData.signature_data = signatureData;
      updateData.signature_hash = await generateHash(hashInput);
      updateData.signed_at = new Date().toISOString();
      updateData.signer_name = signerName;
    }

    const { error: err } = await supabase
      .from("quotes")
      .update(updateData)
      .eq("id", quote.id);

    if (err) { setError(err.message); setSubmitting(false); return; }

    // Log audit
    try {
      await supabase.from("audit_logs").insert({
        action: `quote_${action}`,
        entity_type: 'quote',
        entity_id: quote.id,
        details: {
          quote_number: quote.number,
          client_name: (quote.clients as any)?.name,
          client_comment: clientComment.trim() || null,
          action_at: new Date().toISOString(),
        },
      });
    } catch (e) { console.error("Audit log error:", e); }

    setResult(action);
    setSubmitting(false);

    // Send notification email
    try {
      const clientName = (quote.clients as any)?.name || "—";
      const emailLabels: Record<string, { approved: string; rejected: string; statusText: (a: string) => string }> = {
        pt: { approved: '✅ APROVADO', rejected: '❌ REJEITADO', statusText: (a) => a === 'approved' ? 'aprovado' : 'rejeitado' },
        en: { approved: '✅ APPROVED', rejected: '❌ REJECTED', statusText: (a) => a === 'approved' ? 'approved' : 'rejected' },
        es: { approved: '✅ APROBADO', rejected: '❌ RECHAZADO', statusText: (a) => a === 'approved' ? 'aprobado' : 'rechazado' },
      };
      const el = emailLabels[lang] || emailLabels.pt;
      const actionLabel = action === 'approved' ? el.approved : el.rejected;
      const vehicleLabels: Record<string, string> = { pt: 'Veículo', en: 'Vehicle', es: 'Vehículo' };
      const vehicleLabel = vehicleLabels[lang] || vehicleLabels.pt;
      const commentLabels: Record<string, string> = { pt: 'Comentário do cliente', en: 'Client comment', es: 'Comentario del cliente' };
      const subject = `${actionLabel} — ${t('pending') === 'Pending' ? 'Quote' : lang === 'es' ? 'Presupuesto' : 'Orçamento'} ${quote.number} — ${clientName}`;
      const commentHtml = clientComment.trim() ? `
        <div style="background-color:#f8f9fa;border-left:3px solid #6366f1;padding:12px 16px;margin:16px 0;border-radius:4px;">
          <p style="color:#6366f1;font-size:12px;margin:0 0 4px;font-weight:600;">${commentLabels[lang] || commentLabels.pt}</p>
          <p style="color:#374151;font-size:14px;margin:0;">${clientComment.trim()}</p>
        </div>` : '';
      const html = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
          <div style="background-color:${action === 'approved' ? '#f0fdf4' : '#fef2f2'};border-left:4px solid ${action === 'approved' ? '#16a34a' : '#dc2626'};padding:16px;border-radius:4px;margin-bottom:20px;">
            <h2 style="color:${action === 'approved' ? '#166534' : '#991b1b'};font-size:18px;margin:0 0 8px;">${actionLabel}</h2>
            <p style="color:#374151;font-size:14px;margin:0;">${quote.number} — ${el.statusText(action)} — <strong>${clientName}</strong></p>
          </div>
          ${commentHtml}
          <table style="width:100%;font-size:13px;color:#6b7280;">
            <tr><td style="padding:4px 0;"><strong>${vehicleLabel}:</strong></td><td>${(quote.vehicles as any)?.make} ${(quote.vehicles as any)?.model} — ${(quote.vehicles as any)?.plate}</td></tr>
            <tr><td style="padding:4px 0;"><strong>Total:</strong></td><td>€${quote.total?.toFixed(2)}</td></tr>
          </table>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
          <p style="color:#bbb;font-size:12px;text-align:center;">${shop.name} — GarageFlow</p>
        </div>
      `;
      await sendEmail({ to: shop.email, subject, html });
    } catch (emailErr) {
      console.error("Failed to send notification email:", emailErr);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="bg-card border border-border rounded-2xl p-8 text-center max-w-md w-full shadow-lg">
          <XCircle className="w-14 h-14 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-bold mb-2">{t('error')}</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="bg-card border border-border rounded-2xl p-10 text-center max-w-md w-full shadow-lg">
          {result === 'approved' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <h1 className="text-2xl font-bold mb-2">{t('approved')}</h1>
              <p className="text-muted-foreground">{t('approvedDesc')}</p>
            </>
          ) : result === 'expired' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-5">
                <AlertTriangle className="w-10 h-10 text-warning" />
              </div>
              <h1 className="text-2xl font-bold mb-2">{t('expired')}</h1>
              <p className="text-muted-foreground">{t('expiredDesc')}</p>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold mb-2">{t('rejected')}</h1>
              <p className="text-muted-foreground">{t('rejectedDesc')}</p>
            </>
          )}
          <div className="mt-8 pt-5 border-t border-border">
            {shop?.logo_url && <img src={shop.logo_url} alt={shop.name} className="max-h-8 mx-auto mb-2" />}
            {shop?.name && <p className="font-semibold text-foreground">{shop.name}</p>}
            {shop?.email && <p className="text-sm text-muted-foreground">{shop.email}</p>}
            {shop?.phone && <p className="text-sm text-muted-foreground">{shop.phone}</p>}
          </div>
        </div>
      </div>
    );
  }

  const lines = (Array.isArray(quote.lines) ? quote.lines : []) as any[];
  const cur = shop?.currency === 'EUR' ? '€' : (shop?.currency || '€');
  const totalLaborHours = lines.filter((l: any) => l.type === 'service').reduce((s: number, l: any) => s + (l.quantity || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-4 sm:p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header Card */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg mb-6">
          <div className="bg-foreground p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                {shop?.logo_url && (
                  <img src={shop.logo_url} alt={shop.name} className="max-h-12 mb-3 brightness-200 contrast-0 invert" />
                )}
                <h1 className="text-xl sm:text-2xl font-bold text-background">{shop?.name}</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-background/60">
                  {shop?.nif && <span>NIF: {shop.nif}</span>}
                  {shop?.address && <span>{shop.address}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <Badge variant="secondary" className="bg-primary/20 text-primary mb-2 text-xs">
                  <Clock className="w-3 h-3 mr-1" />
                  {t('pending')}
                </Badge>
                <p className="text-2xl font-bold text-background font-mono">{quote.number}</p>
                <p className="text-xs text-background/60 mt-1">
                  <Calendar className="w-3 h-3 inline mr-1" />{quote.date}
                </p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8 space-y-6">
            {/* Client & Vehicle Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('client')}</span>
                </div>
                <p className="font-semibold text-foreground">{(quote.clients as any)?.name}</p>
                {(quote.clients as any)?.company && (
                  <p className="text-sm text-muted-foreground">{(quote.clients as any).company}</p>
                )}
              </div>
              <div className="bg-muted/50 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Car className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('vehicle')}</span>
                </div>
                <p className="font-semibold text-foreground">
                  {(quote.vehicles as any)?.make} {(quote.vehicles as any)?.model}
                  {(quote.vehicles as any)?.year ? ` (${(quote.vehicles as any).year})` : ''}
                </p>
                <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                  <span className="font-mono bg-background px-2 py-0.5 rounded text-xs font-semibold">{(quote.vehicles as any)?.plate}</span>
                  {(quote.vehicles as any)?.fuel && <span>{(quote.vehicles as any).fuel}</span>}
                  {(quote.vehicles as any)?.mileage > 0 && <span>{(quote.vehicles as any).mileage?.toLocaleString()} km</span>}
                </div>
              </div>
            </div>

            {/* Lines Table */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">{t('quoteDetails')}</span>
              </div>
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/70">
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">{t('description')}</th>
                      <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase w-16">{t('qty')}</th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase hidden sm:table-cell">{t('price')}</th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">{t('total')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line: any, i: number) => (
                      <tr key={i} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
                        <td className="p-3">
                          <span className="font-medium">{line.name}</span>
                          <Badge variant="outline" className="ml-2 text-[10px] py-0">
                            {line.type === 'service' ? t('service') : t('part')}
                          </Badge>
                        </td>
                        <td className="p-3 text-center font-mono text-muted-foreground">{line.quantity}</td>
                        <td className="p-3 text-right font-mono text-muted-foreground hidden sm:table-cell">{cur}{line.unit_price?.toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-semibold">{cur}{(line.quantity * line.unit_price).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 bg-muted/30 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span className="font-mono">{cur}{quote.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t('vat')}</span>
                  <span className="font-mono">{cur}{quote.vat_total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xl font-bold pt-3 border-t border-border">
                  <span>{t('total')}</span>
                  <span className="font-mono text-primary">{cur}{quote.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Validity & Estimated Time */}
            <div className="flex flex-wrap gap-3">
              <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('validUntil')}:</span>
                <span className="font-semibold">{quote.validity_date}</span>
              </div>
              {totalLaborHours > 0 && (
                <div className="bg-muted/50 rounded-lg px-4 py-2.5 text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">{t('estimatedTime')}:</span>
                  <span className="font-semibold">~{totalLaborHours} {t('hours')}</span>
                </div>
              )}
            </div>

            {quote.notes && (
              <div className="bg-warning/5 border border-warning/20 rounded-xl p-4 text-sm">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="w-4 h-4 text-warning" />
                  <span className="font-semibold text-warning">{t('notes')}</span>
                </div>
                <p className="text-foreground/80 whitespace-pre-wrap">{quote.notes}</p>
              </div>
            )}

            {/* Client Comment */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" />
                {t('clientComment')}
              </label>
              <Textarea
                value={clientComment}
                onChange={e => setClientComment(e.target.value)}
                placeholder={t('clientCommentPlaceholder')}
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                className="flex-1 h-14 text-base font-semibold rounded-xl bg-success hover:bg-success/90 text-white shadow-lg shadow-success/20 transition-all"
                onClick={() => handleAction('approved')}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                {t('approve')}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-14 text-base font-semibold rounded-xl border-2 border-destructive/30 text-destructive hover:bg-destructive/5 transition-all"
                onClick={() => handleAction('rejected')}
                disabled={submitting}
              >
                <XCircle className="w-5 h-5 mr-2" />
                {t('reject')}
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wrench className="w-4 h-4" />
            <span className="font-semibold">GarageFlow</span>
          </div>
          <p>{t('footer')}</p>
          {shop?.email && shop?.phone && (
            <p className="text-xs mt-1">{t('contact')}: {shop.email} | {shop.phone}</p>
          )}
        </div>
      </div>
    </div>
  );
}