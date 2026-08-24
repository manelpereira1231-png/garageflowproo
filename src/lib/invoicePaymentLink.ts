import { supabase } from "@/integrations/supabase/client";

/**
 * Devolve o link público de pagamento (text-to-pay) de uma fatura, ou null
 * quando o pagamento online não está disponível (sem Stripe Connect ativo,
 * fatura já paga/cancelada, ou token indisponível).
 *
 * Silencioso por design: usado para ENRIQUECER o email/WhatsApp — nunca deve
 * bloquear o envio do documento.
 */
export async function getInvoicePaymentUrl(opts: {
  invoiceId: string;
  shopId?: string | null;
  status?: string | null;
  allowWithoutConnect?: boolean;
}): Promise<string | null> {
  const { invoiceId, shopId, status, allowWithoutConnect } = opts;
  try {
    if (!invoiceId) return null;
    // Só faz sentido cobrar faturas em aberto.
    if (status && !["issued", "partial"].includes(String(status))) return null;

    if (!allowWithoutConnect) {
      if (!shopId) return null;
      const { data: shopRow } = await supabase
        .from("shops")
        .select("stripe_connect_account_id, stripe_connect_charges_enabled")
        .eq("id", shopId)
        .maybeSingle();
      const connectActive = Boolean(
        (shopRow as any)?.stripe_connect_account_id && (shopRow as any)?.stripe_connect_charges_enabled,
      );
      if (!connectActive) return null;
    }

    const { data, error } = await supabase
      .from("invoices")
      .update({ payment_link_sent_at: new Date().toISOString() } as any)
      .eq("id", invoiceId)
      .select("public_token")
      .maybeSingle();
    if (error) return null;
    const token = (data as any)?.public_token;
    if (!token) return null;
    return `${window.location.origin}/invoice/${token}`;
  } catch {
    return null;
  }
}
