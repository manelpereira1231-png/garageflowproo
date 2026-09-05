/** Peças reutilizáveis do Centro Financeiro (origem do valor, KPI com drill-down). */
import { ReactNode, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { SOURCE_LABEL, type ValueSource } from "@/lib/platformFinance";
import { cn } from "@/lib/utils";

const SOURCE_STYLE: Record<ValueSource, string> = {
  api: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  database: "bg-sky-500/10 text-sky-600 border-sky-500/30",
  manual: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  estimate: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  projection: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  unavailable: "bg-muted text-muted-foreground border-border",
};

export function SourceBadge({ source, className }: { source: ValueSource; className?: string }) {
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium px-1.5 py-0", SOURCE_STYLE[source], className)}>
      {SOURCE_LABEL[source]}
    </Badge>
  );
}

interface KpiProps {
  label: string;
  value: string;
  source: ValueSource;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "positive" | "negative";
  formula?: string;
  drill?: ReactNode;
}

/** KPI com drill-down: ao abrir mostra a fórmula e a origem do valor. */
export function KpiCard({ label, value, source, hint, icon, tone = "default", formula, drill }: KpiProps) {
  const [open, setOpen] = useState(false);
  const toneClass = tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-destructive" : "";
  const expandable = Boolean(formula || drill);

  return (
    <Card className="overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className={cn("text-xl sm:text-2xl font-bold mt-1 break-words", toneClass)}>{value}</p>
              {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
            </div>
            {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
          </div>
          <div className="flex items-center justify-between gap-2 mt-3">
            <SourceBadge source={source} />
            {expandable && (
              <CollapsibleTrigger className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                De onde vem
                <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
              </CollapsibleTrigger>
            )}
          </div>
          <CollapsibleContent className="mt-3 space-y-2 border-t pt-3">
            {formula && <p className="text-[11px] text-muted-foreground leading-relaxed">{formula}</p>}
            {drill}
          </CollapsibleContent>
        </CardContent>
      </Collapsible>
    </Card>
  );
}

export function SectionTitle({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{children}</p>;
}
