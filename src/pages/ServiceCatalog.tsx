import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Pencil, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface CatalogService {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  default_time: number;
  default_price: number;
  internal_cost: number;
  vat_rate: number;
  recurrence_km: number | null;
  recurrence_months: number | null;
  active: boolean;
  created_at: string;
}

const emptyForm = {
  name: "", description: "", default_time: 60, default_price: 0,
  internal_cost: 0, vat_rate: 23, recurrence_km: "", recurrence_months: "", active: true,
};

export default function ServiceCatalog() {
  const { t } = useLanguage();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);

  const shopId = localStorage.getItem("garageflow_active_shop");

  const load = async () => {
    if (!shopId) return;
    const { data } = await supabase
      .from("service_catalog")
      .select("*")
      .eq("shop_id", shopId)
      .order("name");
    if (data) setServices(data as CatalogService[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [shopId]);

  const filtered = services.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = async () => {
    if (!shopId || !form.name.trim()) {
      toast.error(t('catalog.fillName'));
      return;
    }

    const payload = {
      shop_id: shopId,
      name: form.name.trim(),
      description: form.description || null,
      default_time: form.default_time,
      default_price: form.default_price,
      internal_cost: form.internal_cost,
      vat_rate: form.vat_rate,
      recurrence_km: form.recurrence_km ? Number(form.recurrence_km) : null,
      recurrence_months: form.recurrence_months ? Number(form.recurrence_months) : null,
      active: form.active,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("service_catalog").update(payload as any).eq("id", editId));
    } else {
      ({ error } = await supabase.from("service_catalog").insert(payload as any));
    }

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editId ? t('catalog.updated') : t('catalog.created'));
    setDialogOpen(false);
    setEditId(null);
    setForm(emptyForm);
    load();
  };

  const handleEdit = (s: CatalogService) => {
    setEditId(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      default_time: s.default_time,
      default_price: s.default_price,
      internal_cost: s.internal_cost,
      vat_rate: s.vat_rate,
      recurrence_km: s.recurrence_km?.toString() || "",
      recurrence_months: s.recurrence_months?.toString() || "",
      active: s.active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("service_catalog").delete().eq("id", id);
    toast.success(t('common.deleted'));
    load();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("service_catalog").update({ active } as any).eq("id", id);
    load();
  };

  const formatCurrency = (val: number) => `€${val.toFixed(2)}`;

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {t('catalog.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('catalog.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{t('catalog.new')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editId ? t('catalog.edit') : t('catalog.new')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t('catalog.name')} *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t('catalog.namePlaceholder')} />
              </div>
              <div>
                <Label>{t('catalog.description')}</Label>
                <Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>{t('catalog.price')} (€)</Label>
                  <Input type="number" value={form.default_price} onChange={e => setForm({ ...form, default_price: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>{t('catalog.cost')} (€)</Label>
                  <Input type="number" value={form.internal_cost} onChange={e => setForm({ ...form, internal_cost: Number(e.target.value) })} />
                </div>
                <div>
                  <Label>{t('catalog.time')} (min)</Label>
                  <Input type="number" value={form.default_time} onChange={e => setForm({ ...form, default_time: Number(e.target.value) })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('catalog.vatRate')} (%)</Label>
                  <Input type="number" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: Number(e.target.value) })} />
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
                  <Label>{t('catalog.active')}</Label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t('catalog.recurrenceKm')}</Label>
                  <Input type="number" value={form.recurrence_km} onChange={e => setForm({ ...form, recurrence_km: e.target.value })} placeholder="Ex: 15000" />
                </div>
                <div>
                  <Label>{t('catalog.recurrenceMonths')}</Label>
                  <Input type="number" value={form.recurrence_months} onChange={e => setForm({ ...form, recurrence_months: e.target.value })} placeholder="Ex: 12" />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">{editId ? t('common.save') : t('catalog.create')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('catalog.search')} className="pl-9" />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('catalog.name')}</TableHead>
                <TableHead className="hidden sm:table-cell">{t('catalog.time')}</TableHead>
                <TableHead>{t('catalog.price')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('catalog.cost')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('catalog.margin')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('catalog.empty')}</TableCell></TableRow>
              ) : filtered.map(s => {
                const margin = s.default_price > 0 ? ((s.default_price - s.internal_cost) / s.default_price * 100).toFixed(0) : "0";
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.description && <div className="text-xs text-muted-foreground truncate max-w-[200px]">{s.description}</div>}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{s.default_time} min</TableCell>
                    <TableCell className="font-medium">{formatCurrency(s.default_price)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{formatCurrency(s.internal_cost)}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant={Number(margin) > 30 ? "default" : "secondary"}>{margin}%</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={v => toggleActive(s.id, v)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
