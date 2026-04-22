import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, Clock, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  escrow: any;
  onCancelled: () => void;
}

export default function MarketSatisfactionWindow({ escrow, onCancelled }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmingDelivery, setConfirmingDelivery] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Reference: delivery_confirmed_at if set, else paid created_at
  const reference = escrow?.delivery_confirmed_at
    ? new Date(escrow.delivery_confirmed_at).getTime()
    : new Date(escrow?.created_at || Date.now()).getTime();
  const deadline = reference + 48 * 3600 * 1000;
  const remainingMs = deadline - now;

  const expired = remainingMs <= 0;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const remaining = useMemo(() => {
    if (expired) return null;
    const h = Math.floor(remainingMs / 3600 / 1000);
    const m = Math.floor((remainingMs / 60 / 1000) % 60);
    return `${h}h ${m}m`;
  }, [remainingMs, expired]);

  const submit = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-satisfaction-cancel", {
        body: { escrow_id: escrow.id, reason },
      });
      if (error) throw new Error((error as any)?.context?.error || error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || "Cancelamento processado");
      setOpen(false);
      onCancelled();
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelivery = async () => {
    if (!confirm("Confirma que recebeu o veículo e está tudo conforme? O pagamento será libertado imediatamente para o vendedor e não poderá cancelar.")) return;
    setConfirmingDelivery(true);
    try {
      const { data, error } = await supabase.functions.invoke("market-escrow-confirm-delivery", {
        body: { escrow_id: escrow.id },
      });
      if (error) throw new Error((error as any)?.context?.error || error.message);
      if (data?.error) throw new Error(data.error);
      toast.success("Entrega confirmada — pagamento libertado ao vendedor");
      onCancelled(); // reuse parent refresh
    } catch (e: any) {
      toast.error(e.message || "Erro ao confirmar entrega");
    } finally {
      setConfirmingDelivery(false);
    }
  };

  if (expired) {
    return (
      <div className="p-2.5 rounded-lg bg-muted/50 border text-[11px] text-muted-foreground flex items-center gap-2">
        <Clock className="h-3.5 w-3.5" />
        Janela de 48h de satisfação expirou — eventuais problemas devem ser tratados via disputa.
      </div>
    );
  }

  return (
    <>
      <div className="p-3 rounded-lg border-2 border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
            Garantia de Satisfação 48h
          </p>
        </div>
        <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80 leading-relaxed">
          Pode cancelar e ser totalmente reembolsado nas próximas <strong>{remaining}</strong>, sem precisar de abrir disputa.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Button
            size="sm"
            className="w-full text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={confirmDelivery}
            disabled={confirmingDelivery}
          >
            {confirmingDelivery ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Confirmar entrega (libertar agora)
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="w-full text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:text-emerald-300"
            onClick={() => setOpen(true)}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Cancelar com reembolso
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar com reembolso total</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              O valor será devolvido integralmente. Conte-nos brevemente o que correu mal — usamos isto para melhorar a plataforma.
            </p>
            <Textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: o veículo não correspondia ao descrito; problemas mecânicos não reportados..."
            />
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Voltar
              </Button>
              <Button
                onClick={submit}
                disabled={loading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirmar cancelamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
