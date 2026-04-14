import { CheckCircle, Clock, Eye, Search, ShieldCheck, Rocket, XCircle, Phone, CalendarCheck, MapPin } from "lucide-react";

const STEPS = [
  { key: "pending_payment", label: "Submetido", desc: "Aguarda pagamento da inspeção" },
  { key: "pending_inspection", label: "Oficina atribuída", desc: "Pagamento confirmado, oficina selecionada" },
  { key: "awaiting_contact", label: "A aguardar contacto", desc: "Oficina vai contactar para agendar" },
  { key: "scheduled", label: "Inspeção agendada", desc: "Data e hora confirmadas" },
  { key: "inspecting", label: "Em inspeção", desc: "Oficina a realizar inspeção" },
  { key: "pending_approval", label: "Aguarda aprovação", desc: "Inspeção concluída, a aguardar validação" },
  { key: "published", label: "Publicado", desc: "Carro visível no marketplace" },
  { key: "sold", label: "Vendido", desc: "Venda confirmada" },
];

const ICON_MAP: Record<string, any> = {
  pending_payment: Clock,
  pending_inspection: Search,
  awaiting_contact: Phone,
  scheduled: CalendarCheck,
  inspecting: Eye,
  pending_approval: ShieldCheck,
  published: Rocket,
  sold: CheckCircle,
  rejected: XCircle,
};

// Map real inspection statuses to timeline steps
function getTimelineStep(listingStatus: string, inspectionStatus?: string): string {
  if (listingStatus === "pending_payment") return "pending_payment";
  if (listingStatus === "pending_inspection") {
    if (inspectionStatus === "scheduled") return "scheduled";
    if (inspectionStatus === "pending") return "awaiting_contact";
    return "pending_inspection";
  }
  if (listingStatus === "inspecting" || inspectionStatus === "in_progress") return "inspecting";
  if (listingStatus === "pending_approval") return "pending_approval";
  if (listingStatus === "published") return "published";
  if (listingStatus === "sold") return "sold";
  if (listingStatus === "rejected") return "rejected";
  return listingStatus;
}

interface Props {
  status: string;
  inspectionStatus?: string;
  scheduledDate?: string | null;
  scheduledTime?: string | null;
  shopName?: string | null;
  shopAddress?: string | null;
}

export default function VehicleTimeline({ status, inspectionStatus, scheduledDate, scheduledTime, shopName, shopAddress }: Props) {
  const effectiveStep = getTimelineStep(status, inspectionStatus);
  const currentIdx = STEPS.findIndex(s => s.key === effectiveStep);
  const isRejected = status === "rejected";

  return (
    <div className="py-4">
      <div className="relative">
        {STEPS.map((step, i) => {
          const isDone = i < currentIdx;
          const isCurrent = i === currentIdx;
          const Icon = ICON_MAP[step.key] || Clock;

          // Enrich description with real data
          let desc = step.desc;
          if (step.key === "scheduled" && (isDone || isCurrent) && scheduledDate) {
            desc = `${scheduledDate}${scheduledTime ? ` às ${scheduledTime}` : ""}`;
            if (shopName) desc += ` — ${shopName}`;
          }
          if ((step.key === "awaiting_contact" || step.key === "pending_inspection") && (isDone || isCurrent) && shopName) {
            desc = `Oficina: ${shopName}`;
            if (shopAddress) desc += ` · ${shopAddress}`;
          }

          return (
            <div key={step.key} className="flex items-start gap-3 mb-0">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  isDone ? "bg-green-500 text-white" :
                  isCurrent ? (isRejected ? "bg-red-500 text-white" : "bg-amber-500 text-white ring-2 ring-amber-300") :
                  "bg-muted text-muted-foreground"
                }`}>
                  <Icon className="h-4 w-4" />
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`w-0.5 h-8 ${isDone ? "bg-green-400" : "bg-border"}`} />
                )}
              </div>
              <div className="pt-1">
                <p className={`text-sm font-medium ${isCurrent ? "text-foreground" : isDone ? "text-green-700 dark:text-green-400" : "text-muted-foreground"}`}>
                  {step.label}
                  {isDone && <CheckCircle className="inline h-3 w-3 ml-1" />}
                </p>
                {(isCurrent || isDone) && (
                  <p className="text-xs text-muted-foreground">{desc}</p>
                )}
              </div>
            </div>
          );
        })}

        {isRejected && (
          <div className="flex items-start gap-3 mt-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-red-500 text-white ring-2 ring-red-300">
              <XCircle className="h-4 w-4" />
            </div>
            <div className="pt-1">
              <p className="text-sm font-medium text-red-600">Rejeitado</p>
              <p className="text-xs text-muted-foreground">O veículo não passou na inspeção</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
