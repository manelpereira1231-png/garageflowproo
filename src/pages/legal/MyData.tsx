import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Download, Trash2, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Página RGPD: permite ao utilizador autenticado exportar todos os seus dados
 * pessoais (direito de acesso/portabilidade) e solicitar a eliminação da conta
 * (direito ao esquecimento), em conformidade com os artigos 15.º, 17.º e 20.º.
 */
export default function MyData() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setUserEmail(user.email ?? null);
      setLoading(false);
    })();
  }, [navigate]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase.functions.invoke("user-data-export");
      if (error) throw error;
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `garageflow-meus-dados-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída — verifica os teus downloads.");
    } catch (e: any) {
      toast.error("Não foi possível exportar agora: " + (e.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirmEmail.trim().toLowerCase() !== (userEmail || "").toLowerCase()) {
      toast.error("O e-mail de confirmação não coincide.");
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("user-data-delete");
      if (error) throw error;
      toast.success("Conta eliminada. Vais ser desconectado.");
      await supabase.auth.signOut();
      setTimeout(() => navigate("/"), 1500);
    } catch (e: any) {
      toast.error("Falha a eliminar conta: " + (e.message || ""));
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
          <span className="flex items-center gap-2 font-bold">
            <ShieldCheck className="h-5 w-5 text-primary" /> Os Meus Dados
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Os Meus Dados (RGPD)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Exerce os teus direitos de acesso, portabilidade e eliminação em conformidade
            com o RGPD. Conta: <strong>{userEmail}</strong>
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">Exportar os meus dados</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Recebes um ficheiro <code>.json</code> com todos os dados associados à tua
                conta: perfil, oficinas, clientes, veículos, faturação, anúncios Market e KYC.
              </p>
              <Button onClick={handleExport} disabled={exporting} className="mt-3">
                {exporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A preparar…</> : "Descarregar dados"}
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-destructive/40">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-destructive">Eliminar a minha conta</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Apaga definitivamente a tua conta e dados pessoais. Documentos fiscais (faturas)
                serão conservados pelo prazo legal de 10 anos, conforme exigido pelo Código do
                IVA português, mas anonimizados sempre que possível.
              </p>
              <div className="mt-3 flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 rounded">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  Esta ação é <strong>irreversível</strong>. Se tens uma subscrição ativa cancela-a
                  primeiro no portal de faturação. Anúncios Market em escrow ativo bloqueiam a
                  eliminação até resolução.
                </span>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-3">
                    Eliminar conta definitivamente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar eliminação</AlertDialogTitle>
                    <AlertDialogDescription>
                      Para confirmar, escreve o teu e-mail (<strong>{userEmail}</strong>) abaixo.
                      Não poderás reverter esta operação.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2 py-2">
                    <Label htmlFor="confirm-email">E-mail de confirmação</Label>
                    <Input
                      id="confirm-email"
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      placeholder={userEmail || ""}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> A eliminar…</> : "Eliminar agora"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4">
          Para questões adicionais contacta{" "}
          <a href="mailto:privacidade@garageflow.pt" className="underline">
            privacidade@garageflow.pt
          </a>{" "}
          ou consulta a{" "}
          <Link to="/legal/privacy" className="underline">Política de Privacidade</Link>.
        </p>
      </main>
    </div>
  );
}
