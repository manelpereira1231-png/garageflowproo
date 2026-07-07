/**
 * moloni-emit — Emissão de fatura certificada via Moloni (API v1).
 *
 * Fluxo:
 *  1. JWT + ownership check.
 *  2. Carrega `invoices` + `invoice_items` + `clients` + `integracao_faturacao`.
 *  3. Garante access_token Moloni válido (refresh se expirou).
 *  4. Cria/reusa cliente Moloni (via getByVat, senão insert).
 *  5. Descobre document_set_id (série) e tax_id por taxa IVA.
 *  6. Cria/reusa produto genérico por descrição de linha.
 *  7. POST /invoices/insert/ com status=1 (fechado/emitido).
 *  8. GET PDF link e grava `atcud`, `provider_invoice_id`, `provider_pdf_url`, `number`.
 *
 * Requer segredos:
 *   MOLONI_CLIENT_ID, MOLONI_CLIENT_SECRET, BILLING_CRED_ENC_KEY
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
  let json: any = null;
  try { json = txt ? JSON.parse(txt) : null; } catch { /* ignore */ }
  if (!res.ok) {
    const msg = json?.error?.message || json?.error || txt.slice(0, 300);
    throw new Error(`Moloni ${path} falhou (${res.status}): ${msg}`);
  }
  return json;
}

