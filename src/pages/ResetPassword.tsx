import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { erpSupabase, marketSupabase, type Realm } from "@/integrations/supabase/realmClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Password recovery page — works for BOTH realms (ERP + Market).
 *
 * The recovery email is sent by either `erpSupabase` or `marketSupabase`
 * (each has its own storageKey). When the user clicks the link, Supabase
 * sets the recovery session on the SAME client that issued it. We
 * subscribe to both clients here and use whichever one fires
 * PASSWORD_RECOVERY (or already has a session).
 *
 * The `?realm=` query param is a hint added by the sender (Auth.tsx /
 * MarketAuth.tsx) so we know where to redirect after success, even if
 * Supabase strips the hash before our listeners attach.
 */

function friendlyAuthError(message?: string): string {
  if (!message) return "Não foi possível redefinir a password. Tente novamente.";
  const m = message.toLowerCase();
  if (m.includes("expired") || m.includes("invalid") && m.includes("token")) {
    return "O link de recuperação expirou ou já foi utilizado. Peça um novo email.";
  }
  if (m.includes("weak") || m.includes("password should") || m.includes("at least")) {
    return "Password demasiado fraca. Use pelo menos 6 caracteres.";
  }
  if (m.includes("same password") || m.includes("new password should be different")) {
    return "A nova password tem de ser diferente da anterior.";
  }
  if (m.includes("rate") || m.includes("too many")) {
    return "Demasiadas tentativas. Aguarde alguns minutos antes de tentar novamente.";
  }
  return "Não foi possível redefinir a password. O link pode ter expirado — peça um novo.";
}

export default function ResetPassword() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const realmHint = (searchParams.get("realm") as Realm | null) ?? null;

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [activeRealm, setActiveRealm] = useState<Realm | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const clients: Array<{ realm: Realm; client: typeof erpSupabase }> = [
      { realm: "erp", client: erpSupabase },
      { realm: "market", client: marketSupabase },
    ];

    const subs = clients.map(({ realm, client }) =>
      client.auth.onAuthStateChange((event, session) => {
        if (cancelled) return;
        if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
          setActiveRealm((prev) => prev ?? realm);
        }
      })
    );

    // Also probe existing sessions (in case the hash was already consumed)
    Promise.all(clients.map(async ({ realm, client }) => {
      const { data } = await client.auth.getSession();
      return data.session ? realm : null;
    })).then((results) => {
      if (cancelled) return;
      const found = results.find(Boolean) as Realm | undefined;
      if (found) setActiveRealm((prev) => prev ?? found);
      setChecked(true);
    });

    return () => {
      cancelled = true;
      subs.forEach(({ data }) => data.subscription.unsubscribe());
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error(t('auth.passwordMismatch') || "As passwords não coincidem.");
      return;
    }
    if (password.length < 6) {
      toast.error("A password tem de ter pelo menos 6 caracteres.");
      return;
    }
    const realm = activeRealm ?? realmHint ?? "erp";
    const client = realm === "market" ? marketSupabase : erpSupabase;

    setLoading(true);
    try {
      const { error } = await client.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      toast.success(t('auth.resetSuccess') || "Password redefinida com sucesso.");
      const dest = realm === "market" ? "/market/auth" : "/auth";
      setTimeout(() => navigate(dest, { replace: true }), 1800);
    } catch (err: any) {
      toast.error(friendlyAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const hasSession = activeRealm !== null;
  const backDest = useMemo(() => (realmHint === "market" ? "/market/auth" : "/auth"), [realmHint]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Garage<span className="text-primary">Flow</span>
          </h1>
        </div>

        <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
          {success ? (
            <div className="text-center space-y-3">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
              <h2 className="text-lg font-semibold">{t('auth.resetSuccess') || "Password redefinida"}</h2>
              <p className="text-sm text-muted-foreground">A redirecionar para o login...</p>
            </div>
          ) : !hasSession && checked ? (
            <div className="text-center space-y-3">
              <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
              <h2 className="text-lg font-semibold">Link inválido ou expirado</h2>
              <p className="text-sm text-muted-foreground">
                Este link de recuperação já não é válido. Peça um novo email a partir do ecrã de login.
              </p>
              <Button variant="outline" onClick={() => navigate(backDest)} className="mt-2">
                Voltar ao login
              </Button>
            </div>
          ) : !hasSession ? (
            <div className="text-center py-6">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground mt-3">A validar o link...</p>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-1">{t('auth.resetPassword') || "Redefinir password"}</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {activeRealm === "market" ? "Conta GarageFlow Market" : "Conta GarageFlow ERP"}
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password">{t('auth.newPassword') || "Nova password"}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="pl-9" required minLength={6} autoComplete="new-password" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword">{t('auth.confirmNewPassword') || "Confirmar nova password"}</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="pl-9" required minLength={6} autoComplete="new-password" />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (t('auth.processing') || "A processar...") : (t('auth.resetPassword') || "Redefinir password")}
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
