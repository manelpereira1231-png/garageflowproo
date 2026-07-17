import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Mail, MessageSquare, Phone, Bell, RefreshCw, Wand2 } from "lucide-react";
import { toast } from "sonner";

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

  const analyze = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.functions.invoke("marketing-ai-insights", {
        body: { shop_id: shopId },
      });
      if (error) throw error;
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
      toast.error("Não foi possível gerar sugestões IA");
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (shopId && insights === null) {
      analyze();
    }
  }, [shopId, insights, analyze]);

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
          <Button size="sm" variant="ghost" onClick={analyze} disabled={loading || !shopId}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>

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
