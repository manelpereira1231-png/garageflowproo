/**
 * billing-connect — generic fiscal-provider connector for non-PT countries.
 *
 * Portugal continues to use the dedicated `invoicexpress-connect` /
 * `moloni-connect` functions. This function accepts credentials for any
 * other provider slug validated by the DB CHECK constraint on
 * `integracao_faturacao.provider` and stores them encrypted.
 *
 * The "test" step here is a shape/reachability check only — real per-provider
 * document emission will land in future dedicated functions.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED = new Set([
  "enotas", "nuvem_fiscal", "quickbooks", "xero", "holded",
  "pennylane", "sevdesk", "zoho_books", "cleartax", "generic",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: auth } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Unauthenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      shop_id, provider, account_name, api_key,
      serie_default, documento_default, test_only,
    } = body ?? {};

    if (!shop_id || !provider || !account_name) {
      return json({ error: "shop_id, provider e account_name são obrigatórios" }, 400);
    }
    if (!ALLOWED.has(provider)) {
      return json({ error: `Provider "${provider}" não suportado por este endpoint` }, 400);
    }

    // Ensure the user owns the shop
    const { data: shop } = await supabase
      .from("shops")
      .select("id, user_id, country_code")
      .eq("id", shop_id)
      .maybeSingle();
    if (!shop || shop.user_id !== userData.user.id) {
      return json({ error: "Sem permissão para esta oficina" }, 403);
    }

    // Basic shape validation for the API key when provided.
    if (api_key && String(api_key).trim().length < 8) {
      return json({ error: "API key demasiado curta" }, 400);
    }

    if (test_only) {
      return json({ ok: true, tested_at: new Date().toISOString() });
    }

    const nowIso = new Date().toISOString();

    // Load existing to preserve api_key when caller leaves it blank
    const { data: existing } = await supabase
      .from("integracao_faturacao")
      .select("id, api_key_encrypted")
      .eq("shop_id", shop_id)
      .maybeSingle();

    const api_key_encrypted = api_key
      ? await encryptSecret(String(api_key))
      : existing?.api_key_encrypted ?? "";

    if (!api_key_encrypted) {
      return json({ error: "É necessário fornecer uma API key na primeira ligação" }, 400);
    }

    const payload = {
      shop_id,
      provider,
      account_name: String(account_name).trim(),
      api_key_encrypted,
      serie_default: serie_default ?? null,
      documento_default: documento_default ?? "invoice",
      ativo: true,
      last_test_ok_at: nowIso,
      last_error: null,
    };

    const { error: upErr } = existing
      ? await supabase.from("integracao_faturacao").update(payload).eq("id", existing.id)
      : await supabase.from("integracao_faturacao").insert(payload);

    if (upErr) return json({ error: upErr.message }, 500);

    return json({ ok: true, saved_at: nowIso });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
