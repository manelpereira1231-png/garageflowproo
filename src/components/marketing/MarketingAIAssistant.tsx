import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mail, MessageSquare, Phone, Bell, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useAiQuota } from "@/hooks/useAiQuota";

export type AIInsight = {
  id: string;
  segment: string;
  count: number;
  channel: "email" | "sms" | "whatsapp" | "push";
  subject: string;
  content: string;
  headline: string;
  reason: string;
  priority: number;
};

const CHANNEL_ICON: Record<AIInsight["channel"], typeof Mail> = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
  push: Bell,
};

const CHANNEL_LABEL: Record<AIInsight["channel"], string> = {
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Notificação",
};

interface Props {
  shopId: string | null;
  onCreateCampaign: (insight: AIInsight) => void;
}

export default function MarketingAIAssistant({ shopId, onCreateCampaign }: Props) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsight[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const quota = useAiQuota(shopId);
  const noAi = !quota.loading && quota.limit === 0 && !quota.unlimited;
  const exhausted = !quota.loading && !quota.unlimited && quota.remaining <= 0 && quota.limit > 0;
  const blocked = noAi || exhausted;

  const analyze = useCallback(async () => {
    if (!shopId || blocked) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-ai-insights", {
        body: { shop_id: shopId },
      });
      if (error) {
        // O SDK devolve apenas "non-2xx status code"; o motivo real vem no corpo.
        let code = String((error as any)?.message ?? "");
        let friendly = "";
        try {
          const ctx = (error as any).context;
          const resp: Response | undefined = ctx instanceof Response ? ctx : ctx?.response;
          const body = resp ? await resp.clone().json().catch(() => null) : null;
          if (body?.error) code = String(body.error);
          if (body?.message) friendly = String(body.message);
        } catch { /* mantém o código do SDK */ }
        if (code.includes("plan_no_ai")) throw new Error("O seu plano não inclui IA. Faça upgrade para usar o assistente.");
        if (code.includes("quota_exceeded")) throw new Error("Atingiu o limite mensal de créditos IA.");
        if (code.includes("rate_limited")) throw new Error("IA temporariamente indisponível. Tente novamente dentro de instantes.");
        if (code.includes("credits_exhausted")) throw new Error("Créditos de IA esgotados.");
        if (code.includes("Unauthorized") || code.includes("Forbidden")) throw new Error("Sem permissão para gerar sugestões nesta oficina.");
        throw new Error(friendly || "Não foi possível gerar sugestões agora. Tente novamente.");
      }
      if ((data as any)?.error) {
        const msg = (data as any)?.message || (data as any)?.error;
        setError(msg);
        setInsights([]);
        return;
      }
      setInsights(((data as any)?.insights ?? []) as AIInsight[]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Erro ao gerar sugestões");
      toast.error(e?.message ?? "Não foi possível gerar sugestões IA");
    } finally {
      setLoading(false);
    }
  }, [shopId, blocked]);

  useEffect(() => {
    if (shopId && insights === null && !blocked && !quota.loading) {
      analyze();
    }
  }, [shopId, insights, analyze, blocked, quota.loading]);

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Assistente IA
                <Badge variant="outline" className="text-[10px] py-0 px-1.5">Beta</Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Sugestões automáticas com base nos dados reais da oficina.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {!quota.loading && (
              <Badge variant={blocked ? "destructive" : "secondary"} className="text-[10px]">
                {quota.unlimited ? "Ilimitado" : `${quota.used}/${quota.limit}`}
              </Badge>
            )}
            <Button size="sm" variant="ghost" onClick={analyze} disabled={loading || !shopId || blocked}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        {noAi && (
          <div className="text-xs bg-destructive/10 border border-destructive/30 rounded-md p-2 text-destructive mb-2">
            O seu plano não inclui créditos IA. Faça upgrade para desbloquear o assistente de marketing.
          </div>
        )}
        {exhausted && (
          <div className="text-xs bg-warning/10 border border-warning/30 rounded-md p-2 text-warning mb-2">
            Atingiu o limite mensal de créditos IA do seu plano. Renova no próximo mês ou muda de plano.
          </div>
        )}

        {loading && insights === null && (
          <div className="text-xs text-muted-foreground py-4 text-center">
            A analisar dados da oficina…
          </div>
        )}

        {!loading && insights?.length === 0 && !error && (
          <div className="text-xs text-muted-foreground py-4 text-center">
            Sem oportunidades ativas neste momento. Volta mais tarde.
          </div>
        )}

        {error && (
          <div className="text-xs text-destructive py-2">
            {error}
          </div>
        )}

        {insights && insights.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {insights.map((it) => {
              const Icon = CHANNEL_ICON[it.channel];
              return (
                <div
                  key={it.id}
                  className="rounded-lg border border-border/60 bg-background/60 p-3 flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{it.headline}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-2">
                        {it.reason}
                      </div>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {it.count}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Icon className="w-3 h-3" />
                      {CHANNEL_LABEL[it.channel]}
                    </Badge>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-7 text-xs gap-1"
                      onClick={() => onCreateCampaign(it)}
                    >
                      <Wand2 className="w-3 h-3" />
                      Criar campanha
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
