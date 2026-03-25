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
  Rocket, Award, Sparkles, BarChart3, Zap, CreditCard, Smartphone, Eye, EyeOff
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

      // Auto-login with returned session
      if (data.session?.access_token && data.session?.refresh_token) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success(t('affiliate.registrationSuccess') || "Registo concluído com sucesso! 🎉 A entrar no painel...");
        // Navigate to affiliate dashboard
        setTimeout(() => navigate("/affiliate-dashboard"), 500);
      } else {
        toast.success(t('affiliate.registrationSuccess') || "Registo concluído com sucesso! 🎉");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao registar. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LandingLayout>
      <div className="bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 md:py-12 max-w-5xl">
        {/* Hero */}
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4 gap-1 px-3 py-1">
            <Sparkles className="w-3.5 h-3.5" /> {t('affiliate.programBadge') || "Programa de Afiliados"}
          </Badge>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            {t('affiliate.heroTitle') || "Torne-se parceiro"} <span className="text-primary">GarageFlow</span> {t('affiliate.heroTitleSuffix') || "e ganhe comissões"}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('affiliate.heroSubtitle') || "Ganhe comissões automáticas por cada oficina que se registar e pagar um plano através do seu link exclusivo."}
          </p>
        </div>

        {/* Commission highlight */}
        <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-10">
          <Card className="text-center border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 pb-4">
              <p className="text-3xl font-black text-primary">10%</p>
              <p className="text-sm font-semibold mt-1">{t('affiliate.planPro') || "Plano Pro"}</p>
              <p className="text-xs text-muted-foreground">49€/mês → 4,90€/mês</p>
            </CardContent>
          </Card>
          <Card className="text-center border-2 border-primary/20 bg-primary/5">
            <CardContent className="pt-6 pb-4">
              <p className="text-3xl font-black text-primary">20%</p>
              <p className="text-sm font-semibold mt-1">{t('affiliate.planGarage') || "Plano Garage"}</p>
              <p className="text-xs text-muted-foreground">99€/mês → 19,80€/mês</p>
            </CardContent>
          </Card>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {[
            { icon: DollarSign, color: "text-primary", title: t('affiliate.benefit1Title') || "Sem investimento", desc: t('affiliate.benefit1Desc') || "Cadastre-se grátis e comece imediatamente" },
            { icon: Zap, color: "text-amber-500", title: t('affiliate.benefit2Title') || "Link automático", desc: t('affiliate.benefit2Desc') || "Receba o seu link exclusivo na hora" },
            { icon: BarChart3, color: "text-blue-500", title: t('affiliate.benefit3Title') || "Rastreio total", desc: t('affiliate.benefit3Desc') || "Veja em tempo real quem entrou pelo seu link" },
            { icon: Shield, color: "text-green-500", title: t('affiliate.benefit4Title') || "Pagamentos seguros", desc: t('affiliate.benefit4Desc') || "IBAN ou MB WAY — receba de forma simples" },
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

        {/* Signup Form */}
        <div className="max-w-lg mx-auto">
          <Card className="border-2 shadow-lg" id="signup-form">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                <Rocket className="w-5 h-5 text-primary" />
                {t('affiliate.formTitle') || "Quero ser Afiliado"}
              </CardTitle>
              <CardDescription>{t('affiliate.formSubtitle') || "Preencha os dados abaixo e entre diretamente no seu painel"}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="af-name">{t('affiliate.fullName') || "Nome Completo"} *</Label>
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
                  <Label htmlFor="af-password">{t('affiliate.password') || "Password"} *</Label>
                  <div className="relative">
                    <Input
                      id="af-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={t('affiliate.passwordPlaceholder') || "Mínimo 6 caracteres"}
                      value={form.password}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                      maxLength={72}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="af-phone">{t('affiliate.phone') || "Telefone / WhatsApp"} *</Label>
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
                    <Label htmlFor="af-company">{t('affiliate.company') || "Empresa / Profissão"}</Label>
                    <Input
                      id="af-company"
                      placeholder={t('common.optional') || "Opcional"}
                      value={form.company}
                      onChange={e => setForm({ ...form, company: e.target.value })}
                      maxLength={100}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-city">{t('affiliate.city') || "Cidade / País"}</Label>
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
                    {t('affiliate.paymentData') || "Dados de Pagamento"}
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t('affiliate.paymentDataDesc') || "Para recebermos as suas comissões, indique o método preferido."}
                  </p>
                  
                  <div className="space-y-3">
                    <Select value={payoutMethod} onValueChange={(v: "iban" | "mbway") => setPayoutMethod(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="iban">
                          <span className="flex items-center gap-2">
                            <CreditCard className="w-3.5 h-3.5" /> {t('affiliate.bankTransfer') || "Transferência Bancária (IBAN)"}
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
                      <Label>{t('affiliate.holderName') || "Nome do titular"} *</Label>
                      <Input
                        placeholder={t('affiliate.holderNamePlaceholder') || "Nome completo do titular"}
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
                          <Label>{t('affiliate.bank') || "Banco"} ({t('common.optional') || "opcional"})</Label>
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
                        <Label>{t('affiliate.mbwayNumber') || "Número MB WAY"} *</Label>
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
                    {t('affiliate.termsAccept') || "Aceito os termos do programa de afiliados e confirmo que os dados são verdadeiros."}
                  </label>
                </div>

                <Button type="submit" className="w-full h-12 text-base" disabled={loading || !acceptedTerms}>
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Award className="w-5 h-5 mr-2" />
                      {t('affiliate.submitButton') || "Criar conta e entrar no painel"}
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

        {/* How it works */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-8">{t('affiliate.howItWorks') || "Como funciona?"}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { step: "1", title: t('affiliate.step1') || "Registe-se", desc: t('affiliate.step1Desc') || "Crie conta grátis — demora 2 minutos" },
              { step: "2", title: t('affiliate.step2') || "Receba o link", desc: t('affiliate.step2Desc') || "Link exclusivo gerado na hora" },
              { step: "3", title: t('affiliate.step3') || "Partilhe", desc: t('affiliate.step3Desc') || "Envie o link a oficinas que conhece" },
              { step: "4", title: t('affiliate.step4') || "Ganhe", desc: t('affiliate.step4Desc') || "Comissão automática a cada pagamento" },
            ].map(s => (
              <div key={s.step} className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-black text-xl flex items-center justify-center mx-auto mb-3">
                  {s.step}
                </div>
                <h3 className="font-bold mb-1">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">{t('affiliate.faqTitle') || "Perguntas Frequentes"}</h2>
          <div className="space-y-4">
            {[
              { q: t('affiliate.faq1Q') || "Quanto custa ser afiliado?", a: t('affiliate.faq1A') || "Nada! O registo é 100% gratuito." },
              { q: t('affiliate.faq2Q') || "Quando recebo as comissões?", a: t('affiliate.faq2A') || "As comissões são calculadas automaticamente e pagas mensalmente via IBAN ou MB WAY." },
              { q: t('affiliate.faq3Q') || "Posso ver quantas oficinas se registaram pelo meu link?", a: t('affiliate.faq3A') || "Sim! No seu painel de afiliado, tem acesso a todas as métricas em tempo real." },
            ].map(f => (
              <Card key={f.q} className="hover:shadow-sm transition-shadow">
                <CardContent className="pt-5 pb-4">
                  <h3 className="font-semibold text-sm mb-1">{f.q}</h3>
                  <p className="text-sm text-muted-foreground">{f.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      </div>
    </LandingLayout>
  );
}
