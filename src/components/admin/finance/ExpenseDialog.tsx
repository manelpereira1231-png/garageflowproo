/** Diálogo para adicionar/editar uma despesa da plataforma. */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ACQUISITION_CHANNELS, CHANNEL_LABEL, EXPENSE_CATEGORIES, type ExpenseRow } from "@/lib/platformFinance";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  expense: ExpenseRow | null;
  extraCategories: { name: string; cost_type: string }[];
  onSaved: () => void;
}

const emptyForm = {
  description: "",
  category: "technology",
  subcategory: "",
  vendor: "",
  amount_net: "",
  vat_amount: "",
  expense_date: new Date().toISOString().slice(0, 10),
  is_recurring: false,
  frequency: "monthly",
  next_due_date: "",
  payment_method: "",
  document_url: "",
  notes: "",
  cost_type: "operational",
  acquisition_channel: "",
  is_paid: true,
};

export function ExpenseDialog({ open, onOpenChange, expense, extraCategories, onSaved }: Props) {
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (expense) {
      setForm({
        description: expense.description,
        category: expense.category,
        subcategory: expense.subcategory || "",
        vendor: expense.vendor || "",
        amount_net: String(expense.amount_net ?? ""),
        vat_amount: String(expense.vat_amount ?? ""),
        expense_date: expense.expense_date?.slice(0, 10) || emptyForm.expense_date,
        is_recurring: expense.is_recurring,
        frequency: expense.frequency || "monthly",
        next_due_date: expense.next_due_date?.slice(0, 10) || "",
        payment_method: expense.payment_method || "",
        document_url: expense.document_url || "",
        notes: expense.notes || "",
        cost_type: expense.cost_type || "operational",
        acquisition_channel: expense.acquisition_channel || "",
        is_paid: expense.is_paid,
      });
    } else {
      setForm({ ...emptyForm });
    }
  }, [open, expense]);

  const net = parseFloat(form.amount_net) || 0;
  const vat = parseFloat(form.vat_amount) || 0;
  const total = net + vat;

  const categories = useMemo(() => {
    const base = Object.entries(EXPENSE_CATEGORIES).map(([key, v]) => ({ key, label: v.label }));
    const extras = extraCategories
      .filter(c => !EXPENSE_CATEGORIES[c.name])
      .map(c => ({ key: c.name, label: c.name }));
    return [...base, ...extras];
  }, [extraCategories]);

  const subcategories = EXPENSE_CATEGORIES[form.category]?.subcategories || [];

  const setField = (k: string, v: unknown) => setForm(prev => ({ ...prev, [k]: v as never }));

  const onCategoryChange = (key: string) => {
    setForm(prev => ({
      ...prev,
      category: key,
      subcategory: "",
      cost_type: EXPENSE_CATEGORIES[key]?.costType || prev.cost_type,
    }));
  };

  const save = async () => {
    if (!form.description.trim()) { toast.error("Indique a descrição da despesa."); return; }
    if (net <= 0 && vat <= 0) { toast.error("Indique um valor válido."); return; }
    setSaving(true);
    try {
      const payload = {
        description: form.description.trim(),
        category: form.category,
        subcategory: form.subcategory || null,
        vendor: form.vendor || null,
        amount_net: net,
        vat_amount: vat,
        amount_total: total,
        expense_date: form.expense_date,
        is_recurring: form.is_recurring,
        frequency: form.is_recurring ? form.frequency : null,
        next_due_date: form.is_recurring && form.next_due_date ? form.next_due_date : null,
        payment_method: form.payment_method || null,
        document_url: form.document_url || null,
        notes: form.notes || null,
        cost_type: form.cost_type,
        acquisition_channel: form.acquisition_channel || null,
        is_paid: form.is_paid,
        paid_at: form.is_paid ? (expense?.paid_at || new Date().toISOString()) : null,
        source: "manual",
      };
      const { error } = expense
        ? await supabase.from("platform_expenses").update(payload).eq("id", expense.id)
        : await supabase.from("platform_expenses").insert(payload as never);
      if (error) throw error;
      toast.success(expense ? "Despesa atualizada." : "Despesa registada.");
      onOpenChange(false);
      onSaved();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Não foi possível guardar a despesa.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar despesa" : "Adicionar despesa"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Descrição *</Label>
            <Input value={form.description} onChange={e => setField("description", e.target.value)} placeholder="Ex.: Subscrição Supabase Pro" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Valor sem IVA (€) *</Label>
              <Input type="number" step="0.01" value={form.amount_net} onChange={e => setField("amount_net", e.target.value)} />
            </div>
            <div>
              <Label>IVA (€)</Label>
              <Input type="number" step="0.01" value={form.vat_amount} onChange={e => setField("vat_amount", e.target.value)} />
            </div>
            <div>
              <Label>Total (€)</Label>
              <Input value={total.toFixed(2)} readOnly className="bg-muted" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={onCategoryChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subcategoria</Label>
              {subcategories.length > 0 ? (
                <Select value={form.subcategory || "none"} onValueChange={v => setField("subcategory", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {subcategories.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={form.subcategory} onChange={e => setField("subcategory", e.target.value)} placeholder="Opcional" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label>Fornecedor</Label>
              <Input value={form.vendor} onChange={e => setField("vendor", e.target.value)} placeholder="Ex.: Stripe" />
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.expense_date} onChange={e => setField("expense_date", e.target.value)} />
            </div>
            <div>
              <Label>Método de pagamento</Label>
              <Input value={form.payment_method} onChange={e => setField("payment_method", e.target.value)} placeholder="Ex.: Cartão" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label>Tipo de custo</Label>
              <Select value={form.cost_type} onValueChange={v => setField("cost_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="operational">Custo operacional</SelectItem>
                  <SelectItem value="growth">Custo de crescimento</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Canal de aquisição</Label>
              <Select value={form.acquisition_channel || "none"} onValueChange={v => setField("acquisition_channel", v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Não aplicável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Não aplicável</SelectItem>
                  {ACQUISITION_CHANNELS.map(c => <SelectItem key={c} value={c}>{CHANNEL_LABEL[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-6 rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <Switch checked={form.is_recurring} onCheckedChange={v => setField("is_recurring", v)} />
              <Label className="cursor-pointer">Despesa recorrente</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_paid} onCheckedChange={v => setField("is_paid", v)} />
              <Label className="cursor-pointer">Já paga</Label>
            </div>
          </div>

          {form.is_recurring && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Periodicidade</Label>
                <Select value={form.frequency} onValueChange={v => setField("frequency", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="quarterly">Trimestral</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                    <SelectItem value="other">Outra</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Próxima despesa</Label>
                <Input type="date" value={form.next_due_date} onChange={e => setField("next_due_date", e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label>Documento / fatura (link)</Label>
            <Input value={form.document_url} onChange={e => setField("document_url", e.target.value)} placeholder="https://..." />
          </div>

          <div>
            <Label>Notas</Label>
            <Textarea rows={2} value={form.notes} onChange={e => setField("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "A guardar..." : "Guardar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
