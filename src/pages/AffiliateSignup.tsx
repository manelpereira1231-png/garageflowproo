import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { erpSupabase } from "@/integrations/supabase/realmClients";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Users, TrendingUp, DollarSign, Shield, CheckCircle, Rocket, Award, Sparkles,
  BarChart3, Zap, CreditCard, Smartphone, Eye, EyeOff, ArrowRight, Share2, Link2, Wallet,
} from "lucide-react";
import LandingLayout from "@/components/LandingLayout";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import { getCountryConfig, listActiveCountries, type CountryCode } from "@/lib/regionConfig";
import { formatMarketPrice } from "@/lib/marketPrice";

// ─── Per-country payout method config ─────────────────────
type PayoutOption = {
  value: string;
  label: string;
  icon: typeof CreditCard;
  primaryField: { key: "iban" | "mobile"; label: string; placeholder: string; maxLength: number };
  secondaryField?: { key: "bank"; label: string; placeholder: string; maxLength: number };
};

function getPayoutOptionsForCountry(code: CountryCode): PayoutOption[] {
  const c = code.toUpperCase();
  if (c === "BR") {
    return [
      { value: "pix",       label: "Pix (CPF/Email/Telefone)", icon: Smartphone,
        primaryField: { key: "mobile", label: "Chave Pix", placeholder: "CPF, email ou telefone", maxLength: 60 } },
      { value: "bank_transfer", label: "Transferência Bancária (TED)", icon: CreditCard,
        primaryField: { key: "iban", label: "Conta Bancária", placeholder: "Banco / Agência / Conta", maxLength: 60 },
        secondaryField: { key: "bank", label: "Banco", placeholder: "Itaú, Nubank, Bradesco...", maxLength: 50 } },
    ];
  }
  if (c === "IN") {
    return [
      { value: "upi", label: "UPI", icon: Smartphone,
        primaryField: { key: "mobile", label: "UPI ID", placeholder: "name@bank", maxLength: 50 } },
      { value: "bank_transfer", label: "Bank Transfer (IFSC)", icon: CreditCard,
        primaryField: { key: "iban", label: "Account No. + IFSC", placeholder: "1234567890 / SBIN0001234", maxLength: 60 },
        secondaryField: { key: "bank", label: "Bank Name", placeholder: "SBI, HDFC, ICICI...", maxLength: 50 } },
    ];
  }
  if (c === "US") {
    return [
      { value: "bank_transfer", label: "ACH Bank Transfer", icon: CreditCard,
        primaryField: { key: "iban", label: "Routing + Account", placeholder: "Routing / Account #", maxLength: 60 },
        secondaryField: { key: "bank", label: "Bank Name", placeholder: "Chase, BoA, Wells Fargo...", maxLength: 50 } },
      { value: "paypal", label: "PayPal", icon: Smartphone,
        primaryField: { key: "mobile", label: "PayPal Email", placeholder: "you@example.com", maxLength: 100 } },
    ];
  }
  if (c === "UK") {
    return [
      { value: "bank_transfer", label: "Bank Transfer (Sort Code)", icon: CreditCard,
        primaryField: { key: "iban", label: "Sort Code + Account", placeholder: "12-34-56 / 12345678", maxLength: 40 },
        secondaryField: { key: "bank", label: "Bank Name", placeholder: "Barclays, HSBC, Lloyds...", maxLength: 50 } },
    ];
  }
  // Default: EU (PT, ES, FR, DE, IT, BE, NL, AT, IE, LU, FI, GR, HU, CZ, PL, etc.) — IBAN
  if (c === "PT") {
    return [
      { value: "bank_transfer", label: "Transferência Bancária (IBAN)", icon: CreditCard,
        primaryField: { key: "iban", label: "IBAN", placeholder: "PT50 0000 0000 0000 0000 0000 0", maxLength: 34 },
        secondaryField: { key: "bank", label: "Banco", placeholder: "Millennium, CGD, Novo Banco...", maxLength: 50 } },
      { value: "mbway", label: "MB WAY", icon: Smartphone,
        primaryField: { key: "mobile", label: "Número MB WAY", placeholder: "912 345 678", maxLength: 15 } },
    ];
  }
  return [
    { value: "bank_transfer", label: "Bank Transfer (IBAN)", icon: CreditCard,
      primaryField: { key: "iban", label: "IBAN", placeholder: "Your IBAN", maxLength: 34 },
      secondaryField: { key: "bank", label: "Bank", placeholder: "Bank name", maxLength: 50 } },
  ];
}

