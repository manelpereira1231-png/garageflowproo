import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { useSubscription } from "@/hooks/useSubscription";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface LineItem {
  id: string; type: 'service' | 'part'; name: string;
  quantity: number; unit_price: number; unit_cost: number; vat_rate: number;
}

export default function QuoteForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { plan, limits, checkQuoteLimit } = useSubscription();
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!editId);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [validityDays, setValidityDays] = useState("30");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [quoteStatus, setQuoteStatus] = useState("draft");

  useEffect(() => {
    const fetchData = async () => {
      const { data: c } = await supabase.from("clients").select("id, name").order("name");
      if (c) setClients(c);
      const { data: v } = await supabase.from("vehicles").select("id, client_id, make, model, plate").order("make");
      if (v) setVehicles(v);

      // Load existing quote for editing
      if (editId) {
        const { data: quote } = await supabase.from("quotes").select("*").eq("id", editId).single();
        if (quote) {
          setClientId(quote.client_id);
          setVehicleId(quote.vehicle_id);
          setNotes(quote.notes || "");
          setQuoteStatus(quote.status);
          const quoteLines = Array.isArray(quote.lines) ? quote.lines : [];
          setLines(quoteLines.map((l: any) => ({
            id: l.id || crypto.randomUUID(),
            type: l.type || 'service',
            name: l.name || '',
            quantity: l.quantity || 1,
            unit_price: l.unit_price || 0,
            unit_cost: l.unit_cost || 0,
            vat_rate: l.vat_rate ?? 23,
          })));
          // Calculate validity days from dates
          if (quote.date && quote.validity_date) {
            const diff = Math.round((new Date(quote.validity_date).getTime() - new Date(quote.date).getTime()) / (1000 * 60 * 60 * 24));
            setValidityDays(String(diff > 0 ? diff : 30));
          }
        }
        setLoadingData(false);
      }
    };
    fetchData();
  }, [editId]);

  useEffect(() => {
    if (!editId) {
      setFilteredVehicles(vehicles.filter(v => v.client_id === clientId));
      setVehicleId("");
    } else {
      setFilteredVehicles(vehicles.filter(v => v.client_id === clientId));
    }
  }, [clientId, vehicles, editId]);

  const addLine = () => {
    setLines([...lines, { id: crypto.randomUUID(), type: 'service', name: '', quantity: 1, unit_price: 0, unit_cost: 0, vat_rate: 23 }]);
  };

  const updateLine = (id: string, field: string, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const removeLine = (id: string) => setLines(lines.filter(l => l.id !== id));

  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0);
  const vatTotal = lines.reduce((s, l) => s + l.quantity * l.unit_price * l.vat_rate / 100, 0);
  const total = subtotal + vatTotal;
  const costTotal = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);
  const profit = total - costTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !vehicleId || lines.length === 0) {
      toast.error(t('quotes.fillRequired'));
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t('common.sessionExpired')); setLoading(false); return; }
    const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).maybeSingle();
    if (!shop) { toast.error(t('common.configureShop')); setLoading(false); return; }

    // Check quote limit for new quotes on Free plan
    if (!editId && plan === 'free') {
      const canCreate = await checkQuoteLimit();
      if (!canCreate) {
        setShowLimitModal(true);
        setLoading(false);
        return;
      }
    }

    if (editId) {
      // Update existing quote
      const now = new Date();
      const validity = new Date(now);
      validity.setDate(validity.getDate() + parseInt(validityDays));

      const { error } = await supabase.from("quotes").update({
        client_id: clientId, vehicle_id: vehicleId,
        validity_date: validity.toISOString().split('T')[0],
        lines: lines as any, subtotal, vat_total: vatTotal, total, cost_total: costTotal, profit,
        notes: notes || null,
      }).eq("id", editId);

      if (error) toast.error(error.message);
      else { toast.success(t('quotes.updated')); navigate("/quotes"); }
    } else {
      // Create new quote
      const now = new Date();
      const validity = new Date(now);
      validity.setDate(validity.getDate() + parseInt(validityDays));
      const { data: countData } = await supabase.from("quotes").select("id", { count: "exact" }).eq("shop_id", shop.id);
      const num = `ORC-${String((countData?.length || 0) + 1).padStart(4, '0')}`;

      const { error } = await supabase.from("quotes").insert({
        shop_id: shop.id, number: num, date: now.toISOString().split('T')[0],
        validity_date: validity.toISOString().split('T')[0], client_id: clientId, vehicle_id: vehicleId,
        lines: lines as any, subtotal, vat_total: vatTotal, total, cost_total: costTotal, profit,
        status: 'draft', notes: notes || null, token: crypto.randomUUID(),
      });

      if (error) toast.error(error.message);
      else { toast.success(t('quotes.created')); navigate("/quotes"); }
    }
    setLoading(false);
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/quotes")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="page-title">{editId ? t('quotes.edit') : t('quotes.new')}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">{t('quotes.clientVehicle')}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t('quotes.client')} *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder={t('quotes.selectClient')} /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('quotes.vehicle')} *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder={clientId ? t('quotes.selectVehicle') : t('quotes.selectClientFirst')} /></SelectTrigger>
                <SelectContent>{filteredVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('quotes.lines')}</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />{t('quotes.addLine')}
            </Button>
          </div>
          {lines.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">{t('quotes.emptyLines')}</p>}
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-end border-b border-border pb-3">
              <div className="col-span-12 sm:col-span-1">
                <Label className="text-xs">{t('line.type')}</Label>
                <Select value={line.type} onValueChange={v => updateLine(line.id, 'type', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="service">{t('line.service')}</SelectItem><SelectItem value="part">{t('line.part')}</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label className="text-xs">{t('line.description')}</Label>
                <Input className="h-9 text-sm" value={line.name} onChange={e => updateLine(line.id, 'name', e.target.value)} required />
              </div>
              <div className="col-span-3 sm:col-span-1"><Label className="text-xs">{t('line.qty')}</Label><Input className="h-9 text-sm" type="number" min={1} value={line.quantity} onChange={e => updateLine(line.id, 'quantity', +e.target.value)} /></div>
              <div className="col-span-3 sm:col-span-2"><Label className="text-xs">{t('line.price')}</Label><Input className="h-9 text-sm" type="number" step="0.01" value={line.unit_price} onChange={e => updateLine(line.id, 'unit_price', +e.target.value)} /></div>
              <div className="col-span-3 sm:col-span-2"><Label className="text-xs">{t('line.cost')}</Label><Input className="h-9 text-sm" type="number" step="0.01" value={line.unit_cost} onChange={e => updateLine(line.id, 'unit_cost', +e.target.value)} /></div>
              <div className="col-span-2 sm:col-span-1"><Label className="text-xs">{t('line.vat')}</Label><Input className="h-9 text-sm" type="number" value={line.vat_rate} onChange={e => updateLine(line.id, 'vat_rate', +e.target.value)} /></div>
              <div className="col-span-1 sm:col-span-1 text-right"><Label className="text-xs">{t('line.total')}</Label><p className="mono text-sm font-medium h-9 flex items-center justify-end">€{(line.quantity * line.unit_price).toFixed(2)}</p></div>
              <div className="col-span-12 sm:col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLine(line.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="space-y-2 text-sm max-w-xs ml-auto">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('totals.subtotal')}</span><span className="mono">€{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('totals.vat')}</span><span className="mono">€{vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-2"><span>{t('totals.total')}</span><span className="mono">€{total.toFixed(2)}</span></div>
            <div className="flex justify-between text-success"><span>{t('totals.profit')}</span><span className="mono font-semibold">€{profit.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label>{t('quotes.validityDays')}</Label><Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>{t('quotes.notes')}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={t('quotes.notesPlaceholder')} /></div>
        </div>

        <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
          {loading ? (editId ? t('quotes.saving') : t('quotes.creating')) : (editId ? t('quotes.save') : t('quotes.create'))}
        </Button>
      </form>

      {/* Upgrade Modal */}
      <Dialog open={showLimitModal} onOpenChange={setShowLimitModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              {t('quotes.limitReached')}
            </DialogTitle>
            <DialogDescription>
              {t('quotes.limitMessage').replace('{limit}', String(limits.maxQuotesPerMonth))}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLimitModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => { setShowLimitModal(false); navigate("/billing"); }}>{t('quotes.upgrade')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}