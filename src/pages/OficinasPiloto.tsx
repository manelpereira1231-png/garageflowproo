import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, Gift, Shield, Wrench, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  workshop_name: z.string().trim().min(2, "Nome muito curto").max(120),
  contact_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(6, "Telefone inválido").max(30),
  email: z.string().trim().email("Email inválido").max(255).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional(),
  team_size: z.string().max(20).optional(),
  current_tool: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(500).optional(),
});

const WHATSAPP = "351910000000"; // ajusta se necessário

export default function OficinasPiloto() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [utm, setUtm] = useState<Record<string, string>>({});

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    setUtm({
      utm_source: p.get("utm_source") || "",
      utm_medium: p.get("utm_medium") || "",
      utm_campaign: p.get("utm_campaign") || "",
    });
  }, []);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || "Verifica os campos");
      return;
    }
    setSubmitting(true);
    const payload = {
      workshop_name: parsed.data.workshop_name,
      contact_name: parsed.data.contact_name || null,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      city: parsed.data.city || null,
      team_size: parsed.data.team_size || null,
      current_tool: parsed.data.current_tool || null,
      notes: parsed.data.notes || null,
      source: "oficinas-piloto",
      utm_source: utm.utm_source || null,
      utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null,
      user_agent: navigator.userAgent.slice(0, 250),
    };
    const { error } = await supabase.from("pilot_leads").insert(payload);
    setSubmitting(false);
    if (error) {
      toast.error("Não foi possível enviar. Tenta novamente.");
      return;
    }
    setDone(true);
    toast.success("Inscrição recebida! Falamos contigo em 24h.");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <Helmet>
        <title>Oficinas Piloto — 3 Meses Grátis | GarageFlow</title>
        <meta name="description" content="Procuramos 10 oficinas em Portugal para o programa piloto. 3 meses grátis, setup feito por nós, suporte WhatsApp direto." />
        <link rel="canonical" href="/oficinas-piloto" />
      </Helmet>

      {/* Hero */}
      <section className="border-b border-zinc-800 bg-gradient-to-b from-amber-950/20 to-transparent">
        <div className="max-w-5xl mx-auto px-4 py-16 md:py-24 text-center">
          <span className="inline-block px-3 py-1 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold tracking-wide uppercase mb-6">
            Apenas 10 vagas · Portugal
          </span>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight">
            3 meses <span className="text-amber-400">grátis</span> para as primeiras
            <br className="hidden md:block" /> 10 oficinas piloto
          </h1>
          <p className="mt-6 text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto">
            Setup feito por nós. Suporte WhatsApp direto. Sem cartão. Depois ficas com
            <strong className="text-zinc-100"> 9€/mês para sempre</strong>.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#form">
              <Button size="lg" className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold">
                Quero entrar no piloto
              </Button>
            </a>
            <a
              href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Olá! Vi a campanha das oficinas piloto e quero saber mais.")}`}
              target="_blank" rel="noopener noreferrer"
            >
              <Button size="lg" variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                <MessageCircle className="w-4 h-4 mr-2" /> Falar no WhatsApp
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { icon: Gift, t: "3 meses grátis", d: "Sem cartão, sem compromisso." },
            { icon: Wrench, t: "Setup por nós", d: "Tu trabalhas, nós configuramos." },
            { icon: MessageCircle, t: "WhatsApp direto", d: "Suporte rápido e humano." },
            { icon: Shield, t: "9€/mês para sempre", d: "Preço fechado vitalício." },
          ].map((b, i) => (
            <Card key={i} className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-5">
                <b.icon className="w-6 h-6 text-amber-400 mb-3" />
                <h3 className="font-semibold">{b.t}</h3>
                <p className="text-sm text-zinc-400 mt-1">{b.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="border-y border-zinc-800 bg-zinc-900/40">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h2 className="text-2xl md:text-3xl font-bold mb-6">O que vais ter</h2>
          <ul className="space-y-3">
            {[
              "Clientes, viaturas, orçamentos e ordens de serviço num só sítio",
              "Faturação rápida e PDFs profissionais",
              "Agenda da oficina e lembretes automáticos",
              "App mobile e PWA — funciona no telemóvel da equipa",
              "Onboarding 1-on-1 por Zoom (30 min)",
              "Acesso ao GarageFlow Market (compra e venda de viaturas)",
            ].map((t, i) => (
              <li key={i} className="flex gap-3 text-zinc-300">
                <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Form */}
      <section id="form" className="max-w-2xl mx-auto px-4 py-16">
        {done ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="w-12 h-12 text-amber-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold">Inscrição recebida</h2>
              <p className="text-zinc-400 mt-2">
                Vamos contactar-te nas próximas 24h. Se quiseres acelerar:
              </p>
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent("Acabei de me inscrever no piloto, quero acelerar.")}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-block mt-4"
              >
                <Button className="bg-amber-500 hover:bg-amber-400 text-zinc-950">
                  <MessageCircle className="w-4 h-4 mr-2" /> Falar agora no WhatsApp
                </Button>
              </a>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-6 md:p-8">
              <div className="flex items-center gap-2 text-amber-400 text-sm mb-3">
                <Clock className="w-4 h-4" /> 60 segundos · Resposta em 24h
              </div>
              <h2 className="text-2xl md:text-3xl font-bold mb-6">Candidata a tua oficina</h2>
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="workshop_name">Nome da oficina *</Label>
                  <Input id="workshop_name" name="workshop_name" required maxLength={120} className="bg-zinc-950 border-zinc-800" />
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="contact_name">O teu nome</Label>
                    <Input id="contact_name" name="contact_name" maxLength={120} className="bg-zinc-950 border-zinc-800" />
                  </div>
                  <div>
                    <Label htmlFor="phone">Telemóvel *</Label>
                    <Input id="phone" name="phone" required type="tel" maxLength={30} className="bg-zinc-950 border-zinc-800" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" maxLength={255} className="bg-zinc-950 border-zinc-800" />
                  </div>
                  <div>
                    <Label htmlFor="city">Cidade</Label>
                    <Input id="city" name="city" maxLength={80} className="bg-zinc-950 border-zinc-800" />
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="team_size">Mecânicos</Label>
                    <select id="team_size" name="team_size" className="w-full h-10 rounded-md bg-zinc-950 border border-zinc-800 px-3 text-sm">
                      <option value="">Selecionar</option>
                      <option value="1">Sou só eu</option>
                      <option value="2-3">2-3</option>
                      <option value="4-6">4-6</option>
                      <option value="7+">7+</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="current_tool">Software atual</Label>
                    <Input id="current_tool" name="current_tool" placeholder="Excel, papel, outro..." maxLength={120} className="bg-zinc-950 border-zinc-800" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="notes">Algo que queiras dizer?</Label>
                  <Textarea id="notes" name="notes" rows={3} maxLength={500} className="bg-zinc-950 border-zinc-800" />
                </div>
                <Button type="submit" disabled={submitting} size="lg" className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold">
                  {submitting ? "A enviar..." : "Candidatar a oficina"}
                </Button>
                <p className="text-xs text-zinc-500 text-center">
                  Ao enviar concordas em ser contactado pela equipa GarageFlow.
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </section>

      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} GarageFlow · Portugal
      </footer>
    </div>
  );
}
