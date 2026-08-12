import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { MessageSquare, Mail, Send } from "lucide-react";
import { toast } from "sonner";
import { isValidEmail } from "@/lib/emailService";
import {
  getCommsPresets, defaultPresetIdForStatus, sendWorkOrderEmail, sendWorkOrderWhatsApp,
  type WorkOrderCommsContext,
} from "@/lib/clientComms";

/**
 * Diálogo de comunicação com o cliente da OS.
 * Reutiliza a camada partilhada `lib/clientComms.ts` (WhatsApp + email + email_logs).
 * Nunca altera o estado da Ordem de Serviço.
 */
export default function ClientCommsDialog({
  open, onOpenChange, ctx,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ctx: WorkOrderCommsContext;
}) {
  const presets = useMemo(() => getCommsPresets(ctx), [ctx]);
  const initial = presets.find((p) => p.id === defaultPresetIdForStatus(ctx.status)) || presets[0];
  const [presetId, setPresetId] = useState(initial?.id || "");
  const [subject, setSubject] = useState(initial?.subject || "");
  const [body, setBody] = useState(initial?.body || "");
  const [sending, setSending] = useState<"email" | "wa" | null>(null);

  const pickPreset = (id: string) => {
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    setPresetId(id);
    setSubject(p.subject);
    setBody(p.body);
  };

  const emailOk = isValidEmail(ctx.clientEmail);
  const phoneOk = Boolean(ctx.clientPhone);

  const handleEmail = async () => {
    setSending("email");
    try {
      await sendWorkOrderEmail(ctx, subject.trim() || "Ordem de Serviço", body);
      toast.success("Email enviado ao cliente.");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível enviar o email.");
    } finally {
      setSending(null);
    }
  };

  const handleWhatsApp = async () => {
    setSending("wa");
    try {
      await sendWorkOrderWhatsApp(ctx, body);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Não foi possível abrir o WhatsApp.");
    } finally {
      setSending(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Comunicar com o cliente</DialogTitle>
          <DialogDescription>
            {ctx.clientName || "Cliente"} — OS {ctx.number}. A mensagem não altera o estado do serviço.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Mensagens rápidas</Label>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={presetId === p.id ? "default" : "outline"}
                  className="h-8 text-xs"
                  onClick={() => pickPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comms-subject" className="text-xs text-muted-foreground">Assunto (email)</Label>
            <Input id="comms-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="comms-body" className="text-xs text-muted-foreground">Mensagem</Label>
            <Textarea
              id="comms-body"
              rows={8}
              value={body}
              onChange={(e) => { setBody(e.target.value); setPresetId(""); }}
            />
          </div>

          <div className="text-xs text-muted-foreground space-y-0.5">
            <div>Email: {ctx.clientEmail || "— sem email registado"}</div>
            <div>Telefone: {ctx.clientPhone || "— sem telefone registado"}</div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="min-h-[44px] w-full sm:w-auto"
            disabled={!phoneOk || !body.trim() || sending !== null}
            onClick={handleWhatsApp}
          >
            <MessageSquare className="w-4 h-4 mr-1.5" /> WhatsApp
          </Button>
          <Button
            className="min-h-[44px] w-full sm:w-auto"
            disabled={!emailOk || !body.trim() || sending !== null}
            onClick={handleEmail}
          >
            {sending === "email" ? <Send className="w-4 h-4 mr-1.5 animate-pulse" /> : <Mail className="w-4 h-4 mr-1.5" />}
            Enviar email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
