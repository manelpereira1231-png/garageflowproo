import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Save, ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/pushNotifications";
import { sendLifecycleEmail } from "@/lib/lifecycleEmail";
import ProgressiveSetup from "@/components/ProgressiveSetup";
import { formatMoney } from "@/lib/money";
import { getTaxLabel } from "@/lib/regionConfig";

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
}

export default function InvoiceForm() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromQuote = searchParams.get("from_quote");
  const fromWorkOrder = searchParams.get("from_wo");

  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, vat_rate: 23 },
  ]);
  const [saving, setSaving] = useState(false);
  const [shop, setShop] = useState<any>(null);
  const [quoteId, setQuoteId] = useState<string | null>(fromQuote);
  const [workOrderId, setWorkOrderId] = useState<string | null>(fromWorkOrder);

  useEffect(() => {
    const load = async () => {
      const activeId = localStorage.getItem("garageflow_active_shop");
      if (!activeId) return;

      const [shopRes, clientsRes, vehiclesRes] = await Promise.all([
        supabase.from("shops").select("*").eq("id", activeId).maybeSingle(),
        supabase.from("clients").select("id, name, nif, email, phone").eq("shop_id", activeId).is("deleted_at", null).order("name"),
        supabase.from("vehicles").select("id, make, model, plate, client_id").eq("shop_id", activeId).is("deleted_at", null),
      ]);
      if (shopRes.data) setShop(shopRes.data);
      if (clientsRes.data) setClients(clientsRes.data);
      if (vehiclesRes.data) setVehicles(vehiclesRes.data);

      // Discriminação Peça/Mão de obra/Serviço — igual à conversão automática
      // OS→Fatura (autoCreateInvoiceFromWorkOrder). Garante que a fatura
      // manual preenchida a partir de orçamento/OS não perde a categoria.
      const typeLabel = (tp?: string) => {
        if (tp === 'part') return 'Peça';
        if (tp === 'labor') return 'Mão de obra';
        if (tp === 'service') return 'Serviço';
        return null;
      };
      const mapLineToItem = (l: any) => {
        const raw = l.name || l.description || "";
        const prefix = typeLabel(l.type);
        return {
          id: crypto.randomUUID(),
          description: raw ? (prefix ? `${prefix}: ${raw}` : raw) : (prefix || ''),
          quantity: l.quantity || 1,
          unit_price: l.unit_price || 0,
          vat_rate: l.vat_rate || 23,
        };
      };

      // Pre-fill from quote
      if (fromQuote) {
        const { data: quote } = await supabase.from("quotes").select("*").eq("id", fromQuote).maybeSingle();
        if (quote) {
          setClientId(quote.client_id);
          setVehicleId(quote.vehicle_id);
          setNotes(quote.notes || "");
          const lines = Array.isArray(quote.lines) ? (quote.lines as any[]) : [];
          if (lines.length > 0) setItems(lines.map(mapLineToItem));
        }
      }

      // Pre-fill from work order
      if (fromWorkOrder) {
        const { data: wo } = await supabase.from("work_orders").select("*").eq("id", fromWorkOrder).maybeSingle();
        if (wo) {
          setClientId(wo.client_id);
          setVehicleId(wo.vehicle_id);
          setNotes(wo.notes || "");
          setWorkOrderId(wo.id);
          if (wo.quote_id) setQuoteId(wo.quote_id);
          const lines = Array.isArray(wo.lines) ? (wo.lines as any[]) : [];
          if (lines.length > 0) setItems(lines.map(mapLineToItem));
        }
      }
    };
    load();
  }, [fromQuote, fromWorkOrder]);

  const clientVehicles = vehicles.filter(v => v.client_id === clientId);

  const addItem = () => {
    setItems([...items, { id: crypto.randomUUID(), description: "", quantity: 1, unit_price: 0, vat_rate: shop?.vat_rate || 23 }]);
  };

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems(items.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const removeItem = (id: string) => {
    if (items.length <= 1) return;
    setItems(items.filter(i => i.id !== id));
  };

  const calcItemTotal = (item: InvoiceItem) => {
    const base = item.quantity * item.unit_price;
    return base + base * (item.vat_rate / 100);
  };

  const subtotal = items.reduce((acc, i) => acc + i.quantity * i.unit_price, 0);
  const vatTotal = items.reduce((acc, i) => acc + i.quantity * i.unit_price * (i.vat_rate / 100), 0);
  const total = subtotal + vatTotal;
  const invoiceCurrency = shop?.currency || undefined;

  const handleSave = async (issueNow: boolean) => {
    if (!clientId) { toast.error(t('invoices.selectClient')); return; }
    if (items.some(i => !i.description.trim())) { toast.error(t('invoices.fillItems')); return; }

    setSaving(true);
    const activeId = localStorage.getItem("garageflow_active_shop");
    if (!activeId) { setSaving(false); return; }

    const { data: numData } = await supabase.rpc('next_invoice_number', { _shop_id: activeId });
    const number = numData || `FAT-${new Date().getFullYear()}-0001`;

    const { data: invoice, error } = await supabase.from("invoices").insert({
      shop_id: activeId,
      client_id: clientId,
      vehicle_id: vehicleId || null,
      work_order_id: workOrderId || null,
      quote_id: quoteId || null,
      number,
      type: 'invoice',
      status: issueNow ? 'issued' : 'draft',
      subtotal,
      vat_total: vatTotal,
      total,
      currency: shop?.currency || 'EUR',
      due_date: dueDate || null,
      notes: notes || null,
    }).select().single();

    if (error || !invoice) {
      toast.error(error?.message || t('common.error'));
      setSaving(false);
      return;
    }

    // Insert items
    const itemsToInsert = items.map(i => ({
      invoice_id: invoice.id,
      description: i.description,
      quantity: i.quantity,
      unit_price: i.unit_price,
      vat_rate: i.vat_rate,
      total: i.quantity * i.unit_price * (1 + i.vat_rate / 100),
    }));

    const { error: itemsError } = await supabase.from("invoice_items").insert(itemsToInsert);
    if (itemsError) {
      toast.error(itemsError.message);
      setSaving(false);
      return;
    }

    toast.success(issueNow ? t('invoices.issued') : t('invoices.saved'));
    // Push notification for new invoice
    if (issueNow && activeId) {
      const client = clients.find(c => c.id === clientId);
      const clientName = client?.name || '';
      sendPushNotification(
        activeId,
        `Nova fatura ${number}`,
        `${clientName} — ${formatMoney(total, invoiceCurrency)}`,
        `/invoices/${invoice.id}`
      );
      if (client?.email) {
        void sendLifecycleEmail({
          shopId: activeId, templateKey: "invoice_created", entityId: invoice.id, recipient: client.email,
          data: { client_name: clientName, invoice_number: number, total: `${(shop?.currency || '€')}${total.toFixed(2)}` },
        });
      }
    }
    navigate(`/invoices/${invoice.id}`);
    setSaving(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/invoices")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="page-title">{t('invoices.new')}</h1>
          <p className="text-muted-foreground text-sm">{t('invoices.newDescription')}</p>
        </div>
      </div>

      {/* Client & Vehicle */}
      <Card className="mb-4">
        <CardHeader><CardTitle className="text-base">{t('invoices.clientVehicle')}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>{t('quotes.client')}</Label>
            <Select value={clientId} onValueChange={(v) => { setClientId(v); setVehicleId(""); }}>
              <SelectTrigger><SelectValue placeholder={t('invoices.selectClient')} /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.nif ? `(${c.nif})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('quotes.vehicle')}</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder={t('invoices.selectVehicle')} /></SelectTrigger>
              <SelectContent>
                {clientVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('invoices.dueDate')}</Label>
            <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('invoices.items')}</CardTitle>
            <Button variant="outline" size="sm" onClick={addItem}>
              <Plus className="w-4 h-4 mr-1" />{t('invoices.addItem')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((item, idx) => (
            <div key={item.id} className="grid grid-cols-12 gap-2 items-end">
              <div className="col-span-12 md:col-span-5">
                {idx === 0 && <Label className="text-xs">{t('invoices.description')}</Label>}
                <Input value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder={t('invoices.description')} />
              </div>
              <div className="col-span-3 md:col-span-2">
                {idx === 0 && <Label className="text-xs">{t('invoices.qty')}</Label>}
                <Input
                  type="number"
                  inputMode="decimal"
                  min={1}
                  value={item.quantity === 0 ? '' : item.quantity}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const v = e.target.value;
                    updateItem(item.id, 'quantity', v === '' ? 0 : Number(v));
                  }}
                />
              </div>
              <div className="col-span-4 md:col-span-2">
                {idx === 0 && <Label className="text-xs">{t('invoices.unitPrice')}</Label>}
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step={0.01}
                  value={item.unit_price === 0 ? '' : item.unit_price}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const v = e.target.value;
                    updateItem(item.id, 'unit_price', v === '' ? 0 : Number(v));
                  }}
                />
              </div>
              <div className="col-span-3 md:col-span-2">
                {idx === 0 && <Label className="text-xs">IVA %</Label>}
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  value={item.vat_rate === 0 ? '' : item.vat_rate}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const v = e.target.value;
                    updateItem(item.id, 'vat_rate', v === '' ? 0 : Number(v));
                  }}
                />
              </div>
              <div className="col-span-2 md:col-span-1 flex items-center justify-end">
                <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} disabled={items.length <= 1} className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="mb-4">
        <CardContent className="pt-6">
          <div className="flex flex-col items-end gap-1">
            <p className="text-sm text-muted-foreground">Subtotal: <span className="font-semibold text-foreground">{cur}{subtotal.toFixed(2)}</span></p>
            <p className="text-sm text-muted-foreground">IVA: <span className="font-semibold text-foreground">{cur}{vatTotal.toFixed(2)}</span></p>
            <p className="text-lg font-bold">Total: {cur}{total.toFixed(2)}</p>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <Label>{t('invoices.notes')}</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder={t('invoices.notesPlaceholder')} />
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={() => navigate("/invoices")}>{t('common.cancel')}</Button>
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />{t('invoices.saveDraft')}
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          {t('invoices.issueInvoice')}
        </Button>
      </div>
      <ProgressiveSetup trigger="nif" />
      <ProgressiveSetup trigger="address" />
    </div>
  );
}
