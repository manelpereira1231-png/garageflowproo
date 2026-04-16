import { useState, useEffect } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Lock, User, ArrowLeft, Globe, Car, ShieldCheck, Phone, MapPin, Wrench, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

export default function MarketAuth() {
  const { language, setLanguage } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const redirectParam = searchParams.get("redirect");
  const redirect = redirectParam && redirectParam.startsWith("/market") && !redirectParam.startsWith("//")
    ? redirectParam
    : "/market/dashboard";

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

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

        toast.success("Bem-vindo de volta!");
        navigate(redirect, { replace: true });
        return;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            owner_name: name,
            name,
            account_type: "particular",
            carity_user: true,
            skip_shop_creation: true,
          },
          emailRedirectTo: window.location.origin + "/market",
        },
      });
      if (error) throw error;

      if (signUpData?.user) {
        await supabase.from("user_roles" as any).insert([
          { user_id: signUpData.user.id, role: "buyer" },
          { user_id: signUpData.user.id, role: "seller" },
        ]);
        await supabase.from("carity_seller_profiles").insert({
          user_id: signUpData.user.id,
          name,
          phone: phone || "",
          location: location || "",
        });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-amber-400/5 rounded-full blur-3xl" />
      </div>

      {/* Language selector */}
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
          </SelectContent>
        </Select>
      </div>

      {/* Back to market */}
      <Link
        to="/market"
        className="absolute top-4 left-4 z-10 text-xs flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao Market
      </Link>

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
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
        </div>

        {/* Form card */}
        <div className="bg-slate-900/80 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <Car className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">
              {mode === "forgot"
                ? "Recuperar password"
                : mode === "login"
                ? "Entrar"
                : "Criar conta"}
            </h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label className={labelClasses}>
                    <User className="w-3.5 h-3.5" /> Nome completo
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={100}
                    placeholder="O seu nome"
                    className={inputClasses}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className={labelClasses}>
                      <Phone className="w-3.5 h-3.5" /> Telefone
                    </Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+351 9XX..."
                      className={inputClasses}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className={labelClasses}>
                      <MapPin className="w-3.5 h-3.5" /> Localização
                    </Label>
                    <Input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Lisboa, Porto..."
                      className={inputClasses}
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className={labelClasses}>
                <Mail className="w-3.5 h-3.5" /> Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                maxLength={255}
                placeholder="email@exemplo.com"
                className={inputClasses}
              />
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
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-amber-400 hover:underline"
                >
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
                : "Criar conta gratuita"}
            </Button>
          </form>

          {/* Mode toggle */}
          <div className="mt-5 text-center text-sm">
            {mode === "forgot" ? (
              <button
                onClick={() => setMode("login")}
                className="text-amber-400 hover:underline flex items-center gap-1 mx-auto"
              >
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
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
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
          <p className="text-xs text-slate-600">
            Tem uma oficina?{" "}
            <Link to="/auth?mode=signup" className="text-primary hover:underline">
              Registe-se no GarageFlow ERP →
            </Link>
          </p>
          <p className="text-xs text-slate-600">
            GarageFlow Market é um serviço de{" "}
            <Link to="/" className="text-amber-400/60 hover:underline">
              GarageFlow
            </Link>
          </p>

          {/* Legal links */}
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
