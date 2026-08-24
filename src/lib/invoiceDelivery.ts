import { supabase } from "@/integrations/supabase/client";

/**
 * Guarda central de entrega de faturas ao cliente.
 *
 * Porquê: o envio da fatura (email/WhatsApp) é disparado a partir de vários
 * pontos da UI (lista, detalhe, emissão automática). Sem um lock partilhado,
 * um duplo-clique, um re-render ou uma navegação repetida podem gerar DOIS
 * envios do mesmo PDF e DOIS registos em `email_logs`.
 *
 * A guarda é in-memory (por sessão/aba) com janela curta: passada a janela o
 * utilizador pode legitimamente reenviar o documento.
 */
const claims = new Map<string, number>();
const CLAIM_TTL_MS = 60 * 1000;

type Channel = "email" | "whatsapp";

function key(invoiceId: string, channel: Channel, variant: string) {
  return `${invoiceId}:${channel}:${variant}`;
}

/**
 * Tenta reservar um envio. Devolve `false` quando o mesmo documento já foi
 * enviado (ou está a ser enviado) pelo mesmo canal nos últimos 60s.
 */
export function claimInvoiceDelivery(
  invoiceId: string,
  channel: Channel,
  variant: string = "issued",
): boolean {
  const k = key(invoiceId, channel, variant);
  const last = claims.get(k);
  if (last && Date.now() - last < CLAIM_TTL_MS) return false;
  claims.set(k, Date.now());
  return true;
}

/** Liberta a reserva (usar quando o envio falhou, para permitir nova tentativa). */
export function releaseInvoiceDelivery(
  invoiceId: string,
  channel: Channel,
  variant: string = "issued",
) {
  claims.delete(key(invoiceId, channel, variant));
}

/**
 * Regista o envio em `email_logs` sem duplicar linhas.
 * - Verifica primeiro se já existe um registo igual (mesma fatura + assunto)
 *   nos últimos 2 minutos.
 * - Nunca lança: o registo é auditoria, não pode partir o envio. Falhas
 *   ficam visíveis na consola (antes eram silenciosamente ignoradas).
 */
export async function logInvoiceEmail(params: {
  shopId?: string | null;
  toEmail: string;
  subject: string;
  invoiceId: string;
  status?: "sent" | "failed";
}) {
  const { shopId, toEmail, subject, invoiceId, status = "sent" } = params;
  if (!shopId) return;
  try {
    const since = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data: dup } = await supabase
      .from("email_logs")
      .select("id")
      .eq("entity_type", "invoice")
      .eq("entity_id", invoiceId)
      .eq("to_email", toEmail)
      .eq("subject", subject)
      .eq("status", status)
      .gte("created_at", since)
      .limit(1);
    if (dup && dup.length > 0) return;

    const { error } = await supabase.from("email_logs").insert({
      shop_id: shopId,
      to_email: toEmail,
      subject,
      status,
      entity_type: "invoice",
      entity_id: invoiceId,
    });
    if (error) console.warn("[invoiceDelivery] email_logs insert failed:", error.message);
  } catch (e) {
    console.warn("[invoiceDelivery] email_logs insert threw", e);
  }
}
