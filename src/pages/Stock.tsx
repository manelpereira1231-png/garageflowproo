import { useState, useEffect } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Pencil, Package, Trash2, ArrowUpDown, AlertTriangle, TrendingDown, Filter, Truck, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Part {
  id: string; shop_id: string; name: string; reference: string | null; supplier: string | null;
  internal_cost: number; sale_price: number; vat_rate: number; stock_quantity: number;
  min_stock: number; active: boolean; created_at: string;
}

interface PartsOrder {
  id: string; shop_id: string; supplier_id: string | null; work_order_id: string | null;
  part_name: string; part_reference: string | null; quantity: number; unit_price: number;
  total: number; status: string; notes: string | null; created_at: string; delivered_at: string | null;
  suppliers?: { name: string } | null;
}

interface StockMovement {
  id: string; part_id: string; type: string; quantity: number; reason: string | null; created_at: string;
  work_order_id: string | null;
}

const emptyForm = {
  name: "", reference: "", supplier: "", internal_cost: 0, sale_price: 0,
  vat_rate: 23, stock_quantity: 0, min_stock: 0, active: true,
};

export default function Stock() {
  const { t, language } = useLanguage();
  const [parts, setParts] = useState<Part[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<PartsOrder[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementDialog, setMovementDialog] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [movForm, setMovForm] = useState({ type: "in", quantity: 1, reason: "" });
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");

  const activeShopId = useActiveShopId();

  const load = async () => {
    if (!activeShopId) return;
    const [partsRes, movRes, ordersRes] = await Promise.all([
      supabase.from("parts").select("*").eq("shop_id", activeShopId).order("name"),
      supabase.from("stock_movements").select("*").eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(200),
      supabase.from("parts_orders").select("*, suppliers(name)").eq("shop_id", activeShopId).order("created_at", { ascending: false }).limit(200),
    ]);
    if (partsRes.data) setParts(partsRes.data as Part[]);
    if (movRes.data) setMovements(movRes.data as StockMovement[]);
    if (ordersRes.data) setOrders(ordersRes.data as PartsOrder[]);
  };

  useEffect(() => { load(); }, [activeShopId]);

  const suppliers = [...new Set(parts.map(p => p.supplier).filter(Boolean))] as string[];

  const filtered = parts.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || (p.reference || "").toLowerCase().includes(search.toLowerCase());
    const matchSupplier = supplierFilter === "all" || p.supplier === supplierFilter;
    const matchStock = stockFilter === "all" || 
      (stockFilter === "low" && p.active && p.stock_quantity <= p.min_stock) ||
      (stockFilter === "ok" && p.stock_quantity > p.min_stock);
    return matchSearch && matchSupplier && matchStock;
  });

  const lowStock = parts.filter(p => p.active && p.stock_quantity <= p.min_stock);
  const totalStockValue = parts.reduce((s, p) => s + (p.stock_quantity * p.sale_price), 0);
  const totalStockCost = parts.reduce((s, p) => s + (p.stock_quantity * p.internal_cost), 0);
  const totalMargin = totalStockValue - totalStockCost;

  const handleSave = async () => {
    if (!activeShopId || !form.name.trim()) { toast.error(t('stock.fillName')); return; }
    const payload = { shop_id: activeShopId, ...form, reference: form.reference || null, supplier: form.supplier || null };
    let error;
    if (editId) {
      ({ error } = await supabase.from("parts").update(payload as any).eq("id", editId));
    } else {
      ({ error } = await supabase.from("parts").insert(payload as any));
    }
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? t('stock.updated') : t('stock.created'));
    setDialogOpen(false); setEditId(null); setForm(emptyForm); load();
  };

  const handleEdit = (p: Part) => {
    setEditId(p.id);
    setForm({ name: p.name, reference: p.reference || "", supplier: p.supplier || "", internal_cost: p.internal_cost, sale_price: p.sale_price, vat_rate: p.vat_rate, stock_quantity: p.stock_quantity, min_stock: p.min_stock, active: p.active });
    setDialogOpen(true);
  };

  const handleMovement = async () => {
    if (!activeShopId || !movementDialog) return;
    const qty = movForm.type === "out" ? -Math.abs(movForm.quantity) : Math.abs(movForm.quantity);
    
    const { error } = await supabase.from("stock_movements").insert({
      shop_id: activeShopId, part_id: movementDialog, type: movForm.type,
      quantity: Math.abs(movForm.quantity), reason: movForm.reason || null,
    } as any);

    if (!error) {
      const part = parts.find(p => p.id === movementDialog);
      if (part) {
        await supabase.from("parts").update({ stock_quantity: part.stock_quantity + qty } as any).eq("id", movementDialog);
      }
      toast.success(t('stock.movementRegistered'));
    }
    setMovementDialog(null); setMovForm({ type: "in", quantity: 1, reason: "" }); load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("stock_movements").delete().eq("part_id", id);
    await supabase.from("parts").delete().eq("id", id);
    toast.success(t('common.deleted'));
    load();
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            {t('stock.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('stock.subtitle')}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) { setEditId(null); setForm(emptyForm); } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />{t('stock.newPart')}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editId ? t('stock.editPart') : t('stock.newPart')}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t('stock.partName')} *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('stock.reference')}</Label><Input value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></div>
                <div><Label>{t('stock.supplier')}</Label><Input value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>{t('stock.costPrice')} (€)</Label><Input type="number" value={form.internal_cost} onChange={e => setForm({ ...form, internal_cost: Number(e.target.value) })} /></div>
                <div><Label>{t('stock.salePrice')} (€)</Label><Input type="number" value={form.sale_price} onChange={e => setForm({ ...form, sale_price: Number(e.target.value) })} /></div>
                <div><Label>{t('catalog.vatRate')} (%)</Label><Input type="number" value={form.vat_rate} onChange={e => setForm({ ...form, vat_rate: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{t('stock.currentStock')}</Label><Input type="number" value={form.stock_quantity} onChange={e => setForm({ ...form, stock_quantity: Number(e.target.value) })} /></div>
                <div><Label>{t('stock.minStock')}</Label><Input type="number" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={v => setForm({ ...form, active: v })} />
                <Label>{t('catalog.active')}</Label>
              </div>
              <Button onClick={handleSave} className="w-full">{editId ? t('common.save') : t('stock.create')}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">{t('stock.totalParts')}</p>
          <p className="text-xl font-bold">{parts.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{parts.filter(p => p.active).length} {t('catalog.active').toLowerCase()}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">{t('stock.stockValue')}</p>
          <p className="text-xl font-bold text-primary">€{totalStockValue.toFixed(2)}</p>
        </CardContent></Card>
        <Card><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">{t('stock.stockCost')}</p>
          <p className="text-xl font-bold">€{totalStockCost.toFixed(2)}</p>
        </CardContent></Card>
        <Card className={lowStock.length > 0 ? "border-warning/40" : ""}><CardContent className="py-3 px-4">
          <p className="text-xs text-muted-foreground">{t('stock.lowStockAlert')}</p>
          <p className={`text-xl font-bold ${lowStock.length > 0 ? 'text-warning' : 'text-success'}`}>{lowStock.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('stock.stockMargin')}: €{totalMargin.toFixed(0)}</p>
        </CardContent></Card>
      </div>

      {/* Low Stock Warning with details */}
      {lowStock.length > 0 && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="py-4 px-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-warning">
              <AlertTriangle className="w-4 h-4" />
              {t('stock.lowStockAlert')} ({lowStock.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {lowStock.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-background rounded-lg px-3 py-2 border border-warning/20">
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    {p.supplier && <p className="text-xs text-muted-foreground">{p.supplier}</p>}
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive" className="text-xs">{p.stock_quantity}/{p.min_stock}</Badge>
                    <Progress value={p.min_stock > 0 ? Math.min((p.stock_quantity / p.min_stock) * 100, 100) : 0} className="w-16 h-1.5 mt-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="parts">
        <TabsList>
          <TabsTrigger value="parts">{t('stock.parts')} ({parts.length})</TabsTrigger>
          <TabsTrigger value="orders" className="gap-1">
            <ShoppingCart className="w-3 h-3" />
            {t('stock.orders')} ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="movements">{t('stock.movements')} ({movements.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="parts" className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('stock.search')} className="pl-9" />
            </div>
            {suppliers.length > 0 && (
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger className="w-[180px]"><Filter className="w-3 h-3 mr-1" /><SelectValue placeholder={t('stock.supplier')} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('stock.allSuppliers')}</SelectItem>
                  {suppliers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={stockFilter} onValueChange={setStockFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('stock.allStock')}</SelectItem>
                <SelectItem value="low">{t('stock.lowOnly')}</SelectItem>
                <SelectItem value="ok">{t('stock.okOnly')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stock.partName')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('stock.reference')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('stock.supplier')}</TableHead>
                    <TableHead>{t('stock.currentStock')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('stock.costPrice')}</TableHead>
                    <TableHead>{t('stock.salePrice')}</TableHead>
                    <TableHead className="w-28"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t('stock.empty')}</TableCell></TableRow>
                  ) : filtered.map(p => (
                    <TableRow key={p.id} className={!p.active ? "opacity-50" : ""}>
                      <TableCell>
                        <div className="font-medium">{p.name}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground">{p.reference || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{p.supplier || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={p.stock_quantity <= p.min_stock ? "destructive" : "secondary"}>
                            {p.stock_quantity}
                          </Badge>
                          {p.min_stock > 0 && (
                            <span className="text-xs text-muted-foreground">/ min {p.min_stock}</span>
                          )}
                          {p.stock_quantity <= p.min_stock && p.active && (
                            <TrendingDown className="w-3 h-3 text-destructive" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">€{p.internal_cost.toFixed(2)}</TableCell>
                      <TableCell className="font-medium">€{p.sale_price.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setMovementDialog(p.id)} title={t('stock.addMovement')}>
                            <ArrowUpDown className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stock.orders.part')}</TableHead>
                    <TableHead>{t('stock.orders.supplier')}</TableHead>
                    <TableHead>{t('stock.orders.qty')}</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>{t('stock.orders.status')}</TableHead>
                    <TableHead>{t('stock.orders.date')}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        {t('stock.orders.empty')}
                      </TableCell>
                    </TableRow>
                  ) : orders.map(o => (
                    <TableRow key={o.id}>
                      <TableCell className="font-medium">{o.part_name}</TableCell>
                      <TableCell className="text-muted-foreground">{(o.suppliers as any)?.name || '—'}</TableCell>
                      <TableCell>{o.quantity}</TableCell>
                      <TableCell className="font-semibold">€{(o.total || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant={o.status === 'delivered' ? 'default' : o.status === 'sent' ? 'secondary' : o.status === 'cancelled' ? 'destructive' : 'outline'}>
                          {t(`stock.orders.${o.status}`) || o.status}
                        </Badge>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(o.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        {o.status !== 'delivered' && o.status !== 'cancelled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1"
                            onClick={async () => {
                              const { error } = await supabase.from('parts_orders').update({ status: 'delivered' } as any).eq('id', o.id);
                              if (error) { toast.error(error.message); return; }
                              toast.success(t('stock.orders.deliveryConfirmed'));
                              load();
                            }}
                          >
                            <Truck className="w-3.5 h-3.5" />
                            {t('stock.orders.confirmDelivery')}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="movements">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('stock.partName')}</TableHead>
                    <TableHead>{t('stock.movementType')}</TableHead>
                    <TableHead>{t('stock.quantity')}</TableHead>
                    <TableHead className="hidden sm:table-cell">{t('stock.reason')}</TableHead>
                    <TableHead>{t('common.date')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {movements.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">{t('stock.noMovements')}</TableCell></TableRow>
                  ) : movements.map(m => {
                    const part = parts.find(p => p.id === m.part_id);
                    return (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{part?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant={m.type === "in" ? "default" : m.type === "out" ? "destructive" : "secondary"}>
                            {m.type === "in" ? t('stock.typeIn') : m.type === "out" ? t('stock.typeOut') : t('stock.typeAdjustment')}
                          </Badge>
                        </TableCell>
                        <TableCell className={m.type === "out" ? "text-destructive font-medium" : "text-success font-medium"}>
                          {m.type === "out" ? `-${m.quantity}` : `+${m.quantity}`}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-muted-foreground">{m.reason || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{format(new Date(m.created_at), "dd/MM HH:mm")}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Stock Movement Dialog */}
      <Dialog open={!!movementDialog} onOpenChange={(o) => { if (!o) setMovementDialog(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t('stock.addMovement')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {movementDialog && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <span className="font-medium">{parts.find(p => p.id === movementDialog)?.name}</span>
                <span className="text-muted-foreground ml-2">
                  ({t('stock.currentStock')}: {parts.find(p => p.id === movementDialog)?.stock_quantity})
                </span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('stock.movementType')}</Label>
                <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={movForm.type} onChange={e => setMovForm({ ...movForm, type: e.target.value })}>
                  <option value="in">{t('stock.typeIn')}</option>
                  <option value="out">{t('stock.typeOut')}</option>
                  <option value="adjustment">{t('stock.typeAdjustment')}</option>
                </select>
              </div>
              <div>
                <Label>{t('stock.quantity')}</Label>
                <Input type="number" min={1} value={movForm.quantity} onChange={e => setMovForm({ ...movForm, quantity: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>{t('stock.reason')}</Label>
              <Input value={movForm.reason} onChange={e => setMovForm({ ...movForm, reason: e.target.value })} placeholder={t('stock.reasonPlaceholder')} />
            </div>
            <Button onClick={handleMovement} className="w-full">{t('stock.registerMovement')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
