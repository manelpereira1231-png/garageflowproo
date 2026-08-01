/**
 * enotas-connect
 * --------------
 * Guarda / testa credenciais eNotas de UMA oficina brasileira.
 *
 * Body: {
 *   shop_id: string,
 *   account_name: string,   // empresaId (UUID) do eNotas
 *   api_key: string,        // API key da conta eNotas
 *   serie_default?: string,
 *   documento_default?: 'nfse'|'nfe'|'nfce',
 *   test_only?: boolean,
 * }
 *
 * Segurança:
 *  - Requer JWT válido do dono/membro da oficina.
 *  - Verifica get_user_shop_ids(auth.uid()) inclui shop_id.
 *  - API key é encriptada com BILLING_CRED_ENC_KEY antes de gravar.
 *  - Nunca devolve a chave em resposta.
 *  - Testa credenciais chamando GET /empresas/{empresaId} do eNotas.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ENOTAS_BASE = "https://api.enotasgw.com.br/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
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
      shop_id, account_name, api_key,
      serie_default, documento_default = "nfse", test_only = false,
    } = body || {};

    if (!shop_id || !account_name) {
      return json({ error: "shop_id e account_name (empresaId eNotas) são obrigatórios" }, 400);
    }

    // Preserve existing key when caller leaves it blank on update
    const { data: existing } = await admin
      .from("integracao_faturacao")
      .select("id, api_key_encrypted")
      .eq("shop_id", shop_id).maybeSingle();

    if (!existing && !api_key) {
      return json({ error: "API key é obrigatória na primeira ligação" }, 400);
    }

    // Ownership check
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(shop_id)) return json({ error: "Sem permissão nesta oficina" }, 403);

    // Determine the API key to test with (new one, or decrypt existing)
    let testKey = api_key ? String(api_key).trim() : "";
    if (!testKey && existing?.api_key_encrypted) {
      const { decryptSecret } = await import("../_shared/billing-crypto.ts");
      testKey = await decryptSecret(existing.api_key_encrypted);
    }

    // Test credentials by calling GET /empresas/{empresaId}
    const testUrl = `${ENOTAS_BASE}/empresas/${encodeURIComponent(String(account_name).trim())}`;
    let testRes: Response;
    try {
      testRes = await fetch(testUrl, {
        method: "GET",
        headers: { Authorization: `Basic ${testKey}`, Accept: "application/json" },
      });
    } catch (e) {
      return json({ error: `Não foi possível contactar o eNotas: ${(e as Error).message}` }, 502);
    }
    if (!testRes.ok) {
      const txt = await testRes.text().catch(() => "");
      return json({
        error: friendlyError(testRes.status, txt) + " Verifica o empresaId e a API key.",
        detail: txt.slice(0, 200),
      }, 400);
    }
    await testRes.text().catch(() => "");

    if (test_only) return json({ ok: true, tested: true });

    const encrypted = api_key
      ? await encryptSecret(String(api_key).trim())
      : existing!.api_key_encrypted;

    const payload = {
      shop_id,
      provider: "enotas",
      account_name: String(account_name).trim(),
      api_key_encrypted: encrypted,
      serie_default: serie_default || null,
      documento_default,
      ativo: true,
      last_test_ok_at: new Date().toISOString(),
      last_error: null,
    };

    const { error: upErr } = existing
      ? await admin.from("integracao_faturacao").update(payload).eq("id", existing.id)
      : await admin.from("integracao_faturacao").insert(payload);
    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true });
  } catch (e: any) {
    console.error("[enotas-connect]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function friendlyError(status: number, _body: string): string {
  if (status === 401 || status === 403) return "Credenciais eNotas inválidas.";
  if (status === 404) return "empresaId eNotas não encontrado.";
  if (status === 429) return "Limite de pedidos atingido. Tenta novamente em instantes.";
  if (status >= 500) return "Serviço eNotas indisponível. Tenta novamente.";
  return `eNotas recusou o pedido (HTTP ${status}).`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
