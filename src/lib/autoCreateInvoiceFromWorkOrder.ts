import { supabase } from "@/integrations/supabase/client";

/**
 * Cria automaticamente uma fatura (rascunho) a partir de uma Ordem de Serviço concluída.
 *
 * A criação é feita no servidor (RPC `create_invoice_from_work_order`), de forma
 * atómica e idempotente, para que qualquer utilizador autorizado a concluir o
 * serviço (incluindo técnicos, que não têm `invoices.create`) consiga gerar a
 * fatura. A fatura fica em "draft" e visível para a administração da oficina.
 */
export async function autoCreateInvoiceFromWorkOrder(workOrderId: string): Promise<{
  invoiceId: string | null;
  created: boolean;
  error?: string;
}> {
  try {
    const { data, error } = await supabase.rpc("create_invoice_from_work_order" as any, {
      _work_order_id: workOrderId,
    });

    if (error) {
      return { invoiceId: null, created: false, error: error.message };
    }

    const res = (data || {}) as { invoice_id?: string; created?: boolean; error?: string };
    if (res.error) {
      return { invoiceId: null, created: false, error: res.error };
    }

    return { invoiceId: res.invoice_id ?? null, created: Boolean(res.created) };
  } catch (e: any) {
    return { invoiceId: null, created: false, error: e?.message || "Erro desconhecido" };
  }
}
