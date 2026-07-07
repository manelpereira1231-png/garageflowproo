import { useState, useEffect, useMemo } from "react";
import { useActiveShopId } from "@/hooks/useActiveShopId";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Pencil, BookOpen, Trash2, Copy, Sparkles,
  TrendingUp, Clock, Percent, Package2,
} from "lucide-react";
import { toast } from "sonner";
import ListSkeleton from "@/components/ListSkeleton";
import { formatMoney } from "@/lib/money";

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

// Pack de serviços comuns de oficina automóvel (PT).
// Preços de referência — a oficina ajusta depois.
const TEMPLATE_PACK: Array<Omit<CatalogService, "id" | "shop_id" | "created_at" | "active"> & { active?: boolean }> = [
  { name: "Mudança de óleo + filtro",           description: "Óleo motor 5L + filtro óleo",             default_time: 30, default_price: 65,  internal_cost: 32, vat_rate: 23, recurrence_km: 15000, recurrence_months: 12 },
  { name: "Revisão completa",                    description: "Óleo, filtros (óleo/ar/habitáculo), verificações",   default_time: 90, default_price: 150, internal_cost: 75, vat_rate: 23, recurrence_km: 15000, recurrence_months: 12 },
  { name: "Substituição de pastilhas travão",    description: "Frente ou trás — inclui MO",              default_time: 60, default_price: 90,  internal_cost: 45, vat_rate: 23, recurrence_km: 40000, recurrence_months: null },
  { name: "Substituição de discos + pastilhas",  description: "Frente ou trás — inclui MO",              default_time: 90, default_price: 180, internal_cost: 95, vat_rate: 23, recurrence_km: 60000, recurrence_months: null },
  { name: "Alinhamento de direção",              description: "Alinhamento 4 rodas",                     default_time: 45, default_price: 45,  internal_cost: 12, vat_rate: 23, recurrence_km: 20000, recurrence_months: null },
  { name: "Equilibragem de rodas",               description: "4 rodas",                                 default_time: 30, default_price: 25,  internal_cost: 6,  vat_rate: 23, recurrence_km: null,  recurrence_months: null },
  { name: "Diagnóstico eletrónico OBD",          description: "Leitura + análise de códigos de erro",    default_time: 30, default_price: 40,  internal_cost: 5,  vat_rate: 23, recurrence_km: null,  recurrence_months: null },
  { name: "Substituição correia distribuição",   description: "Correia + tensor + bomba de água",        default_time: 240,default_price: 550, internal_cost: 280,vat_rate: 23, recurrence_km: 120000,recurrence_months: 72 },
  { name: "Substituição bateria",                 description: "12V — inclui codificação se necessária",  default_time: 20, default_price: 30,  internal_cost: 5,  vat_rate: 23, recurrence_km: null,  recurrence_months: 48 },
  { name: "Filtro ar habitáculo",                description: "Substituição filtro pólen",               default_time: 15, default_price: 25,  internal_cost: 8,  vat_rate: 23, recurrence_km: 20000, recurrence_months: 12 },
  { name: "Enchimento AC + verificação",         description: "Recarga R134a ou R1234yf",                default_time: 45, default_price: 70,  internal_cost: 25, vat_rate: 23, recurrence_km: null,  recurrence_months: 24 },
  { name: "Pré-inspeção IPO",                    description: "Verificação pré-centro inspeção",         default_time: 30, default_price: 25,  internal_cost: 3,  vat_rate: 23, recurrence_km: null,  recurrence_months: null },
];

