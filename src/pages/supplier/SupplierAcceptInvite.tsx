import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function SupplierAcceptInvite() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const token = sp.get("token") || "";
  const [invite, setInvite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      const { data } = await supabase
        .from("gsn_supplier_invites" as any)
        .select("email,company_name,used_at,expires_at")
        .eq("token", token)
        .maybeSingle();
      setInvite(data);
      setLoading(false);
    })();
  }, [token]);

  const submit = async () => {
    if (password.length < 8) return toast.error("Palavra-passe deve ter pelo menos 8 caracteres");
    if (password !== confirm) return toast.error("Palavras-passe não coincidem");
    if (!terms) return toast.error("Tem de aceitar os termos");
    if (!invite?.email) return toast.error("Convite inválido");
    setSubmitting(true);
    try {
      const { data: sign, error: signErr } = await supabase.auth.signUp({
        email: invite.email, password,
        options: { emailRedirectTo: `${window.location.origin}/supplier/pending` },
      });
      if (signErr && !/already/i.test(signErr.message)) throw signErr;
      if (!sign?.session) {
        const { error: pwErr } = await supabase.auth.signInWithPassword({ email: invite.email, password });
        if (pwErr) throw pwErr;
      }
      const { error: rpcErr } = await supabase.rpc("gsn_accept_invite" as any, { _token: token });
      if (rpcErr) throw rpcErr;
      toast.success("Registo concluído. A sua candidatura está em análise.");
      nav("/supplier/pending", { replace: true });
    } catch (e: any) {
      toast.error(e.message || "Erro ao completar registo");
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">A carregar...</div>;

  if (!invite || invite.used_at || (invite.expires_at && new Date(invite.expires_at) < new Date())) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader><CardTitle>Convite inválido</CardTitle>
            <CardDescription>Este link já foi usado ou expirou. Contacte o administrador.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Bem-vindo à Supplier Network</CardTitle>
          <CardDescription>
            {invite.company_name} · {invite.email}<br />
            Defina a sua palavra-passe para completar o registo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Palavra-passe</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
          <div><Label>Confirmar palavra-passe</Label><Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
          <label className="flex items-start gap-2 text-sm">
            <Checkbox checked={terms} onCheckedChange={(v) => setTerms(!!v)} />
            <span className="text-muted-foreground">Aceito os Termos de Utilização e a Política de Privacidade da GarageFlow Supplier Network.</span>
          </label>
          <Button onClick={submit} disabled={submitting} className="w-full">
            {submitting ? "A criar conta..." : "Criar conta"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
