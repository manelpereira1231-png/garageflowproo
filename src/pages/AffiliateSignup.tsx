import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
  Wrench, Users, TrendingUp, DollarSign, Shield, CheckCircle, Copy,
  Rocket, Award, Sparkles, BarChart3, Eye, Zap, Heart, CreditCard, Smartphone
} from "lucide-react";

const PRODUCTION_DOMAIN = "https://garageflow.pt";

export default function AffiliateSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState<{ id: string; code: string; link: string } | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    city: "",
  });
  const [payoutMethod, setPayoutMethod] = useState<"iban" | "mbway">("iban");
  const [payoutData, setPayoutData] = useState({
    holder_name: "",
    iban: "",
    bank: "",
    mbway_phone: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error("Nome e email são obrigatórios");
      return;
    }
    if (!form.phone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }
    if (!acceptedTerms) {
      toast.error("Tem de aceitar os termos para continuar");
      return;
    }

    // Validate payment data
    if (payoutMethod === "iban" && !payoutData.iban.trim()) {
      toast.error("IBAN é obrigatório para receber pagamentos");
      return;
    }
    if (payoutMethod === "mbway" && !payoutData.mbway_phone.trim()) {
      toast.error("Número MB WAY é obrigatório para receber pagamentos");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("affiliate-signup", {
        body: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          city: form.city,
          payout_method: payoutMethod === "iban" ? "bank_transfer" : "mbway",
          payout_holder_name: payoutData.holder_name,
          payout_iban: payoutData.iban,
          payout_mbway_phone: payoutData.mbway_phone,
          payout_bank: payoutData.bank,
        },
      });

      if (error) throw new Error(error.message || "Erro ao registar");
      if (data?.error) throw new Error(data.error);

      const partnerId = data.id;
      const affiliateCode = data.code;
      const link = `${PRODUCTION_DOMAIN}/auth?mode=signup&partner=${partnerId}`;

      setCreated({ id: partnerId, code: affiliateCode, link });
      toast.success("Registo concluído com sucesso! 🎉");
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    if (created?.link) {
      navigator.clipboard.writeText(created.link);
      toast.success("Link copiado com sucesso! 📋");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center">
              <Wrench className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Garage<span className="text-primary">Flow</span></span>
          </button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4 gap-1 px-3 py-1">
            <Sparkles className="w-3.5 h-3.5" /> Programa de Afiliados
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Torne-se parceiro <span className="text-primary">GarageFlow</span> e ganhe comissões
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Ganhe comissões automáticas por cada oficina que se registar e pagar um plano através do seu link exclusivo.
          </p>
        </div>

        {/* Commission highlight */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-10">
          <Card className="text-center border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 pb-4">
              <p className="text-3xl font-black text-primary">10%</p>
              <p className="text-sm font-semibold mt-1">Plano Pro</p>
              <p className="text-xs text-muted-foreground">49€/mês → 4,90€/mês para si</p>
            </CardContent>
          </Card>
          <Card className="text-center border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 pb-4">
              <p className="text-3xl font-black text-primary">20%</p>
              <p className="text-sm font-semibold mt-1">Plano Garage</p>
              <p className="text-xs text-muted-foreground">99€/mês → 19,80€/mês para si</p>
            </CardContent>
          </Card>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { icon: DollarSign, color: "text-primary", title: "Sem investimento", desc: "Cadastre-se grátis e comece imediatamente" },
            { icon: Zap, color: "text-amber-500", title: "Link automático", desc: "Receba o seu link exclusivo na hora" },
            { icon: BarChart3, color: "text-blue-500", title: "Rastreio total", desc: "Veja em tempo real quem entrou pelo seu link" },
            { icon: Shield, color: "text-green-500", title: "Pagamentos seguros", desc: "IBAN ou MB WAY — receba de forma simples" },
          ].map(b => (
            <Card key={b.title} className="text-center hover:shadow-md transition-shadow">
              <CardContent className="pt-6 pb-4">
                <b.icon className={`w-8 h-8 ${b.color} mx-auto mb-3`} />
                <h3 className="font-bold text-sm mb-1">{b.title}</h3>
                <p className="text-xs text-muted-foreground">{b.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Signup Form / Success */}
        <div className="max-w-lg mx-auto">
          {!created ? (
            <Card className="border-2 shadow-lg" id="signup-form">
              <CardHeader className="text-center">
                <CardTitle className="text-xl flex items-center justify-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Quero ser Afiliado
                </CardTitle>
                <CardDescription>Preencha os dados abaixo e receba o seu link exclusivo</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="af-name">Nome Completo *</Label>
                    <Input
                      id="af-name"
                      placeholder="João Silva"
                      value={form.name}
                      onChange={e => setForm({ ...form, name: e.target.value })}
                      required
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-email">Email *</Label>
                    <Input
                      id="af-email"
                      type="email"
                      placeholder="joao@exemplo.com"
                      value={form.email}
                      onChange={e => setForm({ ...form, email: e.target.value })}
                      required
                      maxLength={255}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-phone">Telefone / WhatsApp *</Label>
                    <Input
                      id="af-phone"
                      placeholder="+351 912 345 678"
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      required
                      maxLength={20}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="af-company">Empresa / Profissão</Label>
                      <Input
                        id="af-company"
                        placeholder="Opcional"
                        value={form.company}
                        onChange={e => setForm({ ...form, company: e.target.value })}
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="af-city">Cidade / País</Label>
                      <Input
                        id="af-city"
                        placeholder="Lisboa, PT"
                        value={form.city}
                        onChange={e => setForm({ ...form, city: e.target.value })}
                        maxLength={100}
                      />
                    </div>
                  </div>

                  {/* Payment Method Section */}
                  <div className="border-t pt-4 mt-2">
                    <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-primary" />
                      Dados de Pagamento
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Para recebermos as suas comissões, indique o método preferido.
                    </p>
                    
                    <div className="space-y-3">
                      <Select value={payoutMethod} onValueChange={(v: "iban" | "mbway") => setPayoutMethod(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iban">
                            <span className="flex items-center gap-2">
                              <CreditCard className="w-3.5 h-3.5" /> Transferência Bancária (IBAN)
                            </span>
                          </SelectItem>
                          <SelectItem value="mbway">
                            <span className="flex items-center gap-2">
                              <Smartphone className="w-3.5 h-3.5" /> MB WAY
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="space-y-1.5">
                        <Label>Nome do titular *</Label>
                        <Input
                          placeholder="Nome completo do titular"
                          value={payoutData.holder_name}
                          onChange={e => setPayoutData({ ...payoutData, holder_name: e.target.value })}
                          maxLength={100}
                        />
                      </div>

                      {payoutMethod === "iban" ? (
                        <>
                          <div className="space-y-1.5">
                            <Label>IBAN *</Label>
                            <Input
                              placeholder="PT50 0000 0000 0000 0000 0000 0"
                              value={payoutData.iban}
                              onChange={e => setPayoutData({ ...payoutData, iban: e.target.value })}
                              maxLength={34}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Banco (opcional)</Label>
                            <Input
                              placeholder="Ex: Millennium, CGD, Novo Banco..."
                              value={payoutData.bank}
                              onChange={e => setPayoutData({ ...payoutData, bank: e.target.value })}
                              maxLength={50}
                            />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <Label>Número MB WAY *</Label>
                          <Input
                            placeholder="912 345 678"
                            value={payoutData.mbway_phone}
                            onChange={e => setPayoutData({ ...payoutData, mbway_phone: e.target.value })}
                            maxLength={15}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox
                      id="af-terms"
                      checked={acceptedTerms}
                      onCheckedChange={(v) => setAcceptedTerms(v === true)}
                    />
                    <label htmlFor="af-terms" className="text-sm text-muted-foreground cursor-pointer leading-tight">
                      Aceito os termos do programa de afiliados e confirmo que os dados são verdadeiros.
                    </label>
                  </div>

                  <Button type="submit" className="w-full h-12 text-base" disabled={loading || !acceptedTerms}>
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Award className="w-5 h-5 mr-2" />
                        Quero ser Afiliado
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2 border-green-500/30 shadow-lg">
              <CardContent className="pt-8 pb-8 text-center space-y-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">Bem-vindo ao programa! 🎉</h2>
                  <p className="text-muted-foreground">O seu registo foi concluído com sucesso.</p>
                </div>

                {/* Affiliate Code */}
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">O seu código de afiliado</p>
                  <p className="text-2xl font-black text-primary tracking-wider">{created.code}</p>
                </div>

                {/* Affiliate Link */}
                <div className="bg-muted/50 rounded-lg p-4">
                  <Label className="text-xs text-muted-foreground mb-2 block">O seu link exclusivo de afiliado</Label>
                  <div className="flex items-center gap-2">
                    <Input value={created.link} readOnly className="text-xs font-mono" />
                    <Button onClick={copyLink} size="icon" variant="outline" className="shrink-0">
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Partilhe este link. Cada oficina que se registar e pagar gera comissão automática para si.
                  </p>
                </div>

                <Button onClick={copyLink} className="w-full gap-2" size="lg">
                  <Copy className="w-4 h-4" /> Copiar o meu Link de Afiliado
                </Button>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg p-4 text-left">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">📌 Próximos passos:</p>
                  <ul className="text-sm text-amber-700 dark:text-amber-400 space-y-1">
                    <li>1. Copie o seu link acima</li>
                    <li>2. Partilhe com oficinas que conhece</li>
                    <li>3. Quando pagarem um plano, recebe comissão automática</li>
                    <li>4. Acompanhe tudo no painel de administrador</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* How it works */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-8">Como funciona?</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Registe-se", desc: "Preencha o formulário acima — é grátis" },
              { step: "2", title: "Receba o link", desc: "Link exclusivo gerado na hora" },
              { step: "3", title: "Partilhe", desc: "Envie a oficinas que conhece" },
              { step: "4", title: "Ganhe", desc: "Comissão automática por cada plano pago" },
            ].map(item => (
              <div key={item.step} className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                  {item.step}
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6 text-center">Perguntas frequentes</h2>
          <div className="space-y-4">
            {[
              { q: "Preciso investir alguma coisa?", a: "Não. O programa é 100% gratuito. Basta registar-se e partilhar o link." },
              { q: "Quando recebo as comissões?", a: "As comissões são calculadas automaticamente quando uma oficina paga um plano. São revistas e pagas mensalmente via IBAN ou MB WAY." },
              { q: "Posso indicar qualquer oficina?", a: "Sim, desde que a oficina se registe através do seu link exclusivo e subscreva um plano pago (Pro ou Garage)." },
              { q: "Como sei que a oficina foi atribuída a mim?", a: "O sistema rastreia automaticamente cada registo feito pelo seu link. Tudo é auditado e transparente." },
              { q: "Posso alterar os dados de pagamento depois?", a: "Sim, entre em contacto com o suporte para atualizar os seus dados de pagamento a qualquer momento." },
            ].map(faq => (
              <Card key={faq.q} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-4 pb-4">
                  <p className="font-semibold text-sm mb-1">{faq.q}</p>
                  <p className="text-sm text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Footer CTA */}
        {!created && (
          <div className="mt-16 text-center pb-8">
            <Button size="lg" onClick={() => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" })} className="gap-2">
              <Heart className="w-5 h-5" /> Quero ser Afiliado — É grátis
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
