import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import ProgressiveSetup from "@/components/ProgressiveSetup";
import { sendLifecycleEmail } from "@/lib/lifecycleEmail";

interface LineItem {
  id: string; type: 'service' | 'part'; name: string;
  quantity: number; unit_price: number; unit_cost: number; vat_rate: number;
}

export default function ServiceForm() {
  const navigate = useNavigate();
  const { id: editId } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!editId);
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [filteredVehicles, setFilteredVehicles] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [entryMileage, setEntryMileage] = useState("0");
  const [clientDescription, setClientDescription] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [laborHours, setLaborHours] = useState("0");
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);

  const activeShopId = localStorage.getItem("garageflow_active_shop");

  useEffect(() => {
    const fetchData = async () => {
      if (!activeShopId) return;
      const { data: c } = await supabase.from("clients").select("id, name").eq("shop_id", activeShopId).is("deleted_at", null).order("name");
      if (c) setClients(c);
      const { data: v } = await supabase.from("vehicles").select("id, client_id, make, model, plate").eq("shop_id", activeShopId).is("deleted_at", null).order("make");
      if (v) setVehicles(v);

      // Load existing service for editing
      if (editId) {
        const { data: service } = await supabase.from("work_orders").select("*").eq("id", editId).single();
        if (service) {
          setClientId(service.client_id);
          setVehicleId(service.vehicle_id);
          setEntryMileage(String(service.entry_mileage || 0));
          setClientDescription(service.client_description || "");
          setDiagnosis(service.diagnosis || "");
          setLaborHours(String(service.labor_hours || 0));
          setTechnician(service.technician || "");
          setNotes(service.notes || "");
          const svcLines = Array.isArray(service.lines) ? service.lines : [];
          setLines(svcLines.map((l: any) => ({
            id: l.id || crypto.randomUUID(),
            type: l.type || 'service',
            name: l.name || '',
            quantity: l.quantity || 1,
            unit_price: l.unit_price || 0,
            unit_cost: l.unit_cost || 0,
            vat_rate: l.vat_rate ?? 23,
          })));
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
    if (!clientId || !vehicleId) { toast.error(t('services.fillRequired')); return; }
    setLoading(true);
    if (!activeShopId) { toast.error(t('common.configureShop')); setLoading(false); return; }
    const shopId = activeShopId;

    if (editId) {
      // Update existing service
      const { error } = await supabase.from("work_orders").update({
        client_id: clientId, vehicle_id: vehicleId,
        entry_mileage: parseInt(entryMileage), client_description: clientDescription || null,
        diagnosis: diagnosis || null, lines: lines as any, labor_hours: parseFloat(laborHours),
        technician: technician || null, subtotal, vat_total: vatTotal, total, cost_total: costTotal,
        profit, notes: notes || null,
      }).eq("id", editId);

      if (error) toast.error(error.message);
      else { toast.success(t('services.updated')); navigate("/services"); }
    } else {
      // Create new service
      const { data: numData } = await supabase.rpc("next_number", { _shop_id: shopId, _prefix: "SRV" });
      const num = numData || `SRV-${Date.now()}`;

      const { data: inserted, error } = await supabase.from("work_orders").insert({
        shop_id: shopId, number: num, origin: 'manual', client_id: clientId, vehicle_id: vehicleId,
        entry_mileage: parseInt(entryMileage), client_description: clientDescription || null,
        diagnosis: diagnosis || null, lines: lines as any, labor_hours: parseFloat(laborHours),
        technician: technician || null, subtotal, vat_total: vatTotal, total, cost_total: costTotal,
        profit, status: 'open', notes: notes || null,
      }).select("id").single();

      if (error) toast.error(error.message);
      else {
        toast.success(t('services.created'));
        try {
          const { data: cli } = await supabase.from("clients").select("name, email").eq("id", clientId).maybeSingle();
          const { data: veh } = await supabase.from("vehicles").select("plate, make, model").eq("id", vehicleId).maybeSingle();
          if (cli?.email && inserted?.id) {
            void sendLifecycleEmail({
              shopId, templateKey: "first_work_order", entityId: inserted.id, recipient: cli.email,
              data: {
                client_name: cli.name, wo_number: num,
                vehicle: veh ? `${veh.make ?? ""} ${veh.model ?? ""} ${veh.plate ?? ""}`.trim() : "",
              },
            });
          }
        } catch {}
        navigate("/services");
      }
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/services")}><ArrowLeft className="w-4 h-4" /></Button>
          <h1 className="page-title">{editId ? t('services.edit') : t('services.new')}</h1>
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
            <div className="space-y-1.5"><Label>{t('services.entryMileage')}</Label><Input type="number" value={entryMileage} onChange={e => setEntryMileage(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{t('services.technician')}</Label><Input value={technician} onChange={e => setTechnician(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>{t('services.clientDescription')}</Label><Textarea value={clientDescription} onChange={e => setClientDescription(e.target.value)} placeholder={t('services.clientDescPlaceholder')} /></div>
          <div className="space-y-1.5"><Label>{t('services.diagnosis')}</Label><Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder={t('services.diagnosisPlaceholder')} /></div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{t('quotes.lines')}</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}><Plus className="w-3.5 h-3.5 mr-1.5" />{t('quotes.addLine')}</Button>
          </div>
          {lines.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">{t('quotes.emptyLines')}</p>}
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-end border-b border-border pb-3">
              <div className="col-span-6 sm:col-span-1">
                <Label className="text-xs">{t('line.type')}</Label>
                <Select value={line.type} onValueChange={v => updateLine(line.id, 'type', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="service">{t('line.service')}</SelectItem><SelectItem value="part">{t('line.part')}</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-6 sm:col-span-1 flex sm:hidden justify-end">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLine(line.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="col-span-12 sm:col-span-3"><Label className="text-xs">{t('line.description')}</Label><Input className="h-9 text-sm" value={line.name} onChange={e => updateLine(line.id, 'name', e.target.value)} required /></div>
              <div className="col-span-4 sm:col-span-1"><Label className="text-xs">{t('line.qty')}</Label><Input className="h-9 text-sm" type="number" inputMode="numeric" min={1} placeholder="1" value={line.quantity === 0 ? "" : line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value === "" ? 0 : +e.target.value)} /></div>
              <div className="col-span-4 sm:col-span-2"><Label className="text-xs">{t('line.price')}</Label><Input className="h-9 text-sm" type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={line.unit_price === 0 ? "" : line.unit_price} onChange={e => updateLine(line.id, 'unit_price', e.target.value === "" ? 0 : +e.target.value)} /></div>
              <div className="col-span-4 sm:col-span-2"><Label className="text-xs">{t('line.cost')}</Label><Input className="h-9 text-sm" type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={line.unit_cost === 0 ? "" : line.unit_cost} onChange={e => updateLine(line.id, 'unit_cost', e.target.value === "" ? 0 : +e.target.value)} /></div>
              <div className="col-span-6 sm:col-span-1"><Label className="text-xs">{t('line.vat')}</Label><Input className="h-9 text-sm" type="number" inputMode="decimal" placeholder="23" value={line.vat_rate === 0 ? "" : line.vat_rate} onChange={e => updateLine(line.id, 'vat_rate', e.target.value === "" ? 0 : +e.target.value)} /></div>
              <div className="col-span-6 sm:col-span-1 text-right"><Label className="text-xs">{t('line.total')}</Label><p className="mono text-sm font-medium h-9 flex items-center justify-end">€{(line.quantity * line.unit_price).toFixed(2)}</p></div>
              <div className="hidden sm:flex sm:col-span-1 justify-end"><Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLine(line.id)}><Trash2 className="w-3.5 h-3.5" /></Button></div>
            </div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5"><Label>{t('services.laborHours')}</Label><Input type="number" step="0.5" value={laborHours} onChange={e => setLaborHours(e.target.value)} /></div>
          </div>
          <div className="space-y-2 text-sm max-w-xs ml-auto">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('totals.subtotal')}</span><span className="mono">€{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t('totals.vat')}</span><span className="mono">€{vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-2"><span>{t('totals.total')}</span><span className="mono">€{total.toFixed(2)}</span></div>
            <div className="flex justify-between text-success"><span>{t('totals.profit')}</span><span className="mono font-semibold">€{profit.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="space-y-1.5"><Label>{t('quotes.notes')}</Label><Textarea value={notes} onChange={e => setNotes(e.target.value)} /></div>

        <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
          {loading ? (editId ? t('services.saving') : t('services.creating')) : (editId ? t('services.save') : t('services.create'))}
        </Button>
      </form>
      <ProgressiveSetup trigger="labor_rate" />
    </div>
  );
}