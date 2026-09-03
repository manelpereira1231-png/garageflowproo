import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mostra os LIMITES REAIS de cada plano (números explícitos), lidos do
 * catálogo gerido no painel Admin (`plan_limits_catalog` + `plans.limits`).
 *
 * Nada é hardcoded: se o admin alterar "Clientes" de 50 para 80, a landing
 * page e a página de Faturação passam a mostrar 80 imediatamente.
 */

export interface PlanLimitDef {
  key: string;
  label: string;
  description: string | null;
  unit: string | null;
  category: string;
  sort_order: number;
  allow_unlimited: boolean;
}

async function fetchLimitCatalog(): Promise<PlanLimitDef[]> {
  const { data } = await supabase
    .from("plan_limits_catalog" as any)
    .select("key,label,description,unit,category,sort_order,allow_unlimited")
    .order("sort_order", { ascending: true });
  return ((data ?? []) as unknown) as PlanLimitDef[];
}

export function usePlanLimitsCatalog() {
  return useQuery({
    queryKey: ["plan-limits-catalog"],
    queryFn: fetchLimitCatalog,
    staleTime: 5 * 60 * 1000,
  });
}

export function formatLimitValue(value: number | boolean | undefined, unit: string | null): string {
  if (value === undefined || value === null) return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value < 0) return "Ilimitado";
  if (value === 0) return "Não incluído";
  if (unit === "percent") return `${Math.round(value * 100)}%`;
  const n = value.toLocaleString("pt-PT");
  return unit === "per_month" ? `${n}/mês` : n;
}

interface Props {
  limits: Record<string, number | boolean> | undefined;
  /** Máximo de linhas mostradas (as restantes ficam ocultas). 0 = todas. */
  max?: number;
  className?: string;
}

export function PlanLimitsList({ limits, max = 0, className = "" }: Props) {
  const { data: catalog } = usePlanLimitsCatalog();
  if (!catalog || !limits) return null;

  const rows = catalog
    .filter((c) => c.unit !== "percent" && c.unit !== "boolean")
    .filter((c) => limits[c.key] !== undefined)
    .map((c) => ({ ...c, value: limits[c.key] }));

  const visible = max > 0 ? rows.slice(0, max) : rows;
  if (visible.length === 0) return null;

  return (
    <ul className={`space-y-1.5 mb-5 pb-5 border-b border-border ${className}`}>
      {visible.map((r) => {
        const unlimited = typeof r.value === "number" && r.value < 0;
        const none = r.value === 0;
        return (
          <li key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground truncate" title={r.description ?? undefined}>
              {r.label}
            </span>
            <span
              className={`font-semibold tabular-nums whitespace-nowrap ${
                none ? "text-muted-foreground/70 font-normal" : unlimited ? "text-success" : ""
              }`}
            >
              {formatLimitValue(r.value, r.unit)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
