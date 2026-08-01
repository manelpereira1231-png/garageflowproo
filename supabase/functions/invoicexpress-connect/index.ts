/**
 * invoicexpress-connect
 * ---------------------
 * Guarda / testa credenciais InvoiceXpress de UMA oficina.
 * Body: {
 *   shop_id: string,
 *   account_name: string,   // subdomínio InvoiceXpress (e.g. "minhaoficina")
 *   api_key: string,        // API key da conta certificada da oficina
 *   serie_default?: string,
 *   documento_default?: 'invoice'|'invoice_receipt'|'simplified_invoice',
 *   test_only?: boolean,    // se true, testa mas não grava
 * }
 *
 * Segurança:
 *  - Requer JWT válido do dono/membro da oficina.
 *  - Verifica get_user_shop_ids(auth.uid()) inclui shop_id (mesmo com service-role).
 *  - API key é encriptada com BILLING_CRED_ENC_KEY antes de gravar.
 *  - Nunca devolve a chave em resposta.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

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

    const body = await req.json();
    const {
      shop_id,
      account_name,
      api_key,
      serie_default,
      documento_default = "invoice",
      test_only = false,
    } = body || {};

    if (!shop_id || !account_name || !api_key) {
      return json({ error: "Campos obrigatórios em falta (shop_id, account_name, api_key)" }, 400);
    }

    // Ownership check — user must belong to the shop
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(shop_id)) {
      return json({ error: "Sem permissão nesta oficina" }, 403);
    }

    // Test the credentials by calling InvoiceXpress "accounts.json"
    const testUrl = `https://${account_name}.app.invoicexpress.com/api/users/info.xml?api_key=${encodeURIComponent(api_key)}`;
    const testRes = await fetch(testUrl, { method: "GET" });
    if (!testRes.ok) {
      const txt = await testRes.text().catch(() => "");
      return json({
        error: `InvoiceXpress rejeitou as credenciais (HTTP ${testRes.status}). Verifica o nome da conta e a API key.`,
        detail: txt.slice(0, 200),
      }, 400);
    }

    if (test_only) return json({ ok: true, tested: true });

    const encrypted = await encryptSecret(api_key);

    const { error: upsertErr } = await admin
      .from("integracao_faturacao")
      .upsert({
        shop_id,
        provider: "invoicexpress",
        account_name,
        api_key_encrypted: encrypted,
        serie_default: serie_default || null,
        documento_default,
        ativo: true,
        last_test_ok_at: new Date().toISOString(),
        last_error: null,
      }, { onConflict: "shop_id" });

    if (upsertErr) return json({ error: upsertErr.message }, 500);

    return json({ ok: true });
  } catch (e: any) {
    console.error("[invoicexpress-connect]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
