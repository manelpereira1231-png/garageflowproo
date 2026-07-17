import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Brain, AlertTriangle, Wrench, Package, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/i18n/LanguageContext";
import { useAiQuota } from "@/hooks/useAiQuota";

interface AIDiagnosisPanelProps {
  vehicle?: { make: string; model: string; year: number; fuel: string; mileage: number };
  clientDescription?: string;
  shopId: string;
  onApplyDiagnosis?: (diagnosis: string) => void;
}

interface Diagnosis {
  diagnosis_summary: string;
  possible_causes: { cause: string; probability: string; explanation?: string }[];
  recommended_services: { service: string; priority: string; estimated_hours?: number }[];
  parts_needed: { part_name: string; quantity: number; notes?: string }[];
  safety_warning?: string;
  estimated_severity: string;
}

const severityColors: Record<string, string> = {
  low: "bg-success/10 text-success",
  medium: "bg-warning/10 text-warning",
  high: "bg-destructive/10 text-destructive",
  critical: "bg-destructive text-destructive-foreground",
};

const priorityColors: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive",
  recommended: "bg-warning/10 text-warning",
  optional: "bg-muted text-muted-foreground",
};

const probabilityColors: Record<string, string> = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
};

export default function AIDiagnosisPanel({ vehicle, clientDescription, shopId, onApplyDiagnosis }: AIDiagnosisPanelProps) {
  const { language } = useLanguage();
  const isPt = language === "pt";
  const [symptoms, setSymptoms] = useState(clientDescription || "");
  const [diagnosis, setDiagnosis] = useState<Diagnosis | null>(null);
  const [loading, setLoading] = useState(false);
  const quota = useAiQuota(shopId);

  const noAi = !quota.loading && quota.limit === 0 && !quota.unlimited;
  const exhausted = !quota.loading && !quota.unlimited && quota.remaining <= 0 && quota.limit > 0;
  const disabled = loading || noAi || exhausted;

  const generateDiagnosis = async () => {
    if (!symptoms.trim()) {
      toast.error(isPt ? "Descreva os sintomas do veículo." : "Describe the vehicle symptoms.");
      return;
    }

    setLoading(true);
    try {
      // Fetch catalog and parts for context
      const [catalogRes, partsRes] = await Promise.all([
        supabase.from("service_catalog").select("name, default_price").eq("shop_id", shopId).eq("active", true).limit(30),
        supabase.from("parts").select("name, reference, sale_price, stock_quantity").eq("shop_id", shopId).eq("active", true).limit(50),
      ]);

      const { data, error } = await supabase.functions.invoke("ai-diagnosis", {
        body: {
          symptoms,
          vehicle,
          services_catalog: catalogRes.data || [],
          parts_catalog: partsRes.data || [],
          shop_id: shopId,
        },
      });

      if (error) {
        // Edge function returns 402/403 with { error: "quota_exceeded" | "plan_no_ai" }
        const raw = (error as any)?.context?.body ?? (error as any)?.message ?? "";
        const msg = String(raw);
        if (msg.includes("plan_no_ai")) throw new Error(isPt ? "O seu plano não inclui IA. Faça upgrade para desbloquear." : "Your plan does not include AI. Upgrade to unlock.");
        if (msg.includes("quota_exceeded")) throw new Error(isPt ? "Atingiu o limite mensal de créditos IA do seu plano." : "You've reached your plan's monthly AI credits limit.");
        throw error;
      }
      if (data?.error) throw new Error(data.error);

      setDiagnosis(data as Diagnosis);
    } catch (e: any) {
      console.error("AI diagnosis error:", e);
      toast.error(e?.message || (isPt ? "Erro ao gerar diagnóstico IA." : "Error generating AI diagnosis."));
    }
    setLoading(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Brain className="w-4 h-4 text-primary" />
        <Label className="font-semibold text-sm">{isPt ? "Diagnóstico IA" : "AI Diagnosis"}</Label>
        <Badge variant="outline" className="text-[10px] ml-auto">
          <Sparkles className="w-3 h-3 mr-0.5" /> AI
        </Badge>
      </div>

      {/* Input */}
      <Textarea
        value={symptoms}
        onChange={e => setSymptoms(e.target.value)}
        placeholder={isPt ? "Descreva os sintomas (ex: barulho nos travões, vibração no volante, luz de motor acesa...)" : "Describe symptoms (e.g., brake noise, steering vibration, engine light on...)"}
        rows={2}
        className="text-sm"
      />

      <Button onClick={generateDiagnosis} disabled={loading} size="sm" className="w-full">
        {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Brain className="w-4 h-4 mr-1" />}
        {loading ? (isPt ? "A analisar..." : "Analyzing...") : (isPt ? "Gerar Diagnóstico IA" : "Generate AI Diagnosis")}
      </Button>

      {/* Results */}
      {diagnosis && (
        <ScrollArea className="max-h-80">
          <div className="space-y-3 pr-2">
            {/* Safety Warning */}
            {diagnosis.safety_warning && (
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-2.5 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-destructive font-medium">{diagnosis.safety_warning}</p>
              </div>
            )}

            {/* Summary + Severity */}
            <div className="bg-muted rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold">{isPt ? "Resumo" : "Summary"}</span>
                <Badge className={`text-[10px] ${severityColors[diagnosis.estimated_severity]}`}>
                  {diagnosis.estimated_severity.toUpperCase()}
                </Badge>
              </div>
              <p className="text-xs">{diagnosis.diagnosis_summary}</p>
            </div>

            {/* Possible Causes */}
            {diagnosis.possible_causes.length > 0 && (
              <div>
                <span className="text-xs font-semibold">{isPt ? "Causas Possíveis" : "Possible Causes"}</span>
                <div className="mt-1 space-y-1">
                  {diagnosis.possible_causes.map((c, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-card rounded-lg p-2 border border-border">
                      <span className={`font-bold ${probabilityColors[c.probability]}`}>
                        {c.probability === "high" ? "●" : c.probability === "medium" ? "◐" : "○"}
                      </span>
                      <div>
                        <span className="font-medium">{c.cause}</span>
                        {c.explanation && <p className="text-muted-foreground mt-0.5">{c.explanation}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Services */}
            {diagnosis.recommended_services.length > 0 && (
              <div>
                <span className="text-xs font-semibold flex items-center gap-1"><Wrench className="w-3 h-3" /> {isPt ? "Serviços Recomendados" : "Recommended Services"}</span>
                <div className="mt-1 space-y-1">
                  {diagnosis.recommended_services.map((s, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-card rounded-lg p-2 border border-border">
                      <span>{s.service}</span>
                      <div className="flex items-center gap-2">
                        {s.estimated_hours && <span className="text-muted-foreground">{s.estimated_hours}h</span>}
                        <Badge className={`text-[10px] ${priorityColors[s.priority]}`}>{s.priority}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Parts Needed */}
            {diagnosis.parts_needed.length > 0 && (
              <div>
                <span className="text-xs font-semibold flex items-center gap-1"><Package className="w-3 h-3" /> {isPt ? "Peças Necessárias" : "Parts Needed"}</span>
                <div className="mt-1 space-y-1">
                  {diagnosis.parts_needed.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs bg-card rounded-lg p-2 border border-border">
                      <span>{p.part_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">x{p.quantity}</span>
                        {p.notes && <span className="text-muted-foreground text-[10px]">{p.notes}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Apply button */}
            {onApplyDiagnosis && (
              <Button size="sm" variant="outline" className="w-full" onClick={() => onApplyDiagnosis(diagnosis.diagnosis_summary)}>
                {isPt ? "Aplicar ao Diagnóstico" : "Apply to Diagnosis"}
              </Button>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