export default function ServiceCatalog() {
  const { t } = useLanguage();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [laborRate, setLaborRate] = useState<number>(35);

  const activeShopId = useActiveShopId();

  const load = async () => {
    if (!activeShopId) return;
    const [{ data }, { data: shop }] = await Promise.all([
      supabase.from("service_catalog").select("*").eq("shop_id", activeShopId).order("name"),
      supabase.from("shops").select("labor_rate").eq("id", activeShopId).maybeSingle(),
    ]);
    if (data) setServices(data as CatalogService[]);
    if (shop) setLaborRate(Number((shop as any).labor_rate) || 35);
    setLoading(false);
  };

  useEffect(() => { load(); }, [activeShopId]);

  // Labor cost derived from time × hourly rate (Settings). Shown separately so
  // "Custo peças" stays clean and the user sees where the labor comes from.
  const laborCost = useMemo(
    () => Math.round(((Number(form.default_time) || 0) / 60) * laborRate * 100) / 100,
    [form.default_time, laborRate]
  );
  const totalCost = useMemo(
    () => Math.round((Number(form.internal_cost || 0) + laborCost) * 100) / 100,
    [form.internal_cost, laborCost]
  );

  const filtered = useMemo(() => services.filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" ? true : statusFilter === "active" ? s.active : !s.active;
    return matchSearch && matchStatus;
  }), [services, search, statusFilter]);

  const kpis = useMemo(() => {
    const active = services.filter(s => s.active);
    const avgPrice = active.length ? active.reduce((a, s) => a + Number(s.default_price || 0), 0) / active.length : 0;
    const avgTime = active.length ? active.reduce((a, s) => a + Number(s.default_time || 0), 0) / active.length : 0;
    const marginPts = active
      .filter(s => Number(s.default_price) > 0)
      .map(s => (Number(s.default_price) - Number(s.internal_cost)) / Number(s.default_price) * 100);
    const avgMargin = marginPts.length ? marginPts.reduce((a, b) => a + b, 0) / marginPts.length : 0;
    return {
      total: services.length,
      active: active.length,
      avgPrice, avgTime, avgMargin,
    };
  }, [services]);

  const handleSave = async () => {
    if (!activeShopId || !form.name.trim()) {
      toast.error(t('catalog.fillName'));
      return;
    }

    const payload = {
      shop_id: activeShopId,
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

  const handleDuplicate = async (s: CatalogService) => {
    if (!activeShopId) return;
    const { error } = await supabase.from("service_catalog").insert({
      shop_id: activeShopId,
      name: `${s.name} (cópia)`,
      description: s.description,
      default_time: s.default_time,
      default_price: s.default_price,
      internal_cost: s.internal_cost,
      vat_rate: s.vat_rate,
      recurrence_km: s.recurrence_km,
      recurrence_months: s.recurrence_months,
      active: s.active,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success("Serviço duplicado");
    load();
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

  const importTemplatePack = async () => {
    if (!activeShopId) return;
    setImporting(true);
    const existingNames = new Set(services.map(s => s.name.toLowerCase().trim()));
    const toInsert = TEMPLATE_PACK
      .filter(tpl => !existingNames.has(tpl.name.toLowerCase().trim()))
      .map(tpl => ({ ...tpl, shop_id: activeShopId, active: true }));
    if (toInsert.length === 0) {
      toast.info("Todos os serviços do pack já existem");
      setImporting(false);
      return;
    }
    const { error } = await supabase.from("service_catalog").insert(toInsert as any);
    setImporting(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${toInsert.length} serviços adicionados ao catálogo`);
    load();
  };

  const formatDuration = (mins: number) => {
    if (mins < 60) return `${mins}min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
  };

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
        <div className="flex gap-2 w-full sm:w-auto">
          {services.length < 5 && (
            <Button size="sm" variant="outline" onClick={importTemplatePack} disabled={importing} className="gap-1 flex-1 sm:flex-none">
              <Sparkles className="w-4 h-4" />
              {importing ? "A importar..." : "Pack inicial"}
            </Button>
          )}
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex-1 sm:flex-none"><Plus className="w-4 h-4 mr-1" />{t('catalog.new')}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
                    <Input type="number" step="0.01" value={form.default_price || ""} placeholder="0,00" onChange={e => setForm({ ...form, default_price: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>Custo peças (€)</Label>
                    <Input type="number" step="0.01" value={form.internal_cost || ""} placeholder="0,00" onChange={e => setForm({ ...form, internal_cost: Number(e.target.value) })} />
                  </div>
                  <div>
                    <Label>{t('catalog.time')} (min)</Label>
                    <Input type="number" value={form.default_time || ""} placeholder="60" onChange={e => setForm({ ...form, default_time: Number(e.target.value) })} />
                  </div>
                </div>

                {/* Breakdown do custo — deixa claro o que é peças vs mão-de-obra */}
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-xs space-y-1.5">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custo peças</span>
                    <span>{formatMoney(Number(form.internal_cost) || 0)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Mão-de-obra ({form.default_time || 0}min × {laborRate.toFixed(2)}€/h)</span>
                    <span>{formatMoney(laborCost)}</span>
                  </div>
                  <div className="flex justify-between font-semibold border-t border-border pt-1.5">
                    <span>Custo total</span>
                    <span>{formatMoney(totalCost)}</span>
                  </div>
                  {form.default_price > 0 && (
                    <div className="flex justify-between pt-1.5 border-t border-border">
                      <span className="text-muted-foreground">Margem</span>
                      <span className={`font-semibold ${form.default_price - totalCost >= 0 ? 'text-success' : 'text-destructive'}`}>
                        {formatMoney(form.default_price - totalCost)}
                        {form.default_price > 0 && ` · ${(((form.default_price - totalCost) / form.default_price) * 100).toFixed(0)}%`}
                      </span>
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground pt-1 leading-relaxed">
                    A mão-de-obra é calculada automaticamente a partir do tempo × tarifa/hora (Definições). Em "Custo peças" coloca só o valor dos materiais.
                  </p>
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
                <p className="text-xs text-muted-foreground">
                  A recorrência aciona lembretes automáticos ao cliente (km ou meses, o que ocorrer primeiro).
                </p>
                <Button onClick={handleSave} className="w-full">{editId ? t('common.save') : t('catalog.create')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Total serviços</p>
            <Package2 className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold">{kpis.total}</p>
          <p className="text-xs text-muted-foreground mt-1">{kpis.active} ativos</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Preço médio</p>
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold text-primary">{formatMoney(kpis.avgPrice)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Margem média</p>
            <Percent className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className={`text-xl font-bold ${kpis.avgMargin >= 40 ? "text-success" : kpis.avgMargin >= 25 ? "text-primary" : "text-warning"}`}>
            {kpis.avgMargin.toFixed(0)}%
          </p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Tempo médio</p>
            <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <p className="text-xl font-bold">{formatDuration(Math.round(kpis.avgTime))}</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('catalog.search')} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Só ativos</SelectItem>
            <SelectItem value="inactive">Só inativos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mobile card view */}
      <div className="sm:hidden space-y-2">
        {loading && services.length === 0 ? (
          <ListSkeleton rows={5} />
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm bg-card border border-border rounded-xl p-5">
            {t('catalog.empty')}
          </div>
        ) : filtered.map(s => {
          const margin = s.default_price > 0 ? ((s.default_price - s.internal_cost) / s.default_price * 100) : 0;
          return (
            <div key={s.id} className={`bg-card border border-border rounded-xl p-4 space-y-2 ${!s.active ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{s.name}</p>
                  {s.description && <p className="text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
                </div>
                <Switch checked={s.active} onCheckedChange={v => toggleActive(s.id, v)} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <div className="flex gap-3 text-muted-foreground">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(s.default_time)}</span>
                  <Badge variant={margin >= 40 ? "default" : margin >= 25 ? "secondary" : "outline"} className="text-[10px]">
                    {margin.toFixed(0)}% margem
                  </Badge>
                </div>
                <span className="font-bold text-sm text-primary">{formatMoney(s.default_price)}</span>
              </div>
              <div className="flex gap-1 pt-1 border-t border-border">
                <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs" onClick={() => handleEdit(s)}>
                  <Pencil className="w-3 h-3 mr-1" />Editar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 flex-1 text-xs" onClick={() => handleDuplicate(s)}>
                  <Copy className="w-3 h-3 mr-1" />Duplicar
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden sm:block">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('catalog.name')}</TableHead>
                <TableHead>{t('catalog.time')}</TableHead>
                <TableHead>{t('catalog.price')}</TableHead>
                <TableHead className="hidden md:table-cell">{t('catalog.cost')}</TableHead>
                <TableHead>{t('catalog.margin')}</TableHead>
                <TableHead className="hidden lg:table-cell">Recorrência</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead className="w-32"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && services.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-6"><ListSkeleton rows={4} variant="row" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t('catalog.empty')}</TableCell></TableRow>
              ) : filtered.map(s => {
                const margin = s.default_price > 0 ? ((s.default_price - s.internal_cost) / s.default_price * 100) : 0;
                const marginColor = margin >= 40 ? "default" : margin >= 25 ? "secondary" : "outline";
                return (
                  <TableRow key={s.id} className={!s.active ? "opacity-60" : ""}>
                    <TableCell>
                      <div className="font-medium">{s.name}</div>
                      {s.description && <div className="text-xs text-muted-foreground truncate max-w-[280px]">{s.description}</div>}
                    </TableCell>
                    <TableCell>{formatDuration(s.default_time)}</TableCell>
                    <TableCell className="font-medium">{formatMoney(s.default_price)}</TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">{formatMoney(s.internal_cost)}</TableCell>
                    <TableCell>
                      <Badge variant={marginColor as any}>{margin.toFixed(0)}%</Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {s.recurrence_km ? `${s.recurrence_km.toLocaleString("pt-PT")}km` : ""}
                      {s.recurrence_km && s.recurrence_months ? " · " : ""}
                      {s.recurrence_months ? `${s.recurrence_months}m` : ""}
                      {!s.recurrence_km && !s.recurrence_months && "—"}
                    </TableCell>
                    <TableCell>
                      <Switch checked={s.active} onCheckedChange={v => toggleActive(s.id, v)} />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)} title="Editar">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicate(s)} title="Duplicar">
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(s.id)} title="Apagar">
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
