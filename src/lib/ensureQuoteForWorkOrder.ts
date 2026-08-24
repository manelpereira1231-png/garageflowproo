import { supabase } from "@/integrations/supabase/client";
import { insertWithNumber, nextDocNumber } from "@/lib/insertWithNumber";

/**
 * Devolve o token de aprovação do orçamento **desta** Ordem de Serviço.
 *
 * Regras (evita o bug de apontar para um orçamento antigo já aprovado/convertido):
 * - Se a OS já tem `quote_id`, usa esse orçamento — nunca outro.
 * - Se não tem e a OS está em `waiting_approval`, cria um orçamento novo
 *   (status `sent`, pendente de decisão do cliente) copiado da OS e liga-o
 *   à OS via `work_orders.quote_id`. Idempotente: uma segunda chamada
 *   reencontra o orçamento ligado.
 * - Caso contrário devolve `null` (sem link de aprovação) — nunca reutiliza
 *   o "último orçamento do cliente", que podia estar já aprovado/convertido.
 */
export async function ensureQuoteTokenForWorkOrder(wo: any): Promise<string | null> {
  if (!wo) return null;

  // 1. Orçamento já ligado a esta OS
  if (wo.quote_id) {
    const { data } = await supabase
      .from("quotes")
      .select("token")
      .eq("id", wo.quote_id)
      .maybeSingle();
    return (data as any)?.token || null;
  }
  if ((wo.quotes as any)?.token) return (wo.quotes as any).token;

  // 2. Só criamos orçamento quando a OS aguarda mesmo aprovação do cliente
  if (wo.status !== "waiting_approval") return null;

  const shopId = wo.shop_id || localStorage.getItem("garageflow_active_shop");
  if (!shopId || !wo.client_id || !wo.vehicle_id) return null;

  const { data: created, error } = await insertWithNumber<any>({
    getNumber: () => nextDocNumber(shopId, "ORC"),
    insert: (number) =>
      supabase
        .from("quotes")
        .insert({
          shop_id: shopId,
          number,
          client_id: wo.client_id,
          vehicle_id: wo.vehicle_id,
          lines: Array.isArray(wo.lines) ? wo.lines : [],
          labor_hours: Number(wo.labor_hours || 0),
          subtotal: Number(wo.subtotal || 0),
          vat_total: Number(wo.vat_total || 0),
          total: Number(wo.total || 0),
          cost_total: Number(wo.cost_total || 0),
          profit: Number(wo.profit || 0),
          notes: wo.notes || wo.diagnosis || null,
          status: "sent",
        })
        .select("id, token")
        .single() as any,
  });

  if (error || !created) return null;

  await supabase.from("work_orders").update({ quote_id: created.id }).eq("id", wo.id);
  // manter o objeto local coerente para chamadas seguintes na mesma sessão
  wo.quote_id = created.id;
  wo.quotes = { token: created.token };

  return created.token || null;
}
