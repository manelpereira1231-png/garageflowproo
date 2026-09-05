/**
 * ATRIBUIÇÃO DE PARCEIRO / AFILIADO
 *
 * Regra de ouro: uma conta só é considerada "convidada por um parceiro" quando
 * existe uma referência EXPLÍCITA e VÁLIDA:
 *   /auth?mode=signup&partner=<uuid de parceiro ativo>
 *
 * Antes desta camada, o id do parceiro era escrito em localStorage sem prazo
 * nem validação, pelo que qualquer visita antiga a um link de afiliado marcava
 * para sempre esse browser — inclusive registos vindos da /demo, que são
 * entradas comerciais normais e NÃO têm parceiro.
 *
 * Agora:
 *  - a atribuição guarda também o momento de captura e expira (30 dias);
 *  - só é aceite depois de o servidor confirmar que o parceiro existe e está ativo;
 *  - uma entrada direta na /demo (sem ?partner) limpa atribuições antigas,
 *    porque é um funil próprio; um link de parceiro para a /demo continua a
 *    funcionar porque o parâmetro é capturado nessa mesma visita.
 *
 * O sistema de parceiros/afiliados mantém-se intacto para referências reais.
 */
import { supabase } from "@/integrations/supabase/client";

const PARTNER_STORAGE_KEY = "garageflow_affiliate_partner";
const PARTNER_META_KEY = "garageflow_affiliate_partner_meta";
/** Janela de atribuição (cookie window) — 30 dias, padrão de afiliação. */
export const PARTNER_ATTRIBUTION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PartnerMeta {
  partner_id: string;
  captured_at: number;
}

function readMeta(): PartnerMeta | null {
  try {
    const raw = localStorage.getItem(PARTNER_META_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PartnerMeta;
      if (parsed?.partner_id && typeof parsed.captured_at === "number") return parsed;
    }
    // Legado: valor antigo sem timestamp. Não é de confiança (pode ser de há
    // meses e nunca foi validado) — descartamos em vez de o assumir válido.
    if (localStorage.getItem(PARTNER_STORAGE_KEY)) clearPartnerAttribution();
  } catch { /* storage indisponível */ }
  return null;
}

/** Guarda a atribuição vinda de um link de parceiro explícito. */
export function capturePartnerFromUrl(partnerId: string | null): void {
  if (!partnerId || !UUID_RE.test(partnerId)) return;
  try {
    const meta: PartnerMeta = { partner_id: partnerId, captured_at: Date.now() };
    localStorage.setItem(PARTNER_META_KEY, JSON.stringify(meta));
    localStorage.setItem(PARTNER_STORAGE_KEY, partnerId);
  } catch { /* ignore */ }
}

/** Id de parceiro atribuído, se existir e ainda estiver dentro da janela. */
export function getStoredPartnerId(): string | null {
  const meta = readMeta();
  if (!meta) return null;
  if (Date.now() - meta.captured_at > PARTNER_ATTRIBUTION_TTL_MS) {
    clearPartnerAttribution();
    return null;
  }
  return meta.partner_id;
}

export function clearPartnerAttribution(): void {
  try {
    localStorage.removeItem(PARTNER_STORAGE_KEY);
    localStorage.removeItem(PARTNER_META_KEY);
  } catch { /* ignore */ }
}

/**
 * Confirma no servidor que o parceiro existe e está ativo.
 * Devolve o id apenas quando a referência é real; caso contrário limpa-a.
 */
export async function resolveValidPartnerId(): Promise<string | null> {
  const partnerId = getStoredPartnerId();
  if (!partnerId) return null;
  try {
    const { data, error } = await supabase.rpc("partner_referral_is_valid" as any, {
      _partner_id: partnerId,
    });
    if (error) return null; // rede/RLS: não confirmamos, logo não afirmamos parceria
    if (data !== true) {
      clearPartnerAttribution();
      return null;
    }
    return partnerId;
  } catch {
    return null;
  }
}
