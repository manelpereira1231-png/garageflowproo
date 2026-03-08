import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, CheckCircle, Wrench } from "lucide-react";
import { format } from "date-fns";

const SERVICE_OPTIONS = [
  "Revisão geral",
  "Mudança de óleo",
  "Travões",
  "Pneus",
  "Diagnóstico",
  "Inspeção",
  "Ar condicionado",
  "Eletricidade",
  "Outro",
];

export default function PublicBooking() {
  const { slug } = useParams<{ slug: string }>();
  const [shop, setShop] = useState<{ id: string; name: string; logo_url: string | null; phone: string; email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    client_email: "",
    service_type: "",
    date: "",
    time: "09:00",
    notes: "",
  });

  useEffect(() => {
    if (!slug) return;
    const load = async () => {
      const { data } = await supabase
        .from("shops")
        .select("id, name, logo_url, phone, email")
        .eq("slug", slug)
        .maybeSingle();
      setShop(data as any);
      setLoading(false);
    };
    load();
  }, [slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shop || !form.client_name || !form.service_type || !form.date || !form.time) {
      setError("Preencha todos os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    setError("");

    // Try to find or create client
    let clientId: string | null = null;
    if (form.client_email || form.client_phone) {
      // We can't query clients as anon due to RLS, so just pass the data
      // The shop will see client_name/phone/email on the appointment
    }

    const { error: insertError } = await supabase.from("appointments").insert({
      shop_id: shop.id,
      service_type: form.service_type,
      date: form.date,
      time: form.time,
      client_name: form.client_name,
      client_phone: form.client_phone || null,
      client_email: form.client_email || null,
      notes: form.notes || null,
      status: "scheduled",
    } as any);

    setSubmitting(false);

    if (insertError) {
      setError("Erro ao criar marcação. Tente novamente.");
      return;
    }

    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!shop) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Oficina não encontrada.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center space-y-4">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Marcação enviada!</h2>
            <p className="text-muted-foreground">
              A sua marcação foi registada com sucesso. A oficina <strong>{shop.name}</strong> irá confirmar em breve.
            </p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setForm({ client_name: "", client_phone: "", client_email: "", service_type: "", date: "", time: "09:00", notes: "" }); }}>
              Nova marcação
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8 sm:pt-16">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center pb-2">
          {shop.logo_url && (
            <img src={shop.logo_url} alt={shop.name} className="w-16 h-16 rounded-lg object-contain mx-auto mb-2" />
          )}
          <CardTitle className="text-xl flex items-center justify-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Marcar revisão
          </CardTitle>
          <p className="text-sm text-muted-foreground">{shop.name}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome *</Label>
              <Input value={form.client_name} onChange={e => setForm({ ...form, client_name: e.target.value })} placeholder="O seu nome" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Telefone</Label>
                <Input value={form.client_phone} onChange={e => setForm({ ...form, client_phone: e.target.value })} placeholder="912 345 678" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.client_email} onChange={e => setForm({ ...form, client_email: e.target.value })} placeholder="email@exemplo.com" />
              </div>
            </div>
            <div>
              <Label>Tipo de serviço *</Label>
              <Select value={form.service_type} onValueChange={v => setForm({ ...form, service_type: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {SERVICE_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data pretendida *</Label>
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} min={format(new Date(), "yyyy-MM-dd")} required />
              </div>
              <div>
                <Label>Hora pretendida *</Label>
                <Input type="time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} required />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Descreva o problema ou serviço pretendido..." />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "A enviar..." : "Confirmar marcação"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center">
              Powered by <span className="font-semibold">GarageFlow</span>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
