import { supabase } from "@/integrations/supabase/client";

/**
 * Cria automaticamente uma Ordem de Serviço (status 'approved') a partir de um orçamento aprovado.
 *
 * - Idempotente: se já existir OS ligada a este quote (origin='quote', quote_id=...), devolve o id existente.
 * - Copia linhas, subtotal, iva, total, cliente, veículo, mão-de-obra e notas do orçamento.
 * - Marca o orçamento como 'converted' após criar a OS.
 *
 * Mesma lógica usada em autoCreateInvoiceFromWorkOrder — invocada quando o cliente
 * aprova o orçamento via link público (QuoteApproval).
 */
export async function autoCreateWorkOrderFromQuote(quoteId: string): Promise<{
  workOrderId: string | null;
  created: boolean;
  error?: string;
}> {
  try {
    // 1. Já existe uma OS ligada a este orçamento?
    const { data: existing } = await supabase
      .from("work_orders")
      .select("id")
      .eq("quote_id", quoteId)
      .maybeSingle();

    if (existing?.id) {
      // Garantir que orçamento fica 'converted' também neste caso
      await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);
      return { workOrderId: existing.id, created: false };
    }

    // 2. Carregar orçamento
    const { data: q, error: qErr } = await supabase
      .from("quotes")
      .select("*")
      .eq("id", quoteId)
      .maybeSingle();

    if (qErr || !q) {
      return { workOrderId: null, created: false, error: qErr?.message || "Orçamento não encontrado" };
    }

    if (!q.client_id || !q.vehicle_id) {
      return { workOrderId: null, created: false, error: "Orçamento sem cliente ou veículo" };
    }

    // 3. Gerar número sequencial
    const { data: countData } = await supabase
      .from("work_orders")
      .select("id", { count: "exact" })
      .eq("shop_id", q.shop_id);
    const num = `SRV-${String((countData?.length || 0) + 1).padStart(4, "0")}`;

    // 4. Inserir OS
    const { data: wo, error: insertError } = await supabase
      .from("work_orders")
      .insert({
        shop_id: q.shop_id,
        number: num,
        origin: "quote",
        quote_id: q.id,
        client_id: q.client_id,
        vehicle_id: q.vehicle_id,
        entry_mileage: 0,
        lines: q.lines,
        labor_hours: (q as any).labor_hours || 0,
        subtotal: Number(q.subtotal || 0),
        vat_total: Number(q.vat_total || 0),
        total: Number(q.total || 0),
        cost_total: Number(q.cost_total || 0),
        profit: Number(q.profit || 0),
        status: "approved",
        notes: q.notes || null,
      })
      .select("id")
      .single();

    if (insertError || !wo) {
      return { workOrderId: null, created: false, error: insertError?.message || "Falha a criar OS" };
    }

    // 5. Marcar orçamento como convertido
    await supabase.from("quotes").update({ status: "converted" }).eq("id", quoteId);

    return { workOrderId: wo.id, created: true };
  } catch (e: any) {
    return { workOrderId: null, created: false, error: e?.message || "Erro desconhecido" };
  }
}
