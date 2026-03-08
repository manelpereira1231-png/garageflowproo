import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardCheck, Plus, Eye, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ChecklistItem {
  name: string;
  status: "ok" | "attention" | "repair" | "na";
  notes: string;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  { name: "Travões dianteiros", status: "na", notes: "" },
  { name: "Travões traseiros", status: "na", notes: "" },
  { name: "Discos de travão", status: "na", notes: "" },
  { name: "Pneu dianteiro esquerdo", status: "na", notes: "" },
  { name: "Pneu dianteiro direito", status: "na", notes: "" },
  { name: "Pneu traseiro esquerdo", status: "na", notes: "" },
  { name: "Pneu traseiro direito", status: "na", notes: "" },
  { name: "Óleo motor", status: "na", notes: "" },
  { name: "Filtro de ar", status: "na", notes: "" },
  { name: "Filtro de óleo", status: "na", notes: "" },
  { name: "Filtro de habitáculo", status: "na", notes: "" },
  { name: "Suspensão dianteira", status: "na", notes: "" },
  { name: "Suspensão traseira", status: "na", notes: "" },
  { name: "Bateria", status: "na", notes: "" },
  { name: "Correias", status: "na", notes: "" },
  { name: "Líquido refrigerante", status: "na", notes: "" },
  { name: "Escape", status: "na", notes: "" },
  { name: "Luzes", status: "na", notes: "" },
  { name: "Limpa-brisas", status: "na", notes: "" },
  { name: "Nível líquido travões", status: "na", notes: "" },
];

interface Checklist {
  id: string; shop_id: string; work_order_id: string; items: ChecklistItem[];
  technician: string | null; completed_at: string | null; created_at: string;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  ok: <CheckCircle className="w-4 h-4 text-green-500" />,
  attention: <AlertTriangle className="w-4 h-4 text-amber-500" />,
  repair: <XCircle className="w-4 h-4 text-destructive" />,
  na: <span className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 inline-block" />,
};

export default function Inspections() {
  const { t } = useLanguage();
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [workOrders, setWorkOrders] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewChecklist, setViewChecklist] = useState<Checklist | null>(null);
  const [selectedWO, setSelectedWO] = useState("");
  const [items, setItems] = useState<ChecklistItem[]>([...DEFAULT_ITEMS]);
  const [technician, setTechnician] = useState("");

  const shopId = localStorage.getItem("garageflow_active_shop");

  const load = async () => {
    if (!shopId) return;
    const [clRes, woRes] = await Promise.all([
      supabase.from("inspection_checklists").select("*").eq("shop_id", shopId).order("created_at", { ascending: false }),
      supabase.from("work_orders").select("id, number, status, client_id").eq("shop_id", shopId).in("status", ["open", "diagnosis", "in_progress", "approved"]).order("created_at", { ascending: false }),
    ]);
    if (clRes.data) setChecklists(clRes.data.map((c: any) => ({ ...c, items: Array.isArray(c.items) ? c.items : JSON.parse(c.items) })) as Checklist[]);
    if (woRes.data) setWorkOrders(woRes.data);
  };

  useEffect(() => { load(); }, [shopId]);

  const handleCreate = async () => {
    if (!shopId || !selectedWO) { toast.error(t('inspections.selectWO')); return; }
    const { error } = await supabase.from("inspection_checklists").insert({
      shop_id: shopId, work_order_id: selectedWO,
      items: JSON.stringify(items), technician: technician || null,
    } as any);
    if (error) { toast.error(error.message); return; }
    toast.success(t('inspections.created'));
    setDialogOpen(false); setItems([...DEFAULT_ITEMS]); setSelectedWO(""); setTechnician(""); load();
  };

  const handleComplete = async (id: string) => {
    await supabase.from("inspection_checklists").update({ completed_at: new Date().toISOString() } as any).eq("id", id);
    toast.success(t('inspections.completed'));
    load();
  };

  const updateItemStatus = (index: number, status: ChecklistItem["status"]) => {
    const updated = [...items];
    updated[index] = { ...updated[index], status };
    setItems(updated);
  };

  const updateItemNotes = (index: number, notes: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], notes };
    setItems(updated);
  };

  const saveExistingChecklist = async (checklist: Checklist) => {
    await supabase.from("inspection_checklists").update({ items: JSON.stringify(checklist.items) } as any).eq("id", checklist.id);
    toast.success(t('common.saved'));
    load();
  };

  const getSummary = (items: ChecklistItem[]) => {
    const ok = items.filter(i => i.status === "ok").length;
    const attention = items.filter(i => i.status === "attention").length;
    const repair = items.filter(i => i.status === "repair").length;
    return { ok, attention, repair };
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-foreground flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-primary" />
            {t('inspections.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('inspections.subtitle')}</p>
        </div>
        <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="w-4 h-4 mr-1" />{t('inspections.new')}</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('inspections.workOrder')}</TableHead>
                <TableHead>{t('inspections.technician')}</TableHead>
                <TableHead>{t('inspections.summary')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('common.date')}</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {checklists.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t('inspections.empty')}</TableCell></TableRow>
              ) : checklists.map(cl => {
                const s = getSummary(cl.items);
                const wo = workOrders.find(w => w.id === cl.work_order_id);
                return (
                  <TableRow key={cl.id}>
                    <TableCell className="font-medium">{wo?.number || cl.work_order_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-muted-foreground">{cl.technician || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-600">✓ {s.ok}</span>
                        <span className="text-amber-500">⚠ {s.attention}</span>
                        <span className="text-destructive">✕ {s.repair}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={cl.completed_at ? "default" : "secondary"}>
                        {cl.completed_at ? t('inspections.done') : t('inspections.inProgress')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(cl.created_at), "dd/MM/yy")}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewChecklist(cl)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {!cl.completed_at && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" onClick={() => handleComplete(cl.id)}>
                            <CheckCircle className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('inspections.new')}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t('inspections.workOrder')} *</Label>
                <Select value={selectedWO} onValueChange={setSelectedWO}>
                  <SelectTrigger><SelectValue placeholder={t('inspections.selectWO')} /></SelectTrigger>
                  <SelectContent>
                    {workOrders.map(wo => <SelectItem key={wo.id} value={wo.id}>{wo.number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('inspections.technician')}</Label>
                <Input value={technician} onChange={e => setTechnician(e.target.value)} />
              </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">{t('inspections.item')}</TableHead>
                    <TableHead className="w-1/3">{t('common.status')}</TableHead>
                    <TableHead>{t('inspections.notes')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="text-sm font-medium">{item.name}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(["ok", "attention", "repair", "na"] as const).map(st => (
                            <button key={st} onClick={() => updateItemStatus(i, st)}
                              className={`p-1.5 rounded transition-all ${item.status === st ? 'bg-muted ring-2 ring-primary/30' : 'hover:bg-muted/50'}`}>
                              {STATUS_ICON[st]}
                            </button>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input value={item.notes} onChange={e => updateItemNotes(i, e.target.value)} className="h-8 text-xs" placeholder="..." />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button onClick={handleCreate} className="w-full">{t('inspections.create')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!viewChecklist} onOpenChange={(o) => { if (!o) setViewChecklist(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('inspections.viewTitle')}</DialogTitle></DialogHeader>
          {viewChecklist && (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('inspections.item')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('inspections.notes')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {viewChecklist.items.map((item, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{STATUS_ICON[item.status]} <span className="text-xs ml-1">{item.status.toUpperCase()}</span></TableCell>
                      <TableCell className="text-muted-foreground text-sm">{item.notes || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
