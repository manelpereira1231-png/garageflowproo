import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, Wrench, Loader2, AlertTriangle, Car, User, Calendar, MessageSquare, FileText, PenTool, ArrowLeft } from "lucide-react";
import { sendEmail } from "@/lib/emailService";
import { autoCreateWorkOrderFromQuote } from "@/lib/autoCreateWorkOrderFromQuote";
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

      const { data: rpcData, error: qErr } = await supabase
        .rpc("get_quote_by_token", { _token: token });

      if (qErr || !rpcData) { setError(translations.pt.notFound); setLoading(false); return; }

      const payload = rpcData as any;
      const q = payload.quote ? { ...payload.quote, clients: payload.client, vehicles: payload.vehicle } : null;
      const s = payload.shop || null;
      if (!q) { setError(translations.pt.notFound); setLoading(false); return; }

      if (s?.language && translations[s.language]) {
        setLang(s.language);
      }

      setQuote(q);
      setShop(s);
      setLoading(false);

      if (['approved', 'rejected', 'converted'].includes(q.status)) {
        setResult(q.status === 'rejected' ? 'rejected' : 'approved');
        return;
      }
      if (q.status === 'expired') {
        setResult('expired');
        return;
      }

      if (q.validity_date) {
        const today = new Date().toISOString().split("T")[0];
        if (q.validity_date < today) {
          setResult('expired');
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

    const { error: err } = await supabase.rpc("respond_to_quote_by_token", {
      _token: token!,
      _action: action,
      _client_notes: clientComment.trim() || null,
      _signature_data: updateData.signature_data || null,
      _signature_hash: updateData.signature_hash || null,
      _signer_name: updateData.signer_name || null,
    });

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

    // On approval: auto-create work order and send approval-confirmation email to client
    if (action === 'approved') {
      try {
        const { workOrderId } = await autoCreateWorkOrderFromQuote(quote.id);
        let woNumber: string | null = null;
        if (workOrderId) {
          const { data: wo } = await supabase.from("work_orders").select("number").eq("id", workOrderId).maybeSingle();
          woNumber = wo?.number || null;
        }

        const clientEmail = (quote.clients as any)?.email as string | undefined;
        const clientName = (quote.clients as any)?.name || "—";
        const veh = quote.vehicles as any;
        const vehicleLabel = `${veh?.make || ''} ${veh?.model || ''}`.trim();
        const plate = veh?.plate || '';

        if (clientEmail) {
          // Try to load configured template for quote_approved / email
          let subjectTpl = '';
          let bodyTpl = '';
          try {
            const { data: tplRow } = await (supabase as any)
              .from('message_templates')
              .select('subject, body_text, active')
              .eq('shop_id', shop.id)
              .eq('event_slug', 'quote_approved')
              .eq('channel', 'email')
              .maybeSingle();
            if (tplRow && tplRow.active !== false) {
              subjectTpl = tplRow.subject || '';
              bodyTpl = tplRow.body_text || '';
            }
          } catch {}

          const defaults: Record<string, { subject: string; body: string }> = {
            pt: {
              subject: '✅ O seu orçamento foi aprovado com sucesso',
              body:
                'Olá {{cliente_nome}},\n\nRecebemos a confirmação da aprovação do seu orçamento.\n\nO orçamento {{numero_orcamento}} foi aprovado com sucesso e a {{nome_oficina}} já foi notificada.\n\nA nossa equipa irá agora:\n• preparar a intervenção;\n• encomendar peças, quando necessário;\n• iniciar os trabalhos o mais rapidamente possível.\n\nCaso exista alguma alteração ou seja necessária informação adicional, entraremos em contacto.\n\nObrigado pela confiança.\nEquipa {{nome_oficina}}',
            },
            en: {
              subject: '✅ Your quote has been approved successfully',
              body:
                'Hello {{cliente_nome}},\n\nWe have received the approval of your quote.\n\nQuote {{numero_orcamento}} has been successfully approved and {{nome_oficina}} has already been notified.\n\nOur team will now:\n• prepare the intervention;\n• order parts when necessary;\n• start the work as soon as possible.\n\nIf there is any change or additional information needed, we will contact you.\n\nThank you for your trust.\n{{nome_oficina}} team',
            },
            es: {
              subject: '✅ Su presupuesto ha sido aprobado con éxito',
              body:
                'Hola {{cliente_nome}},\n\nHemos recibido la aprobación de su presupuesto.\n\nEl presupuesto {{numero_orcamento}} ha sido aprobado con éxito y {{nome_oficina}} ya ha sido notificado.\n\nNuestro equipo:\n• preparará la intervención;\n• pedirá las piezas necesarias;\n• iniciará los trabajos lo antes posible.\n\nSi hay algún cambio o necesitamos información adicional, le contactaremos.\n\nGracias por su confianza.\nEquipo {{nome_oficina}}',
            },
          };
          const def = defaults[lang] || defaults.pt;
          if (!subjectTpl) subjectTpl = def.subject;
          if (!bodyTpl) bodyTpl = def.body;

          const nowStr = new Date().toLocaleString(lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : 'pt-PT', { dateStyle: 'short', timeStyle: 'short' });
          const vars: Record<string, string> = {
            cliente_nome: clientName,
            nome_oficina: shop.name || '',
            numero_orcamento: quote.number || '',
            numero_ordem_servico: woNumber || '',
            matricula: plate,
            marca: veh?.make || '',
            modelo: veh?.model || '',
            veiculo: vehicleLabel,
            valor_orcamento: `€${quote.total?.toFixed(2) ?? '0.00'}`,
            valor_total: `€${quote.total?.toFixed(2) ?? '0.00'}`,
            data_hora: nowStr,
            telefone: shop.phone || '',
            email: shop.email || '',
          };
          const render = (s: string) => s.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => vars[k.toLowerCase()] ?? '');
          const clientSubject = render(subjectTpl);
          const bodyHtml = render(bodyTpl).split('\n').map((line) => {
            if (!line.trim()) return '<br/>';
            if (line.trim().startsWith('•')) {
              return `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 6px 16px;">${line.trim()}</p>`;
            }
            return `<p style="color:#374151;font-size:14px;line-height:1.6;margin:0 0 10px;">${line}</p>`;
          }).join('');

          const summaryLabels: Record<string, Record<string, string>> = {
            pt: { title: 'Resumo', workshop: 'Oficina', quote: 'Orçamento', vehicle: 'Veículo', plate: 'Matrícula', amount: 'Valor aprovado', when: 'Data da aprovação', doubts: 'Caso tenha alguma dúvida, poderá contactar diretamente a oficina.' },
            en: { title: 'Summary', workshop: 'Workshop', quote: 'Quote', vehicle: 'Vehicle', plate: 'Plate', amount: 'Approved amount', when: 'Approval date', doubts: 'If you have any questions, please contact the workshop directly.' },
            es: { title: 'Resumen', workshop: 'Taller', quote: 'Presupuesto', vehicle: 'Vehículo', plate: 'Matrícula', amount: 'Importe aprobado', when: 'Fecha de aprobación', doubts: 'Si tiene alguna duda, puede contactar directamente con el taller.' },
          };
          const SL = summaryLabels[lang] || summaryLabels.pt;
          const summaryHtml = `
            <div style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <p style="color:#111827;font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.5px;">${SL.title}</p>
              <table style="width:100%;font-size:13px;color:#374151;border-collapse:collapse;">
                <tr><td style="padding:4px 0;color:#6b7280;width:45%;">${SL.workshop}</td><td style="padding:4px 0;font-weight:600;">${shop.name || ''}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;">${SL.quote}</td><td style="padding:4px 0;font-weight:600;font-family:monospace;">${quote.number || ''}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;">${SL.vehicle}</td><td style="padding:4px 0;font-weight:600;">${vehicleLabel || '—'}</td></tr>
                ${plate ? `<tr><td style="padding:4px 0;color:#6b7280;">${SL.plate}</td><td style="padding:4px 0;font-weight:600;font-family:monospace;">${plate}</td></tr>` : ''}
                <tr><td style="padding:4px 0;color:#6b7280;">${SL.amount}</td><td style="padding:4px 0;font-weight:700;color:#059669;">€${quote.total?.toFixed(2) ?? '0.00'}</td></tr>
                <tr><td style="padding:4px 0;color:#6b7280;">${SL.when}</td><td style="padding:4px 0;font-weight:600;">${nowStr}</td></tr>
              </table>
            </div>
            <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:16px 0 0;">${SL.doubts}</p>`;

          const clientHtml = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background-color:#ffffff;">
              <div style="background-color:#262626;padding:24px 32px;border-radius:12px 12px 0 0;">
                ${shop.logo_url ? `<img src="${shop.logo_url}" alt="${shop.name}" style="max-height:40px;margin-bottom:10px;display:block;" />` : ''}
                <span style="color:#ffb41e;font-size:20px;font-weight:700;">${shop.name}</span><br/>
                <span style="color:#ffffff;font-size:16px;font-weight:600;">${clientSubject}</span>
              </div>
              <div style="padding:28px 32px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;">
                ${bodyHtml}
                ${summaryHtml}
                <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
                <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0;">${shop.name}${shop.phone ? ` · ${shop.phone}` : ''}${shop.email ? ` · ${shop.email}` : ''}</p>
              </div>
            </div>`;
          await sendEmail({ to: clientEmail, subject: clientSubject, html: clientHtml });

          // Audit trail entry
          try {
            await supabase.from('audit_logs').insert({
              action: 'quote_approval_confirmation_email_sent',
              entity_type: 'quote',
              entity_id: quote.id,
              details: { quote_number: quote.number, to: clientEmail, wo_number: woNumber },
            });
          } catch {}
        }
      } catch (woErr) {
        console.error("Auto work order / client email failed:", woErr);
      }
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
    const decidedAt = result === 'approved' ? (quote?.signed_at || quote?.updated_at) : quote?.updated_at;
    const decidedDate = decidedAt ? new Date(decidedAt) : new Date();
    const fmtDate = decidedDate.toLocaleDateString(lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : 'pt-PT');
    const fmtTime = decidedDate.toLocaleTimeString(lang === 'en' ? 'en-GB' : lang === 'es' ? 'es-ES' : 'pt-PT', { hour: '2-digit', minute: '2-digit' });
    const veh = quote?.vehicles as any;
    const cli = quote?.clients as any;
    const cur = shop?.currency === 'EUR' ? '€' : (shop?.currency || '€');

    const labels = {
      pt: { qNum: 'Orçamento', state: 'Estado', client: 'Cliente', vehicle: 'Veículo', plate: 'Matrícula', decidedOn: 'Data da aprovação', decidedOnRej: 'Data da rejeição', total: 'Valor', at: 'às', notified: 'A oficina foi notificada automaticamente e irá iniciar a preparação dos trabalhos.', rejectedInfo: 'Caso pretenda solicitar alterações, contacte diretamente a oficina.', back: 'Voltar ao GarageFlow', approved: 'Aprovado', rejected: 'Rejeitado' },
      en: { qNum: 'Quote', state: 'Status', client: 'Client', vehicle: 'Vehicle', plate: 'Plate', decidedOn: 'Approval date', decidedOnRej: 'Rejection date', total: 'Amount', at: 'at', notified: 'The workshop has been automatically notified and will start preparing the work.', rejectedInfo: 'If you wish to request changes, please contact the workshop directly.', back: 'Back to GarageFlow', approved: 'Approved', rejected: 'Rejected' },
      es: { qNum: 'Presupuesto', state: 'Estado', client: 'Cliente', vehicle: 'Vehículo', plate: 'Matrícula', decidedOn: 'Fecha de aprobación', decidedOnRej: 'Fecha de rechazo', total: 'Importe', at: 'a las', notified: 'El taller ha sido notificado automáticamente y comenzará la preparación de los trabajos.', rejectedInfo: 'Si desea solicitar cambios, contacte directamente con el taller.', back: 'Volver a GarageFlow', approved: 'Aprobado', rejected: 'Rechazado' },
    } as const;
    const L = (labels as any)[lang] || labels.pt;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <div className="bg-card border border-border rounded-2xl p-8 sm:p-10 text-center max-w-lg w-full shadow-lg">
          {shop?.logo_url && (
            <img src={shop.logo_url} alt={shop.name} className="max-h-14 mx-auto mb-5 object-contain" />
          )}
          {result === 'approved' ? (
            <>
              <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-5">
                <CheckCircle className="w-10 h-10 text-success" />
              </div>
              <h1 className="text-2xl font-bold mb-2">✅ {t('approved')}</h1>
              <p className="text-muted-foreground mb-2">{t('approvedDesc')}</p>
              <p className="text-sm text-muted-foreground">{L.notified}</p>
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
              <h1 className="text-2xl font-bold mb-2">❌ {t('rejected')}</h1>
              <p className="text-muted-foreground mb-2">{t('rejectedDesc')}</p>
              <p className="text-sm text-muted-foreground">{L.rejectedInfo}</p>
            </>
          )}

          {result !== 'expired' && quote && (
            <div className="mt-6 bg-muted/40 border border-border rounded-xl p-4 text-left space-y-2 text-sm">
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">{L.qNum}:</span><span className="font-mono font-semibold">{quote.number}</span></div>
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">{L.state}:</span><span className="font-semibold">{result === 'approved' ? `✅ ${L.approved}` : `❌ ${L.rejected}`}</span></div>
              {cli?.name && <div className="flex justify-between gap-3"><span className="text-muted-foreground">{L.client}:</span><span className="font-semibold">{cli.name}</span></div>}
              {veh && (veh.make || veh.model) && (
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{L.vehicle}:</span><span className="font-semibold">{veh.make} {veh.model}{veh.plate ? ` — ${veh.plate}` : ''}</span></div>
              )}
              {typeof quote.total === 'number' && (
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{L.total}:</span><span className="font-mono font-semibold">{cur}{Number(quote.total).toFixed(2)}</span></div>
              )}
              <div className="flex justify-between gap-3"><span className="text-muted-foreground">{result === 'approved' ? L.decidedOn : L.decidedOnRej}:</span><span className="font-semibold">{fmtDate} {L.at} {fmtTime}</span></div>
              {result === 'approved' && quote?.signer_name && (
                <div className="flex justify-between gap-3"><span className="text-muted-foreground">{t('signedBy')}:</span><span className="font-semibold">{quote.signer_name}</span></div>
              )}
            </div>
          )}

          <div className="mt-8 pt-5 border-t border-border">
            {shop?.name && <p className="font-semibold text-foreground">{shop.name}</p>}
            {shop?.email && <p className="text-sm text-muted-foreground">{shop.email}</p>}
            {shop?.phone && <p className="text-sm text-muted-foreground">{shop.phone}</p>}
          </div>

          <Button
            variant="outline"
            className="mt-6"
            onClick={() => { window.location.href = 'https://garageflow.pt'; }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {L.back}
          </Button>
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
              <div className="flex items-start gap-4 min-w-0">
                {shop?.logo_url && (
                  <div className="shrink-0 bg-white rounded-lg p-2 shadow-md">
                    <img src={shop.logo_url} alt={shop.name} className="max-h-14 max-w-[120px] object-contain" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold text-background">{shop?.name}</h1>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-background/60">
                  {shop?.nif && <span>NIF: {shop.nif}</span>}
                  {shop?.address && <span>{shop.address}</span>}
                </div>
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
                    {Number(quote.labor_hours) > 0 && Number(shop?.labor_rate) > 0 && (
                      <tr className="border-t border-border/50 bg-primary/5">
                        <td className="p-3">
                          <span className="font-medium">Mão-de-obra</span>
                          <Badge variant="outline" className="ml-2 text-[10px] py-0">{t('service')}</Badge>
                          <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                            {Number(quote.labor_hours).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}h × {cur}{Number(shop.labor_rate).toFixed(2)}/h
                          </div>
                        </td>
                        <td className="p-3 text-center font-mono text-muted-foreground">
                          {Number(quote.labor_hours).toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}h
                        </td>
                        <td className="p-3 text-right font-mono text-muted-foreground hidden sm:table-cell">{cur}{Number(shop.labor_rate).toFixed(2)}</td>
                        <td className="p-3 text-right font-mono font-semibold">{cur}{(Number(quote.labor_hours) * Number(shop.labor_rate)).toFixed(2)}</td>
                      </tr>
                    )}
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

            {/* Digital Signature */}
            <SignaturePad
              onSign={handleSignature}
              disabled={submitting}
              labels={{
                title: t('signatureTitle'),
                signerName: t('signerName'),
                signerNamePlaceholder: t('signerNamePlaceholder'),
                clear: t('signatureClear'),
                confirm: t('signatureConfirm'),
                drawHere: t('signatureDrawHere'),
                required: t('signatureRequired'),
              }}
            />

            {signatureData && (
              <div className="flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg p-3">
                <CheckCircle className="w-4 h-4" />
                <span>{t('signedBy')}: <strong>{signerName}</strong></span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                className="flex-1 h-14 text-base font-semibold rounded-xl bg-success hover:bg-success/90 text-white shadow-lg shadow-success/20 transition-all"
                onClick={() => handleAction('approved')}
                disabled={submitting || !signatureData || !signerName}
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