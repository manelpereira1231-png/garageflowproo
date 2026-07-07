import { Badge } from "@/components/ui/badge";
import { ShieldCheck, FileText, Ban } from "lucide-react";

/**
 * Selo legal do estado de certificação AT de um documento fiscal.
 * Lê o campo `legal_status` da tabela `invoices`:
 *   - draft      → Rascunho (sem valor fiscal)
 *   - certified  → Certificada (ATCUD + série InvoiceXpress/Moloni)
 *   - cancelled  → Anulada (via Nota de Crédito)
 */
export type LegalStatus = "draft" | "certified" | "cancelled" | null | undefined;

interface Props {
  legalStatus?: LegalStatus;
  atcud?: string | null;
  series?: string | null;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export default function CertifiedBadge({
  legalStatus,
  atcud,
  series,
  size = "sm",
  showLabel = true,
}: Props) {
  const status: LegalStatus = legalStatus || "draft";
  const iconSize = size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (status === "certified") {
    return (
      <Badge
        variant="secondary"
        className={`bg-success/10 text-success border border-success/20 gap-1 ${textSize}`}
        title={
          atcud
            ? `Documento certificado pela AT · ATCUD: ${atcud}${series ? ` · Série: ${series}` : ""}`
            : "Documento fiscal certificado pela AT"
        }
      >
        <ShieldCheck className={iconSize} />
        {showLabel && "Certificada"}
      </Badge>
    );
  }

  if (status === "cancelled") {
    return (
      <Badge
        variant="secondary"
        className={`bg-destructive/10 text-destructive border border-destructive/20 gap-1 ${textSize}`}
        title="Anulada por Nota de Crédito"
      >
        <Ban className={iconSize} />
        {showLabel && "Anulada"}
      </Badge>
    );
  }

  return (
    <Badge
      variant="secondary"
      className={`bg-muted text-muted-foreground border border-border gap-1 ${textSize}`}
      title="Rascunho interno — sem valor fiscal. Emita via faturação certificada para valor legal."
    >
      <FileText className={iconSize} />
      {showLabel && "Rascunho"}
    </Badge>
  );
}
