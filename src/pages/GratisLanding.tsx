import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { erpSupabase } from "@/integrations/supabase/realmClients";
import { supabase } from "@/integrations/supabase/client";
import { ensureSignupAllowed } from "@/lib/signupGuard";
import { trackSignupConversion, captureAdsParams, trackCtaClick } from "@/lib/gadsTracking";
import { setOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { CheckCircle2, Zap, Clock, ShieldCheck, Loader2 } from "lucide-react";

/**
 * Aggressive capture landing — /gratis-3-meses
 * 1-field form (email). Generates a temporary password, signs up,
 * applies 3-month free trial bonus (handled server-side by trial logic),
 * and lands the user straight on /admin with auto-session.
 */
export default function GratisLanding() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    captureAdsParams();
    // Real social proof — count workshops created in last 7 days
    (async () => {
      try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: c } = await supabase
          .from("shops")
          .select("id", { count: "exact", head: true })
          .gte("created_at", since);
        if (typeof c === "number") setCount(c);
      } catch { /* silent */ }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error("Email inválido");
      return;
    }
    setLoading(true);
    try {
      await ensureSignupAllowed(clean, "erp");
      // Generate a strong temporary password — user can reset later.
      const tempPwd =
        "Gf!" +
        crypto.getRandomValues(new Uint32Array(2)).join("") +
        "_" +
        Math.random().toString(36).slice(2, 8) +
        "A";

      const { data: signUpData, error } = await erpSupabase.auth.signUp({
        email: clean,
        password: tempPwd,
        options: {
          data: {
            owner_name: clean.split("@")[0],
            name: clean.split("@")[0],
            account_type: "garage",
            signup_source: "gratis-3-meses",
          },
          emailRedirectTo: window.location.origin + "/admin",
        },
      });
      if (error) throw error;

      if (signUpData?.user) {
        await supabase.from("user_roles" as any).insert({
          user_id: signUpData.user.id,
          role: "garage_owner",
        });
        setOnboardingStatus("guided");
      }

      trackCtaClick("gratis-3-meses-signup");
      trackSignupConversion(clean);

      if (signUpData?.session) {
        toast.success("Conta criada! Bem-vindo.");
        navigate("/admin", { replace: true });
      } else {
        // Fallback: try direct sign-in if auto-confirm enabled
        const { data: sign } = await erpSupabase.auth.signInWithPassword({
          email: clean,
          password: tempPwd,
        });
        if (sign?.session) {
          navigate("/admin", { replace: true });
        } else {
          toast.success("Confirme o email para ativar a conta (verifique também o spam).", {
            duration: 8000,
          });
          navigate("/auth?mode=login&prefill=" + encodeURIComponent(clean));
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Não foi possível registar agora. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>3 Meses Grátis — GarageFlow | Software para Oficinas</title>
        <meta
          name="description"
          content="Comece já com 3 meses grátis. Sem cartão. Setup em 2 minutos. Software completo de gestão para oficinas em Portugal."
        />
        <link rel="canonical" href="https://garageflow.pt/gratis-3-meses" />
        <meta property="og:title" content="3 Meses Grátis — GarageFlow" />
        <meta property="og:description" content="Sem cartão. Setup em 2 minutos." />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="container mx-auto px-4 py-12 sm:py-20 max-w-3xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-6">
            <Zap className="w-4 h-4" /> Oferta de lançamento
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-4">
            3 meses grátis.
            <br />
            <span className="text-primary">Sem cartão de crédito.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto">
            Software completo para a tua oficina. Orçamentos, faturas, viaturas, clientes e
            ordens de serviço. Setup em 2 minutos.
          </p>
        </div>

        <Card className="p-6 sm:p-8 shadow-xl border-primary/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            <label htmlFor="email" className="block text-sm font-semibold">
              O teu email profissional
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="nome@oficina.pt"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                className="flex-1 h-12 text-base"
              />
              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="h-12 px-6 font-bold whitespace-nowrap"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" /> A criar...
                  </>
                ) : (
                  "Começar grátis →"
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Ao continuar aceitas os{" "}
              <a href="/legal/terms" className="underline">Termos</a> e a{" "}
              <a href="/legal/privacy" className="underline">Privacidade</a>. Cancelas quando
              quiseres.
            </p>
          </form>

          <div className="grid sm:grid-cols-3 gap-4 mt-8 pt-6 border-t">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Sem cartão</div>
                <div className="text-xs text-muted-foreground">Zero compromisso</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Clock className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">2 minutos</div>
                <div className="text-xs text-muted-foreground">Setup imediato</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Dados em PT</div>
                <div className="text-xs text-muted-foreground">RGPD conforme</div>
              </div>
            </div>
          </div>
        </Card>

        {count !== null && count > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-6">
            <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2 align-middle" />
            <strong className="text-foreground">{count}</strong> oficinas registaram-se na
            última semana
          </p>
        )}

        <ul className="mt-12 grid sm:grid-cols-2 gap-3 text-sm">
          {[
            "Orçamentos e faturas em segundos",
            "Histórico completo por viatura",
            "Lembretes automáticos a clientes",
            "Stock e fornecedores integrados",
            "App mobile para a equipa",
            "Suporte em português",
          ].map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
