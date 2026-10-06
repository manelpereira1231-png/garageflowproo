import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const origin = () => window.location.origin;

/** Link de acompanhamento do cliente (reutiliza o existente se ainda for válido). */
export async function getClientLink(claim: any, shopId: string): Promise<string | null> {
  const { data: ex } = await (supabase as any).from("claim_share_links").select("token, expires_at")
    .eq("claim_id", claim.id).eq("audience", "cliente").is("revoked_at", null).order("created_at", { ascending: false }).limit(1);
  const valid = (ex || []).find((l: any) => !l.expires_at || new Date(l.expires_at) > new Date());
  if (valid) return `${origin()}/acompanhar/${valid.token}`;
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await (supabase as any).from("claim_share_links")
    .insert({ claim_id: claim.id, shop_id: shopId, audience: "cliente", created_by: auth.session?.user.id ?? null })
    .select("token").single();
  if (error) { toast.error(error.message); return null; }
  return `${origin()}/acompanhar/${data.token}`;
}

/** Cria o link do perito (14 dias) para uma autorização e abre as opções de envio. */
export async function createExpertLink(claim: any, shopId: string, supplementId: string): Promise<string | null> {
  const { data: auth } = await supabase.auth.getSession();
  const { data, error } = await (supabase as any).from("claim_share_links").insert({
    claim_id: claim.id, shop_id: shopId, audience: "perito", supplement_id: supplementId,
    expires_at: new Date(Date.now() + 14 * 86400000).toISOString(), created_by: auth.session?.user.id ?? null,
  }).select("token").single();
  if (error) { toast.error(error.message); return null; }
  const url = `${origin()}/perito/${data.token}`;
  try { await navigator.clipboard.writeText(url); } catch { /* sem permissão de cópia */ }
  await supabase.from("claim_events").insert({ claim_id: claim.id, shop_id: shopId, kind: "note", description: "Pacote enviado ao perito (link válido 14 dias)" });
  const contact = String(claim.expert_contact || "");
  const email = contact.match(/[^\s@]+@[^\s@]+\.[^\s@]+/)?.[0];
  const phone = contact.replace(/[^\d+]/g, "").replace(/^\+/, "");
  const text = `Olá${claim.expert_name ? ` ${claim.expert_name}` : ""}, segue o pedido de validação do sinistro ${claim.ref || ""}${claim.vehicles?.plate ? ` (${claim.vehicles.plate})` : ""}: ${url}`;
  toast.success("Link do perito copiado", {
    description: email ? "Pode colar no email ou usar o botão abaixo." : "Cole-o no email ou WhatsApp do perito.",
    action: email
      ? { label: "Abrir email", onClick: () => window.open(`mailto:${email}?subject=${encodeURIComponent(`Validação ${claim.ref || "sinistro"}`)}&body=${encodeURIComponent(text)}`, "_blank") }
      : phone.length >= 9
        ? { label: "WhatsApp", onClick: () => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank") }
        : undefined,
    duration: 12000,
  });
  return url;
}
