/**
 * moloni-emit (SCAFFOLD — pronto a ligar quando MOLONI_CLIENT_ID/SECRET estiverem configurados)
 *
 * Emite fatura certificada Moloni para uma invoice GarageFlow existente.
 * Espelha invoicexpress-emit: valida ownership, obtém credenciais desencriptadas,
 * chama /invoices/insert/ + /invoices/setTransportCode/ (para fechar), grava
 * atcud, provider_invoice_id, provider_pdf_url.
 *
 * Endpoints Moloni relevantes:
 *  - POST https://api.moloni.pt/v1/invoices/insert/?access_token=...
 *  - POST https://api.moloni.pt/v1/invoices/getPDFLink/?access_token=...
 *  - POST https://api.moloni.pt/v1/grant/?grant_type=refresh_token para refrescar
 *
 * Body: { invoice_id: string }
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes } = await supa.auth.getUser();
    const user = userRes.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    if (!Deno.env.get("MOLONI_CLIENT_ID") || !Deno.env.get("MOLONI_CLIENT_SECRET")) {
      return json({ error: "Integração Moloni ainda não ativada na plataforma." }, 501);
    }

    const { invoice_id } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id obrigatório" }, 400);

    const { data: inv } = await admin.from("invoices").select("*, clients(*), invoice_items(*)").eq("id", invoice_id).maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) return json({ error: "Sem permissão nesta oficina" }, 403);

    const { data: integ } = await admin.from("integracao_faturacao")
      .select("*").eq("shop_id", inv.shop_id).eq("provider", "moloni").maybeSingle();
    if (!integ) return json({ error: "Oficina não tem Moloni configurado" }, 400);

    // TODO — quando ativar:
    //   1. Desencriptar access_token; se expirado usar refresh_token via /grant/
    //   2. POST /invoices/insert/ com company_id, customer_id (criar se preciso), products (mapping), payment
    //   3. Guardar document_id, atcud, número, PDF link em invoices.provider_*
    //   4. Retornar { ok: true, pdf_url }
    return json({ error: "Emissão Moloni ainda não implementada — usa InvoiceXpress." }, 501);
  } catch (e: any) {
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
