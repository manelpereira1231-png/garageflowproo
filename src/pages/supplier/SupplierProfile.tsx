import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { toast } from "sonner";

export default function SupplierProfile() {
  const { supplierId } = useIsSupplier();
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!supplierId) return;
    (async () => {
      const { data } = await supabase.from("gsn_suppliers" as any).select("*").eq("id", supplierId).maybeSingle();
      setData(data);
    })();
  }, [supplierId]);

  const save = async () => {
    if (!supplierId) return;
    setSaving(true);
    const { error } = await supabase.from("gsn_suppliers" as any).update({
      company_name: data.company_name,
      trade_name: data.trade_name,
      vat_number: data.vat_number,
      email: data.email,
      phone: data.phone,
      website: data.website,
      country: data.country,
      district: data.district,
      city: data.city,
      postal_code: data.postal_code,
      address: data.address,
      description: data.description,
      average_delivery_time: data.average_delivery_time,
      minimum_order: Number(data.minimum_order) || 0,
      support_email: data.support_email,
      support_phone: data.support_phone,
      logo_url: data.logo_url,
      banner_url: data.banner_url,
      pickup_available: !!data.pickup_available,
      delivery_available: !!data.delivery_available,
    }).eq("id", supplierId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil atualizado");
  };

  if (!data) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  const set = (k: string, v: any) => setData({ ...data, [k]: v });

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">Perfil da empresa</h1>
      <Card>
        <CardHeader><CardTitle>Identificação</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Razão social</Label><Input value={data.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} /></div>
          <div><Label>Nome comercial</Label><Input value={data.trade_name ?? ""} onChange={(e) => set("trade_name", e.target.value)} /></div>
          <div><Label>NIF</Label><Input value={data.vat_number ?? ""} onChange={(e) => set("vat_number", e.target.value)} /></div>
          <div><Label>Website</Label><Input value={data.website ?? ""} onChange={(e) => set("website", e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Descrição</Label><Textarea rows={4} value={data.description ?? ""} onChange={(e) => set("description", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Contactos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Email</Label><Input value={data.email ?? ""} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={data.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></div>
          <div><Label>Email de suporte</Label><Input value={data.support_email ?? ""} onChange={(e) => set("support_email", e.target.value)} /></div>
          <div><Label>Telefone de suporte</Label><Input value={data.support_phone ?? ""} onChange={(e) => set("support_phone", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Localização</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>País</Label><Input value={data.country ?? ""} onChange={(e) => set("country", e.target.value)} /></div>
          <div><Label>Distrito</Label><Input value={data.district ?? ""} onChange={(e) => set("district", e.target.value)} /></div>
          <div><Label>Cidade</Label><Input value={data.city ?? ""} onChange={(e) => set("city", e.target.value)} /></div>
          <div><Label>Código postal</Label><Input value={data.postal_code ?? ""} onChange={(e) => set("postal_code", e.target.value)} /></div>
          <div className="md:col-span-2"><Label>Morada</Label><Input value={data.address ?? ""} onChange={(e) => set("address", e.target.value)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Logística</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><Label>Tempo médio de entrega</Label><Input value={data.average_delivery_time ?? ""} onChange={(e) => set("average_delivery_time", e.target.value)} placeholder="24-48h" /></div>
          <div><Label>Encomenda mínima (€)</Label><Input type="number" step="0.01" value={data.minimum_order ?? 0} onChange={(e) => set("minimum_order", e.target.value)} /></div>
        </CardContent>
      </Card>
      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>{saving ? "A guardar..." : "Guardar alterações"}</Button>
      </div>
    </div>
  );
}
