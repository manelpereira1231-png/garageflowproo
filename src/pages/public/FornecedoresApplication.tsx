import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSystemFeature } from "@/hooks/useSystemFeature";

const schema = z.object({
  company_name: z.string().trim().min(2).max(200),
  trade_name: z.string().trim().max(200).optional().or(z.literal("")),
  responsible_name: z.string().trim().min(2).max(200),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().max(50).optional().or(z.literal("")),
  vat_number: z.string().trim().max(50).optional().or(z.literal("")),
  website: z.string().trim().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(100).optional().or(z.literal("")),
  district: z.string().trim().max(100).optional().or(z.literal("")),
  postal_code: z.string().trim().max(20).optional().or(z.literal("")),
  country: z.string().trim().max(2).default("PT"),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  categories: z.string().max(500).optional().or(z.literal("")),
  brands: z.string().max(500).optional().or(z.literal("")),
  carriers: z.string().max(500).optional().or(z.literal("")),
  average_delivery_time: z.string().max(100).optional().or(z.literal("")),
});

export default function FornecedoresApplication() {
  const nav = useNavigate();
  const { enabled } = useSystemFeature("supplier_network_enabled");
  const [form, setForm] = useState<any>({ country: "PT" });
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const setF = (k: string, v: any) => setForm((s: any) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!enabled) return toast.error("Neste momento aceitamos candidaturas apenas por convite. Contacte-nos.");
    if (!terms) return toast.error("Tem de aceitar os termos");
    const parsed = schema.safeParse(form);
    if (!parsed.success) return toast.error(Object.values(parsed.error.flatten().fieldErrors).flat()[0] as string || "Dados inválidos");
    setSubmitting(true);
    const payload = {
      ...parsed.data,
      categories: (parsed.data.categories || "").split(",").map((s) => s.trim()).filter(Boolean),
      brands: (parsed.data.brands || "").split(",").map((s) => s.trim()).filter(Boolean),
      carriers: (parsed.data.carriers || "").split(",").map((s) => s.trim()).filter(Boolean),
      accepted_terms: true,
      source: "public",
    };
    const { error } = await supabase.from("gsn_supplier_applications" as any).insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    setDone(true);
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Helmet><title>Candidatura recebida | GarageFlow</title></Helmet>
        <Card className="max-w-lg w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="w-7 h-7 text-emerald-500" />
            </div>
            <CardTitle>Candidatura recebida</CardTitle>
            <CardDescription>
              Obrigado. A nossa equipa vai analisar os seus dados e responder por email em 2 a 5 dias úteis.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild variant="outline"><Link to="/">Voltar ao início</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <Helmet>
        <title>Candidatura Supplier Network | GarageFlow</title>
        <meta name="description" content="Candidate-se para vender peças automóveis na rede GarageFlow Supplier Network." />
        <link rel="canonical" href="https://garageflow.pt/fornecedores/candidatura" />
      </Helmet>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Candidatura a fornecedor</CardTitle>
            <CardDescription>Preencha os dados abaixo. Todos os campos com * são obrigatórios.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!enabled && (
              <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm text-amber-700 dark:text-amber-300">
                Neste momento aceitamos candidaturas apenas por convite.
              </div>
            )}
            <div className="grid md:grid-cols-2 gap-4">
              <div><Label>Empresa *</Label><Input value={form.company_name || ""} onChange={(e) => setF("company_name", e.target.value)} /></div>
              <div><Label>Nome comercial</Label><Input value={form.trade_name || ""} onChange={(e) => setF("trade_name", e.target.value)} /></div>
              <div><Label>Nome do responsável *</Label><Input value={form.responsible_name || ""} onChange={(e) => setF("responsible_name", e.target.value)} /></div>
              <div><Label>Email *</Label><Input type="email" value={form.email || ""} onChange={(e) => setF("email", e.target.value)} /></div>
              <div><Label>Telefone</Label><Input value={form.phone || ""} onChange={(e) => setF("phone", e.target.value)} /></div>
              <div><Label>NIF</Label><Input value={form.vat_number || ""} onChange={(e) => setF("vat_number", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Website</Label><Input value={form.website || ""} onChange={(e) => setF("website", e.target.value)} /></div>
              <div className="md:col-span-2"><Label>Morada</Label><Input value={form.address || ""} onChange={(e) => setF("address", e.target.value)} /></div>
              <div><Label>Cidade</Label><Input value={form.city || ""} onChange={(e) => setF("city", e.target.value)} /></div>
              <div><Label>Distrito</Label><Input value={form.district || ""} onChange={(e) => setF("district", e.target.value)} /></div>
              <div><Label>Código postal</Label><Input value={form.postal_code || ""} onChange={(e) => setF("postal_code", e.target.value)} /></div>
              <div><Label>País</Label><Input value={form.country || "PT"} onChange={(e) => setF("country", e.target.value.toUpperCase())} maxLength={2} /></div>
            </div>
            <div><Label>Descrição</Label><Textarea value={form.description || ""} onChange={(e) => setF("description", e.target.value)} rows={3} /></div>
            <div><Label>Categorias (separadas por vírgula)</Label><Input value={form.categories || ""} onChange={(e) => setF("categories", e.target.value)} placeholder="Travões, Suspensão, Motor" /></div>
            <div><Label>Marcas vendidas</Label><Input value={form.brands || ""} onChange={(e) => setF("brands", e.target.value)} placeholder="Bosch, Brembo, Bilstein" /></div>
            <div><Label>Transportadoras</Label><Input value={form.carriers || ""} onChange={(e) => setF("carriers", e.target.value)} placeholder="CTT, DPD" /></div>
            <div><Label>Tempo médio de entrega</Label><Input value={form.average_delivery_time || ""} onChange={(e) => setF("average_delivery_time", e.target.value)} placeholder="24-48h" /></div>
            <label className="flex items-start gap-2 text-sm pt-2">
              <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} />
              <span className="text-muted-foreground">Aceito os Termos e a Política de Privacidade da GarageFlow.</span>
            </label>
            <Button onClick={submit} disabled={submitting} className="w-full" size="lg">
              {submitting ? "A submeter..." : "Submeter candidatura"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
