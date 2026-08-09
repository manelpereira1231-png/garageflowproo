import { supabase } from "@/integrations/supabase/client";

/**
 * Consumo de stock das peças de uma Ordem de Serviço.
 *
 * A lógica vive integralmente na RPC transacional `consume_work_order_parts`
 * (SECURITY INVOKER, RLS aplicada). Este ficheiro é apenas o wrapper que mantém
 * a interface já usada por Services.tsx e Workshop.tsx.
 *
 * Garantias da RPC:
 *  - transacional: ou todas as peças são processadas, ou nenhuma;
 *  - idempotente por (work_order_id, part_id) — unique index parcial em stock_movements;
 *  - delta: aumentar quantidade consome só a diferença; reduzir NÃO devolve stock
 *    (devolução continua manual em Stock);
 *  - decremento atómico com bloqueio determinístico (sem race condition);
 *  - stock negativo permitido, devolvendo aviso em `insufficient`;
 *  - peça inexistente ou de outra oficina => erro `PART_NOT_FOUND` + rollback total;
 *  - histórico continua em `stock_movements` (type = 'out', com work_order_id).
 */
export async function consumeWorkOrderParts(params: {
  workOrderId: string;
  shopId: string | null | undefined;
  lines: any;
  reference?: string | null;
}): Promise<{ consumed: number; insufficient: string[]; skipped: boolean; error?: string }> {
  const { workOrderId, shopId, lines, reference } = params;
  const empty = { consumed: 0, insufficient: [] as string[], skipped: true };
  if (!workOrderId || !shopId) return empty;

  const svcLines = Array.isArray(lines) ? lines : [];
  const partLines = svcLines.filter(
    (l: any) => l?.type === "part" && l?.ref_id && Number(l?.quantity) > 0
  );
  if (partLines.length === 0) return empty;

  const { data, error } = await supabase.rpc("consume_work_order_parts" as any, {
    p_work_order_id: workOrderId,
    p_lines: partLines as any,
    p_reference: reference || null,
  });

  if (error) {
    return { ...empty, error: error.message };
  }

  const result = (data || {}) as any;
  return {
    consumed: Number(result.consumed) || 0,
    insufficient: Array.isArray(result.insufficient) ? result.insufficient : [],
    skipped: Boolean(result.skipped),
  };
}
