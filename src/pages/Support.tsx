import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Mail, MessageCircle, LifeBuoy, Phone, Clock, ShieldCheck } from "lucide-react";

const SUPPORT_EMAIL = "manelpereira11@gmail.com";
const SUPPORT_WHATSAPP = "351933683304"; // ajusta se necessário

export default function Support() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const initialContext = params.get("context") === "market" ? "market" : "erp";

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    context: initialContext,
    category: "general",
    priority: "normal",
    subject: "",
    message: "",
  });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setForm((f) => ({
          ...f,
          email: user.email ?? f.email,
          name: (user.user_metadata?.full_name as string) ?? f.name,
        }));
      }
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject.trim() || !form.message.trim() || !form.email.trim()) {
      toast.error("Preencha email, assunto e mensagem.");
      return;
    }
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data: inserted, error } = await supabase
      .from("support_tickets" as any)
      .insert({
        user_id: user?.id ?? null,
        contact_email: form.email,
        contact_name: form.name || null,
        contact_phone: form.phone || null,
        context: form.context,
        category: form.category,
        priority: form.priority,
        subject: form.subject,
        message: form.message,
      })
      .select("id")
      .single();

    if (error) {
      setLoading(false);
      toast.error("Erro ao enviar pedido. Tente novamente ou contacte por email.");
      return;
    }

    // Notifica admin por email — não bloqueia o feedback ao utilizador
    supabase.functions.invoke("notify-support-ticket", {
      body: {
        ticket_id: (inserted as any)?.id,
        contact_email: form.email,
        contact_name: form.name || null,
        contact_phone: form.phone || null,
        context: form.context,
        category: form.category,
        priority: form.priority,
        subject: form.subject,
        message: form.message,
      },
    }).catch((err) => console.warn("notify-support-ticket failed:", err));

    setLoading(false);
    toast.success("Pedido enviado. A administração foi notificada e responderá em breve.");
    setForm((f) => ({ ...f, subject: "", message: "" }));
  };

  const waLink = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent(
    `Olá, preciso de ajuda no GarageFlow ${form.context === "market" ? "Market" : "ERP"}.`,
  )}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Suporte GarageFlow</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Fale com a administração</CardTitle>
              <CardDescription>
                Problema técnico, pagamento, KYC, inspeção, conta ou dúvida — escreva-nos e respondemos por email.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Seu nome" />
                  </div>
                  <div>
                    <Label>Email *</Label>
                    <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.pt" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Telefone (opcional)</Label>
                    <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+351 ..." />
                  </div>
                  <div>
                    <Label>Plataforma</Label>
                    <Select value={form.context} onValueChange={(v) => setForm({ ...form, context: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="erp">GarageFlow (Oficina)</SelectItem>
                        <SelectItem value="market">GarageFlow Market</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Categoria</Label>
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">Dúvida geral</SelectItem>
                        <SelectItem value="billing">Faturação / Pagamentos</SelectItem>
                        <SelectItem value="bug">Erro técnico</SelectItem>
                        <SelectItem value="account">Conta / Login</SelectItem>
                        <SelectItem value="kyc">KYC / Verificação</SelectItem>
                        <SelectItem value="inspection">Inspeção (Market)</SelectItem>
                        <SelectItem value="dispute">Disputa / Reembolso</SelectItem>
                        <SelectItem value="rgpd">Dados pessoais (RGPD)</SelectItem>
                        <SelectItem value="other">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Urgência</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Baixa</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">Alta</SelectItem>
                        <SelectItem value="urgent">Urgente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Assunto *</Label>
                  <Input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Resumo curto do problema" />
                </div>
                <div>
                  <Label>Mensagem *</Label>
                  <Textarea required rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} placeholder="Descreva o problema com detalhe (passos, erros, IDs, prints se possível)..." />
                </div>
                <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                  {loading ? "A enviar..." : "Enviar pedido"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contacto direto</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <a href={`mailto:${SUPPORT_EMAIL}?subject=Suporte%20GarageFlow`} className="flex items-center gap-2 hover:text-primary">
                <Mail className="w-4 h-4" /> {SUPPORT_EMAIL}
              </a>
              <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4" /> Resposta: até 24h úteis
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <ShieldCheck className="w-4 h-4" /> RGPD/LOPDGDD compliant
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recursos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <a href="/legal/my-data" className="block hover:text-primary">Os meus dados (RGPD)</a>
              <a href="/legal/privacy" className="block hover:text-primary">Política de Privacidade</a>
              <a href="/legal/terms" className="block hover:text-primary">Termos GarageFlow</a>
              <a href="/legal/market-terms" className="block hover:text-primary">Termos Market</a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
