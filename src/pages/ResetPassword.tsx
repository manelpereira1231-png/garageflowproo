import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { type Realm } from "@/integrations/supabase/realmClients";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Lock, CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";

/**
 * Password / child-shop activation page.
 *
 * Critical security rule: this page NEVER reads the normal ERP/Market auth
 * clients and NEVER trusts an already-open browser session. Email action links
 * are consumed by a dedicated temporary client with its own storage key, so a
 * child-shop invitation cannot log into, replace, or reuse the Oficina Mãe session.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const ACTIVATION_STORAGE_PREFIX = "garageflow_password_activation";

type ActivationType = "invite" | "recovery" | "unknown";

function createActivationClient(realm: Realm) {
  const storageKey = `${ACTIVATION_STORAGE_PREFIX}_${realm}`;
  try { window.localStorage.removeItem(storageKey); } catch {}
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      storage: window.localStorage,
      storageKey,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

function clearActivationStorage(realm: Realm) {
  try { window.localStorage.removeItem(`${ACTIVATION_STORAGE_PREFIX}_${realm}`); } catch {}
}

function getHashParams() {
  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

function getActivationType(url: URL, hashParams: URLSearchParams): ActivationType {
  const raw = hashParams.get("type") || url.searchParams.get("type") || "";
  return raw === "invite" || raw === "recovery" ? raw : "unknown";
}

function isChildInviteUser(user: User | null) {
  const metadata = user?.user_metadata ?? {};
  return metadata.source === "child_shop_invite" || metadata.account_type === "garage_child";
}

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
  const [activationType, setActivationType] = useState<ActivationType>("unknown");
  const [activationUser, setActivationUser] = useState<User | null>(null);
  const activationClientRef = useRef<SupabaseClient<Database> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const url = new URL(window.location.href);
      const hashParams = getHashParams();
      const code = url.searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const errDesc = url.searchParams.get("error_description") || url.searchParams.get("error");
      const type = getActivationType(url, hashParams);
      const realm: Realm = realmHint === "market" ? "market" : "erp";

      if (errDesc) {
        if (!cancelled) setChecked(true);
        return;
      }

      // No token/code means an existing browser session is irrelevant here.
      if (!code && (!accessToken || !refreshToken)) {
        if (!cancelled) setChecked(true);
        return;
      }

      const client = createActivationClient(realm);
      activationClientRef.current = client;

      try {
        const result = code
          ? await client.auth.exchangeCodeForSession(code)
          : await client.auth.setSession({ access_token: accessToken!, refresh_token: refreshToken! });

        if (result.error || !result.data.session) {
          if (!cancelled) setChecked(true);
          return;
        }

        const { data: userData, error: userError } = await client.auth.getUser();
        if (userError || !userData.user) {
          if (!cancelled) setChecked(true);
          return;
        }

        if (type === "invite" && isChildInviteUser(userData.user) && userData.user.user_metadata?.child_password_set_at) {
          await client.auth.signOut({ scope: "local" });
          clearActivationStorage(realm);
          if (!cancelled) setChecked(true);
          return;
        }

        if (!cancelled) {
          setActivationType(type);
          setActivationUser(userData.user);
          setActiveRealm(realm);
        }

        // Clean one-time credentials from the address bar so refresh cannot replay them.
        url.searchParams.delete("code");
        url.searchParams.delete("type");
        window.history.replaceState({}, document.title, url.pathname + (url.search || "") + url.hash);
        if (window.location.hash) window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
      } finally {
        if (!cancelled) setChecked(true);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [realmHint]);



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
    const client = activationClientRef.current;
    if (!client || !activationUser) {
      toast.error("Link inválido ou expirado. Peça um novo email.");
      return;
    }

    setLoading(true);
    try {
      const updatePayload = isChildInviteUser(activationUser)
        ? { password, data: { child_password_set_at: new Date().toISOString() } }
        : { password };
      const { error } = await client.auth.updateUser(updatePayload);
      if (error) throw error;
      setSuccess(true);
      toast.success(t('auth.resetSuccess') || "Password redefinida com sucesso.");
      await client.auth.signOut({ scope: "local" });
      clearActivationStorage(realm);
      setTimeout(() => navigate(realm === "market" ? "/market/auth" : "/login", { replace: true }), 1800);
    } catch (err: any) {
      toast.error(friendlyAuthError(err?.message));
    } finally {
      setLoading(false);
    }
  };

  const hasSession = activeRealm !== null;
  const backDest = useMemo(() => (realmHint === "market" ? "/market/auth" : "/login"), [realmHint]);

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
                {activationType === "invite" && isChildInviteUser(activationUser)
                  ? "Convite de Oficina Filha"
                  : activeRealm === "market" ? "Conta GarageFlow Market" : "Conta GarageFlow ERP"}
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
