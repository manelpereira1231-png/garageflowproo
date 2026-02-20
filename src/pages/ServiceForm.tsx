import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface LineItem {
  id: string;
  type: 'service' | 'part';
  name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  vat_rate: number;
}

export default function ServiceForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    const fetchData = async () => {
      const { data: c } = await supabase.from("clients").select("id, name").order("name");
      if (c) setClients(c);
      const { data: v } = await supabase.from("vehicles").select("id, client_id, make, model, plate").order("make");
      if (v) setVehicles(v);
    };
    fetchData();
  }, []);

  useEffect(() => {
    setFilteredVehicles(vehicles.filter(v => v.client_id === clientId));
    setVehicleId("");
  }, [clientId, vehicles]);

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
    if (!clientId || !vehicleId) {
      toast.error("Preencha cliente e veículo.");
      return;
    }
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sessão expirada"); setLoading(false); return; }

    const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).single();
    if (!shop) { toast.error("Configure a oficina"); setLoading(false); return; }

    const { data: countData } = await supabase.from("work_orders").select("id", { count: "exact" }).eq("shop_id", shop.id);
    const num = `SRV-${String((countData?.length || 0) + 1).padStart(4, '0')}`;

    const { error } = await supabase.from("work_orders").insert({
      shop_id: shop.id,
      number: num,
      origin: 'manual',
      client_id: clientId,
      vehicle_id: vehicleId,
      entry_mileage: parseInt(entryMileage),
      client_description: clientDescription || null,
      diagnosis: diagnosis || null,
      lines: lines as any,
      labor_hours: parseFloat(laborHours),
      technician: technician || null,
      subtotal, vat_total: vatTotal, total, cost_total: costTotal, profit,
      status: 'open',
      notes: notes || null,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Serviço criado!");
      navigate("/services");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/services")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="page-title">Novo Serviço</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Cliente & Veículo</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Cliente *</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Veículo *</Label>
              <Select value={vehicleId} onValueChange={setVehicleId} disabled={!clientId}>
                <SelectTrigger><SelectValue placeholder={clientId ? "Selecionar" : "Escolha cliente"} /></SelectTrigger>
                <SelectContent>{filteredVehicles.map(v => <SelectItem key={v.id} value={v.id}>{v.make} {v.model} — {v.plate}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Km Entrada</Label>
              <Input type="number" value={entryMileage} onChange={e => setEntryMileage(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Técnico</Label>
              <Input value={technician} onChange={e => setTechnician(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição do Cliente</Label>
            <Textarea value={clientDescription} onChange={e => setClientDescription(e.target.value)} placeholder="O que o cliente reportou..." />
          </div>
          <div className="space-y-1.5">
            <Label>Diagnóstico</Label>
            <Textarea value={diagnosis} onChange={e => setDiagnosis(e.target.value)} placeholder="Diagnóstico técnico..." />
          </div>
        </div>

        {/* Lines */}
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Linhas</h3>
            <Button type="button" variant="outline" size="sm" onClick={addLine}>
              <Plus className="w-3.5 h-3.5 mr-1.5" />Adicionar
            </Button>
          </div>
          {lines.length === 0 && <p className="text-muted-foreground text-sm text-center py-4">Adicione serviços ou peças.</p>}
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-12 gap-2 items-end border-b border-border pb-3">
              <div className="col-span-12 sm:col-span-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={line.type} onValueChange={v => updateLine(line.id, 'type', v)}>
                  <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="service">Serv.</SelectItem><SelectItem value="part">Peça</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-12 sm:col-span-3">
                <Label className="text-xs">Descrição</Label>
                <Input className="h-9 text-sm" value={line.name} onChange={e => updateLine(line.id, 'name', e.target.value)} required />
              </div>
              <div className="col-span-3 sm:col-span-1"><Label className="text-xs">Qtd</Label><Input className="h-9 text-sm" type="number" min={1} value={line.quantity} onChange={e => updateLine(line.id, 'quantity', +e.target.value)} /></div>
              <div className="col-span-3 sm:col-span-2"><Label className="text-xs">Preço</Label><Input className="h-9 text-sm" type="number" step="0.01" value={line.unit_price} onChange={e => updateLine(line.id, 'unit_price', +e.target.value)} /></div>
              <div className="col-span-3 sm:col-span-2"><Label className="text-xs">Custo</Label><Input className="h-9 text-sm" type="number" step="0.01" value={line.unit_cost} onChange={e => updateLine(line.id, 'unit_cost', +e.target.value)} /></div>
              <div className="col-span-2 sm:col-span-1"><Label className="text-xs">IVA%</Label><Input className="h-9 text-sm" type="number" value={line.vat_rate} onChange={e => updateLine(line.id, 'vat_rate', +e.target.value)} /></div>
              <div className="col-span-1 sm:col-span-1 text-right"><Label className="text-xs">Total</Label><p className="mono text-sm font-medium h-9 flex items-center justify-end">€{(line.quantity * line.unit_price).toFixed(2)}</p></div>
              <div className="col-span-12 sm:col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeLine(line.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>

        {/* Labor + Totals */}
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <Label>Horas Mão de Obra</Label>
              <Input type="number" step="0.5" value={laborHours} onChange={e => setLaborHours(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2 text-sm max-w-xs ml-auto">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="mono">€{subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">IVA</span><span className="mono">€{vatTotal.toFixed(2)}</span></div>
            <div className="flex justify-between text-base font-bold border-t border-border pt-2"><span>Total</span><span className="mono">€{total.toFixed(2)}</span></div>
            <div className="flex justify-between text-success"><span>Lucro</span><span className="mono font-semibold">€{profit.toFixed(2)}</span></div>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notas</Label>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
        </div>

        <Button type="submit" className="w-full h-12 text-base" disabled={loading}>
          {loading ? "A criar..." : "Criar Serviço"}
        </Button>
      </form>
    </div>
  );
}
