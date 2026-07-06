/**
 * moloni-connect (SCAFFOLD — desativado até OAuth estar configurado)
 * ------------------------------------------------------------------
 * Guarda / testa credenciais Moloni de UMA oficina.
 * Modelo idêntico ao invoicexpress-connect, mas a Moloni usa OAuth2 (client_credentials
 * ou authorization_code), não uma API key simples.
 *
 * ATIVAÇÃO:
 *  1. Registar app OAuth em https://www.moloni.pt/api/ e obter CLIENT_ID + CLIENT_SECRET.
 *  2. Guardar segredos MOLONI_CLIENT_ID e MOLONI_CLIENT_SECRET.
 *  3. Trocar `NOT_IMPLEMENTED` abaixo pela chamada real ao endpoint /grant/ e /companies/getAll/.
 *  4. Habilitar a opção "Moloni" no seletor de BillingIntegration.tsx.
 *
 * Body: { shop_id, account_email, account_password, company_id, serie_default?, documento_default?, test_only? }
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encryptSecret } from "../_shared/billing-crypto.ts";

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

    const clientId = Deno.env.get("MOLONI_CLIENT_ID");
    const clientSecret = Deno.env.get("MOLONI_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return json({
        error: "Integração Moloni ainda não ativada na plataforma. Contacta o suporte GarageFlow.",
      }, 501);
    }

    const body = await req.json();
    const {
      shop_id, account_email, account_password, company_id,
      serie_default, documento_default = "invoice", test_only = false,
    } = body || {};

    if (!shop_id || !account_email || !account_password || !company_id) {
      return json({ error: "Campos obrigatórios: shop_id, account_email, account_password, company_id" }, 400);
    }

    // Ownership check
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(shop_id)) return json({ error: "Sem permissão nesta oficina" }, 403);

    // Trocar credenciais por access_token (Moloni /grant/)
    const grantUrl = `https://api.moloni.pt/v1/grant/?grant_type=password&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&username=${encodeURIComponent(account_email)}&password=${encodeURIComponent(account_password)}`;
    const grantRes = await fetch(grantUrl);
    if (!grantRes.ok) {
      const txt = await grantRes.text().catch(() => "");
      return json({ error: `Moloni rejeitou (HTTP ${grantRes.status})`, detail: txt.slice(0, 200) }, 400);
    }
    const grant = await grantRes.json();
    if (!grant?.access_token) return json({ error: "Moloni não devolveu access_token" }, 400);

    if (test_only) return json({ ok: true, tested: true });

    // Guardamos access_token + refresh_token encriptados (Moloni tokens expiram em 1h).
    const encAccess = await encryptSecret(grant.access_token);
    const encRefresh = grant.refresh_token ? await encryptSecret(grant.refresh_token) : null;

    const { error: upsertErr } = await admin
      .from("integracao_faturacao")
      .upsert({
        shop_id,
        provider: "moloni",
        account_name: `${account_email}|company:${company_id}`,
        api_key_encrypted: encAccess,
        refresh_token_encrypted: encRefresh,
        serie_default: serie_default || null,
        documento_default,
        ativo: true,
        last_test_ok_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: "shop_id" });

    if (upsertErr) return json({ error: upsertErr.message }, 500);
    return json({ ok: true });
  } catch (e: any) {
    console.error("[moloni-connect]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
