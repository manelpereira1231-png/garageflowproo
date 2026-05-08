import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Lock, User, ArrowLeft, Globe, Car, ShieldCheck, Phone, MapPin, Eye, EyeOff, Building2, Hash, Award, Percent, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MarketAuth() {
  const { language, setLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const accountParam = searchParams.get("account");
  const isDealer = accountParam === "dealer";
  const redirectParam = searchParams.get("redirect");
  const redirect = redirectParam && redirectParam.startsWith("/market") && !redirectParam.startsWith("//")
    ? redirectParam
    : (isDealer ? "/market/profile?welcome=dealer" : "/market/dashboard");

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(isDealer ? "signup" : initialMode);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  // Dealer-specific
  const [companyName, setCompanyName] = useState("");
  const [nif, setNif] = useState("");
  const [dealerLicense, setDealerLicense] = useState("");

  const slugify = (s: string) =>
    s.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60);

  const isMarketContextAccount = async (userId: string, userMetadata?: Record<string, any>) => {
    const { data: roles } = await supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", userId);

    const userRoles = (roles || []).map((role: any) => role.role);
    const hasGarageRole = userRoles.includes("garage_owner") || userRoles.includes("super_admin");
    const hasMarketRole = userRoles.includes("buyer") || userRoles.includes("seller");
    const isMarketAccount = userMetadata?.carity_user === true || userMetadata?.account_type === "particular";

    return !hasGarageRole && (hasMarketRole || isMarketAccount);
  };

  useEffect(() => {
    let active = true;

    const syncExistingSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user) return;

      const isAllowed = await isMarketContextAccount(session.user.id, session.user.user_metadata);
      if (!active) return;

      if (isAllowed) {
        navigate(redirect, { replace: true });
        return;
      }

      await supabase.auth.signOut();
    };

    void syncExistingSession();

    return () => {
      active = false;
    };
  }, [navigate, redirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Link de recuperação enviado para o seu email.");
        setMode("login");
        return;
      }

      if (mode === "login") {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        if (!signInData.user || !(await isMarketContextAccount(signInData.user.id, signInData.user.user_metadata))) {
          await supabase.auth.signOut();
          throw new Error("Esta conta pertence ao GarageFlow ERP. Entre em /auth.");
        }

        try {
          const { clearPricingCache } = await import("@/hooks/useCountryPricing");
          clearPricingCache();
        } catch {}

        toast.success("Bem-vindo de volta!");
        navigate(redirect, { replace: true });
        return;
      }

      // ---- SIGNUP ----
      if (isDealer) {
        if (!companyName.trim() || !nif.trim()) {
          throw new Error("Indique o nome do stand e o NIF.");
        }
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            owner_name: isDealer ? companyName : name,
            name: isDealer ? companyName : name,
            account_type: "particular",
            carity_user: true,
            skip_shop_creation: true,
            is_dealer: isDealer,
          },
          emailRedirectTo: window.location.origin + (isDealer ? "/market/profile?welcome=dealer" : "/market"),
        },
      });
      if (error) throw error;

      if (signUpData?.user) {
        await supabase.from("user_roles" as any).insert([
          { user_id: signUpData.user.id, role: "buyer" },
          { user_id: signUpData.user.id, role: "seller" },
        ]);
        const detectedCountry = (typeof window !== "undefined" ? localStorage.getItem("garageflow_country") : null) || "PT";

        const profilePayload: any = {
          user_id: signUpData.user.id,
          name: isDealer ? companyName : name,
          phone: phone || "",
          location: location || "",
          country_code: detectedCountry.toUpperCase(),
        };
        if (isDealer) {
          profilePayload.account_type = "dealer";
          profilePayload.dealer_company_name = companyName;
          profilePayload.dealer_nif = nif.trim();
          profilePayload.dealer_license = dealerLicense.trim() || null;
          profilePayload.dealer_slug = slugify(companyName) + "-" + Math.random().toString(36).slice(2, 6);
          profilePayload.dealer_plan = "free";
        }
        await supabase.from("carity_seller_profiles").insert(profilePayload);
      }

      // Auto sign-in (email auto-confirm enabled) so dealer goes straight to dashboard
      if (signUpData?.user && !signUpData.session) {
        const { data: signInData } = await supabase.auth.signInWithPassword({ email, password });
        if (signInData?.session) {
          toast.success(isDealer ? "Stand criado! Bem-vindo." : "Conta criada! Bem-vindo.");
          navigate(redirect, { replace: true });
          return;
        }
      } else if (signUpData?.session) {
        toast.success(isDealer ? "Stand criado! Bem-vindo." : "Conta criada! Bem-vindo.");
        navigate(redirect, { replace: true });
        return;
      }

      toast.success("Conta criada com sucesso! Verifique o seu email.");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inputClasses = "bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-400 focus:ring-amber-400/20";
  const labelClasses = "flex items-center gap-1.5 text-sm text-slate-300";

  const dealerBenefits = useMemo(() => ([
    { icon: Percent, text: "Comissão 1% (vs 3% particular)" },
    { icon: Zap, text: "Upload em massa de viaturas" },
    { icon: Award, text: "Página pública /stand/:nome com SEO" },
    { icon: ShieldCheck, text: "Inspeções por oficinas independentes" },
  ]), []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl" />
      </div>

      <div className="absolute top-4 right-4 z-10">
        <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
          <SelectTrigger className="w-[100px] h-8 text-xs bg-slate-800/80 border-slate-700 text-slate-300">
            <Globe className="w-3.5 h-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pt">Português</SelectItem>
            <SelectItem value="pt-BR">Brasileiro</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="es">Español</SelectItem>
            <SelectItem value="hi">हिन्दी</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Link
        to="/market"
        className="absolute top-4 left-4 z-10 text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Market
      </Link>

      <div className={`w-full ${isDealer ? "max-w-4xl" : "max-w-md"} relative z-10`}>
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${isDealer ? "from-amber-300 to-amber-500" : "from-amber-400 to-amber-600"} flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/20`}>
            {isDealer ? <Building2 className="w-8 h-8 text-slate-900" /> : <ShieldCheck className="w-8 h-8 text-slate-900" />}
          </div>
          <h1 className="text-2xl font-bold text-white">
            {isDealer ? <>Registo de <span className="text-amber-400">Stand</span></> : <>GarageFlow <span className="text-amber-400">Market</span></>}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {isDealer
              ? "Conta profissional para stands com comissões reduzidas e ferramentas premium"
              : mode === "signup"
              ? "Crie a sua conta para comprar e vender carros certificados"
              : mode === "forgot"
              ? "Recupere o acesso à sua conta"
              : "Aceda à sua conta de comprador ou vendedor"}
          </p>
        </div>

        <div className={`grid ${isDealer ? "md:grid-cols-[1fr,360px]" : ""} gap-6`}>
          {/* Form card */}
          <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="flex items-center gap-2 mb-6">
              {isDealer ? <Building2 className="w-5 h-5 text-amber-400" /> : <Car className="w-5 h-5 text-amber-400" />}
              <h2 className="text-lg font-semibold text-white">
                {mode === "forgot" ? "Recuperar password" : mode === "login" ? "Entrar" : isDealer ? "Criar conta de Stand" : "Criar conta"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <>
                  {isDealer ? (
                    <>
                      <div className="space-y-1.5">
                        <Label className={labelClasses}>
                          <Building2 className="w-3.5 h-3.5" /> Nome do Stand / Empresa
                        </Label>
                        <Input
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          required
                          maxLength={120}
                          placeholder="Auto Stand Lisboa, Lda."
                          className={inputClasses}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className={labelClasses}>
                            <Hash className="w-3.5 h-3.5" /> NIF / Contribuinte
                          </Label>
                          <Input
                            value={nif}
                            onChange={(e) => setNif(e.target.value)}
                            required
                            maxLength={20}
                            placeholder="500000000"
                            className={inputClasses}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className={labelClasses}>
                            <Award className="w-3.5 h-3.5" /> Nº Licença IMT (opcional)
                          </Label>
                          <Input
                            value={dealerLicense}
                            onChange={(e) => setDealerLicense(e.target.value)}
                            placeholder="Ex: 12345/CE"
                            className={inputClasses}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className={labelClasses}>
                            <Phone className="w-3.5 h-3.5" /> Telefone
                          </Label>
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 9XX..." className={inputClasses} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className={labelClasses}>
                            <MapPin className="w-3.5 h-3.5" /> Localização
                          </Label>
                          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lisboa, Porto..." className={inputClasses} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="space-y-1.5">
                        <Label className={labelClasses}>
                          <User className="w-3.5 h-3.5" /> Nome completo
                        </Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} placeholder="O seu nome" className={inputClasses} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className={labelClasses}>
                            <Phone className="w-3.5 h-3.5" /> Telefone
                          </Label>
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+351 9XX..." className={inputClasses} />
                        </div>
                        <div className="space-y-1.5">
                          <Label className={labelClasses}>
                            <MapPin className="w-3.5 h-3.5" /> Localização
                          </Label>
                          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Lisboa, Porto..." className={inputClasses} />
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}

              <div className="space-y-1.5">
                <Label className={labelClasses}>
                  <Mail className="w-3.5 h-3.5" /> Email {isDealer && mode === "signup" && <span className="text-slate-500">(profissional)</span>}
                </Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} placeholder="email@exemplo.com" className={inputClasses} />
              </div>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label className={labelClasses}>
                    <Lock className="w-3.5 h-3.5" /> Password
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      maxLength={100}
                      placeholder="••••••"
                      className={`${inputClasses} pr-10`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "login" && (
                <div className="text-right">
                  <button type="button" onClick={() => setMode("forgot")} className="text-xs text-amber-400 hover:underline">
                    Esqueceu a password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-11 font-semibold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-900 shadow-lg shadow-amber-500/20"
                disabled={loading}
              >
                {loading
                  ? "A processar..."
                  : mode === "forgot"
                  ? "Enviar link de recuperação"
                  : mode === "login"
                  ? "Entrar no Market"
                  : isDealer
                  ? "Criar conta de Stand"
                  : "Criar conta gratuita"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm">
              {mode === "forgot" ? (
                <button onClick={() => setMode("login")} className="text-amber-400 hover:underline flex items-center gap-1 mx-auto">
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
                </button>
              ) : mode === "login" ? (
                <p className="text-slate-400">
                  Ainda não tem conta?{" "}
                  <button onClick={() => setMode("signup")} className="text-amber-400 hover:underline font-medium">
                    Criar conta
                  </button>
                </p>
              ) : (
                <p className="text-slate-400">
                  Já tem conta?{" "}
                  <button onClick={() => setMode("login")} className="text-amber-400 hover:underline font-medium">
                    Entrar
                  </button>
                  {isDealer && (
                    <>
                      {" "}·{" "}
                      <Link to="/market/auth?mode=signup" className="text-slate-400 hover:text-amber-400 hover:underline">
                        Sou particular
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>

          {/* Dealer benefits panel */}
          {isDealer && (
            <aside className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl p-6 space-y-4 h-fit">
              <div>
                <h3 className="text-white font-semibold text-base mb-1">Regalias para Stands</h3>
                <p className="text-xs text-slate-400">Vantagens exclusivas para profissionais</p>
              </div>
              <ul className="space-y-3">
                {dealerBenefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-slate-300">
                    <b.icon className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    <span>{b.text}</span>
                  </li>
                ))}
              </ul>
              <div className="pt-4 border-t border-amber-500/10 space-y-2">
                <p className="text-xs text-slate-400 font-medium">Planos disponíveis após registo:</p>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300"><span>Starter</span><span className="text-amber-400 font-semibold">39€/mês · 10 carros</span></div>
                  <div className="flex justify-between text-slate-300"><span>Pro</span><span className="text-amber-400 font-semibold">99€/mês · 30 carros</span></div>
                  <div className="flex justify-between text-slate-300"><span>Unlimited</span><span className="text-amber-400 font-semibold">249€/mês · ilimitado</span></div>
                </div>
              </div>
              <div className="flex items-start gap-2 text-[11px] text-slate-400 bg-slate-900/40 rounded-lg p-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <span>Inspeções obrigatórias por oficinas independentes — anti-fraude garantido.</span>
              </div>
            </aside>
          )}
        </div>

        <div className="mt-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-amber-400/60" /> Inspeções certificadas
            </span>
            <span>•</span>
            <span>Pagamento seguro</span>
            <span>•</span>
            <span>Garantia incluída</span>
          </div>
          {!isDealer && (
            <p className="text-xs text-slate-600">
              É um stand?{" "}
              <Link to="/market/auth?mode=signup&account=dealer" className="text-amber-400 hover:underline font-medium">
                Registar como Stand →
              </Link>
            </p>
          )}
          <p className="text-xs text-slate-600">
            Tem uma oficina?{" "}
            <Link to="/auth?mode=signup" className="text-primary hover:underline">
              Registe-se no GarageFlow ERP →
            </Link>
          </p>

          <nav className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-3 border-t border-slate-800">
            <Link to="/legal/privacy" className="hover:text-amber-400 transition-colors">Privacidade</Link>
            <span>·</span>
            <Link to="/legal/terms" className="hover:text-amber-400 transition-colors">Termos</Link>
            <span>·</span>
            <Link to="/legal/market-terms" className="hover:text-amber-400 transition-colors">Termos Market</Link>
            <span>·</span>
            <Link to="/legal/cookies" className="hover:text-amber-400 transition-colors">Cookies</Link>
            <span>·</span>
            <Link to="/legal/dpa" className="hover:text-amber-400 transition-colors">DPA</Link>
            <span>·</span>
            <Link to="/legal/my-data" className="hover:text-amber-400 transition-colors">Os Meus Dados</Link>
            <span>·</span>
            <Link to="/support?context=market" className="text-amber-400 hover:text-amber-300 font-medium transition-colors">Suporte</Link>
          </nav>
        </div>
      </div>
    </div>
  );
}