const PHONE_PLACEHOLDERS: Record<string, string> = {
  PT: "+351 912 345 678", BR: "+55 11 91234-5678", IN: "+91 98765 43210",
  ES: "+34 612 345 678", FR: "+33 6 12 34 56 78", DE: "+49 151 12345678",
  UK: "+44 7700 900123", US: "+1 415 555 0123",
};

const CITY_PLACEHOLDERS: Record<string, string> = {
  PT: "Lisboa, PT", BR: "São Paulo, BR", IN: "Mumbai, IN",
  ES: "Madrid, ES", FR: "Paris, FR", DE: "Berlin, DE",
  UK: "London, UK", US: "New York, US",
};

export default function AffiliateSignup() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const country = getCountryConfig();
  const countryCode = country.code;
  const activeCountries = useMemo(() => listActiveCountries(), []);
  const payoutOptions = useMemo(() => getPayoutOptionsForCountry(countryCode), [countryCode]);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<string>(countryCode);
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", city: "", password: "" });
  const [payoutMethod, setPayoutMethod] = useState<string>(payoutOptions[0]?.value || "bank_transfer");
  const [payoutData, setPayoutData] = useState({ holder_name: "", iban: "", bank: "", mobile: "" });

  const currentPayoutOptions = useMemo(() => getPayoutOptionsForCountry(selectedCountry), [selectedCountry]);
  const currentPayoutOption = useMemo(
    () => currentPayoutOptions.find(o => o.value === payoutMethod) || currentPayoutOptions[0],
    [currentPayoutOptions, payoutMethod]
  );

  // Pricing display per country
  const proCommission = (country.saas.pro.monthly * 0.10);
  const garageCommission = (country.saas.garage.monthly * 0.20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim()) {
      toast.error(t('affiliate.nameEmailRequired') || "Nome e email são obrigatórios");
      return;
    }
    if (!form.phone.trim()) { toast.error(t('affiliate.phoneRequired') || "Telefone é obrigatório"); return; }
    if (!form.password || form.password.length < 6) {
      toast.error(t('affiliate.passwordMinLength') || "Password deve ter pelo menos 6 caracteres"); return;
    }
    if (!acceptedTerms) { toast.error(t('affiliate.acceptTerms') || "Tem de aceitar os termos para continuar"); return; }

    const opt = currentPayoutOption;
    const primaryVal = opt.primaryField.key === "iban" ? payoutData.iban : payoutData.mobile;
    if (!primaryVal.trim()) {
      toast.error(`${opt.primaryField.label} ${t('common.isRequired') || "é obrigatório"}`); return;
    }

    setLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/affiliate-signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": supabaseKey },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.company,
          city: form.city,
          password: form.password,
          country_code: selectedCountry,
          payout_method: payoutMethod,
          payout_holder_name: payoutData.holder_name,
          payout_iban: opt.primaryField.key === "iban" ? payoutData.iban : "",
          payout_mbway_phone: opt.primaryField.key === "mobile" ? payoutData.mobile : "",
          payout_bank: payoutData.bank,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Erro ao registar. Tente novamente.");

      if (data.session?.access_token && data.session?.refresh_token) {
        await erpSupabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success(t('affiliate.registrationSuccess') || "Registo concluído com sucesso! 🎉");
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

  const scrollToForm = () => document.getElementById("signup-form")?.scrollIntoView({ behavior: "smooth" });

  return (
    <LandingLayout>
      <div className="bg-gradient-to-br from-background via-background to-primary/5">
        <div className="container mx-auto px-4 py-10 md:py-16 max-w-5xl">

          {/* ── HERO ── */}
          <div className="text-center mb-12 md:mb-16">
            <Badge variant="secondary" className="mb-5 gap-1.5 px-4 py-1.5 text-sm">
              <Sparkles className="w-4 h-4" /> {t('affiliate.programBadge') || "Affiliate Program"}
            </Badge>
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight mb-5 leading-tight">
              {[t('affiliate.heroTitle'), t('affiliate.heroTitleSuffix')]
                .filter((s) => s && !s.includes('.'))
                .join(' ') || "Become a partner and earn commissions"}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {t('affiliate.heroSubtitle') || `Earn money recommending workshop software in ${country.name}. Automatic commissions for every workshop that signs up.`}
            </p>

            <div className="flex flex-wrap justify-center gap-3 mb-8">
              {[
                { icon: CheckCircle, text: t('affiliate.bullet1') || "No investment needed" },
                { icon: Zap, text: t('affiliate.bullet2') || "Sign up in 2 minutes" },
                { icon: TrendingUp, text: t('affiliate.bullet3') || "Automatic tracked commissions" },
              ].map((b) => (
                <span key={b.text} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
                  <b.icon className="w-4 h-4" /> {b.text}
                </span>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button size="lg" onClick={scrollToForm} className="h-14 px-8 text-base font-semibold shadow-lg">
                <Rocket className="w-5 h-5 mr-2" /> {t('affiliate.ctaStart') || "Start earning now"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => navigate("/afiliados/login")}
                className="h-14 px-6 text-base font-semibold"
              >
                {t('affiliate.haveAccount') || 'I already have an account — Sign in'}
              </Button>
            </div>
          </div>

          {/* ── COMISSÕES ── */}
          <div className="mb-14 md:mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">💰 {t('affiliate.howMuch') || "How much can you earn?"}</h2>
            <p className="text-center text-muted-foreground mb-8 text-sm">
              {t('affiliate.recurringNote') || "Earnings are recurring as long as the customer stays active."}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-lg mx-auto">
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 relative overflow-hidden">
                <div className="absolute top-3 right-3"><Badge variant="secondary" className="text-xs">Pro</Badge></div>
                <CardContent className="pt-8 pb-6 text-center">
                  <p className="text-5xl font-black text-primary mb-1">10%</p>
                  <p className="font-semibold text-base mb-2">Pro Plan</p>
                  <div className="bg-background/80 rounded-lg py-2 px-3">
                    <p className="text-sm text-muted-foreground">
                      {formatMarketPrice(country.saas.pro.monthly)}/m → <span className="font-bold text-foreground">{formatMarketPrice(proCommission)}/m</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-primary/15 relative overflow-hidden">
                <div className="absolute top-3 right-3"><Badge className="text-xs bg-primary text-primary-foreground">Garage</Badge></div>
                <CardContent className="pt-8 pb-6 text-center">
                  <p className="text-5xl font-black text-primary mb-1">20%</p>
                  <p className="font-semibold text-base mb-2">Garage Plan</p>
                  <div className="bg-background/80 rounded-lg py-2 px-3">
                    <p className="text-sm text-muted-foreground">
                      {formatMarketPrice(country.saas.garage.monthly)}/m → <span className="font-bold text-foreground">{formatMarketPrice(garageCommission)}/m</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── COMO FUNCIONA ── */}
          <div className="mb-14 md:mb-16">
            <h2 className="text-2xl font-bold text-center mb-2">🧭 {t('affiliate.howItWorks') || "How it works"}</h2>
            <p className="text-center text-muted-foreground mb-8 text-sm">
              {t('affiliate.howItWorksSubtitle') || "You don't need to sell — just share the link."}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {[
                { step: "1", icon: Users, title: t('affiliate.step1Title') || "Sign up free", desc: t('affiliate.step1Desc') || "Create your account in 2 minutes — 100% free." },
                { step: "2", icon: Link2, title: t('affiliate.step2Title') || "Get your link", desc: t('affiliate.step2Desc') || "Exclusive affiliate link generated automatically." },
                { step: "3", icon: Share2, title: t('affiliate.step3Title') || "Share", desc: t('affiliate.step3Desc') || "Send via WhatsApp, social media, or direct contacts." },
                { step: "4", icon: Wallet, title: t('affiliate.step4Title') || "Earn commissions", desc: t('affiliate.step4Desc') || "Receive automatically for every workshop that activates a plan." },
              ].map((s) => (
                <Card key={s.step} className="text-center border hover:shadow-md transition-shadow">
                  <CardContent className="pt-6 pb-5">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 relative">
                      <s.icon className="w-5 h-5 text-primary" />
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{s.step}</span>
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
              { icon: DollarSign, color: "text-primary", title: t('affiliate.benefit1Title') || "No investment", desc: t('affiliate.benefit1Desc') || "Sign up free and start immediately" },
              { icon: Zap, color: "text-amber-500", title: t('affiliate.benefit2Title') || "Auto link", desc: t('affiliate.benefit2Desc') || "Get your unique link instantly" },
              { icon: BarChart3, color: "text-blue-500", title: t('affiliate.benefit3Title') || "Full tracking", desc: t('affiliate.benefit3Desc') || "See in real time who joined via your link" },
              { icon: Shield, color: "text-green-500", title: t('affiliate.benefit4Title') || "Secure payouts", desc: t('affiliate.benefit4Desc') || "Local methods — receive easily worldwide" },
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
              <h2 className="text-2xl font-bold mb-2">🚀 {t('affiliate.createAccount') || "Create your account"}</h2>
              <p className="text-muted-foreground text-sm">
                {t('affiliate.createAccountSubtitle') || "Create your account and start earning commissions in minutes."}
              </p>
            </div>
            <Card className="border-2 shadow-lg">
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg flex items-center justify-center gap-2">
                  <Rocket className="w-5 h-5 text-primary" />
                  {t('affiliate.iWantToBe') || "I want to be an Affiliate"}
                </CardTitle>
                <CardDescription>
                  {t('affiliate.fillBelow') || "Fill in your details and access your dashboard immediately"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Country selector */}
                  <div className="space-y-1.5">
                    <Label htmlFor="af-country">{t('affiliate.country') || "Country"} *</Label>
                    <Select value={selectedCountry} onValueChange={(v) => {
                      setSelectedCountry(v);
                      const opts = getPayoutOptionsForCountry(v);
                      setPayoutMethod(opts[0]?.value || "bank_transfer");
                      setPayoutData({ holder_name: "", iban: "", bank: "", mobile: "" });
                    }}>
                      <SelectTrigger id="af-country"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {activeCountries.map(c => (
                          <SelectItem key={c.code} value={c.code}>
                            <span className="flex items-center gap-2">{c.flag} {c.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="af-name">{t('affiliate.fullName') || "Full Name"} *</Label>
                    <Input id="af-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required maxLength={100} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-email">Email *</Label>
                    <Input id="af-email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required maxLength={255} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-password">{t('affiliate.password') || "Password"} *</Label>
                    <div className="relative">
                      <Input id="af-password" type={showPassword ? "text" : "password"}
                        placeholder={t('affiliate.passwordPlaceholder') || "Min. 6 characters"}
                        value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                        required minLength={6} maxLength={72} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="af-phone">{t('affiliate.phone') || "Phone / WhatsApp"} *</Label>
                    <Input id="af-phone"
                      placeholder={PHONE_PLACEHOLDERS[selectedCountry] || "+00 000 000 000"}
                      value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })}
                      required maxLength={20} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="af-company">{t('affiliate.company') || "Company / Profession"}</Label>
                      <Input id="af-company" placeholder={t('common.optional') || "Optional"} value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} maxLength={100} />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="af-city">{t('affiliate.city') || "City / Country"}</Label>
                      <Input id="af-city"
                        placeholder={CITY_PLACEHOLDERS[selectedCountry] || "City"}
                        value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} maxLength={100} />
                    </div>
                  </div>

                  {/* Payment Method (country-aware) */}
                  <div className="border-t pt-4 mt-2">
                    <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                      <CreditCard className="w-4 h-4 text-primary" />
                      {t('affiliate.paymentData') || "Payout Details"}
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      {t('affiliate.paymentDataDesc') || "Choose how you want to receive your commissions."}
                    </p>
                    <div className="space-y-3">
                      <Select value={payoutMethod} onValueChange={(v) => setPayoutMethod(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {currentPayoutOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>
                              <span className="flex items-center gap-2">
                                <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="space-y-1.5">
                        <Label>{t('affiliate.holderName') || "Holder name"} *</Label>
                        <Input placeholder={t('affiliate.holderNamePlaceholder') || "Full holder name"}
                          value={payoutData.holder_name}
                          onChange={e => setPayoutData({ ...payoutData, holder_name: e.target.value })} maxLength={100} />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{currentPayoutOption.primaryField.label} *</Label>
                        <Input
                          placeholder={currentPayoutOption.primaryField.placeholder}
                          maxLength={currentPayoutOption.primaryField.maxLength}
                          value={currentPayoutOption.primaryField.key === "iban" ? payoutData.iban : payoutData.mobile}
                          onChange={e => setPayoutData({
                            ...payoutData,
                            [currentPayoutOption.primaryField.key === "iban" ? "iban" : "mobile"]: e.target.value,
                          })}
                        />
                      </div>
                      {currentPayoutOption.secondaryField && (
                        <div className="space-y-1.5">
                          <Label>{currentPayoutOption.secondaryField.label} ({t('common.optional') || "optional"})</Label>
                          <Input
                            placeholder={currentPayoutOption.secondaryField.placeholder}
                            maxLength={currentPayoutOption.secondaryField.maxLength}
                            value={payoutData.bank}
                            onChange={e => setPayoutData({ ...payoutData, bank: e.target.value })}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-start gap-2 pt-2">
                    <Checkbox id="af-terms" checked={acceptedTerms} onCheckedChange={(v) => setAcceptedTerms(v === true)} />
                    <label htmlFor="af-terms" className="text-sm text-muted-foreground cursor-pointer leading-tight">
                      {t('affiliate.termsAccept') || "I accept the affiliate program terms and confirm the data is true."}
                    </label>
                  </div>

                  <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading || !acceptedTerms}>
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Award className="w-5 h-5 mr-2" />
                        {t('affiliate.ctaStart') || "Start earning now"}
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    {t('affiliate.alreadyHaveAccount') || "Already have an account?"}{" "}
                    <a href="/auth" className="text-primary hover:underline font-medium">
                      {t('affiliate.loginHere') || "Log in here"}
                    </a>
                  </p>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* ── FAQ ── */}
          <div className="mt-16 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold text-center mb-8">❓ {t('affiliate.faq') || "FAQ"}</h2>
            <div className="space-y-4">
              {[
                { q: t('affiliate.faq1Q') || "How much does it cost to be an affiliate?", a: t('affiliate.faq1A') || "Nothing! Sign up is 100% free. No investment needed." },
                { q: t('affiliate.faq2Q') || "When do I get paid?", a: t('affiliate.faq2A') || "Commissions are calculated automatically and paid monthly via your chosen payout method." },
                { q: t('affiliate.faq3Q') || "Can I see how many workshops signed up via my link?", a: t('affiliate.faq3A') || "Yes! Your dashboard shows all metrics in real time." },
                { q: t('affiliate.faq4Q') || "Do I need sales experience?", a: t('affiliate.faq4A') || "No. Just share your link with workshops you know. GarageFlow does the rest." },
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
            <p className="text-lg font-semibold mb-4">{t('affiliate.readyToStart') || "Ready to start earning?"}</p>
            <Button size="lg" onClick={scrollToForm} className="h-14 px-8 text-base font-semibold shadow-lg">
              <Rocket className="w-5 h-5 mr-2" /> {t('affiliate.ctaStart') || "Start earning now"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

        </div>
      </div>
    </LandingLayout>
  );
}
