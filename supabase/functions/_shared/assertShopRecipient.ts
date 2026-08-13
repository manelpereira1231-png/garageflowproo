// Valida que um destinatário de SMS/WhatsApp pertence de facto à oficina.
// Impede que um utilizador autorizado envie mensagens para números arbitrários.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const digits = (v: string) => (v || "").replace(/\D/g, "");

/** Compara números ignorando formatação e indicativo (últimos 9 dígitos). */
function samePhone(a: string, b: string): boolean {
  const da = digits(a);
  const db = digits(b);
  if (!da || !db) return false;
  const tail = (s: string) => s.slice(-9);
  return da === db || tail(da) === tail(db);
}

/**
 * Devolve `null` quando o destinatário é um cliente (ou membro) da oficina.
 * Caso contrário devolve uma Response 403 pronta a enviar.
 */
export async function assertShopRecipient(
  shopId: string,
  to: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const target = to.replace("whatsapp:", "");

  const [{ data: clients }, { data: shop }] = await Promise.all([
    supabase.from("clients").select("phone").eq("shop_id", shopId).is("deleted_at", null),
    supabase.from("shops").select("phone").eq("id", shopId).maybeSingle(),
  ]);

  const allowed = [
    ...((clients ?? []).map((c: { phone: string | null }) => c.phone ?? "")),
    (shop as { phone?: string | null } | null)?.phone ?? "",
  ].filter(Boolean);

  if (allowed.some((p) => samePhone(p, target))) return null;

  return new Response(
    JSON.stringify({
      error: "recipient_not_in_shop",
      message: "O destinatário não corresponde a nenhum cliente desta oficina.",
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
