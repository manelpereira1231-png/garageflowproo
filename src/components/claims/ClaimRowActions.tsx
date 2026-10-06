import { useNavigate } from "react-router-dom";
import { MoreHorizontal, FileText, Wrench, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function ClaimRowActions({ claim }: { claim: { id: string; ref?: string; client_id?: string; vehicle_id?: string; quote_id?: string | null; work_order_id?: string | null; status?: string } }) {
  const navigate = useNavigate();
  const canCreate = Boolean(claim.client_id && claim.vehicle_id) && !["done", "cancelled"].includes(claim.status || "");
  const context = new URLSearchParams({ client: claim.client_id || "", vehicle: claim.vehicle_id || "", claim: claim.id });
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button size="icon" variant="ghost" className="h-11 w-11 shrink-0" aria-label={`Ações de ${claim.ref || "sinistro"}`} title="Ações do sinistro" onClick={(event) => event.stopPropagation()}><MoreHorizontal className="h-5 w-5" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className="claims-surface" onClick={(event) => event.stopPropagation()}>
      <DropdownMenuItem className="min-h-[44px]" onSelect={() => navigate(`/claims/${claim.id}`)}><ArrowUpRight className="mr-2 h-4 w-4" />Abrir sinistro</DropdownMenuItem>
      <DropdownMenuItem className="min-h-[44px]" disabled={!claim.quote_id && !canCreate} onSelect={() => navigate(claim.quote_id ? `/quotes/${claim.quote_id}` : `/quotes/new?${context}`)}><FileText className="mr-2 h-4 w-4" />{claim.quote_id ? "Ver orçamento" : "Criar orçamento"}</DropdownMenuItem>
      <DropdownMenuItem className="min-h-[44px]" disabled={!claim.work_order_id && !canCreate} onSelect={() => navigate(claim.work_order_id ? `/services/${claim.work_order_id}` : `/services/new?${context}`)}><Wrench className="mr-2 h-4 w-4" />{claim.work_order_id ? "Ver serviço" : "Criar serviço"}</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}