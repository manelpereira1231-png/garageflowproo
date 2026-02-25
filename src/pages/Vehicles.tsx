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
import { useLanguage } from "@/i18n/LanguageContext";

const FUEL_KEYS = ['fuel.gasoline', 'fuel.diesel', 'fuel.hybrid', 'fuel.electric', 'fuel.lpg'] as const;
const FUEL_VALUES = ['Gasolina', 'Gasóleo', 'Híbrido', 'Elétrico', 'GPL'];

export default function Vehicles() {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    client_id: "", make: "", model: "", year: new Date().getFullYear().toString(),
    plate: "", vin: "", mileage: "0", fuel: "Gasolina", notes: ""
  });

  const fetchData = async () => {
    const { data: v } = await supabase.from("vehicles").select("*, clients(name)").order("created_at", { ascending: false });
    if (v) setVehicles(v);
    const { data: c } = await supabase.from("clients").select("id, name").order("name");
    if (c) setClients(c);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error(t('common.sessionExpired')); setLoading(false); return; }
    const { data: shop } = await supabase.from("shops").select("id").eq("user_id", user.id).maybeSingle();
    if (!shop) { toast.error(t('common.configureShop')); setLoading(false); return; }

    const { error } = await supabase.from("vehicles").insert({
      shop_id: shop.id, client_id: form.client_id, make: form.make, model: form.model,
      year: parseInt(form.year), plate: form.plate.toUpperCase(), vin: form.vin || null,
      mileage: parseInt(form.mileage), fuel: form.fuel, notes: form.notes || null,
    });

    if (error) toast.error(error.message);
    else {
      toast.success(t('vehicles.created'));
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
          <h1 className="page-title">{t('vehicles.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{vehicles.length} {t('vehicles.title').toLowerCase()}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t('vehicles.new')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t('vehicles.new')}</DialogTitle></DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-1.5">
                <Label>{t('vehicles.client')} *</Label>
                <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                  <SelectTrigger><SelectValue placeholder={t('vehicles.selectClient')} /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label>{t('vehicles.make')} *</Label><Input value={form.make} onChange={e => setForm({...form, make: e.target.value})} required /></div>
                <div className="space-y-1.5"><Label>{t('vehicles.model')} *</Label><Input value={form.model} onChange={e => setForm({...form, model: e.target.value})} required /></div>
                <div className="space-y-1.5"><Label>{t('vehicles.year')}</Label><Input type="number" value={form.year} onChange={e => setForm({...form, year: e.target.value})} /></div>
                <div className="space-y-1.5"><Label>{t('vehicles.plate')} *</Label><Input value={form.plate} onChange={e => setForm({...form, plate: e.target.value})} required placeholder="AA-00-BB" /></div>
                <div className="space-y-1.5"><Label>{t('vehicles.vin')}</Label><Input value={form.vin} onChange={e => setForm({...form, vin: e.target.value})} /></div>
                <div className="space-y-1.5"><Label>{t('vehicles.mileage')}</Label><Input type="number" value={form.mileage} onChange={e => setForm({...form, mileage: e.target.value})} /></div>
                <div className="space-y-1.5">
                  <Label>{t('vehicles.fuel')}</Label>
                  <Select value={form.fuel} onValueChange={v => setForm({...form, fuel: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FUEL_VALUES.map((f, i) => <SelectItem key={f} value={f}>{t(FUEL_KEYS[i])}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('vehicles.creating') : t('vehicles.create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder={t('vehicles.search')} value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('vehicles.vehicle')}</TableHead>
              <TableHead>{t('vehicles.plate')}</TableHead>
              <TableHead>{t('vehicles.client')}</TableHead>
              <TableHead>{t('vehicles.mileage')}</TableHead>
              <TableHead>{t('vehicles.fuel')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {vehicles.length === 0 ? t('vehicles.empty') : t('vehicles.noResults')}
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
