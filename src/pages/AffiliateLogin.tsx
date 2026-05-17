import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { erpSupabase } from "@/integrations/supabase/realmClients";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles, Mail, Lock, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import LandingLayout from "@/components/LandingLayout";

/**
 * Dedicated login page for affiliates.
 * Affiliates created through /afiliados already have a real auth.users
 * account (via the `affiliate-signup` edge function) — they can sign in
 * here from ANY device using the same email + password they registered with.
 *
 * After successful login, App.tsx detects `isAffiliate` from partners table
 * and routes to /affiliate-dashboard automatically.
 */
export default function AffiliateLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Indica o teu email");
      return;
    }
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await erpSupabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Email de recuperação enviado. Verifica a tua caixa de entrada.");
        setMode("login");
        return;
      }

      const { data, error } = await erpSupabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error("Login falhou");

      // Verify this user is actually a registered affiliate
      const { data: partner } = await supabase
        .from("partners")
        .select("id")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (!partner) {
        await erpSupabase.auth.signOut();
        throw new Error(
          "Esta conta não está registada como afiliado. Regista-te primeiro em /afiliados."
        );
      }

      toast.success("Bem-vindo de volta! 🎉");
      navigate("/affiliate-dashboard", { replace: true });
    } catch (err: any) {
      toast.error(err.message || "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LandingLayout>
      <div className="min-h-[calc(100vh-200px)] flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <div className="w-full max-w-md">
          <Link
            to="/afiliados"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao programa
          </Link>

          <Card className="border-2 shadow-lg">
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                {mode === "forgot" ? "Recuperar password" : "Entrar como afiliado"}
              </CardTitle>
              <CardDescription>
                {mode === "forgot"
                  ? "Indica o teu email para recuperar o acesso."
                  : "Acede ao teu dashboard a partir de qualquer dispositivo."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="aff-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="aff-email"
                      type="email"
                      autoComplete="email"
                      placeholder="o-teu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-9 h-11"
                      required
                    />
                  </div>
                </div>

                {mode === "login" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="aff-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="aff-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-9 pr-10 h-11"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Esconder password" : "Mostrar password"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full h-11 font-semibold">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {mode === "forgot" ? "Enviar email de recuperação" : "Entrar"}
                </Button>

                <div className="flex flex-col items-center gap-2 text-sm">
                  {mode === "login" ? (
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Esqueci-me da password
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      Voltar ao login
                    </button>
                  )}
                  <span className="text-muted-foreground">
                    Ainda não tens conta?{" "}
                    <Link to="/afiliados" className="text-primary font-medium hover:underline">
                      Regista-te aqui
                    </Link>
                  </span>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </LandingLayout>
  );
}
