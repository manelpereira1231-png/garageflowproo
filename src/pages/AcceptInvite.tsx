import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { erpSupabase } from "@/integrations/supabase/realmClients";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wrench, Mail, Lock, User, Phone, Building2, ArrowLeft, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { homeForRole } from "@/lib/rolePaths";
import { setOnboardingStatus } from "@/hooks/useOnboardingStatus";

type InviteInfo = {
  email: string;
  name: string | null;
  phone: string | null;
  role: string;
  shop_id: string;
  shop_name: string;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  valid: boolean;
};

const roleLabels: Record<string, string> = {
  admin: "Administrador",
  manager: "Gerente",
  reception: "Receção",
  technician: "Técnico",
  commercial: "Comercial",
};

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [mode, setMode] = useState<"signup" | "login">("signup");

  useEffect(() => {
    if (!token) { setError("Token em falta."); setLoading(false); return; }
    (async () => {
      const { data, error: err } = await erpSupabase.rpc("get_team_invitation_info", { _token: token });
      if (err) { setError(err.message); setLoading(false); return; }
      const row = Array.isArray(data) ? data[0] : (data as any);
      if (!row) { setError("Convite não encontrado."); setLoading(false); return; }
      setInfo(row as InviteInfo);
      setName((row as InviteInfo).name || "");
      setPhone((row as InviteInfo).phone || "");
      setLoading(false);
    })();
  }, [token]);

  const waitForSession = async (maxMs = 4000): Promise<boolean> => {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const { data } = await erpSupabase.auth.getSession();
      if (data.session) return true;
      await new Promise((r) => setTimeout(r, 250));
    }
    return false;
  };

  const trySignIn = async (attempts = 4): Promise<string | null> => {
    let lastMsg: string | null = null;
    for (let i = 0; i < attempts; i++) {
      const { error: sErr } = await erpSupabase.auth.signInWithPassword({
        email: info!.email,
        password,
      });
      if (!sErr) return null;
      lastMsg = sErr.message;
      // Propagação do auto-confirm pode demorar ~500ms
      await new Promise((r) => setTimeout(r, 400 + i * 300));
    }
    return lastMsg;
  };

  const acceptAndRedirect = async () => {
    // Garantir sessão viva antes da RPC
    const has = await waitForSession(4000);
    if (!has) throw new Error("Sessão não estabelecida. Tente novamente.");

    const { data, error: err } = await erpSupabase.rpc("accept_team_invitation", { _token: token });
    if (err) throw new Error(err.message);
    const row = Array.isArray(data) ? data[0] : (data as any);
    const role = row?.role || info?.role || null;
    toast.success("Bem-vindo à equipa!");
    navigate(homeForRole(role), { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info || !token) return;
    if (password.length < 6) { toast.error("A palavra-passe deve ter pelo menos 6 caracteres."); return; }
    if (mode === "signup" && password !== confirm) { toast.error("As palavras-passe não coincidem."); return; }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error: signUpErr } = await erpSupabase.auth.signUp({
          email: info.email,
          password,
          options: {
            data: { owner_name: name || info.name || undefined, account_type: "garage_member" },
            emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
          },
        });

        if (signUpErr) {
          const msg = signUpErr.message.toLowerCase();
          if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
            // Utilizador já existe — tentar login imediato com a password que introduziu
            const err = await trySignIn(4);
            if (err) {
              setMode("login");
              toast.message("Já tem conta. Introduza a palavra-passe existente para aceitar o convite.");
              setSubmitting(false);
              return;
            }
            // login bem sucedido
          } else {
            throw signUpErr;
          }
        } else if (!signUpData.session) {
          // Auto-confirm ativo mas sessão ainda não foi entregue — pequeno retry
          const err = await trySignIn(5);
          if (err) {
            throw new Error("Conta criada mas o login falhou. Tente novamente em alguns segundos.");
          }
        }
        setOnboardingStatus("guided");
      } else {
        const err = await trySignIn(3);
        if (err) throw new Error(err);
      }

      await acceptAndRedirect();
    } catch (err: any) {
      toast.error(err.message || "Erro ao aceitar convite.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">Convite inválido</h1>
          <p className="text-muted-foreground">{error || "Não foi possível carregar o convite."}</p>
          <Link to="/auth" className="text-primary hover:underline text-sm inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>
        </div>
      </div>
    );
  }

  if (!info.valid) {
    const reason = info.accepted_at
      ? "Este convite já foi aceite."
      : info.revoked_at
      ? "Este convite foi revogado."
      : "Este convite expirou.";
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-4">
          <h1 className="text-2xl font-bold">Convite indisponível</h1>
          <p className="text-muted-foreground">{reason}</p>
          <Link to="/auth" className="text-primary hover:underline text-sm inline-flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Ir para login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Wrench className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Bem-vindo ao GarageFlow</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Foi convidado para integrar a oficina:
          </p>
          <div className="mt-3 inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-semibold px-3 py-1.5 rounded-full">
            <Building2 className="w-4 h-4" />
            {info.shop_name}
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Função: <span className="font-semibold text-foreground">{roleLabels[info.role] || info.role}</span>
          </p>
        </div>

        <div className="border rounded-2xl p-6 shadow-sm bg-card">
          <h2 className="text-lg font-semibold mb-1">
            {mode === "signup" ? "Criar Conta" : "Entrar"}
          </h2>
          <p className="text-sm mb-6 text-muted-foreground">
            {mode === "signup"
              ? "Defina uma palavra-passe para ativar a sua conta."
              : "Introduza a sua palavra-passe existente para aceitar o convite."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Mail className="w-3.5 h-3.5" /> Email
              </Label>
              <Input type="email" value={info.email} disabled />
            </div>

            {mode === "signup" && (
              <>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <User className="w-3.5 h-3.5" /> Nome
                  </Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome completo" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <Phone className="w-3.5 h-3.5" /> Telefone
                  </Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Opcional" />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-sm">
                <Lock className="w-3.5 h-3.5" /> {mode === "signup" ? "Nova palavra-passe" : "Palavra-passe"}
              </Label>
              <div className="relative">
                <Input
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                  placeholder="••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5 text-sm">
                  <Lock className="w-3.5 h-3.5" /> Confirmar palavra-passe
                </Label>
                <Input
                  type={showPwd ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  minLength={6}
                  required
                  placeholder="••••••"
                />
              </div>
            )}

            <Button type="submit" className="w-full h-11 font-semibold" disabled={submitting}>
              {submitting ? "A processar..." : mode === "signup" ? "Criar Conta" : "Entrar e Aceitar"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            {mode === "signup" ? (
              <button onClick={() => setMode("login")} className="text-primary hover:underline">
                Já tem conta? Entrar
              </button>
            ) : (
              <button onClick={() => setMode("signup")} className="text-primary hover:underline">
                Criar uma nova conta
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
