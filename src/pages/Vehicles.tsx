import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Car, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

const FUEL_KEYS = ['fuel.gasoline', 'fuel.diesel', 'fuel.hybrid', 'fuel.electric', 'fuel.lpg'] as const;
const FUEL_VALUES = ['Gasolina', 'Gasóleo', 'Híbrido', 'Elétrico', 'GPL'];
const PAGE_SIZE = 25;

export default function Vehicles() {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "", make: "", model: "", year: new Date().getFullYear().toString(),
    plate: "", vin: "", mileage: "0", fuel: "Gasolina", notes: ""
  });

  const resetForm = () => setForm({
    client_id: "", make: "", model: "", year: new Date().getFullYear().toString(),
    plate: "", vin: "", mileage: "0", fuel: "Gasolina", notes: ""
  });

  const fetchData = async () => {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data: v, count } = await supabase.from("vehicles").select("*, clients(name)", { count: "exact" }).order("created_at", { ascending: false }).range(from, to);
    if (v) setVehicles(v);
    if (count !== null) setTotalCount(count);
    const { data: c } = await supabase.from("clients").select("id, name").order("name");
    if (c) setClients(c);
  };

  useEffect(() => { fetchData(); }, [page]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const shopId = localStorage.getItem("garageflow_active_shop");
    if (!shopId) { toast.error(t('common.configureShop')); setLoading(false); return; }

    const payload = {
      shop_id: shopId, client_id: form.client_id, make: form.make, model: form.model,
      year: parseInt(form.year), plate: form.plate.toUpperCase(), vin: form.vin || null,
      mileage: parseInt(form.mileage), fuel: form.fuel, notes: form.notes || null,
    };

    const { error } = editingId
      ? await supabase.from("vehicles").update(payload).eq("id", editingId)
      : await supabase.from("vehicles").insert(payload);

    if (error) toast.error(error.message);
    else {
      toast.success(editingId ? t('vehicles.updated') : t('vehicles.created'));
      setOpen(false);
      setEditingId(null);
      resetForm();
      fetchData();
    }
    setLoading(false);
  };

  const openEdit = (v: any) => {
    setEditingId(v.id);
    setForm({
      client_id: v.client_id, make: v.make, model: v.model, year: String(v.year),
      plate: v.plate, vin: v.vin || "", mileage: String(v.mileage), fuel: v.fuel, notes: v.notes || ""
    });
    setOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("vehicles").delete().eq("id", deleteId);
    if (error) toast.error(error.message);
    else { toast.success(t('vehicles.deleted')); fetchData(); }
    setDeleteId(null);
  };

  const filtered = vehicles.filter(v =>
    v.plate.toLowerCase().includes(search.toLowerCase()) ||
    v.make.toLowerCase().includes(search.toLowerCase()) ||
    v.model.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('vehicles.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{totalCount} {t('vehicles.title').toLowerCase()}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); resetForm(); } }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />{t('vehicles.new')}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingId ? t('common.edit') : t('vehicles.new')}</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
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
                {loading ? t('vehicles.creating') : (editingId ? t('common.save') : t('vehicles.create'))}
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
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  {totalCount === 0 ? t('vehicles.empty') : t('vehicles.noResults')}
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
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(v)} className="text-xs">
                      <Pencil className="w-3.5 h-3.5 mr-1" />{t('common.edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(v.id)} className="text-xs text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-muted-foreground">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} de {totalCount}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.confirmDelete')}</AlertDialogTitle>
            <AlertDialogDescription>{t('vehicles.deleteWarning')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
