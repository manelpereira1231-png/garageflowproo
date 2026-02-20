import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { VAT_RATES } from "@/types/garage";

const countries = Object.keys(VAT_RATES);

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [shopId, setShopId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", country: "Portugal",
    currency: "EUR", vat_rate: "23", labor_rate: "35", language: "pt",
  });

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("shops").select("*").eq("user_id", user.id).single();
      if (data) {
        setShopId(data.id);
        setForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          country: data.country || "Portugal",
          currency: data.currency || "EUR",
          vat_rate: String(data.vat_rate ?? 23),
          labor_rate: String(data.labor_rate ?? 35),
          language: data.language || "pt",
        });
      }
    };
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Sessão expirada"); setLoading(false); return; }

    const payload = {
      user_id: user.id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      country: form.country,
      currency: form.currency,
      vat_rate: parseFloat(form.vat_rate),
      labor_rate: parseFloat(form.labor_rate),
      language: form.language,
    };

    if (shopId) {
      const { error } = await supabase.from("shops").update(payload).eq("id", shopId);
      if (error) toast.error(error.message);
      else toast.success("Definições guardadas!");
    } else {
      const { data, error } = await supabase.from("shops").insert(payload).select().single();
      if (error) toast.error(error.message);
      else {
        setShopId(data.id);
        toast.success("Oficina configurada!");
      }
    }
    setLoading(false);
  };

  return (
    <div className="max-w-xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">Definições</h1>
          <p className="text-muted-foreground text-sm mt-1">Configuração da oficina</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Informações da Oficina</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5 col-span-2">
              <Label>Nome da Oficina *</Label>
              <Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold">Fiscal & Financeiro</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>País</Label>
              <Select value={form.country} onValueChange={v => setForm({...form, country: v, vat_rate: String(VAT_RATES[v] || 23)})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {countries.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Taxa IVA (%)</Label>
              <Input type="number" value={form.vat_rate} onChange={e => setForm({...form, vat_rate: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Preço Hora Mão de Obra (€)</Label>
              <Input type="number" step="0.01" value={form.labor_rate} onChange={e => setForm({...form, labor_rate: e.target.value})} />
            </div>
            <div className="space-y-1.5">
              <Label>Moeda</Label>
              <Input value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} />
            </div>
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "A guardar..." : "Guardar Definições"}
        </Button>
      </form>
    </div>
  );
}
