import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Zap, Filter, Clock, ArrowDown, Send } from "lucide-react";

export interface FlowConditions {
  min_total?: number | null;
  vip_only?: boolean;
  client_tag?: string;
  delay_minutes?: number | null;
}

interface Props {
  triggerLabel: string;
  actionLabel: string;
  actionIcon?: React.ComponentType<{ className?: string }>;
  conditions: FlowConditions;
  onChange: (next: FlowConditions) => void;
}

/**
 * Visual flow builder: Trigger → Conditions (IF) → Delay → Action.
 * Persists into the existing `conditions` JSONB column on automation_rules.
 * No layout/design changes to the parent — renders as a vertical stack of cards.
 */
export function VisualFlowBuilder({
  triggerLabel,
  actionLabel,
  actionIcon: ActionIcon = Send,
  conditions,
  onChange,
}: Props) {
  const update = (patch: Partial<FlowConditions>) => onChange({ ...conditions, ...patch });

  return (
    <div className="space-y-2">
      {/* Trigger */}
      <Card className="p-3 border-l-4 border-l-primary">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Quando</p>
            <p className="text-sm font-medium truncate">{triggerLabel}</p>
          </div>
        </div>
      </Card>

      <div className="flex justify-center"><ArrowDown className="w-3 h-3 text-muted-foreground/60" /></div>

      {/* Conditions */}
      <Card className="p-3 border-l-4 border-l-warning">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-warning shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Se (condições)</p>
            <p className="text-xs text-muted-foreground">Opcional — deixe vazio para executar sempre</p>
          </div>
        </div>
        <div className="space-y-2 pl-6">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Apenas clientes VIP</Label>
            <Switch
              checked={!!conditions.vip_only}
              onCheckedChange={(v) => update({ vip_only: v })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor mínimo ({getCountryConfig().currencySymbol})</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={conditions.min_total ?? ""}
              onChange={(e) => update({ min_total: e.target.value === "" ? null : Number(e.target.value) })}
              placeholder="Ex: 100"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta de cliente</Label>
            <Input
              value={conditions.client_tag ?? ""}
              onChange={(e) => update({ client_tag: e.target.value })}
              placeholder="Ex: frota, particular"
              className="h-8 text-xs"
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-center"><ArrowDown className="w-3 h-3 text-muted-foreground/60" /></div>

      {/* Delay */}
      <Card className="p-3 border-l-4 border-l-info">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-info shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Esperar</p>
          </div>
        </div>
        <div className="pl-6 flex items-center gap-2">
          <Select
            value={String(conditions.delay_minutes ?? 0)}
            onValueChange={(v) => update({ delay_minutes: Number(v) })}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="0">Imediato</SelectItem>
              <SelectItem value="60">1 hora depois</SelectItem>
              <SelectItem value="1440">1 dia depois</SelectItem>
              <SelectItem value="4320">3 dias depois</SelectItem>
              <SelectItem value="10080">1 semana depois</SelectItem>
              <SelectItem value="43200">30 dias depois</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="flex justify-center"><ArrowDown className="w-3 h-3 text-muted-foreground/60" /></div>

      {/* Action */}
      <Card className="p-3 border-l-4 border-l-success">
        <div className="flex items-center gap-2">
          <ActionIcon className="w-4 h-4 text-success shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Então</p>
            <p className="text-sm font-medium truncate">{actionLabel}</p>
          </div>
          <Badge variant="outline" className="text-[9px]">final</Badge>
        </div>
      </Card>
    </div>
  );
}
