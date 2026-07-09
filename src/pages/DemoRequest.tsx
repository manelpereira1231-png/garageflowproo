import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Wrench, CheckCircle2, Loader2, Phone, Mail, MapPin, Clock } from "lucide-react";
import { Helmet } from "react-helmet-async";

type FormState = {
  name: string; shop_name: string; email: string; phone: string;
  city: string; employees: string; current_software: string;
  best_contact_time: string; notes: string;
};

const EMPTY: FormState = {
  name: "", shop_name: "", email: "", phone: "",
  city: "", employees: "", current_software: "",
  best_contact_time: "", notes: "",
};

export default function DemoRequest() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const upd = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.shop_name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("Preencha nome, oficina, email e telefone.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("submit-demo-request", { body: form });
      if (error) throw error;
      setDone(true);
      toast.success("Pedido enviado com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Não foi possível enviar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Marcar Demonstração — GarageFlow</title>
        <meta name="description" content="Solicite uma demonstração gratuita e personalizada do GarageFlow para a sua oficina." />
      </Helmet>

      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <Wrench className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">GarageFlow</div>
            <div className="text-xs text-muted-foreground">Sistema de gestão de oficinas</div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 grid lg:grid-cols-5 gap-8">
        <section className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Marcar Demonstração
            </h1>
            <p className="text-muted-foreground mt-2">
              Descubra em 30 minutos como o GarageFlow pode simplificar o dia-a-dia da sua oficina —
              orçamentos, folhas de obra, faturação, agenda, clientes e viaturas — tudo num só sítio.
            </p>
          </div>

          <ul className="space-y-3 text-sm">
            {[
              "Demonstração personalizada à sua realidade",
              "Análise gratuita do fluxo de trabalho atual",
              "Sem compromisso e sem custos",
              "Apresentação por videochamada ou presencial",
            ].map((t) => (
              <li key={t} className="flex gap-2 items-start">
                <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <Card>
            <CardContent className="p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-primary" /> +351 912 345 678</div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /> contact@garageflow.pt</div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> Seg-Sex, 9h–18h</div>
              <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-primary" /> Portugal, Espanha, Brasil</div>
            </CardContent>
          </Card>
        </section>

        <section className="lg:col-span-3">
          <Card>
            <CardContent className="p-6">
              {done ? (
                <div className="text-center py-8 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-950 text-green-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h2 className="text-xl font-bold">Pedido enviado!</h2>
                  <p className="text-sm text-muted-foreground">
                    Recebemos o seu pedido de demonstração. A nossa equipa comercial entrará em contacto
                    dentro de <strong>24 horas úteis</strong>, no horário indicado.
                  </p>
                  <Button variant="outline" onClick={() => { setForm(EMPTY); setDone(false); }}>
                    Enviar outro pedido
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <h2 className="text-xl font-semibold">Solicitar demonstração gratuita</h2>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="name">Nome *</Label>
                      <Input id="name" value={form.name} onChange={upd("name")} required maxLength={150} />
                    </div>
                    <div>
                      <Label htmlFor="shop_name">Nome da Oficina *</Label>
                      <Input id="shop_name" value={form.shop_name} onChange={upd("shop_name")} required maxLength={200} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input id="email" type="email" value={form.email} onChange={upd("email")} required maxLength={255} />
                    </div>
                    <div>
                      <Label htmlFor="phone">Telefone *</Label>
                      <Input id="phone" type="tel" value={form.phone} onChange={upd("phone")} required maxLength={50} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="city">Cidade</Label>
                      <Input id="city" value={form.city} onChange={upd("city")} maxLength={100} />
                    </div>
                    <div>
                      <Label htmlFor="employees">Nº de colaboradores</Label>
                      <Input id="employees" value={form.employees} onChange={upd("employees")}
                        placeholder="Ex.: 1-3, 4-10, 10+" maxLength={30} />
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="current_software">Software que utiliza atualmente</Label>
                      <Input id="current_software" value={form.current_software}
                        onChange={upd("current_software")} placeholder="Ex.: Nenhum, Excel, outro..." maxLength={150} />
                    </div>
                    <div>
                      <Label htmlFor="best_contact_time">Melhor horário para contacto</Label>
                      <Input id="best_contact_time" value={form.best_contact_time}
                        onChange={upd("best_contact_time")} placeholder="Ex.: manhã, 14h–17h..." maxLength={100} />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="notes">Observações</Label>
                    <Textarea id="notes" rows={4} value={form.notes} onChange={upd("notes")} maxLength={2000}
                      placeholder="Conte-nos brevemente o que procura resolver..." />
                  </div>

                  <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> A enviar...</> : "Solicitar Demonstração"}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    Ao enviar, aceita ser contactado pela equipa GarageFlow. Não partilhamos os seus dados.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
