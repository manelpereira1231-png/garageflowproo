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
import {
  Users, TrendingUp, DollarSign, Shield, CheckCircle, Copy,
  Rocket, Award, Sparkles, BarChart3, Zap, CreditCard, Smartphone, Eye, EyeOff,
  ArrowRight, Share2, Link2, Wallet
} from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const PRODUCTION_DOMAIN = "https://garageflow.pt";

export default function AffiliateSignup() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    city: "",
    password: "",
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
      toast.error(t('affiliate.nameEmailRequired') || "Nome e email são obrigatórios");
      return;
    }
    if (!form.phone.trim()) {
      toast.error(t('affiliate.phoneRequired') || "Telefone é obrigatório");
      return;
    }
    if (!form.password || form.password.length < 6) {
      toast.error(t('affiliate.passwordMinLength') || "Password deve ter pelo menos 6 caracteres");
      return;
    }
    if (!acceptedTerms) {
      toast.error(t('affiliate.acceptTerms') || "Tem de aceitar os termos para continuar");
      return;
    }
    if (payoutMethod === "iban" && !payoutData.iban.trim()) {
      toast.error(t('affiliate.ibanRequired') || "IBAN é obrigatório para receber pagamentos");
      return;
    }
    if (payoutMethod === "mbway" && !payoutData.mbway_phone.trim()) {
      toast.error(t('affiliate.mbwayRequired') || "Número MB WAY é obrigatório para receber pagamentos");
      return;
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/affiliate-signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": supabaseKey,
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          city: form.city,
          password: form.password,
          payout_method: payoutMethod === "iban" ? "bank_transfer" : "mbway",
          payout_holder_name: payoutData.holder_name,
          payout_iban: payoutData.iban,
          payout_mbway_phone: payoutData.mbway_phone,
          payout_bank: payoutData.bank,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Erro ao registar. Tente novamente.");
      }

      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success(t('affiliate.registrationSuccess') || "Registo concluído com sucesso! 🎉 A entrar no painel...");
        setTimeout(() => navigate("/affiliate-dashboard"), 500);
      } else {
        toast.success(t('affiliate.registrationSuccess') || "Registo concluído com sucesso! 🎉");
      }
    } catch (err: any) {
      toast.error(err.message || t('error.generic'));
    } finally {
      setLoading(false);
    }
  };

  const scrollToForm = () => {
    document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <LandingLayout>
      <div className="bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-10 md:py-16 max-w-5xl">

          {/* ── HERO ── */}
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-5 gap-1.5 px-4 py-1.5 text-sm">
              <Sparkles className="w-4 h-4" /> Programa de Afiliados
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 leading-tight">
              Programa de Afiliados <span className="text-primary">GarageFlow</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Ganhe dinheiro recomendando software para oficinas em Portugal.
              <br className="hidden sm:block" />
              Comissões automáticas por cada oficina que se registar e ativar um plano através do seu link exclusivo.
            </p>

            {/* Hero bullets */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {[
                { icon: CheckCircle, text: "Sem investimento" },
                { icon: Zap, text: "Registo em 2 minutos" },
                { icon: TrendingUp, text: "Comissões automáticas e rastreadas" },
              ].map((b) => (
                <span key={b.text} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
                  <b.icon className="w-4 h-4" /> {b.text}
                </span>
              ))}
            </div>

            <Button size="lg" onClick={scrollToForm} className="h-14 px-8 text-base font-semibold shadow-lg">
              <Rocket className="w-5 h-5 mr-2" /> Quero começar a ganhar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* ── COMISSÕES ── */}
          <div className="mb-14 md:mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">💰 Quanto pode ganhar?</h2>
            <p className="text-center text-muted-foreground mb-8 text-sm">
              Os ganhos são recorrentes enquanto o cliente se mantiver ativo.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg mx-auto">
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="text-xs">Pro</Badge>
                </div>
                <CardContent className="pt-8 pb-6 text-center">
                  <p className="text-5xl font-black text-primary mb-1">10%</p>
                  <p className="font-semibold text-base mb-2">Plano Pro</p>
                  <div className="bg-background/80 rounded-lg py-2 px-3">
                    <p className="text-sm text-muted-foreground">49€/mês → <span className="font-bold text-foreground">4,90€/mês</span> por oficina</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/15 relative overflow-hidden">
                <div className="absolute top-3 right-3">
                  <Badge className="text-xs bg-primary text-primary-foreground">Garage</Badge>
                </div>
                <CardContent className="pt-8 pb-6 text-center">
                  <p className="text-5xl font-black text-primary mb-1">20%</p>
                  <p className="font-semibold text-base mb-2">Plano Garage</p>
                  <div className="bg-background/80 rounded-lg py-2 px-3">
                    <p className="text-sm text-muted-foreground">99€/mês → <span className="font-bold text-foreground">19,80€/mês</span> por oficina</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── COMO FUNCIONA ── */}
          <div className="mb-14 md:mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">🧭 Como funciona?</h2>
            <p className="text-center text-muted-foreground mb-8 text-sm">
              Não precisa de vender — apenas partilhar o link.
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { step: "1", icon: Users, title: "Registe-se gratuitamente", desc: "Crie a sua conta em 2 minutos — é 100% grátis." },
                { step: "2", icon: Link2, title: "Receba o seu link", desc: "Link de afiliado exclusivo gerado automaticamente." },
                { step: "3", icon: Share2, title: "Partilhe", desc: "Envie via WhatsApp, redes sociais ou contactos diretos." },
                { step: "4", icon: Wallet, title: "Ganhe comissões", desc: "Receba automaticamente por cada oficina que ativar um plano." },
              ].map((s) => (
                <Card key={s.step} className="text-center border hover:shadow-md transition-shadow">
                  <CardContent className="pt-6 pb-5">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 relative">
                      <s.icon className="w-5 h-5 text-primary" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                        {s.step}
                      </span>
                    </div>
                    <h3 className="font-bold text-sm mb-1">{s.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ── BENEFÍCIOS ── */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-14 md:mb-16">
            {[
              { icon: DollarSign, color: "text-primary", title: "Sem investimento", desc: "Cadastre-se grátis e comece imediatamente" },
              { icon: Zap, color: "text-amber-500", title: "Link automático", desc: "Receba o seu link exclusivo na hora" },
              { icon: BarChart3, color: "text-blue-500", title: "Rastreio total", desc: "Veja em tempo real quem entrou pelo seu link" },
              { icon: Shield, color: "text-green-500", title: "Pagamentos seguros", desc: "IBAN ou MB WAY — receba de forma simples" },
            ].map((b) => (
              <Card key={b.title} className="text-center hover:shadow-md transition-shadow">
                <CardContent className="pt-6 pb-4">
                  <b.icon className={`w-8 h-8 ${b.color} mx-auto mb-3`} />
                  <h3 className="font-bold text-sm mb-1">{b.title}</h3>
                  <p className="text-xs text-muted-foreground">{b.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── FORMULÁRIO ── */}
          <div className="max-w-lg mx-auto" id="signup-form">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">🚀 Crie a sua conta</h2>
              <p className="text-muted-foreground text-sm">
                Crie a sua conta e comece a ganhar comissões em minutos.
              </p>
            </div>
            <Card className="border-2 shadow-lg">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  Quero ser Afiliado
                </CardTitle>
                <CardDescription>Preencha os dados abaixo e entre diretamente no seu painel</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="af-name">{t('affiliate.fullName') || "Nome Completo"} *</Label>
                    <Input id="af-name" placeholder="João Silva" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required maxLength={100} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-email">Email *</Label>
                    <Input id="af-email" type="email" placeholder="joao@exemplo.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required maxLength={255} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-password">{t('affiliate.password') || "Password"} *</Label>
                    <div className="relative">
                      <Input id="af-password" type={showPassword ? "text" : "password"} placeholder={t('affiliate.passwordPlaceholder') || "Mínimo 6 caracteres"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} maxLength={72} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-phone">{t('affiliate.phone') || "Telefone / WhatsApp"} *</Label>
                    <Input id="af-phone" placeholder="+351 912 345 678" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} required maxLength={20} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="af-company">{t('affiliate.company') || "Empresa / Profissão"}</Label>
                      <Input id="af-company" placeholder={t('common.optional') || "Opcional"} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} maxLength={100} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="af-city">{t('affiliate.city') || "Cidade / País"}</Label>
                      <Input id="af-city" placeholder="Lisboa, PT" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} maxLength={100} />
                    </div>
                  </div>

                  {/* Payment Method */}
                  <div className="border-t pt-4 mt-2">
                    <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-primary" />
                      {t('affiliate.paymentData') || "Dados de Pagamento"}
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      {t('affiliate.paymentDataDesc') || "Para recebermos as suas comissões, indique o método preferido."}
                    </p>
                    <div className="space-y-3">
                      <Select value={payoutMethod} onValueChange={(v: "iban" | "mbway") => setPayoutMethod(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iban">
                            <span className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5" /> Transferência Bancária (IBAN)</span>
                          </SelectItem>
                          <SelectItem value="mbway">
                            <span className="flex items-center gap-2"><Smartphone className="w-3.5 h-3.5" /> MB WAY</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="space-y-1.5">
                        <Label>{t('affiliate.holderName') || "Nome do titular"} *</Label>
                        <Input placeholder={t('affiliate.holderNamePlaceholder') || "Nome completo do titular"} value={payoutData.holder_name} onChange={e => setPayoutData({ ...payoutData, holder_name: e.target.value })} maxLength={100} />
                      </div>
                      {payoutMethod === "iban" ? (
                        <>
                          <div className="space-y-1.5">
                            <Label>IBAN *</Label>
                            <Input placeholder="PT50 0000 0000 0000 0000 0000 0" value={payoutData.iban} onChange={e => setPayoutData({ ...payoutData, iban: e.target.value })} maxLength={34} />
                          </div>
                          <div className="space-y-1.5">
                            <Label>{t('affiliate.bank') || "Banco"} ({t('common.optional') || "opcional"})</Label>
                            <Input placeholder="Ex: Millennium, CGD, Novo Banco..." value={payoutData.bank} onChange={e => setPayoutData({ ...payoutData, bank: e.target.value })} maxLength={50} />
                          </div>
                        </>
                      ) : (
                        <div className="space-y-1.5">
                          <Label>{t('affiliate.mbwayNumber') || "Número MB WAY"} *</Label>
                          <Input placeholder="912 345 678" value={payoutData.mbway_phone} onChange={e => setPayoutData({ ...payoutData, mbway_phone: e.target.value })} maxLength={15} />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox id="af-terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(v === true)} />
                    <label htmlFor="af-terms" className="text-sm text-muted-foreground cursor-pointer leading-tight">
                      {t('affiliate.termsAccept') || "Aceito os termos do programa de afiliados e confirmo que os dados são verdadeiros."}
                    </label>
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading || !acceptedTerms}>
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Award className="w-5 h-5 mr-2" />
                        Quero começar a ganhar
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {t('affiliate.alreadyHaveAccount') || "Já tem conta?"}{" "}
                    <a href="/auth" className="text-primary hover:underline font-medium">
                      {t('affiliate.loginHere') || "Faça login aqui"}
                    </a>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── FAQ ── */}
          <div className="mt-16 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">❓ Perguntas Frequentes</h2>
            <div className="space-y-4">
              {[
                { q: "Quanto custa ser afiliado?", a: "Nada! O registo é 100% gratuito. Não precisa de investir nada para começar." },
                { q: "Quando recebo as comissões?", a: "As comissões são calculadas automaticamente e pagas mensalmente via IBAN ou MB WAY." },
                { q: "Posso ver quantas oficinas se registaram pelo meu link?", a: "Sim! No seu painel de afiliado, tem acesso a todas as métricas em tempo real." },
                { q: "Preciso de experiência em vendas?", a: "Não. Basta partilhar o seu link com oficinas que conhece. O GarageFlow faz o resto." },
              ].map((f) => (
                <Card key={f.q} className="hover:shadow-sm transition-shadow">
                  <CardContent className="pt-5 pb-4">
                    <h3 className="font-semibold text-sm mb-1">{f.q}</h3>
                    <p className="text-sm text-muted-foreground">{f.a}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* ── CTA FINAL ── */}
          <div className="mt-16 text-center pb-8">
            <p className="text-lg font-semibold mb-4">Pronto para começar a ganhar?</p>
            <Button size="lg" onClick={scrollToForm} className="h-14 px-8 text-base font-semibold shadow-lg">
              <Rocket className="w-5 h-5 mr-2" /> Quero começar a ganhar
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

        </div>
      </div>
    </LandingLayout>
  );
}
