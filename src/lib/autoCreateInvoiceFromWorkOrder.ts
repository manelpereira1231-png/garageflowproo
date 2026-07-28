import { supabase } from "@/integrations/supabase/client";

/**
 * Cria automaticamente uma fatura (rascunho) a partir de uma Ordem de Serviço concluída.
 *
 * - Idempotente: se já existir fatura ligada a este work_order, devolve o id existente.
 * - Copia linhas, subtotal, iva, total, cliente, veículo e notas da OS.
 * - Não emite no InvoiceExpress; fica em "draft" no GarageFlow.
 *   A emissão certificada (Fatura-Recibo) é disparada quando o pagamento é registado.
 */
export async function autoCreateInvoiceFromWorkOrder(workOrderId: string): Promise<{
  invoiceId: string | null;
  created: boolean;
  error?: string;
}> {
  try {
    // 1. Verificar se já existe fatura para esta OS
    const { data: existing } = await supabase
      .from("invoices")
      .select("id")
      .eq("work_order_id", workOrderId)
      .maybeSingle();

    if (existing?.id) {
      return { invoiceId: existing.id, created: false };
    }

    // 2. Carregar a Ordem de Serviço
    const { data: wo, error: woErr } = await supabase
      .from("work_orders")
      .select("*")
      .eq("id", workOrderId)
      .maybeSingle();

    if (woErr || !wo) {
      return { invoiceId: null, created: false, error: woErr?.message || "OS não encontrada" };
    }

    if (!wo.client_id) {
      return { invoiceId: null, created: false, error: "OS sem cliente associado" };
    }

    // 3. Gerar número via RPC (sequencial atómico)
    const { data: numData } = await supabase.rpc("next_invoice_number", { _shop_id: wo.shop_id });
    const number = numData || `FAT-${new Date().getFullYear()}-0001`;

    // 4. Preparar linhas
    const lines = Array.isArray(wo.lines) ? (wo.lines as any[]) : [];
    const laborHours = Number(wo.labor_hours || 0);

    // Se houver horas extra de mão-de-obra, adiciona linha correspondente
    // (usa a shop_labor_rate por defeito 30€/h se não conseguir ler)
    let extraLines: any[] = [];
    const { data: shopData } = await supabase
      .from("shops")
      .select("labor_rate, vat_rate, currency")
      .eq("id", wo.shop_id)
      .maybeSingle();
    if (laborHours > 0) {
      const rate = Number(shopData?.labor_rate || 30);
      const vat = Number(shopData?.vat_rate || 0);
      extraLines.push({
        description: `Mão-de-obra adicional (${laborHours}h)`,
        quantity: laborHours,
        unit_price: rate,
        vat_rate: vat,
      });
    }

    // 5. Inserir fatura
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .insert({
        shop_id: wo.shop_id,
        client_id: wo.client_id,
        vehicle_id: wo.vehicle_id || null,
        work_order_id: wo.id,
        number,
        type: "invoice",
        status: "draft",
        subtotal: Number(wo.subtotal || 0),
        vat_total: Number(wo.vat_total || 0),
        total: Number(wo.total || 0),
        currency: (wo as any).currency || shopData?.currency || "EUR",
        notes: wo.notes || null,
      })
      .select()
      .single();

    if (invErr || !invoice) {
      return { invoiceId: null, created: false, error: invErr?.message || "Falha a criar fatura" };
    }

    // 6. Inserir itens — preserva discriminação Peça / Serviço / Mão de obra.
    //    Os `lines` do work_order usam `name` (não `description`); mantemos
    //    fallback para não perder a descrição real de cada linha.
    const typeLabel = (t?: string) => {
      if (t === 'part') return 'Peça';
      if (t === 'service') return 'Serviço';
      return null;
    };
    const itemsToInsert = [
      ...lines.map((l: any) => {
        const rawName = l.description || l.name || null;
        const prefix = typeLabel(l.type);
        const description = rawName
          ? (prefix ? `${prefix}: ${rawName}` : rawName)
          : (prefix || 'Item');
        return {
          invoice_id: invoice.id,
          description,
          quantity: Number(l.quantity || 1),
          unit_price: Number(l.unit_price || 0),
          vat_rate: Number(l.vat_rate || 23),
          total:
            Number(l.quantity || 1) *
            Number(l.unit_price || 0) *
            (1 + Number(l.vat_rate || 23) / 100),
        };
      }),
      ...extraLines.map((l: any) => ({
        invoice_id: invoice.id,
        description: l.description,
        quantity: l.quantity,
        unit_price: l.unit_price,
        vat_rate: l.vat_rate,
        total: l.quantity * l.unit_price * (1 + l.vat_rate / 100),
      })),
    ];

    if (itemsToInsert.length > 0) {
      await supabase.from("invoice_items").insert(itemsToInsert);
    }

    return { invoiceId: invoice.id, created: true };
  } catch (e: any) {
    return { invoiceId: null, created: false, error: e?.message || "Erro desconhecido" };
  }
}
