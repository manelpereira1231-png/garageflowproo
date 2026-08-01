/**
 * moloni-connect — Liga a conta Moloni de UMA oficina.
 *
 * OAuth password grant → obtém access_token (1h) + refresh_token.
 * Encripta ambos e grava em `integracao_faturacao`.
 *
 * Body: { shop_id, account_email, account_password, moloni_company_id, serie_default?, documento_default?, test_only? }
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const clientId = Deno.env.get("MOLONI_CLIENT_ID");
    const clientSecret = Deno.env.get("MOLONI_CLIENT_SECRET");
    if (!clientId || !clientSecret) {
      return json({ error: "Moloni não configurado na plataforma. Contacta o suporte GarageFlow para ativar." }, 501);
    }

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userRes } = await supa.auth.getUser();
    const user = userRes.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json();
    const { shop_id, account_email, account_password, moloni_company_id, serie_default, documento_default = "invoice", test_only = false } = body || {};
    if (!shop_id || !account_email || !account_password || !moloni_company_id) {
      return json({ error: "Campos obrigatórios: shop_id, account_email, account_password, moloni_company_id" }, 400);
    }

    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(shop_id)) return json({ error: "Sem permissão nesta oficina" }, 403);

    const url = `https://api.moloni.pt/v1/grant/?grant_type=password&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&username=${encodeURIComponent(account_email)}&password=${encodeURIComponent(account_password)}`;
    const gRes = await fetch(url);
    if (!gRes.ok) {
      const txt = await gRes.text().catch(() => "");
      return json({ error: `Moloni rejeitou credenciais (HTTP ${gRes.status}). Verifica email/password/company_id.`, detail: txt.slice(0, 200) }, 400);
    }
    const grant = await gRes.json();
    if (!grant?.access_token) return json({ error: "Moloni não devolveu access_token" }, 400);

    // Validar company_id — companies/getAll deve incluir esse id
    const compRes = await fetch(`https://api.moloni.pt/v1/companies/getAll/?access_token=${encodeURIComponent(grant.access_token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    if (compRes.ok) {
      const companies = await compRes.json().catch(() => []);
      const ok = Array.isArray(companies) && companies.some((c: any) => Number(c.company_id) === Number(moloni_company_id));
      if (!ok) return json({ error: `company_id ${moloni_company_id} não pertence a esta conta Moloni.` }, 400);
    }

    if (test_only) return json({ ok: true, tested: true });

    const encAccess = await encryptSecret(grant.access_token);
    const encRefresh = grant.refresh_token ? await encryptSecret(grant.refresh_token) : null;
    const expiresAt = new Date(Date.now() + (Number(grant.expires_in) || 3600) * 1000).toISOString();

    const { error: upsertErr } = await admin.from("integracao_faturacao").upsert({
      shop_id, provider: "moloni",
      account_name: account_email,
      api_key_encrypted: encAccess,
      refresh_token_encrypted: encRefresh,
      token_expires_at: expiresAt,
      moloni_company_id: Number(moloni_company_id),
      serie_default: serie_default || null,
      documento_default, ativo: true,
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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
