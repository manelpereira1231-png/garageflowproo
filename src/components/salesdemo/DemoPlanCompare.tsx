/**
 * Comparação rápida de planos para a Sales Demo.
 * Usa exclusivamente dados reais (plans_public, plan_features, features
 * e preços do país ativo). Não existe plano gratuito.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePlansCatalog } from "@/hooks/usePlansCatalog";
import { PLAN_LABEL, type DemoPlan } from "@/lib/salesDemo";

const ORDER: DemoPlan[] = ["free", "pro", "garage"];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: DemoPlan;
  priceLabel: (p: DemoPlan) => string;
  onSelect: (p: DemoPlan) => void;
}

export default function DemoPlanCompare({ open, onOpenChange, plan, priceLabel, onSelect }: Props) {
  const { data: catalog } = usePlansCatalog();
  const [pair, setPair] = useState<"free-pro" | "pro-garage">("pro-garage");

  const { data: featureNames } = useQuery({
    queryKey: ["demo-feature-names"],
    queryFn: async () => {
      const { data } = await supabase.from("features").select("slug,name").eq("active", true);
      return Object.fromEntries(((data ?? []) as any[]).map((f) => [f.slug, f.name])) as Record<string, string>;
    },
    staleTime: 10 * 60 * 1000,
  });

  const [from, to] = pair === "free-pro" ? (["free", "pro"] as const) : (["pro", "garage"] as const);

  const diff = useMemo(() => {
    const src = catalog?.features?.[from] ?? [];
    const dst = catalog?.features?.[to] ?? [];
    const enabledSrc = new Set(src.filter((f) => f.enabled).map((f) => f.feature_slug));
    return dst
      .filter((f) => f.enabled && !enabledSrc.has(f.feature_slug))
      .map((f) => featureNames?.[f.feature_slug] ?? f.feature_slug)
      .sort((a, b) => a.localeCompare(b, "pt"));
  }, [catalog, featureNames, from, to]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Comparar planos</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-border overflow-hidden">
          {ORDER.map((p) => (
            <button
              key={p}
              onClick={() => { onSelect(p); onOpenChange(false); }}
              className={`w-full flex items-center justify-between px-4 py-3 text-sm border-b border-border last:border-0 transition-colors ${
                p === plan ? "bg-primary/10 text-foreground font-semibold" : "hover:bg-muted/50"
              }`}
            >
              <span className="flex items-center gap-2">
                {p === plan && <Check className="w-4 h-4 text-primary" />}
                {PLAN_LABEL[p]}
              </span>
              <span className="tabular-nums">{priceLabel(p)}</span>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Enterprise: solução à medida, mediante contacto e demonstração dedicada.
        </p>

        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant={pair === "free-pro" ? "default" : "outline"}
            onClick={() => setPair("free-pro")}
          >
            Start <ArrowRight className="w-3 h-3 mx-1" /> Pro
          </Button>
          <Button
            size="sm"
            variant={pair === "pro-garage" ? "default" : "outline"}
            onClick={() => setPair("pro-garage")}
          >
            Pro <ArrowRight className="w-3 h-3 mx-1" /> Garage
          </Button>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            O que passa a ter no {PLAN_LABEL[to]}
          </p>
          {diff.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem diferenças de funcionalidades registadas.</p>
          ) : (
            <ul className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {diff.map((name) => (
                <li key={name} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
