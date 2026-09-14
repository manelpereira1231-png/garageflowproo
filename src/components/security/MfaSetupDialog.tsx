/**
 * MfaSetupDialog — guided TOTP (Google Authenticator / Authy) enrollment for
 * group/billing owners. Shown once per session after login while the account
 * has no verified TOTP factor. Explains WHY before asking anything and allows
 * "Mais tarde" so nobody is ever locked out mid-work.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ShieldCheck, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "gf_mfa_prompt_dismissed";

type Props = { open: boolean; onClose: () => void; onEnrolled: () => void };

export default function MfaSetupDialog({ open, onClose, onEnrolled }: Props) {
  const [step, setStep] = useState<"intro" | "enroll">("intro");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) { setStep("intro"); setCode(""); }
  }, [open]);

  const startEnroll = async () => {
    setBusy(true);
    try {
      // Remove leftover unverified factors so re-entry never fails.
      const { data: list } = await supabase.auth.mfa.listFactors();
      for (const f of (list?.totp ?? []) as any[]) {
        if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `GarageFlow ${new Date().toISOString().slice(0, 10)}`,
      });
      if (error) throw error;
      setFactorId(data.id);
      setQr((data as any).totp?.qr_code ?? null);
      setSecret((data as any).totp?.secret ?? "");
      setStep("enroll");
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível iniciar a configuração agora. Tente mais tarde.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (code.trim().length < 6) return;
    setBusy(true);
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr) throw chErr;
      const { error } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (error) throw error;
      toast.success("Verificação em duas etapas ativada.");
      sessionStorage.setItem(SESSION_KEY, "1");
      onEnrolled();
      onClose();
    } catch (e: any) {
      toast.error(e?.message?.includes("Invalid") ? "Código inválido. Tente o código atual da app." : (e?.message || "Não foi possível confirmar o código."));
    } finally {
      setBusy(false);
    }
  };

  const later = () => {
    sessionStorage.setItem(SESSION_KEY, "1");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) later(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Proteja a conta do grupo
          </DialogTitle>
          <DialogDescription>
            Esta conta gere o grupo de oficinas, o plano e os pagamentos. Ative a verificação
            em duas etapas para que ninguém consiga entrar só com a palavra-passe.
          </DialogDescription>
        </DialogHeader>

        {step === "intro" ? (
          <div className="space-y-4">
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-4">
              <li>Instale o Google Authenticator (ou Authy) no telemóvel.</li>
              <li>Leia o código QR que vamos mostrar.</li>
              <li>Introduza o código de 6 dígitos para confirmar.</li>
            </ol>
            <div className="flex gap-2">
              <Button onClick={startEnroll} disabled={busy} className="flex-1">Ativar agora</Button>
              <Button variant="ghost" onClick={later} disabled={busy}>Mais tarde</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {qr && <img src={qr} alt="Código QR para a app de autenticação" className="w-44 h-44 mx-auto bg-white rounded-lg p-2" />}
            {secret && (
              <button
                type="button"
                onClick={() => { navigator.clipboard?.writeText(secret); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="w-full text-xs font-mono bg-muted rounded-md px-3 py-2 flex items-center justify-between gap-2"
              >
                <span className="truncate">{secret}</span>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
            <Input
              inputMode="numeric"
              maxLength={6}
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              className="text-center tracking-[0.4em] text-lg"
            />
            <div className="flex gap-2">
              <Button onClick={verify} disabled={busy || code.length < 6} className="flex-1">Confirmar</Button>
              <Button variant="ghost" onClick={later} disabled={busy}>Mais tarde</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function mfaPromptDismissed(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch { return false; }
}
