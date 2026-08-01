/**
 * invoicexpress-credit-note
 * -------------------------
 * Anula uma fatura CERTIFICADA já emitida no InvoiceXpress emitindo a respetiva
 * nota de crédito. NUNCA "apaga" faturas — a AT proíbe.
 *
 * Body: { invoice_id: string, reason?: string }
 *
 * Idempotência: se a invoice já tem credit_note_provider_id, devolve os dados
 * existentes sem re-emitir.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { invoice_id, reason } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id em falta" }, 400);

    const { data: inv } = await admin
      .from("invoices")
      .select("*, invoice_items(*), clients(*)")
      .eq("id", invoice_id)
      .maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) {
      return json({ error: "Sem permissão nesta fatura" }, 403);
    }

    if (!inv.provider_invoice_id) {
      return json({ error: "Esta fatura não foi emitida no provider certificado — não precisa de nota de crédito." }, 400);
    }
    if (inv.credit_note_provider_id) {
      return json({
        ok: true, already_emitted: true,
        credit_note_provider_id: inv.credit_note_provider_id,
        credit_note_number: inv.credit_note_number,
        credit_note_atcud: inv.credit_note_atcud,
        credit_note_pdf_url: inv.credit_note_pdf_url,
      });
    }

    const { data: integ } = await admin
      .from("integracao_faturacao")
      .select("*")
      .eq("shop_id", inv.shop_id)
      .eq("ativo", true)
      .maybeSingle();
    if (!integ || integ.provider !== "invoicexpress") {
      return json({ error: "Integração InvoiceXpress não encontrada para esta oficina" }, 400);
    }

    const apiKey = await decryptSecret(integ.api_key_encrypted);
    const base = `https://${integ.account_name}.app.invoicexpress.com`;

    const client = inv.clients || {};
    const clientTaxId = client.nif && String(client.nif).trim() !== "" ? String(client.nif).trim() : "999999990";

    const items = (inv.invoice_items || []).map((it: any) => ({
      name: (it.description || "Serviço").slice(0, 150),
      description: (it.description || "").slice(0, 950) || undefined,
      unit_price: Number(it.unit_price || 0),
      quantity: Number(it.quantity || 1),
      tax: { name: `IVA ${Number(it.vat_rate || 23)}%` },
    }));

    // 1) Create credit note referencing the original invoice
    const bodyKey = "credit_note";
    const payload: any = {
      [bodyKey]: {
        date: new Date().toISOString().slice(0, 10),
        due_date: new Date().toISOString().slice(0, 10),
        reference: `Anulação ${inv.number}`,
        observations: reason ? String(reason).slice(0, 250) : `Nota de crédito referente a ${inv.number}`,
        client: {
          name: (client.company || client.name || "Consumidor Final").slice(0, 254),
          code: (client.id || "").slice(0, 30),
          email: client.email || undefined,
          fiscal_id: clientTaxId,
        },
        items,
        owner_invoice_id: inv.provider_invoice_id,
        manual_related_document: "true",
        related_documents: [{ related_document: { document_type: "Invoice", document_id: inv.provider_invoice_id } }],
      }
    };

    const createRes = await fetch(`${base}/api/credit_notes.json?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => "");
      return json({ error: friendlyError(createRes.status, txt) }, 400);
    }
    const created = await createRes.json();
    const doc = created?.credit_note || created;
    const cnId = String(doc?.id ?? "");
    if (!cnId) return json({ error: "InvoiceXpress não devolveu ID da nota de crédito" }, 502);

    // 2) Finalize the credit note
    const finRes = await fetch(
      `${base}/api/credit_notes/${cnId}/change-state.json?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credit_note: { state: "finalized", message: reason || "Anulação" } }),
      }
    );
    if (!finRes.ok) {
      const txt = await finRes.text().catch(() => "");
      return json({ error: `Falha a finalizar nota de crédito: ${friendlyError(finRes.status, txt)}` }, 400);
    }

    // 3) Fetch finalized details
    const getRes = await fetch(
      `${base}/api/credit_notes/${cnId}.json?api_key=${encodeURIComponent(apiKey)}`,
      { headers: { "Accept": "application/json" } }
    );
    const j = await getRes.json().catch(() => ({}));
    const cn = j?.credit_note || j;

    await admin.from("invoices").update({
      status: "cancelled",
      legal_status: "cancelled",
      cancelled_at: new Date().toISOString(),
      credit_note_provider_id: cnId,
      credit_note_number: cn?.inverted_sequence_number || cn?.sequence_number || null,
      credit_note_atcud: cn?.atcud || null,
      credit_note_pdf_url: cn?.public_pdf_url || cn?.pdf_url || null,
      credit_note_permalink: cn?.permalink || null,
    }).eq("id", invoice_id);

    return json({
      ok: true,
      credit_note_provider_id: cnId,
      credit_note_number: cn?.inverted_sequence_number || cn?.sequence_number,
      credit_note_atcud: cn?.atcud,
      credit_note_pdf_url: cn?.public_pdf_url || cn?.pdf_url,
      credit_note_permalink: cn?.permalink,
    });
  } catch (e: any) {
    console.error("[invoicexpress-credit-note]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function friendlyError(status: number, body: string): string {
  if (status === 401 || status === 403) return "Credenciais InvoiceXpress inválidas.";
  if (status === 422) return "InvoiceXpress rejeitou os dados da nota de crédito.";
  if (status === 429) return "Limite de pedidos atingido. Tente novamente.";
  if (status >= 500) return "Serviço InvoiceXpress indisponível.";
  return `InvoiceXpress recusou o pedido (HTTP ${status}).`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
