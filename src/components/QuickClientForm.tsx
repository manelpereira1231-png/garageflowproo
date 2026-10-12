import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { clientDisplayName } from "@/lib/clientDisplayName";

type Created = { id: string; name: string; company: string | null; nif: string | null };

/**
 * Criação rápida de cliente dentro de outro fluxo (ex.: Novo orçamento).
 * Grava na mesma tabela de clientes; antes verifica NIF/email/telefone na
 * própria oficina para nunca criar duplicados.
 */
export default function QuickClientForm({ shopId, onCreated, onCancel }: { shopId: string; onCreated: (c: Created) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: "", company: "", nif: "", phone: "", email: "" });
  const [dup, setDup] = useState<Created | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!f.name.trim() && !f.company.trim()) { toast.error("Indique o nome ou a empresa."); return; }
    setSaving(true);
    const ors: string[] = [];
    if (f.nif.trim()) ors.push(`nif.eq.${f.nif.trim()}`);
    if (f.email.trim()) ors.push(`email.ilike.${f.email.trim()}`);
    if (f.phone.trim()) ors.push(`phone.eq.${f.phone.trim()}`);
    if (ors.length) {
      const { data } = await supabase.from("clients").select("id, name, company, nif").eq("shop_id", shopId).is("deleted_at", null).or(ors.join(",")).limit(1);
      if (data?.[0]) { setDup(data[0] as Created); setSaving(false); return; }
    }
    const { data, error } = await supabase.from("clients").insert({
      shop_id: shopId, name: f.name.trim() || f.company.trim(), company: f.company.trim() || null,
      nif: f.nif.trim() || null, phone: f.phone.trim(), email: f.email.trim(),
    } as any).select("id, name, company, nif").single();
    setSaving(false);
    if (error) { toast.error((error as any).code === "23505" ? "Já existe um cliente com estes dados." : "Não foi possível criar o cliente."); return; }
    toast.success("Cliente criado");
    onCreated(data as Created);
  };

  if (dup) return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <p className="text-sm">Já existe um cliente com estes dados: <strong>{clientDisplayName(dup)}</strong>.</p>
      <div className="flex gap-2">
        <Button type="button" className="min-h-[44px]" onClick={() => onCreated(dup)}>Usar este cliente</Button>
        <Button type="button" variant="ghost" className="min-h-[44px]" onClick={() => setDup(null)}>Voltar</Button>
      </div>
    </div>
  );

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><Label className="text-xs">Nome *</Label><Input className="min-h-[44px]" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label className="text-xs">Empresa</Label><Input className="min-h-[44px]" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></div>
        <div><Label className="text-xs">Telefone</Label><Input className="min-h-[44px]" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><Label className="text-xs">NIF / CPF / CNPJ</Label><Input className="min-h-[44px]" value={f.nif} onChange={(e) => setF({ ...f, nif: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label className="text-xs">Email</Label><Input className="min-h-[44px]" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      </div>
      <div className="flex gap-2">
        <Button type="button" className="min-h-[44px]" onClick={save} disabled={saving}>{saving ? "A guardar…" : "Guardar cliente"}</Button>
        <Button type="button" variant="ghost" className="min-h-[44px]" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
