/**
 * moloni-credit-note — Anula uma fatura Moloni emitida via emissão legal de Nota de Crédito.
 * Idempotente: se já existe credit_note_provider_id na invoice, devolve-a.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret, encryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MOLONI_BASE = "https://api.moloni.pt/v1";

async function moloniPost(path: string, body: any, token: string) {
  const res = await fetch(`${MOLONI_BASE}${path}/?access_token=${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  let j: any = null; try { j = txt ? JSON.parse(txt) : null; } catch { /* */ }
  if (!res.ok) throw new Error(`Moloni ${path} (${res.status}): ${j?.error?.message || j?.error || txt.slice(0, 300)}`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    if (!Deno.env.get("MOLONI_CLIENT_ID")) return json({ error: "Moloni não configurado" }, 501);

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: userRes } = await supa.auth.getUser();
    const user = userRes.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { invoice_id, reason } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id obrigatório" }, 400);

    const { data: inv } = await admin.from("invoices").select("*, invoice_items(*)").eq("id", invoice_id).maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    // 🔒 Ownership check ANTES de qualquer short-circuit (evita IDOR entre oficinas)
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) return json({ error: "Sem permissão" }, 403);

    if (!inv.provider_invoice_id) return json({ error: "Fatura ainda não emitida no provider" }, 400);
    if (inv.credit_note_provider_id) {
      return json({ ok: true, credit_note_provider_id: inv.credit_note_provider_id, credit_note_pdf_url: inv.credit_note_pdf_url, cached: true });
    }

    const { data: integ } = await admin.from("integracao_faturacao").select("*").eq("shop_id", inv.shop_id).eq("provider", "moloni").maybeSingle();
    if (!integ) return json({ error: "Integração Moloni não encontrada" }, 400);

    let token = await decryptSecret(integ.api_key_encrypted);
    const exp = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0;
    if (Date.now() > exp - 60_000 && integ.refresh_token_encrypted) {
      const refresh = await decryptSecret(integ.refresh_token_encrypted);
      const url = `${MOLONI_BASE}/grant/?grant_type=refresh_token&client_id=${encodeURIComponent(Deno.env.get("MOLONI_CLIENT_ID")!)}&client_secret=${encodeURIComponent(Deno.env.get("MOLONI_CLIENT_SECRET")!)}&refresh_token=${encodeURIComponent(refresh)}`;
      const gr = await fetch(url); if (!gr.ok) throw new Error("Refresh Moloni falhou");
      const g = await gr.json(); token = g.access_token;
      await admin.from("integracao_faturacao").update({
        api_key_encrypted: await encryptSecret(token),
        refresh_token_encrypted: await encryptSecret(g.refresh_token || refresh),
        token_expires_at: new Date(Date.now() + (Number(g.expires_in) || 3600) * 1000).toISOString(),
      }).eq("id", integ.id);
    }

    const companyId = integ.moloni_company_id;

    // Ler documento original para obter series + produtos
    const orig = await moloniPost("/invoices/getOne", { company_id: companyId, document_id: Number(inv.provider_invoice_id) }, token);
    const documentSetId = orig?.document_set_id;
    const products = (orig?.products || []).map((p: any, idx: number) => ({
      product_id: p.product_id, name: p.name, qty: p.qty, price: p.price, discount: p.discount || 0,
      order: idx, taxes: p.taxes || [],
    }));

    const nc = await moloniPost("/creditNotes/insert", {
      company_id: companyId,
      customer_id: orig.customer_id,
      document_set_id: documentSetId,
      date: new Date().toISOString().slice(0, 10),
      expiration_date: new Date().toISOString().slice(0, 10),
      products,
      status: 1,
      notes: reason || "Anulação",
      associated_documents: [{ associated_id: Number(inv.provider_invoice_id), value: Number(inv.total) || 0 }],
    }, token);

    const ncId = nc?.document_id;
    let ncPdf: string | null = null, ncNumber: string | null = null, ncAtcud: string | null = null;
    try {
      const pdf = await moloniPost("/creditNotes/getPDFLink", { company_id: companyId, document_id: ncId }, token);
      ncPdf = pdf?.url || null;
    } catch { /* */ }
    try {
      const one = await moloniPost("/creditNotes/getOne", { company_id: companyId, document_id: ncId }, token);
      ncNumber = one?.document_no || null; ncAtcud = one?.atcud || null;
    } catch { /* */ }

    await admin.from("invoices").update({
      credit_note_provider_id: String(ncId),
      credit_note_number: ncNumber,
      credit_note_atcud: ncAtcud,
      credit_note_pdf_url: ncPdf,
      cancelled_at: new Date().toISOString(),
      status: "cancelled",
      legal_status: "cancelled",
    }).eq("id", inv.id);

    return json({ ok: true, credit_note_provider_id: String(ncId), credit_note_number: ncNumber, credit_note_pdf_url: ncPdf });
  } catch (e: any) {
    console.error("[moloni-credit-note]", e);
    return json({ error: e?.message || "Erro" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
