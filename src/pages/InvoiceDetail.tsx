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
import { ArrowLeft, FileDown, Ban, CreditCard, Printer } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { generateInvoicePdf } from "@/lib/invoicePdfGenerator";
import { useSubscription } from "@/hooks/useSubscription";

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
  };

  useEffect(() => { loadData(); }, [id]);

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = invoice ? Number(invoice.total) - totalPaid : 0;
  const cur = shop?.currency === 'EUR' ? '€' : (shop?.currency || '€');

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
    const newStatus = newTotalPaid >= Number(invoice.total) ? 'paid' : 'partial';
    await supabase.from("invoices").update({ status: newStatus }).eq("id", invoice.id);

    toast.success(t('invoices.paymentRegistered'));
    setShowPayment(false);
    setPayAmount(0);
    setPayRef("");
    setSaving(false);
    loadData();
  };

  const handleCancel = async () => {
    if (!invoice) return;
    await supabase.from("invoices").update({ status: 'cancelled' }).eq("id", invoice.id);
    toast.success(t('invoices.cancelled'));
    loadData();
  };

  const handleIssue = async () => {
    if (!invoice) return;
    await supabase.from("invoices").update({ status: 'issued' }).eq("id", invoice.id);
    toast.success(t('invoices.issued'));
    loadData();
  };

  const handleDownloadPdf = async () => {
    if (!invoice || !shop) return;
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
          <Badge variant="secondary" className={statusColors[invoice.status] || ''}>
            {t(`invoices.status_${invoice.status}`)}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
            <Printer className="w-4 h-4 mr-1" />PDF
          </Button>
          {invoice.status === 'draft' && (
            <Button size="sm" onClick={handleIssue}>{t('invoices.issueInvoice')}</Button>
          )}
          {['issued', 'partial'].includes(invoice.status) && (
            <Button size="sm" onClick={() => { setPayAmount(remaining); setShowPayment(true); }}>
              <CreditCard className="w-4 h-4 mr-1" />{t('invoices.registerPayment')}
            </Button>
          )}
          {['draft', 'issued'].includes(invoice.status) && (
            <Button variant="destructive" size="sm" onClick={handleCancel}>
              <Ban className="w-4 h-4 mr-1" />{t('invoices.cancel')}
            </Button>
          )}
        </div>
      </div>

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
                <TableHead className="text-center">IVA</TableHead>
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
            <p className="text-sm text-muted-foreground">IVA: <span className="font-semibold text-foreground">{cur}{Number(invoice.vat_total).toFixed(2)}</span></p>
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
                    <TableCell>{new Date(p.paid_at).toLocaleDateString('pt-PT')}</TableCell>
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
