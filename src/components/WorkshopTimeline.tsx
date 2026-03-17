import { CheckCircle, Circle, Clock } from "lucide-react";

interface TimelineStep {
  key: string;
  label: string;
  done: boolean;
  active: boolean;
  timestamp?: string;
}

const STATUS_ORDER = ["open", "diagnosis", "waiting_approval", "approved", "in_progress", "completed", "delivered"];

const STATUS_LABELS_PT: Record<string, string> = {
  open: "Aberto",
  diagnosis: "Diagnóstico",
  waiting_approval: "Aguarda Aprovação",
  approved: "Aprovado",
  in_progress: "Em Execução",
  completed: "Concluído",
  delivered: "Entregue",
};

interface Props {
  currentStatus: string;
  createdAt?: string;
  completedAt?: string;
  deliveredAt?: string;
}

export default function WorkshopTimeline({ currentStatus, createdAt, completedAt, deliveredAt }: Props) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);

  const steps: TimelineStep[] = STATUS_ORDER.map((key, idx) => ({
    key,
    label: STATUS_LABELS_PT[key] || key,
    done: idx < currentIdx,
    active: idx === currentIdx,
    timestamp:
      key === "open" ? createdAt :
      key === "completed" ? completedAt :
      key === "delivered" ? deliveredAt : undefined,
  }));

  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {steps.map((step, idx) => (
        <div key={step.key} className="flex items-center">
          <div className="flex flex-col items-center min-w-[60px]">
            {step.done ? (
              <CheckCircle className="w-5 h-5 text-success" />
            ) : step.active ? (
              <Clock className="w-5 h-5 text-primary animate-pulse" />
            ) : (
              <Circle className="w-5 h-5 text-muted-foreground/30" />
            )}
            <span className={`text-[10px] mt-1 text-center leading-tight ${
              step.active ? "text-primary font-semibold" : step.done ? "text-success" : "text-muted-foreground/50"
            }`}>
              {step.label}
            </span>
            {step.timestamp && (
              <span className="text-[9px] text-muted-foreground">
                {new Date(step.timestamp).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}
              </span>
            )}
          </div>
          {idx < steps.length - 1 && (
            <div className={`h-0.5 w-4 shrink-0 ${step.done ? "bg-success" : "bg-muted-foreground/15"}`} />
          )}
        </div>
      ))}
    </div>
  );
}
