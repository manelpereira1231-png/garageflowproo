import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Car } from "lucide-react";
import { toast } from "sonner";
import { FUEL_TYPES } from "@/types/garage";

interface VehicleRow {
  id: string;
  client_id: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin: string | null;
  mileage: number;
  fuel: string;
  notes: string | null;
  clients?: { name: string } | null;
}

interface ClientOption { id: string; name: string; }

export default function Vehicles() {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    client_id: "", make: "", model: "", year: new Date().getFullYear().toString(),
    plate: "", vin: "", mileage: "0", fuel: "Gasolina", notes: ""
  });

  const fetchData = async () => {
    const { data: v } = await supabase
      .from("vehicles")
      .select("*, clients(name)")
      .order("created_at", { ascending: false });
    if (v) setVehicles(v);
    
    const { data: c } = await supabase.from("clients").select("id, name").order("name");
    if (c) setClients(c);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sessão expirada"); setLoading(false); return; }

    const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).single();
    if (!shop) { toast.error("Configure a oficina primeiro"); setLoading(false); return; }

    const { error } = await supabase.from("vehicles").insert({
      shop_id: shop.id,
      client_id: form.client_id,
      make: form.make,
      model: form.model,
      year: parseInt(form.year),
      plate: form.plate.toUpperCase(),
      vin: form.vin || null,
      mileage: parseInt(form.mileage),
      fuel: form.fuel,
      notes: form.notes || null,
    });

    if (error) toast.error(error.message);
    else {
      toast.success("Veículo criado!");
      setOpen(false);
      fetchData();
    }
    setLoading(false);
  };

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    v.make.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Veículos</h1>
          <p className="text-muted-foreground text-sm mt-1">{vehicles.length} veículos</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Novo Veículo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Veículo</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Cliente *</Label>
                <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Marca *</Label>
                  <Input value={form.make} onChange={e => setForm({...form, make: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo *</Label>
                  <Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} required />
                </div>
                <div className="space-y-1.5">
                  <Label>Ano</Label>
                  <Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>Matrícula *</Label>
                  <Input value={form.plate} onChange={e => setForm({...form, plate: e.target.value})} required placeholder="AA-00-BB" />
                </div>
                <div className="space-y-1.5">
                  <Label>VIN</Label>
                  <Input value={form.vin} onChange={e => setForm({...form, vin: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>Quilometragem</Label>
                  <Input type="number" value={form.mileage} onChange={e => setForm({...form, mileage: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <Label>Combustível</Label>
                  <Select value={form.fuel} onValueChange={v => setForm({...form, fuel: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FUEL_TYPES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "A criar..." : "Criar Veículo"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Pesquisar por matrícula, marca..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Veículo</TableHead>
              <TableHead>Matrícula</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Km</TableHead>
              <TableHead>Combustível</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {vehicles.length === 0 ? "Sem veículos. Crie o primeiro!" : "Nenhum resultado."}
                </TableCell>
              </TableRow>
            ) : filtered.map(v => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-muted-foreground" />
                    {v.make} {v.model} <span className="text-muted-foreground">({v.year})</span>
                  </div>
                </TableCell>
                <TableCell className="mono font-medium">{v.plate}</TableCell>
                <TableCell>{(v.clients as any)?.name || "—"}</TableCell>
                <TableCell className="mono">{v.mileage.toLocaleString()} km</TableCell>
                <TableCell>{v.fuel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
