import { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldCheck, Mail, Lock, User, Phone, MapPin, ArrowLeft, Loader2 } from "lucide-react";

export default function CarityAuth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = searchParams.get("redirect") || "/carity/meus-anuncios";
  const initialMode = searchParams.get("mode") === "signup" ? "signup" : "login";

  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de recuperação enviado! Verifique a sua caixa de entrada.");
        setMode("login");
      } else if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta ao Carity!");
        navigate(redirect);
      } else {
        // Signup
        if (!name.trim()) {
          toast.error("Preencha o seu nome");
          setLoading(false);
          return;
        }

        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { name, carity_user: true },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;

        // Create seller profile if we have the user
        if (signUpData?.user) {
          await supabase.from("carity_seller_profiles").insert({
            user_id: signUpData.user.id,
            name,
            phone: phone || "",
            location: location || "",
          });
        }

        toast.success("Conta criada com sucesso! Verifique o seu email para confirmar.");
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Nav */}
      <nav className="bg-slate-900 border-b border-slate-800 text-white px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link to="/carity" className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-amber-400" />
            <span className="text-xl font-bold">Carity</span>
          </Link>
          <Link to="/carity">
            <Button variant="ghost" size="sm" className="text-slate-300 hover:bg-slate-800">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
          </Link>
        </div>
      </nav>

      <div className="max-w-md mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/20">
            <ShieldCheck className="w-7 h-7 text-slate-900" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            {mode === "forgot" ? "Recuperar Palavra-passe" : mode === "login" ? "Entrar no Carity" : "Criar Conta Carity"}
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            {mode === "forgot"
              ? "Enviaremos um link de recuperação para o seu email"
              : mode === "login"
              ? "Aceda à sua conta de vendedor ou comprador"
              : "Crie a sua conta para comprar ou vender carros"}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm text-slate-300">
                    <User className="w-3.5 h-3.5" /> Nome completo *
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="O seu nome"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm text-slate-300">
                    <Phone className="w-3.5 h-3.5" /> Telefone
                  </Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+351 9XX XXX XXX"
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm text-slate-300">
                    <MapPin className="w-3.5 h-3.5" /> Localização
                  </Label>
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Lisboa, Porto..."
                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm text-slate-300">
                <Mail className="w-3.5 h-3.5" /> Email *
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="email@exemplo.com"
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
              />
            </div>

            {mode !== "forgot" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm text-slate-300">
                  <Lock className="w-3.5 h-3.5" /> Palavra-passe *
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••"
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
              </div>
            )}

            {mode === "login" && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-amber-400 hover:underline"
                >
                  Esqueceu a palavra-passe?
                </button>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {mode === "forgot"
                ? "Enviar link de recuperação"
                : mode === "login"
                ? "Entrar"
                : "Criar conta"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === "forgot" ? (
              <button
                onClick={() => setMode("login")}
                className="text-amber-400 hover:underline flex items-center gap-1 mx-auto"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao login
              </button>
            ) : mode === "login" ? (
              <button
                onClick={() => setMode("signup")}
                className="text-amber-400 hover:underline"
              >
                Não tem conta? Criar agora
              </button>
            ) : (
              <button
                onClick={() => setMode("login")}
                className="text-amber-400 hover:underline"
              >
                Já tem conta? Entrar
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          O Carity é um serviço de{" "}
          <Link to="/" className="text-amber-400 hover:underline">
            GarageFlow
          </Link>
        </p>
      </div>
    </div>
  );
}