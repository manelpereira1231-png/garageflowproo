import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Wrench, Loader2, AlertTriangle } from "lucide-react";
import { sendEmail } from "@/lib/emailService";

const translations: Record<string, Record<string, string>> = {
  pt: {
    loading: "A carregar...",
    error: "Erro",
    invalidToken: "Token inválido",
    notFound: "Orçamento não encontrado",
    expired: "Este orçamento expirou",
    expiredDesc: "O prazo de validade deste orçamento terminou. Contacte a oficina para um novo orçamento.",
    approved: "Orçamento Aprovado!",
    approvedDesc: "Obrigado pela sua aprovação. A oficina entrará em contacto em breve.",
    rejected: "Orçamento Rejeitado",
    rejectedDesc: "Agradecemos o seu feedback. A oficina poderá contactá-lo com alternativas.",
    alreadyProcessed: "Este orçamento já foi processado.",
    pending: "Pendente",
    client: "Cliente",
    vehicle: "Veículo",
    description: "Descrição",
    qty: "Qtd",
    price: "Preço",
    total: "Total",
    subtotal: "Subtotal",
    vat: "IVA",
    validUntil: "Válido até",
    notes: "Notas",
    approve: "Aprovar Orçamento",
    reject: "Rejeitar",
    service: "Serviço",
    part: "Peça",
    footer: "Gestão profissional de oficinas",
    contact: "Contacto",
  },
  en: {
    loading: "Loading...",
    error: "Error",
    invalidToken: "Invalid token",
    notFound: "Quote not found",
    expired: "This quote has expired",
    expiredDesc: "The validity period for this quote has ended. Contact the workshop for a new quote.",
    approved: "Quote Approved!",
    approvedDesc: "Thank you for your approval. The workshop will contact you soon.",
    rejected: "Quote Rejected",
    rejectedDesc: "We appreciate your feedback. The workshop may contact you with alternatives.",
    alreadyProcessed: "This quote has already been processed.",
    pending: "Pending",
    client: "Client",
    vehicle: "Vehicle",
    description: "Description",
    qty: "Qty",
    price: "Price",
    total: "Total",
    subtotal: "Subtotal",
    vat: "VAT",
    validUntil: "Valid until",
    notes: "Notes",
    approve: "Approve Quote",
    reject: "Reject",
    service: "Service",
    part: "Part",
    footer: "Professional workshop management",
    contact: "Contact",
  },
  es: {
    loading: "Cargando...",
    error: "Error",
    invalidToken: "Token inválido",
    notFound: "Presupuesto no encontrado",
    expired: "Este presupuesto ha expirado",
    expiredDesc: "El plazo de validez de este presupuesto ha terminado. Contacte el taller para uno nuevo.",
    approved: "¡Presupuesto Aprobado!",
    approvedDesc: "Gracias por su aprobación. El taller se pondrá en contacto pronto.",
    rejected: "Presupuesto Rechazado",
    rejectedDesc: "Agradecemos su respuesta. El taller podrá contactarle con alternativas.",
    alreadyProcessed: "Este presupuesto ya ha sido procesado.",
    pending: "Pendiente",
    client: "Cliente",
    vehicle: "Vehículo",
    description: "Descripción",
    qty: "Cant",
    price: "Precio",
    total: "Total",
    subtotal: "Subtotal",
    vat: "IVA",
    validUntil: "Válido hasta",
    notes: "Notas",
    approve: "Aprobar Presupuesto",
    reject: "Rechazar",
    service: "Servicio",
    part: "Pieza",
    footer: "Gestión profesional de talleres",
    contact: "Contacto",
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

  const t = (key: string) => translations[lang]?.[key] || translations.pt[key] || key;

  useEffect(() => {
    const load = async () => {
      if (!token) { setError(translations.pt.invalidToken); setLoading(false); return; }

      const { data: q, error: qErr } = await supabase
        .from("quotes")
        .select("*, clients(name, email, phone), vehicles(make, model, plate)")
        .eq("token", token)
        .single();

      if (qErr || !q) { setError(translations.pt.notFound); setLoading(false); return; }

      const { data: s } = await supabase
        .from("shops")
        .select("name, email, phone, nif, address, logo_url, currency, language")
        .eq("id", q.shop_id)
        .single();

      // Set language from shop
      if (s?.language && translations[s.language]) {
        setLang(s.language);
      }

      setQuote(q);
      setShop(s);
      setLoading(false);

      // Check if already processed
      if (['approved', 'rejected'].includes(q.status)) {
        setResult(q.status as 'approved' | 'rejected');
        return;
      }

      // Check if expired
      if (q.validity_date) {
        const today = new Date().toISOString().split("T")[0];
        if (q.validity_date < today) {
          setResult('expired');
          // Also update status in DB
          await supabase.from("quotes").update({ status: 'expired' }).eq("id", q.id);
          return;
        }
      }
    };
    load();
  }, [token]);

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!quote || !shop) return;
    setSubmitting(true);

    const { error: err } = await supabase
      .from("quotes")
      .update({ status: action })
      .eq("id", quote.id);

    if (err) { setError(err.message); setSubmitting(false); return; }
    setResult(action);
    setSubmitting(false);

    // Send notification email to the shop team
    try {
      const clientName = (quote.clients as any)?.name || "—";
      const actionLabel = action === 'approved' ? '✅ APROVADO' : '❌ REJEITADO';
      const subject = `${actionLabel} — Orçamento ${quote.number} — ${clientName}`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${action === 'approved' ? '#f0fdf4' : '#fef2f2'}; border-left: 4px solid ${action === 'approved' ? '#16a34a' : '#dc2626'}; padding: 16px; border-radius: 4px; margin-bottom: 20px;">
            <h2 style="color: ${action === 'approved' ? '#166534' : '#991b1b'}; font-size: 18px; margin: 0 0 8px;">${actionLabel}</h2>
            <p style="color: #374151; font-size: 14px; margin: 0;">O orçamento <strong>${quote.number}</strong> foi ${action === 'approved' ? 'aprovado' : 'rejeitado'} pelo cliente <strong>${clientName}</strong>.</p>
          </div>
          <table style="width: 100%; font-size: 13px; color: #6b7280;">
            <tr><td style="padding: 4px 0;"><strong>Veículo:</strong></td><td>${(quote.vehicles as any)?.make} ${(quote.vehicles as any)?.model} — ${(quote.vehicles as any)?.plate}</td></tr>
            <tr><td style="padding: 4px 0;"><strong>Total:</strong></td><td>€${quote.total?.toFixed(2)}</td></tr>
          </table>
          <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
          <p style="color: #bbb; font-size: 12px; text-align: center;">${shop.name} — GarageFlow</p>
        </div>
      `;
      await sendEmail({ to: shop.email, subject, html });
    } catch (emailErr) {
      console.error("Failed to send notification email:", emailErr);
      // Don't block the user action
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card border border-border rounded-xl p-8 text-center max-w-md w-full">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
          <h1 className="text-xl font-bold mb-2">{t('error')}</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card border border-border rounded-xl p-8 text-center max-w-md w-full">
          {result === 'approved' ? (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-success" />
              <h1 className="text-2xl font-bold mb-2">{t('approved')}</h1>
              <p className="text-muted-foreground">{t('approvedDesc')}</p>
            </>
          ) : result === 'expired' ? (
            <>
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-warning" />
              <h1 className="text-2xl font-bold mb-2">{t('expired')}</h1>
              <p className="text-muted-foreground">{t('expiredDesc')}</p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h1 className="text-2xl font-bold mb-2">{t('rejected')}</h1>
              <p className="text-muted-foreground">{t('rejectedDesc')}</p>
            </>
          )}
          <div className="mt-6 pt-4 border-t border-border text-sm text-muted-foreground">
            {shop?.name && <p className="font-medium text-foreground">{shop.name}</p>}
            {shop?.email && <p>{shop.email}</p>}
            {shop?.phone && <p>{shop.phone}</p>}
          </div>
        </div>
      </div>
    );
  }

  const lines = (Array.isArray(quote.lines) ? quote.lines : []) as any[];
  const cur = shop?.currency === 'EUR' ? '€' : (shop?.currency || '€');

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="bg-card border border-border rounded-xl overflow-hidden mb-6">
          <div className="bg-foreground p-6">
            <div className="flex items-center justify-between">
              <div>
                {shop?.logo_url && (
                  <img src={shop.logo_url} alt={shop.name} className="max-h-10 mb-2" />
                )}
                <h1 className="text-xl font-bold text-background">{shop?.name}</h1>
                {shop?.nif && <p className="text-xs text-muted">NIF: {shop.nif}</p>}
                {shop?.address && <p className="text-xs text-muted">{shop.address}</p>}
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="bg-primary/20 text-primary mb-1">
                  <Clock className="w-3 h-3 mr-1" />
                  {t('pending')}
                </Badge>
                <p className="text-lg font-bold text-background font-mono">{quote.number}</p>
                <p className="text-xs text-muted">{quote.date}</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Client & Vehicle Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">{t('client')}</p>
                <p className="font-medium">{(quote.clients as any)?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">{t('vehicle')}</p>
                <p className="font-medium">{(quote.vehicles as any)?.make} {(quote.vehicles as any)?.model}</p>
                <p className="text-xs text-muted-foreground font-mono">{(quote.vehicles as any)?.plate}</p>
              </div>
            </div>

            {/* Lines Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">{t('description')}</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">{t('qty')}</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">{t('price')}</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">{t('total')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3">
                        <span className="font-medium">{line.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({line.type === 'service' ? t('service') : t('part')})</span>
                      </td>
                      <td className="p-3 text-center font-mono">{line.quantity}</td>
                      <td className="p-3 text-right font-mono">{cur}{line.unit_price?.toFixed(2)}</td>
                      <td className="p-3 text-right font-mono font-medium">{cur}{(line.quantity * line.unit_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('subtotal')}</span>
                  <span className="font-mono">{cur}{quote.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('vat')}</span>
                  <span className="font-mono">{cur}{quote.vat_total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                  <span>{t('total').toUpperCase()}</span>
                  <span className="font-mono">{cur}{quote.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Validity */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <strong>{t('validUntil')}:</strong> {quote.validity_date}
            </div>

            {quote.notes && (
              <div className="bg-warning/10 border-l-3 border-warning rounded p-3 text-sm">
                <strong>{t('notes')}:</strong> {quote.notes}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                className="flex-1 h-12 text-base bg-success hover:bg-success/90 text-white"
                onClick={() => handleAction('approved')}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-5 h-5 mr-2" />}
                {t('approve')}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-base border-destructive text-destructive hover:bg-destructive/10"
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