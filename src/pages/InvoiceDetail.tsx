import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, FileDown, Ban, CreditCard, Printer, ShieldCheck, ExternalLink, Loader2, FileText } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { generateInvoicePdf } from "@/lib/invoicePdfGenerator";
import { useSubscription } from "@/hooks/useSubscription";
import { getCurrencySymbol, getTaxLabelLocal, formatLocalDate } from "@/lib/marketPrice";
import CertifiedBadge from "@/components/CertifiedBadge";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  issued: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  partial: "bg-warning/10 text-warning",
};

export default function InvoiceDetail() {
  const { t } = useLanguage();
  const { plan } = useSubscription();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [shop, setShop] = useState<any>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState("cash");
  const [payRef, setPayRef] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [emitting, setEmitting] = useState(false);
  const [billingProvider, setBillingProvider] = useState<"invoicexpress" | "moloni" | null>(null);

  const handleEmitCertified = async () => {
    if (!invoice) return;
    if (invoice.provider_invoice_id) {
      if (invoice.provider_pdf_url) window.open(invoice.provider_pdf_url, "_blank");
      return;
    }
    const providerLabel = billingProvider === "moloni" ? "Moloni" : "InvoiceXpress";
    if (!billingProvider) { toast.error("Configura primeiro a Faturação Certificada em Definições."); return; }
    if (!confirm(`Emitir fatura certificada via ${providerLabel}? Depois de emitida NÃO é possível apagar — apenas anular por nota de crédito.`)) return;
    setEmitting(true);
    try {
      const fn = billingProvider === "moloni" ? "moloni-emit" : "invoicexpress-emit";
      const { data, error } = await supabase.functions.invoke(fn, {
        body: { invoice_id: invoice.id, send_email: !!(invoice.clients as any)?.email },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx = (error as any).context;
          const resp: Response | undefined = ctx instanceof Response ? ctx : ctx?.response;
          if (resp) {
            const body = await resp.clone().json().catch(() => null);
            if (body?.error) msg = body.error;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      toast.success(`Fatura certificada emitida: ${data.number || data.provider_invoice_id}`);
      await loadData();
    } catch (e: any) {
      toast.error(e.message || "Falha ao emitir fatura", { duration: 10000 });
    } finally {
      setEmitting(false);
    }
  };

  const loadData = async () => {
    if (!id) return;
    const { data: inv } = await supabase
      .from("invoices")
      .select("*, clients(name, email, phone, nif), vehicles(make, model, plate)")
      .eq("id", id)
      .maybeSingle();
    if (!inv) { navigate("/invoices"); return; }
    setInvoice(inv);

    const [itemsRes, paymentsRes, shopRes] = await Promise.all([
      supabase.from("invoice_items").select("*").eq("invoice_id", id).order("id"),
      supabase.from("payments").select("*").eq("invoice_id", id).order("paid_at"),
      supabase.from("shops").select("*").eq("id", inv.shop_id).maybeSingle(),
    ]);
    if (itemsRes.data) setItems(itemsRes.data);
    if (paymentsRes.data) setPayments(paymentsRes.data);
    if (shopRes.data) setShop(shopRes.data);

    // Descobre qual provider de faturação está configurado nesta oficina
    const { data: integ } = await supabase
      .from("integracao_faturacao")
      .select("provider, ativo")
      .eq("shop_id", inv.shop_id)
      .maybeSingle();
    setBillingProvider((integ?.ativo && (integ.provider as any)) || null);
  };

  useEffect(() => { loadData(); }, [id]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = invoice ? Number(invoice.total) - totalPaid : 0;
  const cur = getCurrencySymbol(shop?.currency);
  const taxLbl = getTaxLabelLocal();

  const handlePayment = async () => {
    if (!invoice || !shop) return;
    if (payAmount <= 0) { toast.error(t('invoices.invalidAmount')); return; }
    setSaving(true);

    const { error } = await supabase.from("payments").insert({
      invoice_id: invoice.id,
      shop_id: shop.id,
      amount: payAmount,
      method: payMethod,
      reference: payRef || null,
      paid_at: payDate,
    });

    if (error) { toast.error(error.message); setSaving(false); return; }

    const newTotalPaid = totalPaid + payAmount;
    const isFullyPaid = newTotalPaid >= Number(invoice.total);
    const newStatus = isFullyPaid ? 'paid' : 'partial';
    await supabase.from("invoices").update({ status: newStatus }).eq("id", invoice.id);

    toast.success(t('invoices.paymentRegistered'));
    setShowPayment(false);
    setPayAmount(0);
    setPayRef("");

    // Auto-emitir Fatura-Recibo no InvoiceExpress quando o pagamento fica completo
    if (isFullyPaid && !invoice.provider_invoice_id && billingProvider === 'invoicexpress') {
      try {
        const { data, error: emitErr } = await supabase.functions.invoke('invoicexpress-emit', {
          body: { invoice_id: invoice.id, send_email: !!(invoice.clients as any)?.email },
        });
        if (emitErr || data?.error) {
          toast.error(`Pagamento registado, mas falhou a emitir Fatura-Recibo: ${data?.error || emitErr?.message}`, { duration: 8000 });
        } else {
          toast.success(`Fatura-Recibo emitida: ${data?.number || data?.provider_invoice_id}`);
        }
      } catch (e: any) {
        toast.error(`Falha ao emitir Fatura-Recibo: ${e.message}`, { duration: 8000 });
      }
    }

    setSaving(false);
    loadData();
  };

  const handleCancel = async () => {
    if (!invoice) return;
    // Se a fatura já foi emitida no provider certificado, tem de ser anulada por Nota de Crédito (AT exige)
    if (invoice.provider_invoice_id) {
      const reason = window.prompt("Motivo da anulação (obrigatório para a Nota de Crédito):", "Anulação a pedido do cliente");
      if (!reason || !reason.trim()) return;
      try {
        const fn = billingProvider === "moloni" ? "moloni-credit-note" : "invoicexpress-credit-note";
        const { data, error } = await supabase.functions.invoke(fn, {
          body: { invoice_id: invoice.id, reason: reason.trim() },
        });
        if (error) {
          let msg = error.message;
          try {
            const ctx = (error as any).context;
            const resp: Response | undefined = ctx instanceof Response ? ctx : ctx?.response;
            if (resp) { const b = await resp.clone().json().catch(() => null); if (b?.error) msg = b.error; }
          } catch {}
          throw new Error(msg);
        }
        if (data?.error) throw new Error(data.error);
        toast.success(`Nota de crédito emitida: ${data.credit_note_number || data.credit_note_provider_id}`);
      } catch (e: any) {
        toast.error(e.message || "Falha ao emitir nota de crédito", { duration: 8000 });
        return;
      }
    } else {
      await supabase.from("invoices").update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq("id", invoice.id);
      toast.success(t('invoices.cancelled'));
    }
    loadData();
  };

  const handleIssue = async () => {
    if (!invoice) return;
    await supabase.from("invoices").update({ status: 'issued' }).eq("id", invoice.id);
    toast.success(t('invoices.issued'));
    loadData();
  };

  const handleDownloadPdf = async () => {
    if (!invoice || !shop) {
      toast.error("Dados não carregados. Recarregue a página.");
      return;
    }
    try {
      const doc = await generateInvoicePdf({
        invoice, items, shop,
        clientName: (invoice.clients as any)?.name || '',
        clientEmail: (invoice.clients as any)?.email,
        clientPhone: (invoice.clients as any)?.phone,
        clientNif: (invoice.clients as any)?.nif,
        vehicleMake: (invoice.vehicles as any)?.make,
        vehicleModel: (invoice.vehicles as any)?.model,
        vehiclePlate: (invoice.vehicles as any)?.plate,
        totalPaid,
        plan,
      });
      doc.save(`${invoice.number}.pdf`);
    } catch (err: any) {
      console.error('PDF error', err);
      toast.error(`Falha a gerar PDF: ${err?.message || err}`);
    }
  };

  if (!invoice) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="page-title">{invoice.number}</h1>
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <CertifiedBadge legalStatus={invoice.legal_status} atcud={invoice.atcud} series={invoice.certified_series} size="md" />
            <Badge variant="secondary" className={statusColors[invoice.status] || ''}>
              {t(`invoices.status_${invoice.status}`)}
            </Badge>
            {invoice.atcud && <span className="text-[10px] text-muted-foreground mono">ATCUD: {invoice.atcud}</span>}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Printer className="w-4 h-4 mr-1" />PDF
          </Button>
          {invoice.provider_invoice_id ? (
            <Button variant="secondary" size="sm" asChild>
              <a href={invoice.provider_pdf_url || invoice.provider_permalink || "#"} target="_blank" rel="noreferrer">
                <ShieldCheck className="w-4 h-4 mr-1" />PDF certificado
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          ) : (
            invoice.status !== "cancelled" && (
              billingProvider ? (
                <Button size="sm" variant="default" onClick={handleEmitCertified} disabled={emitting}>
                  {emitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-1" />}
                  Emitir via {billingProvider === "moloni" ? "Moloni" : "InvoiceXpress"}
                </Button>
              ) : (
                <Button size="sm" variant="default" onClick={() => navigate("/settings/billing-integration")}>
                  <ShieldCheck className="w-4 h-4 mr-1" />
                  Emitir via InvoiceXpress
                </Button>
              )
            )
          )}
          {invoice.status === 'draft' && (
            <Button size="sm" onClick={handleIssue}>{t('invoices.issueInvoice')}</Button>
          )}
          {['issued', 'partial'].includes(invoice.status) && (
            <Button size="sm" onClick={() => { setPayAmount(remaining); setShowPayment(true); }}>
              <CreditCard className="w-4 h-4 mr-1" />{t('invoices.registerPayment')}
            </Button>
          )}
          {invoice.credit_note_pdf_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={invoice.credit_note_pdf_url} target="_blank" rel="noreferrer">
                <ShieldCheck className="w-4 h-4 mr-1" />Nota de crédito
                <ExternalLink className="w-3 h-3 ml-1" />
              </a>
            </Button>
          )}
          {['draft', 'issued'].includes(invoice.status) && (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <Ban className="w-4 h-4 mr-1" />
              {invoice.provider_invoice_id ? "Anular (Nota de Crédito)" : t('invoices.cancel')}
            </Button>
          )}
        </div>
      </div>

      {/* Legal status banner */}
      {invoice.legal_status === 'certified' && (
        <div className="mb-4 rounded-xl border-2 border-success/30 bg-success/5 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-success shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-success">Fatura certificada — imutável (art. 36º CIVA)</p>
            <p className="text-muted-foreground text-xs mt-1">
              Este documento tem valor fiscal, ATCUD {invoice.atcud || '—'}{invoice.certified_series ? ` e série ${invoice.certified_series}` : ''}. Não pode ser editado ou apagado. Para corrigir, emita uma <strong>Nota de Crédito</strong>.
            </p>
          </div>
        </div>
      )}
      {invoice.legal_status === 'cancelled' && (
        <div className="mb-4 rounded-xl border-2 border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <Ban className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-destructive">Fatura anulada por Nota de Crédito</p>
            <p className="text-muted-foreground text-xs mt-1">
              {invoice.credit_note_number ? `NC ${invoice.credit_note_number}` : 'Nota de crédito emitida'}{invoice.cancelled_at ? ` em ${formatLocalDate(invoice.cancelled_at)}` : ''}.
            </p>
          </div>
        </div>
      )}
      {(!invoice.legal_status || invoice.legal_status === 'draft') && (
        <div className="mb-4 rounded-xl border border-warning/30 bg-warning/5 p-3 flex items-start gap-2 text-xs">
          <FileText className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            <strong className="text-foreground">Rascunho interno</strong> — sem valor fiscal. Para emitir uma fatura legalmente válida, use o botão <em>“Emitir via {billingProvider === "moloni" ? "Moloni" : "InvoiceXpress"}”</em>{!billingProvider ? " após ligar a integração em Definições → Faturação" : ""}.
          </p>
        </div>
      )}

      {/* Client & Vehicle Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">{t('quotes.client')}</CardTitle></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p className="font-medium">{(invoice.clients as any)?.name}</p>
            {(invoice.clients as any)?.nif && <p className="text-muted-foreground">NIF: {(invoice.clients as any)?.nif}</p>}
            {(invoice.clients as any)?.email && <p className="text-muted-foreground">{(invoice.clients as any)?.email}</p>}
            {(invoice.clients as any)?.phone && <p className="text-muted-foreground">{(invoice.clients as any)?.phone}</p>}
          </CardContent>
        </Card>
        {(invoice.vehicles as any) && (
          <Card>
            <CardHeader><CardTitle className="text-sm">{t('quotes.vehicle')}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{(invoice.vehicles as any)?.make} {(invoice.vehicles as any)?.model}</p>
              <p className="text-muted-foreground mono">{(invoice.vehicles as any)?.plate}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Items */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-sm">{t('invoices.items')}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('invoices.description')}</TableHead>
                <TableHead className="text-center">{t('invoices.qty')}</TableHead>
                <TableHead className="text-right">{t('invoices.unitPrice')}</TableHead>
                <TableHead className="text-center">{taxLbl}</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map(item => (
                <TableRow key={item.id}>
                  <TableCell>{item.description}</TableCell>
                  <TableCell className="text-center">{item.quantity}</TableCell>
                  <TableCell className="text-right mono">{cur}{Number(item.unit_price).toFixed(2)}</TableCell>
                  <TableCell className="text-center">{item.vat_rate}%</TableCell>
                  <TableCell className="text-right mono font-medium">{cur}{Number(item.total).toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex flex-col items-end mt-4 gap-1">
            <p className="text-sm text-muted-foreground">Subtotal: <span className="font-semibold text-foreground">{cur}{Number(invoice.subtotal).toFixed(2)}</span></p>
            <p className="text-sm text-muted-foreground">{taxLbl}: <span className="font-semibold text-foreground">{cur}{Number(invoice.vat_total).toFixed(2)}</span></p>
            <p className="text-lg font-bold">Total: {cur}{Number(invoice.total).toFixed(2)}</p>
            {totalPaid > 0 && (
              <>
                <p className="text-sm text-success">{t('invoices.paid')}: {cur}{totalPaid.toFixed(2)}</p>
                {remaining > 0 && <p className="text-sm text-destructive">{t('invoices.remaining')}: {cur}{remaining.toFixed(2)}</p>}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Payments */}
      {payments.length > 0 && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-sm">{t('invoices.payments')}</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('invoices.date')}</TableHead>
                  <TableHead>{t('invoices.method')}</TableHead>
                  <TableHead>{t('invoices.reference')}</TableHead>
                  <TableHead className="text-right">{t('invoices.amount')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.id}>
                    <TableCell>{formatLocalDate(p.paid_at)}</TableCell>
                    <TableCell className="capitalize">{p.method}</TableCell>
                    <TableCell>{p.reference || '—'}</TableCell>
                    <TableCell className="text-right mono font-medium text-success">{cur}{Number(p.amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {invoice.notes && (
        <Card className="mb-4">
          <CardHeader><CardTitle className="text-sm">{t('invoices.notes')}</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground whitespace-pre-wrap">{invoice.notes}</p></CardContent>
        </Card>
      )}

      {/* Payment Dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('invoices.registerPayment')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('invoices.amount')} ({cur})</Label>
              <Input type="number" min={0.01} step={0.01} value={payAmount} onChange={e => setPayAmount(Number(e.target.value))} />
            </div>
            <div>
              <Label>{t('invoices.method')}</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t('invoices.method_cash')}</SelectItem>
                  <SelectItem value="card">{t('invoices.method_card')}</SelectItem>
                  <SelectItem value="transfer">{t('invoices.method_transfer')}</SelectItem>
                  <SelectItem value="mbway">MB WAY</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t('invoices.reference')}</Label>
              <Input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder={t('invoices.referencePlaceholder')} />
            </div>
            <div>
              <Label>{t('invoices.date')}</Label>
              <Input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>{t('common.cancel')}</Button>
            <Button onClick={handlePayment} disabled={saving}>{t('invoices.confirmPayment')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