async function refreshMoloniToken(refreshToken: string) {
  const clientId = Deno.env.get("MOLONI_CLIENT_ID")!;
  const clientSecret = Deno.env.get("MOLONI_CLIENT_SECRET")!;
  const url = `${MOLONI_BASE}/grant/?grant_type=refresh_token&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(clientSecret)}&refresh_token=${encodeURIComponent(refreshToken)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Refresh Moloni falhou (${res.status}). Reautentica a integração.`);
  return await res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    if (!Deno.env.get("MOLONI_CLIENT_ID") || !Deno.env.get("MOLONI_CLIENT_SECRET")) {
      return json({ error: "Moloni não configurado na plataforma. Contacta o suporte GarageFlow." }, 501);
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

    const { invoice_id } = await req.json();
    if (!invoice_id) return json({ error: "invoice_id obrigatório" }, 400);

    const { data: inv } = await admin
      .from("invoices").select("*, clients(*), invoice_items(*)").eq("id", invoice_id).maybeSingle();
    if (!inv) return json({ error: "Fatura não encontrada" }, 404);

    // 🔒 Ownership check ANTES de qualquer short-circuit (evita IDOR entre oficinas)
    const { data: ids } = await admin.rpc("get_user_shop_ids", { _user_id: user.id });
    const shopIds = Array.isArray(ids) ? ids.map((r: any) => r.get_user_shop_ids ?? r) : [];
    if (!shopIds.includes(inv.shop_id)) return json({ error: "Sem permissão nesta oficina" }, 403);

    if (inv.provider_invoice_id) {
      return json({ ok: true, provider_invoice_id: inv.provider_invoice_id, provider_pdf_url: inv.provider_pdf_url, number: inv.number, cached: true });
    }

    const { data: integ } = await admin.from("integracao_faturacao")
      .select("*").eq("shop_id", inv.shop_id).eq("provider", "moloni").maybeSingle();
    if (!integ || !integ.ativo) return json({ error: "Oficina não tem Moloni ativo em Definições → Faturação" }, 400);
    if (!integ.moloni_company_id) return json({ error: "Falta company_id Moloni na integração" }, 400);

    // Garantir token válido
    let accessToken = await decryptSecret(integ.api_key_encrypted);
    const expiresAt = integ.token_expires_at ? new Date(integ.token_expires_at).getTime() : 0;
    if (Date.now() > expiresAt - 60_000) {
      if (!integ.refresh_token_encrypted) return json({ error: "Token Moloni expirado — reautentica a integração" }, 401);
      const refresh = await decryptSecret(integ.refresh_token_encrypted);
      const grant = await refreshMoloniToken(refresh);
      accessToken = grant.access_token;
      const newRefresh = grant.refresh_token || refresh;
      const newExpiry = new Date(Date.now() + (Number(grant.expires_in) || 3600) * 1000).toISOString();
      await admin.from("integracao_faturacao").update({
        api_key_encrypted: await encryptSecret(accessToken),
        refresh_token_encrypted: await encryptSecret(newRefresh),
        token_expires_at: newExpiry,
      }).eq("id", integ.id);
    }

    const companyId = integ.moloni_company_id;
    const client = inv.clients as any;
    const items = (inv.invoice_items || []) as any[];
    if (items.length === 0) return json({ error: "Fatura sem linhas" }, 400);

    // 1) Cliente Moloni — procurar por VAT/NIF, senão criar
    let customerId: number | null = null;
    const vat = (client?.nif || "").replace(/\s/g, "");
    if (vat) {
      try {
        const found = await moloniPost("/customers/getByVat", { company_id: companyId, vat }, accessToken);
        if (Array.isArray(found) && found[0]?.customer_id) customerId = found[0].customer_id;
      } catch { /* not found */ }
    }
    if (!customerId) {
      const created = await moloniPost("/customers/insert", {
        company_id: companyId,
        vat: vat || "999999990",
        number: `GF-${(client?.id || "").slice(0, 8)}`,
        name: client?.company || client?.name || "Consumidor Final",
        language_id: 1, // PT
        address: client?.address || "Desconhecido",
        city: client?.city || "Desconhecido",
        zip_code: client?.postal_code || "0000-000",
        country_id: 1, // PT
        email: client?.email || undefined,
        phone: client?.phone || undefined,
        maturity_date_id: 1,
        payment_method_id: 1,
      }, accessToken);
      customerId = created?.customer_id;
      if (!customerId) throw new Error("Falha a criar cliente Moloni");
    }

    // 2) Series (document_set_id) — usar serie_default se fornecida, senão primeira ativa
    let documentSetId: number | null = integ.serie_default ? Number(integ.serie_default) : null;
    if (!documentSetId) {
      const sets = await moloniPost("/documentSets/getAll", { company_id: companyId }, accessToken);
      const active = Array.isArray(sets) ? sets.find((s: any) => s.active_by_default === 1) || sets[0] : null;
      documentSetId = active?.document_set_id;
      if (!documentSetId) throw new Error("Sem série de documentos disponível na Moloni");
    }

    // 3) Taxas — mapa taxa% → tax_id Moloni
    const taxes = await moloniPost("/taxes/getAll", { company_id: companyId }, accessToken);
    const taxByRate = new Map<number, number>();
    (taxes || []).forEach((t: any) => {
      const rate = Number(t.value);
      if (t.type === 1 && !taxByRate.has(rate)) taxByRate.set(rate, t.tax_id);
    });

    // 4) Produtos — criar um produto genérico por descrição (usando ProductCategoryID = 0 default)
    const products = await moloniPost("/products/getAll", { company_id: companyId, offset: 0, qty: 200 }, accessToken).catch(() => []);
    const productByRef = new Map<string, number>();
    (products || []).forEach((p: any) => { if (p.reference) productByRef.set(String(p.reference), p.product_id); });

    // Buscar unidade e categoria default
    let unitId = 1, categoryId = 1;
    try {
      const units = await moloniPost("/measurementUnits/getAll", { company_id: companyId }, accessToken);
      if (Array.isArray(units) && units[0]) unitId = units[0].unit_id;
    } catch { /* ignore */ }
    try {
      const cats = await moloniPost("/productCategories/getAll", { company_id: companyId, parent_id: 0 }, accessToken);
      if (Array.isArray(cats) && cats[0]) categoryId = cats[0].category_id;
    } catch { /* ignore */ }

    const productsPayload: any[] = [];
    for (const it of items) {
      const rate = Number(it.vat_rate) || 23;
      const taxId = taxByRate.get(rate);
      if (!taxId) throw new Error(`Taxa IVA ${rate}% não configurada na Moloni`);
      const ref = `GF-${(it.description || "SRV").slice(0, 32).replace(/[^\w\-]/g, "_")}`;
      let productId = productByRef.get(ref);
      if (!productId) {
        const p = await moloniPost("/products/insert", {
          company_id: companyId,
          category_id: categoryId,
          type: 1, // Serviço
          name: (it.description || "Serviço").slice(0, 200),
          reference: ref,
          price: Number(it.unit_price) || 0,
          unit_id: unitId,
          has_stock: 0,
          taxes: [{ tax_id: taxId, value: rate, order: 0, cumulative: 0 }],
        }, accessToken);
        productId = p?.product_id;
        productByRef.set(ref, productId!);
      }
      productsPayload.push({
        product_id: productId,
        name: (it.description || "Serviço").slice(0, 200),
        summary: "",
        qty: Number(it.quantity) || 1,
        price: Number(it.unit_price) || 0,
        discount: 0,
        order: productsPayload.length,
        taxes: [{ tax_id: taxId, value: rate, order: 0, cumulative: 0 }],
      });
    }

    // 5) Emitir fatura (status=1 = fechada/emitida — irreversível)
    const docType = integ.documento_default === "invoice_receipt" ? "invoiceReceipts"
      : integ.documento_default === "simplified_invoice" ? "simplifiedInvoices"
      : "invoices";
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = inv.due_date || today;
    const inserted = await moloniPost(`/${docType}/insert`, {
      company_id: companyId,
      customer_id: customerId,
      document_set_id: documentSetId,
      date: today,
      expiration_date: dueDate,
      products: productsPayload,
      status: 1,
      our_reference: inv.number || "",
      notes: inv.notes || "",
    }, accessToken);
    const providerDocId = inserted?.document_id;
    if (!providerDocId) throw new Error("Moloni não devolveu document_id");

    // 6) PDF link
    let pdfUrl: string | null = null;
    try {
      const pdf = await moloniPost(`/${docType}/getPDFLink`, { company_id: companyId, document_id: providerDocId }, accessToken);
      pdfUrl = pdf?.url || null;
    } catch { /* pdf pode não estar disponível imediatamente */ }

    // 7) Detalhes (ATCUD, número)
    let atcud: string | null = null;
    let providerNumber: string | null = null;
    try {
      const one = await moloniPost(`/${docType}/getOne`, { company_id: companyId, document_id: providerDocId }, accessToken);
      atcud = one?.atcud || null;
      providerNumber = one?.document_no || one?.number || null;
    } catch { /* ignore */ }

    const seriesFromNumber = (providerNumber || "").split("/")[0] || null;
    await admin.from("invoices").update({
      provider: "moloni",
      provider_invoice_id: String(providerDocId),
      provider_pdf_url: pdfUrl,
      atcud,
      certified_series: seriesFromNumber,
      number: providerNumber || inv.number,
      status: "issued",
      legal_status: "certified",
      emitida_em: new Date().toISOString(),
    }).eq("id", inv.id);

    return json({
      ok: true,
      provider_invoice_id: String(providerDocId),
      provider_pdf_url: pdfUrl,
      atcud,
      number: providerNumber,
    });
  } catch (e: any) {
    console.error("[moloni-emit]", e);
    return json({ error: e?.message || "Erro desconhecido" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
