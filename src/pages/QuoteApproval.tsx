import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Wrench, Loader2 } from "lucide-react";

export default function QuoteApproval() {
  const { token } = useParams<{ token: string }>();
  const [quote, setQuote] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'approved' | 'rejected' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!token) { setError("Token inválido"); setLoading(false); return; }

      const { data: q, error: qErr } = await supabase
        .from("quotes")
        .select("*, clients(name, email, phone), vehicles(make, model, plate)")
        .eq("token", token)
        .single();

      if (qErr || !q) { setError("Orçamento não encontrado"); setLoading(false); return; }

      const { data: s } = await supabase
        .from("shops")
        .select("name, email, phone, nif, address, logo_url, currency")
        .eq("id", q.shop_id)
        .single();

      setQuote(q);
      setShop(s);
      setLoading(false);

      if (['approved', 'rejected'].includes(q.status)) {
        setResult(q.status as 'approved' | 'rejected');
      }
    };
    load();
  }, [token]);

  const handleAction = async (action: 'approved' | 'rejected') => {
    if (!quote) return;
    setSubmitting(true);
    const { error: err } = await supabase
      .from("quotes")
      .update({ status: action })
      .eq("id", quote.id);
    if (err) { setError(err.message); setSubmitting(false); return; }
    setResult(action);
    setSubmitting(false);
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
          <h1 className="text-xl font-bold mb-2">Erro</h1>
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
              <h1 className="text-2xl font-bold mb-2">Orçamento Aprovado!</h1>
              <p className="text-muted-foreground">Obrigado pela sua aprovação. A oficina entrará em contacto em breve.</p>
            </>
          ) : (
            <>
              <XCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
              <h1 className="text-2xl font-bold mb-2">Orçamento Rejeitado</h1>
              <p className="text-muted-foreground">Agradecemos o seu feedback. A oficina poderá contactá-lo com alternativas.</p>
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
              </div>
              <div className="text-right">
                <Badge variant="secondary" className="bg-primary/20 text-primary mb-1">
                  <Clock className="w-3 h-3 mr-1" />
                  Pendente
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
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Cliente</p>
                <p className="font-medium">{(quote.clients as any)?.name}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wider mb-1">Veículo</p>
                <p className="font-medium">{(quote.vehicles as any)?.make} {(quote.vehicles as any)?.model}</p>
                <p className="text-xs text-muted-foreground font-mono">{(quote.vehicles as any)?.plate}</p>
              </div>
            </div>

            {/* Lines Table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Descrição</th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground uppercase">Qtd</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Preço</th>
                    <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line: any, i: number) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-3">
                        <span className="font-medium">{line.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">({line.type === 'service' ? 'Serviço' : 'Peça'})</span>
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
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{cur}{quote.subtotal?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">IVA</span>
                  <span className="font-mono">{cur}{quote.vat_total?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                  <span>TOTAL</span>
                  <span className="font-mono">{cur}{quote.total?.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Validity */}
            <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
              <strong>Válido até:</strong> {quote.validity_date}
            </div>

            {quote.notes && (
              <div className="bg-warning/10 border-l-3 border-warning rounded p-3 text-sm">
                <strong>Notas:</strong> {quote.notes}
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
                Aprovar Orçamento
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-base border-destructive text-destructive hover:bg-destructive/10"
                onClick={() => handleAction('rejected')}
                disabled={submitting}
              >
                <XCircle className="w-5 h-5 mr-2" />
                Rejeitar
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
          <p>Gestão profissional de oficinas</p>
        </div>
      </div>
    </div>
  );
}