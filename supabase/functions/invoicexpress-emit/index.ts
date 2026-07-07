/**
 * invoicexpress-emit
 * ------------------
 * Emite UMA fatura no InvoiceXpress a partir de uma invoice do GarageFlow (draft).
 * O provider certificado é quem gera número final, ATCUD, QR Code, hash e SAF-T.
 * O GarageFlow apenas envia os dados e guarda a referência devolvida.
 *
 * Body: { invoice_id: string, send_email?: boolean }
 *
 * Idempotência: se a invoice já tem provider_invoice_id, devolvemos o link sem re-emitir.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const { invoice_id, send_email = false } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id em falta" }, 400);

    // Load invoice with items + client + shop, using service-role but scoping by ownership.
    const { data: inv } = await admin
      .from("invoices")
      .select("*, invoice_items(*), clients(*), shops(*)")
      .eq("id", invoice_id)
      .maybeSingle();

    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    // Ownership check
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) {
      return json({ error: "Sem permissão nesta fatura" }, 403);
    }

    // Idempotência
    if (inv.provider_invoice_id) {
      return json({
        ok: true,
        already_emitted: true,
        provider_invoice_id: inv.provider_invoice_id,
        atcud: inv.atcud,
        pdf_url: inv.provider_pdf_url,
        permalink: inv.provider_permalink,
      });
    }

    // Load integration
    const { data: integ } = await admin
      .from("integracao_faturacao")
      .select("*")
      .eq("shop_id", inv.shop_id)
      .eq("ativo", true)
      .maybeSingle();
    if (!integ) {
      return json({
        error: "Esta oficina ainda não tem uma integração de faturação certificada configurada. Vai a Definições → Faturação Certificada.",
      }, 400);
    }
    if (integ.provider !== "invoicexpress") {
      return json({ error: `Provider '${integ.provider}' ainda não é suportado.` }, 400);
    }

    const apiKey = await decryptSecret(integ.api_key_encrypted);
    const base = `https://${integ.account_name}.app.invoicexpress.com`;

    // Map documento_default → InvoiceXpress endpoint & type
    const kindMap: Record<string, { endpoint: string; type: string }> = {
      invoice:            { endpoint: "invoices",            type: "Invoice" },
      invoice_receipt:    { endpoint: "invoice_receipts",    type: "InvoiceReceipt" },
      simplified_invoice: { endpoint: "simplified_invoices", type: "SimplifiedInvoice" },
    };
    const kind = kindMap[integ.documento_default] || kindMap.invoice;

    const client = inv.clients || {};
    const hasNif = client.nif && String(client.nif).trim() !== "";
    const clientTaxId = hasNif ? String(client.nif).trim() : null;

    // Build the InvoiceXpress payload (JSON API)
    const itemsPayload = (inv.invoice_items || []).map((it: any) => ({
      name: (it.description || "Serviço").slice(0, 150),
      description: (it.description || "").slice(0, 950) || undefined,
      unit_price: Number(it.unit_price || 0),
      quantity: Number(it.quantity || 1),
      tax: { name: `IVA ${Number(it.vat_rate || 23)}%` },
    }));

    const payload: any = {
      [kind.type.toLowerCase().replace(/([A-Z])/g, "_$1")]: undefined, // placeholder
    };
    // Real key expected by IX API is snake_case of the type
    const bodyKey = kind.type === "Invoice" ? "invoice"
      : kind.type === "InvoiceReceipt" ? "invoice_receipt"
      : "simplified_invoice";
    delete payload[Object.keys(payload)[0]];

    payload[bodyKey] = {
      date: new Date().toISOString().slice(0, 10),
      due_date: inv.due_date || new Date().toISOString().slice(0, 10),
      reference: inv.number,
      observations: inv.notes || undefined,
      client: {
        name: (client.company || client.name || "Consumidor Final").slice(0, 254),
        code: (client.id || "").slice(0, 30),
        email: client.email || undefined,
        phone: client.phone || undefined,
        fiscal_id: clientTaxId || "999999990",
      },
      items: itemsPayload,
      ...(integ.serie_default ? { sequence_number: integ.serie_default } : {}),
    };

    // 1) Create document
    const createRes = await fetch(`${base}/api/${kind.endpoint}.json?api_key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!createRes.ok) {
      const txt = await createRes.text().catch(() => "");
      const msg = `InvoiceXpress (create) HTTP ${createRes.status}: ${txt.slice(0, 300)}`;
      await admin.from("integracao_faturacao")
        .update({ last_error: msg })
        .eq("shop_id", inv.shop_id);
      return json({ error: friendlyError(createRes.status, txt) }, 400);
    }

    const created = await createRes.json();
    const doc = created?.[bodyKey] || created;
    const providerId = String(doc?.id ?? "");
    if (!providerId) {
      return json({ error: "InvoiceXpress não devolveu ID do documento" }, 502);
    }

    // 2) Finalize (change state to "finalized" so ATCUD/hash are minted)
    const finalizeRes = await fetch(
      `${base}/api/${kind.endpoint}/${providerId}/change-state.json?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({ [bodyKey]: { state: "finalized" } }),
      }
    );
    if (!finalizeRes.ok) {
      const txt = await finalizeRes.text().catch(() => "");
      return json({ error: `Falha a finalizar documento: ${friendlyError(finalizeRes.status, txt)}` }, 400);
    }

    // 3) Fetch the finalized doc to grab number/ATCUD/permalink
    const getRes = await fetch(
      `${base}/api/${kind.endpoint}/${providerId}.json?api_key=${encodeURIComponent(apiKey)}`,
      { headers: { "Accept": "application/json" } }
    );
    const getJson = await getRes.json().catch(() => ({}));
    const finalDoc = getJson?.[bodyKey] || getJson;

    const providerNumber: string | undefined = finalDoc?.inverted_sequence_number || finalDoc?.sequence_number || finalDoc?.reference;
    const atcud: string | undefined = finalDoc?.atcud;
    const permalink: string | undefined = finalDoc?.permalink;
    const pdfUrl: string | undefined = finalDoc?.public_pdf_url || finalDoc?.pdf_url;

    // 4) Update GarageFlow invoice with the certified references
    const seriesFromNumber = (providerNumber || "").split("/")[0] || null;
    await admin.from("invoices")
      .update({
        status: "issued",
        legal_status: "certified",
        provider: "invoicexpress",
        provider_invoice_id: providerId,
        atcud: atcud || null,
        certified_series: seriesFromNumber,
        provider_pdf_url: pdfUrl || null,
        provider_permalink: permalink || null,
        emitida_em: new Date().toISOString(),
        number: providerNumber || inv.number,
      })
      .eq("id", invoice_id);

    // 5) Optional: send by email through InvoiceXpress
    if (send_email && client.email) {
      await fetch(
        `${base}/api/${kind.endpoint}/${providerId}/email-document.json?api_key=${encodeURIComponent(apiKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: {
              client: { email: client.email, save: "0" },
              subject: `Fatura ${providerNumber}`,
              body: "Segue em anexo a fatura.",
            }
          }),
        }
      ).catch(() => {});
    }

    return json({
      ok: true,
      provider_invoice_id: providerId,
      number: providerNumber,
      atcud,
      permalink,
      pdf_url: pdfUrl,
    });
  } catch (e: any) {
    console.error("[invoicexpress-emit]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function friendlyError(status: number, body: string): string {
  if (status === 401 || status === 403) return "Credenciais InvoiceXpress inválidas. Volte a ligar a conta em Definições.";
  if (status === 422) return "InvoiceXpress rejeitou os dados da fatura. Confirme o NIF e os campos obrigatórios.";
  if (status === 429) return "Limite de pedidos atingido. Tente novamente dentro de instantes.";
  if (status >= 500) return "Serviço InvoiceXpress indisponível. Tente novamente.";
  return `InvoiceXpress recusou o pedido (HTTP ${status}).`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
