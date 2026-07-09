import { useState, useEffect, useMemo } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { marketSupabase } from "@/integrations/supabase/realmClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Lock, User, ArrowLeft, Globe, Car, ShieldCheck, Phone, MapPin, Eye, EyeOff, Building2, Hash, Award, Percent, Zap, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { getUserAccessProfile } from "@/lib/authRealm";
import { ensureSignupAllowed } from "@/lib/signupGuard";

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
    : (isDealer ? "/market/dealer-dashboard" : "/market/dashboard");

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
    const { data: { user } } = await marketSupabase.auth.getUser();
    if (!user || user.id !== userId) return false;
    return (await getUserAccessProfile(user)).isMarketUser;
  };

  useEffect(() => {
    let active = true;

    const syncExistingSession = async () => {
      const { data: { session } } = await marketSupabase.auth.getSession();
      if (!active || !session?.user) return;

      const isAllowed = await isMarketContextAccount(session.user.id, session.user.user_metadata);
      if (!active) return;

      if (isAllowed) {
        navigate(redirect, { replace: true });
        return;
      }
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
        const { error } = await marketSupabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password?realm=market`,
        });
        if (error) throw error;
        toast.success("Se este email existir, enviaremos um link de recuperação. Verifique a caixa de entrada e a pasta de spam.");
        setMode("login");
        return;
      }

      if (mode === "login") {
        const { data: signInData, error } = await marketSupabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Lote A: contas unificadas. Uma oficina que activou o Market pode
        // fazer login aqui com a mesma conta. Só rejeita se for uma conta
        // ERP-only que ainda NÃO activou o Market (sem role buyer/seller).
        if (!signInData.user) throw new Error("Falha no login.");
        const { data: { user } } = await marketSupabase.auth.getUser();
        const profile = user ? await getUserAccessProfile(user) : null;
        if (!profile?.isMarketUser) {
          throw new Error(
            "Esta conta ainda não tem acesso ao Marketplace. Entre no ERP e active o Marketplace em Definições, ou registe-se aqui como particular."
          );
        }

        try {
          const { clearPricingCache } = await import("@/hooks/useCountryPricing");
          clearPricingCache();
        } catch {}

        toast.success("Bem-vindo de volta!");
        import("@/lib/trackEvent").then(({ trackEvent }) => trackEvent("login", { realm: "market" }));
        navigate(redirect, { replace: true });
        return;

      }

      // ---- SIGNUP ----
      if (isDealer) {
        if (!companyName.trim() || !nif.trim()) {
          throw new Error("Indique o nome do stand e o NIF.");
        }
        const cleanNif = nif.trim().toUpperCase().replace(/\s+/g, "");
        // Basic shape: PT NIFs are 9 digits; allow alphanumeric for other countries (max 20)
        if (cleanNif.length < 8 || cleanNif.length > 20) {
          throw new Error("NIF inválido. Verifique o número do contribuinte.");
        }
        // Anti-fraud: block duplicate NIF across the platform
        const { data: nifOk, error: nifErr } = await supabase.rpc("dealer_nif_available" as any, { _nif: cleanNif });
        if (nifErr) throw new Error("Não foi possível validar o NIF. Tente novamente.");
        if (nifOk === false) {
          throw new Error("Este NIF já está registado por outro Stand. Se acredita que é um erro, contacte o suporte.");
        }
      }

      // Anti-flood: server-side rate limit by IP and email
      await ensureSignupAllowed(email, "market");

      const { data: signUpData, error } = await marketSupabase.auth.signUp({
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
          emailRedirectTo: window.location.origin + (isDealer ? "/market/dealer-dashboard" : "/market"),
        },
      });
      if (error) throw error;

      if (signUpData?.user) {
        import("@/lib/trackEvent").then(({ trackEvent }) => trackEvent("signup", { realm: "market", account_type: isDealer ? "dealer" : "particular" }));
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

      if (signUpData?.session) {
        toast.success(isDealer ? "Stand criado! Bem-vindo." : "Conta criada! Bem-vindo.");
        navigate(redirect, { replace: true });
        return;
      }

      toast.success("Confirme o seu email para ativar a conta. Verifique a caixa de entrada (e spam).", { duration: 8000 });
      setMode("login");
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
    <div className={`min-h-screen flex items-center justify-center p-4 relative overflow-hidden ${
      isDealer
        ? "bg-zinc-950"
        : "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
    }`}>
      {/* Background — distinct per account type */}
      <div className="absolute inset-0 pointer-events-none">
        {isDealer ? (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(245,158,11,0.10),transparent_45%),radial-gradient(circle_at_85%_85%,rgba(234,179,8,0.08),transparent_45%)]" />
            <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "repeating-linear-gradient(135deg, transparent 0 14px, rgba(245,158,11,0.6) 14px 15px)" }} />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent" />
          </>
        ) : (
          <>
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl" />
          </>
        )}
      </div>

      {/* Top bar with account-type badge for clarity */}
      {isDealer && (
        <div className="absolute top-0 inset-x-0 z-10 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-zinc-900 py-1.5 text-center text-[11px] font-bold tracking-[0.25em] uppercase shadow-lg">
          <Award className="inline w-3 h-3 mr-1.5 -mt-0.5" /> Conta Profissional · Stand · Comissão 1%
        </div>
      )}

      <div className={`absolute ${isDealer ? "top-10" : "top-4"} right-4 z-10`}>
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
        to={isDealer ? "/market" : "/market"}
        className={`absolute ${isDealer ? "top-10" : "top-4"} left-4 z-10 text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors`}
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Market
      </Link>

      <div className={`w-full ${isDealer ? "max-w-5xl mt-8" : "max-w-md"} relative z-10`}>
        <div className="text-center mb-8">
          {isDealer ? (
            <>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 mb-4">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[11px] font-semibold text-amber-300 tracking-wider uppercase">Onboarding Profissional</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Regista o teu <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-amber-500">Stand</span>
              </h1>
              <p className="text-slate-400 text-sm mt-2 max-w-xl mx-auto">
                Conta empresarial dedicada — fora do fluxo dos vendedores particulares. Ferramentas de inventário, página pública SEO e comissões reduzidas.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-amber-500/20">
                <ShieldCheck className="w-8 h-8 text-slate-900" />
              </div>
              <h1 className="text-2xl font-bold text-white">
                GarageFlow <span className="text-amber-400">Market</span>
              </h1>
              <p className="text-slate-400 text-sm mt-1">
                {mode === "signup"
                  ? "Crie a sua conta para comprar e vender carros certificados"
                  : mode === "forgot"
                  ? "Recupere o acesso à sua conta"
                  : "Aceda à sua conta de comprador ou vendedor"}
              </p>
            </>
          )}
        </div>

        <div className={`grid ${isDealer ? "md:grid-cols-[1fr,380px]" : ""} gap-6`}>
          {/* Form card */}
          <div className={`${isDealer ? "bg-zinc-900/90 border-amber-500/15" : "bg-slate-900/80 border-slate-800"} backdrop-blur-sm border rounded-2xl p-6 shadow-2xl`}>
            <div className="flex items-center gap-2 mb-6">
              {isDealer ? <Building2 className="w-5 h-5 text-amber-400" /> : <Car className="w-5 h-5 text-amber-400" />}
              <h2 className="text-lg font-semibold text-white">
                {mode === "forgot" ? "Recuperar password" : mode === "login" ? "Entrar" : isDealer ? "Dados do Stand" : "Criar conta"}
              </h2>
              {isDealer && mode === "signup" && (
                <span className="ml-auto text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">B2B</span>
              )}
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
            <button
              type="button"
              onClick={() => { window.location.href = "/auth?mode=signup"; }}
              className="text-primary hover:underline font-medium"
            >
              Registe-se no GarageFlow ERP →
            </button>
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
