import { supabase } from "@/integrations/supabase/client";

/**
 * Consumo de stock das peças de uma Ordem de Serviço.
 *
 * Fluxo oficial (extraído de Services.tsx — comportamento preservado byte a byte):
 *  - só corre na CONCLUSÃO do serviço (nunca ao adicionar a peça à OS);
 *  - lê as linhas `type === 'part'` com `ref_id` e `quantity > 0`;
 *  - decrementa `parts.stock_quantity` e regista um movimento `out` em `stock_movements`;
 *  - permite stock negativo (apenas avisa), tal como o sistema existente.
 *
 * IDEMPOTÊNCIA: se já existir qualquer movimento `out` associado a esta OS,
 * o consumo é ignorado. É isto que impede duplo desconto quando a conclusão
 * acontece por caminhos diferentes (Serviços vs Modo Oficina) ou em reabertura.
 *
 * Multi-tenant: o `shop_id` vem do chamador e as peças são filtradas por
 * `.eq("shop_id", shopId)`; a RLS de `parts`/`stock_movements` faz o resto.
 */
export async function consumeWorkOrderParts(params: {
  workOrderId: string;
  shopId: string | null | undefined;
  lines: any;
  reference?: string | null;
}): Promise<{ consumed: number; insufficient: string[]; skipped: boolean }> {
  const { workOrderId, shopId, lines, reference } = params;
  const empty = { consumed: 0, insufficient: [] as string[], skipped: true };
  if (!workOrderId || !shopId) return empty;

  const svcLines = Array.isArray(lines) ? lines : [];
  const partLines = svcLines.filter(
    (l: any) => l?.type === "part" && l?.ref_id && Number(l?.quantity) > 0
  );
  if (partLines.length === 0) return empty;

  // Guarda de idempotência — uma única operação de consumo por OS.
  const { data: existing } = await supabase
    .from("stock_movements")
    .select("id")
    .eq("work_order_id", workOrderId)
    .eq("type", "out")
    .limit(1);
  if (existing && existing.length > 0) return empty;

  const partIds = Array.from(new Set(partLines.map((l: any) => String(l.ref_id)))) as string[];
  const { data: partsData } = await supabase
    .from("parts")
    .select("id, name, stock_quantity")
    .in("id", partIds)
    .eq("shop_id", shopId);

  const partsMap = new Map<string, any>((partsData || []).map((p: any) => [p.id, p]));
  const insufficient: string[] = [];
  let consumed = 0;

  for (const l of partLines) {
    const p = partsMap.get(String(l.ref_id));
    if (!p) continue;
    const qty = Number(l.quantity) || 0;
    const newStock = (Number(p.stock_quantity) || 0) - qty;
    if (newStock < 0) insufficient.push(`${p.name} (falta ${Math.abs(newStock)})`);
    await supabase.from("parts").update({ stock_quantity: newStock } as any).eq("id", p.id);
    await supabase.from("stock_movements").insert({
      shop_id: shopId,
      part_id: p.id,
      type: "out",
      quantity: qty,
      reason: `Consumo em serviço ${reference || ""}`.trim(),
      work_order_id: workOrderId,
    } as any);
    consumed += 1;
  }

  return { consumed, insufficient, skipped: false };
}
