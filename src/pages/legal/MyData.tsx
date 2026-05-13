import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Download, Trash2, Loader2, AlertTriangle, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { myDataI18n } from "@/i18n/myDataI18n";
import type { Language } from "@/i18n/translations";
import SEOHead from "@/components/SEOHead";

const LANG_LABELS: Record<Language, string> = {
  "pt": "Português (PT)", "pt-BR": "Português (BR)", "en": "English", "es": "Español", "hi": "हिन्दी",
};

/**
 * Página RGPD: permite ao utilizador autenticado exportar todos os seus dados
 * pessoais (direito de acesso/portabilidade) e solicitar a eliminação da conta
 * (direito ao esquecimento), em conformidade com os artigos 15.º, 17.º e 20.º.
 */
export default function MyData() {
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const t = myDataI18n[language] || myDataI18n.en;
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
      a.download = `garageflow-mydata-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t.exportSuccess);
    } catch (e: any) {
      toast.error(t.exportError + " " + (e.message || ""));
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (confirmEmail.trim().toLowerCase() !== (userEmail || "").toLowerCase()) {
      toast.error(t.deleteEmailMismatch);
      return;
    }
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("user-data-delete");
      if (error) throw error;
      toast.success(t.deleteSuccess);
      await supabase.auth.signOut();
      setTimeout(() => navigate("/"), 1500);
    } catch (e: any) {
      toast.error(t.deleteFailed + " " + (e.message || ""));
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
      <SEOHead title={`${t.header} — GarageFlow`} description={t.title} noindex />
      <header className="border-b bg-card">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {t.back}
          </Link>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1.5 h-8">
                  <Globe className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">{LANG_LABELS[language]}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(Object.keys(LANG_LABELS) as Language[]).map((lang) => (
                  <DropdownMenuItem key={lang} onSelect={() => setLanguage(lang)}
                    className={lang === language ? "font-semibold" : ""}>
                    {LANG_LABELS[lang]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="flex items-center gap-2 font-bold">
              <ShieldCheck className="h-5 w-5 text-primary" /> {t.header}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.subtitle} <strong>{userEmail}</strong>
          </p>
        </div>

        <Card className="p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-primary/10 p-3">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold">{t.exportTitle}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.exportDesc}</p>
              <Button onClick={handleExport} disabled={exporting} className="mt-3">
                {exporting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.exportPreparing}</> : t.exportBtn}
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
              <h2 className="font-semibold text-destructive">{t.deleteTitle}</h2>
              <p className="text-sm text-muted-foreground mt-1">{t.deleteDesc}</p>
              <div className="mt-3 flex items-start gap-2 text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-3 rounded">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <span>{t.deleteWarning}</span>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="mt-3">{t.deleteBtn}</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t.deleteConfirmTitle}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t.deleteConfirmDesc} <strong>{userEmail}</strong>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <div className="space-y-2 py-2">
                    <Label htmlFor="confirm-email">{t.deleteConfirmEmail}</Label>
                    <Input
                      id="confirm-email"
                      type="email"
                      value={confirmEmail}
                      onChange={(e) => setConfirmEmail(e.target.value)}
                      placeholder={userEmail || ""}
                    />
                  </div>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={deleting}>{t.cancel}</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      disabled={deleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.deleting}</> : t.deleteNow}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center pt-4">
          {t.footer}{" "}
          <a href="mailto:privacidade@garageflow.pt" className="underline">privacidade@garageflow.pt</a>{" "}
          {t.footerOr}{" "}
          <Link to="/legal/privacy" className="underline">{t.footerLink}</Link>.
        </p>
      </main>
    </div>
  );
}
