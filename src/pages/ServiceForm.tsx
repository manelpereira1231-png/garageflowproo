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
import { GsnPartPickerButton } from "@/components/parts/GsnPartPickerButton";

interface LineItem {
  id: string; type: 'service' | 'part'; name: string;
  quantity: number; unit_price: number; unit_cost: number; vat_rate: number;
  ref_id?: string | null;
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
  const [catalog, setCatalog] = useState<any[]>([]);
  const [partsList, setPartsList] = useState<any[]>([]);
  const [clientId, setClientId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [entryMileage, setEntryMileage] = useState("0");
  const [clientDescription, setClientDescription] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [laborHours, setLaborHours] = useState("0");
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [shopDefaults, setShopDefaults] = useState<{ labor_rate: number; vat_rate: number }>({
    labor_rate: 35,
    vat_rate: 23,
  });

  const activeShopId = localStorage.getItem("garageflow_active_shop");
  const round2 = (n: number) => Math.round(n * 100) / 100;

  useEffect(() => {
    const fetchData = async () => {
      if (!activeShopId) return;
      const { data: c } = await supabase.from("clients").select("id, name").eq("shop_id", activeShopId).is("deleted_at", null).order("name");
      if (c) setClients(c);
      const { data: v } = await supabase.from("vehicles").select("id, client_id, make, model, plate").eq("shop_id", activeShopId).is("deleted_at", null).order("make");
      if (v) setVehicles(v);
      const { data: shop } = await supabase.from("shops").select("labor_rate, vat_rate").eq("id", activeShopId).maybeSingle();
      const laborRate = Number((shop as any)?.labor_rate) || 35;
      const shopVat = Number((shop as any)?.vat_rate) || 23;
      setShopDefaults({ labor_rate: laborRate, vat_rate: shopVat });
      const { data: cat } = await supabase.from("service_catalog").select("id, name, default_price, internal_cost, vat_rate, default_time").eq("shop_id", activeShopId).order("name");
      if (cat) setCatalog(cat);
      const { data: pts } = await supabase.from("parts").select("id, name, sale_price, internal_cost, vat_rate").eq("shop_id", activeShopId).eq("active", true).order("name");
      if (pts) setPartsList(pts);

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
            ref_id: l.ref_id ?? null,
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
    setLines([...lines, { id: crypto.randomUUID(), type: 'service', name: '', quantity: 1, unit_price: 0, unit_cost: 0, vat_rate: shopDefaults.vat_rate }]);
  };
  const updateLine = (id: string, field: string, value: any) => {
    setLines(lines.map(l => l.id === id ? { ...l, [field]: value } : l));
  };
  const removeLine = (id: string) => setLines(lines.filter(l => l.id !== id));

  const laborCharge = round2((parseFloat(laborHours) || 0) * shopDefaults.labor_rate);
  const linesSubtotal = round2(lines.reduce((s, l) => s + l.quantity * l.unit_price, 0));
  const subtotal = round2(linesSubtotal + laborCharge);
  const vatTotal = round2(lines.reduce((s, l) => s + l.quantity * l.unit_price * l.vat_rate / 100, 0) + laborCharge * shopDefaults.vat_rate / 100);
  const total = round2(subtotal + vatTotal);
  const costTotal = round2(lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0));
  const profit = round2(subtotal - costTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId || !vehicleId) { toast.error(t('services.fillRequired')); return; }
    setLoading(true);
    if (!activeShopId) { toast.error(t('common.configureShop')); setLoading(false); return; }
    const shopId = activeShopId;

    if (editId) {
      const { error } = await supabase.from("work_orders").update({
        client_id: clientId, vehicle_id: vehicleId,
        entry_mileage: parseInt(entryMileage), client_description: clientDescription || null,
        diagnosis: diagnosis || null, lines: lines as any, labor_hours: parseFloat(laborHours) || 0,
        technician: technician || null, subtotal, vat_total: vatTotal, total, cost_total: costTotal,
        profit, notes: notes || null,
      }).eq("id", editId);

      if (error) toast.error(error.message);
      else { toast.success(t('services.updated')); navigate("/services"); }
    } else {
      const { data: numData } = await supabase.rpc("next_number", { _shop_id: shopId, _prefix: "SRV" });
      const num = numData || `SRV-${Date.now()}`;

      const { data: inserted, error } = await supabase.from("work_orders").insert({
        shop_id: shopId, number: num, origin: 'manual', client_id: clientId, vehicle_id: vehicleId,
        entry_mileage: parseInt(entryMileage), client_description: clientDescription || null,
        diagnosis: diagnosis || null, lines: lines as any, labor_hours: parseFloat(laborHours) || 0,
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
            <div className="space-y-1.5"><Label>{t('services.laborHours')} ({shopDefaults.labor_rate.toFixed(2)}€/h)</Label><Input type="number" inputMode="decimal" step="0.5" min={0} value={laborHours} onChange={e => setLaborHours(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5"><Label>{t('services.clientDescription')}</Label><Textarea value={clientDescription} onChange={e => setClientDescription(e.target.value)} placeholder={t('services.clientDescPlaceholder')} /></div>
          <div className="space-y-1.5"><Label>{t('services.diagnosis')}</Label><Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder={t('services.diagnosisPlaceholder')} /></div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="font-semibold">{t('quotes.lines')}</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />{t('quotes.addLine')}
            </Button>
          </div>
          <div className="rounded-md bg-muted/40 border border-border/60 px-3 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-2 flex-wrap">
            <span>
              Tarifa mão-de-obra: <strong className="text-foreground">€{shopDefaults.labor_rate.toFixed(2)}/h</strong>
              {' · '}IVA por defeito: <strong className="text-foreground">{shopDefaults.vat_rate}%</strong>
              {' · '}fonte: <button type="button" onClick={() => navigate('/settings')} className="underline hover:text-foreground">Definições</button>
            </span>
            <span className="text-[10px]">Preço ao cliente = <strong>preço do catálogo</strong> (se definido). Sem preço no catálogo, aplica-se <strong>custo peças + (tempo/60) × tarifa/hora</strong>. As <strong>horas de mão-de-obra</strong> extra são somadas ao total quando o tempo previsto no catálogo não chega.</span>
          </div>
          {lines.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">{t('quotes.emptyLines')}</p>}

          {lines.map((line, idx) => {
            const options = line.type === 'service' ? catalog : partsList;
            const pickerLabel = line.type === 'service'
              ? (catalog.length === 0 ? 'Catálogo vazio — cria serviços em Catálogo' : 'Escolher serviço do catálogo…')
              : (partsList.length === 0 ? 'Sem peças — cria peças em Stock' : 'Escolher peça do stock…');
            return (
            <div key={line.id} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Linha #{idx + 1}</span>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive gap-1" onClick={() => removeLine(line.id)}>
                  <Trash2 className="w-3.5 h-3.5" /> Remover
                </Button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={line.type} onValueChange={v => updateLine(line.id, 'type', v)}>
                  <SelectTrigger className="h-10 w-full sm:w-32 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">🔧 {t('line.service')}</SelectItem>
                    <SelectItem value="part">📦 {t('line.part')}</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value=""
                  onValueChange={(val) => {
                    if (line.type === 'service') {
                      const item = catalog.find(c => c.id === val);
                      if (item) {
                        const cost = Number(item.internal_cost) || 0;
                        const timeMin = Number(item.default_time) || 0;
                        const catalogPrice = Number(item.default_price) || 0;
                        const labor = round2((timeMin / 60) * shopDefaults.labor_rate);
                        const unitPrice = catalogPrice > 0 ? round2(catalogPrice) : round2(cost + labor);
                        const vatRate = Number(item.vat_rate) > 0 ? Number(item.vat_rate) : shopDefaults.vat_rate;
                        setLines(prev => prev.map(l => l.id === line.id ? {
                          ...l,
                          name: timeMin > 0 ? `${item.name} (${timeMin} min)` : item.name,
                          unit_price: unitPrice,
                          unit_cost: cost,
                          vat_rate: vatRate,
                        } : l));
                      }
                    } else {
                      const item = partsList.find(p => p.id === val);
                      if (item) setLines(prev => prev.map(l => l.id === line.id ? {
                        ...l,
                        name: item.name,
                        unit_price: Number(item.sale_price) || 0,
                        unit_cost: Number(item.internal_cost) || 0,
                        vat_rate: Number(item.vat_rate) > 0 ? Number(item.vat_rate) : shopDefaults.vat_rate,
                        ref_id: item.id,
                      } : l));
                    }
                  }}
                >
                  <SelectTrigger className="h-10 flex-1 text-sm border-primary/40 bg-primary/5 hover:bg-primary/10">
                    <SelectValue placeholder={pickerLabel} />
                  </SelectTrigger>
                  <SelectContent className="max-h-80">
                    {options.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-muted-foreground">{pickerLabel}</div>
                    ) : options.map((c: any) => {
                      const cost = Number(c.internal_cost) || 0;
                      const timeMin = Number(c.default_time) || 0;
                      const labor = round2((timeMin / 60) * shopDefaults.labor_rate);
                      const catalogPrice = Number(c.default_price) || 0;
                      const previewPrice = line.type === 'service'
                        ? (catalogPrice > 0 ? round2(catalogPrice) : round2(cost + labor))
                        : Number(c.sale_price) || 0;
                      const timeLabel = line.type === 'service' && timeMin > 0
                        ? ` · ${timeMin} min`
                        : '';
                      return (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}{timeLabel} — €{previewPrice.toFixed(2)}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-12 sm:col-span-4">
                  <Label className="text-xs">{t('line.description')} *</Label>
                  <Input className="h-9 text-sm" value={line.name} onChange={e => updateLine(line.id, 'name', e.target.value)} required />
                </div>
                <div className="col-span-3 sm:col-span-1"><Label className="text-xs">{t('line.qty')}</Label><Input className="h-9 text-sm" type="number" inputMode="numeric" min={1} placeholder="1" value={line.quantity === 0 ? "" : line.quantity} onChange={e => updateLine(line.id, 'quantity', e.target.value === "" ? 0 : +e.target.value)} /></div>
                <div className="col-span-4 sm:col-span-2"><Label className="text-xs">{t('line.price')}</Label><Input className="h-9 text-sm" type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={line.unit_price === 0 ? "" : line.unit_price} onChange={e => updateLine(line.id, 'unit_price', e.target.value === "" ? 0 : +e.target.value)} /></div>
                <div className="col-span-5 sm:col-span-2"><Label className="text-xs">{t('line.cost')}</Label><Input className="h-9 text-sm" type="number" inputMode="decimal" step="0.01" placeholder="0.00" value={line.unit_cost === 0 ? "" : line.unit_cost} onChange={e => updateLine(line.id, 'unit_cost', e.target.value === "" ? 0 : +e.target.value)} /></div>
                <div className="col-span-4 sm:col-span-1"><Label className="text-xs">{t('line.vat')}%</Label><Input className="h-9 text-sm" type="number" inputMode="decimal" placeholder="23" value={line.vat_rate === 0 ? "" : line.vat_rate} onChange={e => updateLine(line.id, 'vat_rate', e.target.value === "" ? 0 : +e.target.value)} /></div>
                <div className="col-span-8 sm:col-span-2 text-right"><Label className="text-xs">{t('line.total')}</Label><p className="mono text-sm font-semibold h-9 flex items-center justify-end">€{(line.quantity * line.unit_price).toFixed(2)}</p></div>
              </div>
            </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="space-y-2 text-sm max-w-xs ml-auto">
            <div className="flex justify-between"><span className="text-muted-foreground">{t('totals.subtotal')}</span><span className="mono">€{subtotal.toFixed(2)}</span></div>
            {laborCharge > 0 && <div className="flex justify-between text-xs"><span className="text-muted-foreground">Mão-de-obra extra ({parseFloat(laborHours) || 0}h × €{shopDefaults.labor_rate.toFixed(2)}/h)</span><span className="mono">€{laborCharge.toFixed(2)}</span></div>}
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
