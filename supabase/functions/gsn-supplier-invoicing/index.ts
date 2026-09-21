/**
 * gsn-supplier-invoicing
 * ----------------------
 * Faturação InvoiceXpress de CADA FORNECEDOR (GSN).
 * Não toca na faturação das oficinas (invoicexpress-connect / invoicexpress-emit).
 *
 * Ações:
 *   status      → estado real da ligação do fornecedor autenticado
 *   connect     → testa e grava credenciais (chave encriptada)
 *   disconnect  → desativa a ligação
 *   emit        → emite fatura real de UMA encomenda paga (idempotente)
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { encryptSecret, decryptSecret } from "../_shared/billing-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const IX_KIND: Record<string, { endpoint: string; bodyKey: string }> = {
  invoice: { endpoint: "invoices", bodyKey: "invoice" },
  invoice_receipt: { endpoint: "invoice_receipts", bodyKey: "invoice_receipt" },
  simplified_invoice: { endpoint: "simplified_invoices", bodyKey: "simplified_invoice" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const { data: u } = await admin.auth.getUser(auth.replace("Bearer ", ""));
    const user = u?.user;
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { data: sup } = await admin
      .from("gsn_suppliers")
      .select("id, company_name, trade_name, vat_number, email, address, postal_code, city, country")
      .eq("owner_user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();
    if (!sup) return json({ error: "Fornecedor não encontrado" }, 404);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");

    const loadIntegration = async () => {
      const { data } = await admin
        .from("integracao_faturacao")
        .select("*")
        .eq("supplier_id", sup.id)
        .maybeSingle();
      return data;
    };

    // ───────────────────────────── STATUS ─────────────────────────
    if (action === "status") {
      const row = await loadIntegration();
      return json({
        connected: !!row?.ativo,
        provider: row?.provider ?? null,
        account_name: row?.account_name ?? null,
        documento_default: row?.documento_default ?? null,
        serie_default: row?.serie_default ?? null,
        last_test_ok_at: row?.last_test_ok_at ?? null,
        last_error: row?.last_error ?? null,
      });
    }

    // ───────────────────────────── CONNECT ────────────────────────
    if (action === "connect") {
      const account_name = String(body.account_name || "").trim();
      const api_key = String(body.api_key || "").trim();
      const documento_default = ["invoice", "invoice_receipt", "simplified_invoice"].includes(body.documento_default)
        ? body.documento_default
        : "invoice_receipt";
      const serie_default = body.serie_default ? String(body.serie_default).trim() : null;
      if (!account_name || !api_key) return json({ error: "Nome da conta e chave API são obrigatórios" }, 400);

      const testUrl = `https://${account_name}.app.invoicexpress.com/sequences.json?api_key=${encodeURIComponent(api_key)}`;
      const test = await fetch(testUrl, { headers: { Accept: "application/json" } }).catch(() => null);
      if (!test || !test.ok) {
        return json({
          error: `O InvoiceXpress rejeitou as credenciais${test ? ` (HTTP ${test.status})` : ""}. Verifique o nome da conta e a chave API.`,
        }, 400);
      }

      const existing = await loadIntegration();
      const payload = {
        supplier_id: sup.id,
        shop_id: null,
        provider: "invoicexpress",
        account_name,
        api_key_encrypted: await encryptSecret(api_key),
        serie_default,
        documento_default,
        ativo: true,
        last_test_ok_at: new Date().toISOString(),
        last_error: null,
      };
      const { error } = existing
        ? await admin.from("integracao_faturacao").update(payload).eq("id", existing.id)
        : await admin.from("integracao_faturacao").insert(payload);
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true, connected: true, account_name });
    }

    // ─────────────────────────── DISCONNECT ───────────────────────
    if (action === "disconnect") {
      const row = await loadIntegration();
      if (row) await admin.from("integracao_faturacao").update({ ativo: false }).eq("id", row.id);
      return json({ ok: true, connected: false });
    }

    // ───────────────────────────── EMIT ───────────────────────────
    if (action === "emit") {
      const orderId = String(body.order_id || "");
      if (!orderId) return json({ error: "order_id em falta" }, 400);

      const row = await loadIntegration();
      if (!row?.ativo) return json({ error: "InvoiceXpress ainda não está ligado.", code: "not_connected" }, 409);

      const { data: order } = await admin
        .from("gsn_orders")
        .select("id, order_number, supplier_id, buyer_shop_id, subtotal, vat_total, shipping_total, discount_total, commission_total, total, currency, status")
        .eq("id", orderId)
        .maybeSingle();
      if (!order || order.supplier_id !== sup.id) return json({ error: "Encomenda não encontrada" }, 404);
      if (!["paid", "confirmed", "preparing", "shipped", "partial", "delivered"].includes(order.status)) {
        return json({ error: `A encomenda ainda não está paga (estado: ${order.status}).`, code: "not_paid" }, 409);
      }

      // Idempotência — nunca emitir duas vezes para a mesma encomenda.
      const { data: existingInv } = await admin
        .from("gsn_invoices").select("*").eq("order_id", orderId).maybeSingle();
      if (existingInv?.provider_invoice_id) {
        return json({ ok: true, already_issued: true, number: existingInv.number, pdf_url: existingInv.pdf_url });
      }

      const { data: items } = await admin
        .from("gsn_order_items").select("title, quantity, unit_price, vat").eq("order_id", orderId);

      let buyer: any = null;
      if (order.buyer_shop_id) {
        const { data } = await admin.from("shops")
          .select("name, nif, address, postal_code, city, email").eq("id", order.buyer_shop_id).maybeSingle();
        buyer = data;
      }

      const apiKey = await decryptSecret(row.api_key_encrypted);
      const base = `https://${row.account_name}.app.invoicexpress.com`;
      const kind = IX_KIND[row.documento_default] || IX_KIND.invoice_receipt;
      const today = new Date().toISOString().slice(0, 10);

      const payload: any = {
        [kind.bodyKey]: {
          date: today,
          due_date: today,
          reference: order.order_number || order.id,
          observations: `Encomenda GarageFlow Supplier Network ${order.order_number ?? ""}`.trim(),
          client: {
            name: (buyer?.name || "Cliente").slice(0, 254),
            code: (order.buyer_shop_id || order.id).slice(0, 30),
            email: buyer?.email || undefined,
            address: buyer?.address || undefined,
            postal_code: buyer?.postal_code || undefined,
            city: buyer?.city || undefined,
            fiscal_id: buyer?.nif || "999999990",
          },
          items: (items ?? []).map((it: any) => ({
            name: String(it.title ?? "Artigo").slice(0, 254),
            unit_price: Number(it.unit_price || 0),
            quantity: Number(it.quantity || 1),
            tax: { name: `IVA ${Number(it.vat ?? 23)}%` },
          })),
          ...(row.serie_default ? { sequence_id: row.serie_default } : {}),
        },
      };
      if (!payload[kind.bodyKey].items.length) return json({ error: "A encomenda não tem artigos" }, 400);

      const saveError = async (msg: string) => {
        await admin.from("integracao_faturacao").update({ last_error: msg.slice(0, 500) }).eq("id", row.id);
        if (existingInv) {
          await admin.from("gsn_invoices").update({ status: "error", last_error: msg.slice(0, 500) }).eq("id", existingInv.id);
        }
        return json({ ok: false, error: msg }, 400);
      };

      const createRes = await fetch(`${base}/${kind.endpoint}.json?api_key=${encodeURIComponent(apiKey)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
      });
      if (!createRes.ok) {
        return await saveError(`InvoiceXpress (criar) HTTP ${createRes.status}: ${(await createRes.text().catch(() => "")).slice(0, 300)}`);
      }
      const created = await createRes.json();
      const doc = created?.[kind.bodyKey] || created;
      const providerId = String(doc?.id ?? "");
      if (!providerId) return await saveError("O InvoiceXpress não devolveu o ID do documento");

      const finalizeRes = await fetch(
        `${base}/${kind.endpoint}/${providerId}/change-state.json?api_key=${encodeURIComponent(apiKey)}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ [kind.bodyKey]: { state: "finalized" } }),
        },
      );
      if (!finalizeRes.ok) {
        return await saveError(`InvoiceXpress (finalizar) HTTP ${finalizeRes.status}: ${(await finalizeRes.text().catch(() => "")).slice(0, 300)}`);
      }

      const getRes = await fetch(`${base}/${kind.endpoint}/${providerId}.json?api_key=${encodeURIComponent(apiKey)}`, {
        headers: { Accept: "application/json" },
      });
      const finalJson = await getRes.json().catch(() => ({}));
      const finalDoc = finalJson?.[kind.bodyKey] || finalJson;
      const number = finalDoc?.inverted_sequence_number || finalDoc?.sequence_number || null;
      const pdfUrl = finalDoc?.public_pdf_url || finalDoc?.pdf_url || null;

      const invoiceRow = {
        supplier_id: sup.id,
        order_id: order.id,
        buyer_shop_id: order.buyer_shop_id,
        number,
        subtotal: Number(order.subtotal || 0),
        vat_total: Number(order.vat_total || 0),
        shipping_total: Number(order.shipping_total || 0),
        discount_total: Number(order.discount_total || 0),
        commission_total: Number(order.commission_total || 0),
        total: Number(order.total || 0),
        currency: order.currency || "EUR",
        pdf_url: pdfUrl,
        provider: "invoicexpress",
        provider_invoice_id: providerId,
        status: "issued",
        issued_at: new Date().toISOString(),
        last_error: null,
      };
      const { error: invErr } = existingInv
        ? await admin.from("gsn_invoices").update(invoiceRow).eq("id", existingInv.id)
        : await admin.from("gsn_invoices").insert(invoiceRow);
      if (invErr) return json({ ok: false, error: invErr.message }, 500);

      await admin.from("integracao_faturacao").update({ last_error: null, last_test_ok_at: new Date().toISOString() }).eq("id", row.id);
      return json({ ok: true, number, pdf_url: pdfUrl, provider_invoice_id: providerId });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[gsn-supplier-invoicing]", e);
    return json({ error: (e as Error).message }, 500);
  }
});
