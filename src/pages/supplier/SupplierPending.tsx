import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, XCircle, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useIsSupplier } from "@/hooks/useIsSupplier";
import { supabase } from "@/integrations/supabase/client";

export default function SupplierPending() {
  const { state, rejectionReason, loading } = useIsSupplier();

  const config: Record<string, { icon: any; title: string; desc: string; tone: string }> = {
    invited: { icon: Clock, tone: "text-amber-500", title: "Convite recebido",
      desc: "Recebeu um convite. Complete o registo para submeter a sua candidatura para aprovação." },
    pending: { icon: Clock, tone: "text-amber-500", title: "Candidatura em análise",
      desc: "A sua candidatura foi recebida e está a ser analisada pela nossa equipa." },
    pending_approval: { icon: Clock, tone: "text-amber-500", title: "Aguarda aprovação",
      desc: "Os seus dados estão a ser validados. Receberá uma notificação assim que a conta for ativada." },
    rejected: { icon: XCircle, tone: "text-destructive", title: "Candidatura rejeitada",
      desc: rejectionReason || "A sua candidatura não foi aprovada. Contacte o suporte para mais informação." },
    suspended: { icon: ShieldAlert, tone: "text-destructive", title: "Conta suspensa",
      desc: "A sua conta de fornecedor está temporariamente suspensa." },
    blocked: { icon: ShieldAlert, tone: "text-destructive", title: "Conta bloqueada",
      desc: "A sua conta foi bloqueada. Contacte o suporte." },
    approved: { icon: CheckCircle2, tone: "text-emerald-500", title: "Conta aprovada", desc: "Já pode aceder ao dashboard." },
  };

  const c = config[state ?? "pending"] ?? config.pending;
  const Icon = c.icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
            <Icon className={`w-7 h-7 ${c.tone}`} />
          </div>
          <CardTitle>{loading ? "A carregar..." : c.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{c.desc}</p>
          <div className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => window.location.reload()}>Atualizar</Button>
            <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); window.location.href = "/auth"; }}>
              Terminar sessão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
